import os
import re
import base64
import json
import tempfile
import threading
import time
from datetime import datetime, timedelta
from typing import Optional, Any, List, Dict
from queue import Empty, Queue
from dotenv import load_dotenv

import librosa
import whisper
import uvicorn
import websocket as ws_client
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import Response, StreamingResponse
import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from twilio.twiml.voice_response import Start, VoiceResponse

from services.acoustics import analyze_audio, AcousticAnalysisResult
from services.wearable import (
    MockOuraRing,
    MockAppleWatch,
    MockDexcomG7,
    collect_snapshot,
    PROFILES as WEARABLE_PROFILES,
    set_profiles_source,
)
from services.consolidate import consolidate
from services.intelligence import (
    generate_predictive_risk_model,
    generate_lifestyle_coaching,
    handle_virtual_assistant,
    generate_smart_alert,
)
from services.history import (
    get_historical_vitality,
    get_hourly_vitality,
    get_signal_history,
    get_composite_timeline,
    get_event_timeline,
    get_week_comparison,
    compute_all_trends,
)
from services.symptom_extract import extract_symptoms
from services import db as db_service

_env_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(_env_dir), ".env"))

# ── Twilio / Deepgram config (optional — only active when env vars set) ───────
NGROK_URL = os.getenv("NGROK_URL", "").rstrip("/")
DEEPGRAM_KEY = os.getenv("DEEPGRAM_API_KEY")
OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY")

DEEPGRAM_URL = (
    "wss://api.deepgram.com/v1/listen"
    "?model=nova-2"
    "&encoding=mulaw"
    "&sample_rate=8000"
    "&channels=1"
    "&interim_results=true"
    "&smart_format=true"
    "&redact=pci"
    "&redact=ssn"
    "&redact=numbers"
    "&redact=email_address"
    "&redact=phone_number"
)

# ── SSE broadcast (for live call transcript → browser) ────────────────────────
_browser_queues: list[Queue] = []
_queues_lock = threading.Lock()


def _broadcast_call(data: dict):
    with _queues_lock:
        for q in _browser_queues:
            q.put(data)


# ── Per-call transcript accumulator ───────────────────────────────────────────
_call_transcripts: dict[str, list[str]] = {}
_transcripts_lock = threading.Lock()

VALID_PROFILES = {
    "follicular",
    "ovulation",
    "luteal_mild",
    "luteal_pms",
    "pmdd_crisis",
    "pcos_flare",
    "perimenopause",
    "baseline",
}


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = None


# --- Cycle History and Prediction Models ---
class PeriodEvent(BaseModel):
    startDate: str  # YYYY-MM-DD
    endDate: Optional[str] = None  # YYYY-MM-DD
    flow: Optional[str] = None  # light|medium|heavy
    notes: Optional[str] = None


class AddPeriodRequest(BaseModel):
    startDate: str
    endDate: Optional[str] = None
    flow: Optional[str] = None
    notes: Optional[str] = None


class SymptomEntryPayload(BaseModel):
    """Body map / symptom log entry (id and timestamp can be server-generated)."""
    region: str
    type: str
    severity: int
    qualities: List[str] = []
    timing: str = ""
    triggers: List[str] = []
    notes: str = ""


class AppointmentCreate(BaseModel):
    """Request to create an appointment (patient schedules)."""
    date: str  # YYYY-MM-DD
    time: str  # e.g. "09:00" or "9:00 AM"
    type: str = "Visit"  # reason / visit type
    patient_name: Optional[str] = None  # display name; can be set by frontend


# In-memory fallback when MONGODB_URI is not set
_cycle_periods: List[PeriodEvent] = []
_symptom_logs: List[Dict[str, Any]] = []
_appointments: List[Dict[str, Any]] = []


def _period_dict_to_model(d: Dict[str, Any]) -> PeriodEvent:
    return PeriodEvent(
        startDate=d["startDate"],
        endDate=d.get("endDate"),
        flow=d.get("flow"),
        notes=d.get("notes"),
    )


async def _get_cycle_periods_list() -> List[PeriodEvent]:
    if db_service.MONGODB_URI:
        rows = await db_service.db_get_cycle_periods()
        return [_period_dict_to_model({k: v for k, v in r.items() if k != "_id"}) for r in rows]
    return _cycle_periods


async def _get_symptom_logs(days: int = 30) -> List[Dict[str, Any]]:
    if db_service.MONGODB_URI:
        cutoff = (datetime.utcnow() - timedelta(days=max(1, min(days, 365)))).isoformat() + "Z"
        return await db_service.db_get_symptoms(cutoff)
    return _symptom_logs


async def _get_appointments_list(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
) -> List[Dict[str, Any]]:
    if db_service.MONGODB_URI:
        return await db_service.db_get_appointments(from_date, to_date)
    out = list(_appointments)
    if from_date:
        out = [a for a in out if (a.get("date") or "") >= from_date]
    if to_date:
        out = [a for a in out if (a.get("date") or "") <= to_date]
    out.sort(key=lambda a: (a.get("date", ""), a.get("time", "")))
    return out


print("     Loading AI models...")
_whisper_model = whisper.load_model("base")
print("     Models loaded.")

app = FastAPI(
    title="Vitality - Women's Health Intelligence API",
    description=(
        "Multimodal biometric and vocal biomarker platform for proactive "
        "management of PMDD, PCOS, and endometriosis."
    ),
    version="1.0.0",
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_latest_acoustic: Optional[AcousticAnalysisResult] = None
_latest_transcript: Optional[str] = None
_latest_consolidated: Optional[Any] = None
_wearable_profile: str = "follicular"

_apple_watch = MockAppleWatch(profile=_wearable_profile)
_oura_ring = MockOuraRing(profile=_wearable_profile)
_dexcom = MockDexcomG7(profile=_wearable_profile)


def _seed_sample_data():
    """Sample data to push to MongoDB when collections are empty (no more in-code mock data)."""
    now = datetime.utcnow()
    base_ts = (now - timedelta(days=30)).isoformat() + "Z"
    return {
        "sample_periods": [
            {"startDate": "2025-01-06", "endDate": "2025-01-10", "flow": "medium", "notes": ""},
            {"startDate": "2025-02-03", "endDate": "2025-02-07", "flow": "medium", "notes": ""},
            {"startDate": "2025-02-20", "endDate": "2025-02-24", "flow": "light", "notes": ""},
        ],
        "sample_symptoms": [
            {"id": "s_seed_1", "timestamp": base_ts, "region": "pelvic_midline", "type": "cramping", "severity": 4, "qualities": [], "timing": "", "triggers": [], "notes": ""},
            {"id": "s_seed_2", "timestamp": (now - timedelta(days=14)).isoformat() + "Z", "region": "lower_back", "type": "pain", "severity": 3, "qualities": [], "timing": "", "triggers": [], "notes": ""},
            {"id": "s_seed_3", "timestamp": (now - timedelta(days=7)).isoformat() + "Z", "region": "head", "type": "headache", "severity": 5, "qualities": [], "timing": "", "triggers": [], "notes": ""},
            {"id": "s_seed_4", "timestamp": (now - timedelta(days=3)).isoformat() + "Z", "region": "pelvic_midline", "type": "bloating", "severity": 3, "qualities": [], "timing": "", "triggers": [], "notes": ""},
            {"id": "s_seed_5", "timestamp": (now - timedelta(days=1)).isoformat() + "Z", "region": "chest", "type": "tenderness", "severity": 4, "qualities": [], "timing": "", "triggers": [], "notes": ""},
        ],
        "sample_appointments": [
            {"id": "apt_seed_1", "date": (now + timedelta(days=7)).strftime("%Y-%m-%d"), "time": "10:00", "type": "Visit", "patient_name": "Patient"},
            {"id": "apt_seed_2", "date": (now + timedelta(days=14)).strftime("%Y-%m-%d"), "time": "14:00", "type": "Follow-up", "patient_name": "Patient"},
            {"id": "apt_seed_3", "date": (now + timedelta(days=21)).strftime("%Y-%m-%d"), "time": "09:00", "type": "Visit", "patient_name": "Patient"},
        ],
    }


@app.on_event("startup")
async def startup_load_profile():
    global _wearable_profile, _apple_watch, _oura_ring, _dexcom, VALID_PROFILES
    if db_service.MONGODB_URI:
        try:
            seed_data = _seed_sample_data()
            await db_service.db_seed_initial(
                WEARABLE_PROFILES,
                sample_periods=seed_data["sample_periods"],
                sample_symptoms=seed_data["sample_symptoms"],
                sample_appointments=seed_data["sample_appointments"],
            )
            _wearable_profile = await db_service.db_get_wearable_profile()
            all_profiles = await db_service.db_get_all_profiles()
            if all_profiles:
                set_profiles_source(all_profiles)
                VALID_PROFILES.clear()
                VALID_PROFILES.update(all_profiles.keys())
            _apple_watch = MockAppleWatch(profile=_wearable_profile)
            _oura_ring = MockOuraRing(profile=_wearable_profile)
            _dexcom = MockDexcomG7(profile=_wearable_profile)
            print(f"     MongoDB: seeded data; profile '{_wearable_profile}'; {len(all_profiles)} profiles from DB")
        except Exception as e:
            print(f"     MongoDB startup warning: {e}")


def _resolve_profile(profile: Optional[str]) -> str:
    return profile if profile and profile in VALID_PROFILES else _wearable_profile


async def _ensure_consolidated(profile: Optional[str] = None) -> Any:
    """Rebuild consolidated result if needed (uses DB when MONGODB_URI set)."""
    global _latest_consolidated
    prof = _resolve_profile(profile)
    if profile or not _latest_consolidated:
        snapshot = collect_snapshot(profile=prof)
        periods = await _get_cycle_periods_list()
        symptom_logs = await _get_symptom_logs(30)
        _latest_consolidated = consolidate(
            acoustic_result=_latest_acoustic,
            wearable_snapshot=snapshot,
            profile=prof,
            symptom_logs=symptom_logs,
            cycle_periods_context=_cycle_periods_context(periods),
        )
    return _latest_consolidated


# --- Cycle Helper Functions ---
def _parse_date_ymd(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%d")


def _cycle_stats(periods: List[PeriodEvent]) -> Dict[str, Any]:
    if len(periods) < 2:
        return {
            "median_cycle_length": None,
            "variability_days": None,
            "median_period_length": None,
            "confidence": "low",
        }

    starts = [_parse_date_ymd(p.startDate) for p in periods]
    cycle_lengths = []
    for i in range(len(starts) - 1):
        cycle_lengths.append((starts[i + 1] - starts[i]).days)

    cycle_lengths_sorted = sorted(cycle_lengths)
    mid = len(cycle_lengths_sorted) // 2
    if len(cycle_lengths_sorted) % 2 == 1:
        median_cycle = cycle_lengths_sorted[mid]
    else:
        median_cycle = (cycle_lengths_sorted[mid - 1] + cycle_lengths_sorted[mid]) / 2

    mad = sum(abs(cl - median_cycle) for cl in cycle_lengths) / len(cycle_lengths)

    period_lengths = []
    for p in periods:
        if p.endDate:
            period_lengths.append((_parse_date_ymd(p.endDate) - _parse_date_ymd(p.startDate)).days + 1)

    median_period = None
    if period_lengths:
        pl = sorted(period_lengths)
        m2 = len(pl) // 2
        median_period = pl[m2] if len(pl) % 2 == 1 else (pl[m2 - 1] + pl[m2]) / 2

    if mad <= 1.5:
        conf = "high"
    elif mad <= 3.5:
        conf = "medium"
    else:
        conf = "low"

    return {
        "median_cycle_length": median_cycle,
        "variability_days": round(mad, 2),
        "median_period_length": median_period,
        "confidence": conf,
    }


def _cycle_predictions(periods: List[PeriodEvent]) -> Dict[str, Any]:
    if not periods:
        return {"next_period_start": None, "ovulation_date": None}

    periods_sorted = sorted(periods, key=lambda p: p.startDate)
    last_start = _parse_date_ymd(periods_sorted[-1].startDate)
    stats = _cycle_stats(periods_sorted)

    cycle_len = stats["median_cycle_length"]
    if cycle_len is None:
        cycle_len = 28

    next_start = datetime(last_start.year, last_start.month, last_start.day)
    next_start = next_start.replace(hour=0, minute=0, second=0, microsecond=0)
    next_start = next_start + timedelta(days=int(round(cycle_len)))

    ovulation = next_start - timedelta(days=14)

    return {
        "next_period_start": next_start.strftime("%Y-%m-%d"),
        "ovulation_date": ovulation.strftime("%Y-%m-%d"),
    }


def _cycle_periods_context(periods: List[PeriodEvent]) -> Dict[str, Any]:
    """Derive cycle day and phase from logged periods for pipeline context."""
    if not periods:
        return {"cycle_day": None, "phase_estimate": None, "in_period": False}
    periods_sorted = sorted(periods, key=lambda p: p.startDate)
    last = periods_sorted[-1]
    last_start = _parse_date_ymd(last.startDate)
    stats = _cycle_stats(periods_sorted)
    cycle_len = stats.get("median_cycle_length") or 28
    cycle_len = int(round(cycle_len))
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    start_naive = last_start.replace(hour=0, minute=0, second=0, microsecond=0)
    days_since_start = (today - start_naive).days
    if days_since_start < 0:
        days_since_start = (days_since_start % cycle_len) if cycle_len else 0
    cycle_day = (days_since_start % cycle_len) + 1 if cycle_len else 1

    end_naive = _parse_date_ymd(last.endDate).replace(hour=0, minute=0, second=0, microsecond=0) if last.endDate else start_naive + timedelta(days=4)
    in_period = start_naive <= today <= end_naive

    if cycle_day <= 5 or in_period:
        phase_estimate = "follicular"
    elif cycle_day <= 13:
        phase_estimate = "follicular"
    elif cycle_day <= 15:
        phase_estimate = "ovulation"
    elif cycle_day <= 21:
        phase_estimate = "luteal_mild"
    else:
        phase_estimate = "luteal_pms"

    return {
        "cycle_day": cycle_day,
        "phase_estimate": phase_estimate,
        "in_period": in_period,
        "median_cycle_length": stats.get("median_cycle_length"),
    }


def transcribe(file_path: str) -> str:
    print("     Transcribing voice...")
    audio, _ = librosa.load(file_path, sr=16000, mono=True)
    return _whisper_model.transcribe(audio, fp16=False)["text"].strip()


@app.post("/analyze")
async def analyze_voice(file: UploadFile = File(...)):
    global _latest_acoustic, _latest_transcript

    tmp_path = None
    try:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        content = await file.read()
        tmp.write(content)
        tmp.close()
        tmp_path = tmp.name

        print(f"\n🎙️  Processing: {file.filename}")

        acoustics_result = analyze_audio(tmp_path)
        transcript = transcribe(tmp_path)

        _latest_acoustic = acoustics_result
        _latest_transcript = transcript

        return {
            "status": "success",
            "transcript": transcript,
            "analysis": acoustics_result.to_dict(),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.post("/call-triage")
async def call_triage(file: UploadFile = File(...)):
    tmp_path = None
    try:
        ext = os.path.splitext(file.filename or "")[1] or ".wav"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        content = await file.read()
        tmp.write(content)
        tmp.close()
        tmp_path = tmp.name
        transcript = transcribe(tmp_path)
        extraction = extract_symptoms(transcript)
        return {
            "status": "success",
            "transcript": transcript,
            "extraction": extraction,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.get("/consolidated")
async def get_consolidated(
    profile: Optional[str] = Query(default=None),
):
    global _latest_consolidated
    try:
        prof = _resolve_profile(profile)
        snapshot = collect_snapshot(profile=prof)
        periods = await _get_cycle_periods_list()
        symptom_logs = await _get_symptom_logs(30)
        result = consolidate(
            acoustic_result=_latest_acoustic,
            wearable_snapshot=snapshot,
            profile=prof,
            symptom_logs=symptom_logs,
            cycle_periods_context=_cycle_periods_context(periods),
        )
        _latest_consolidated = result

        return {
            "status": "success",
            "vitality_index": result.vitality_index,
            "tier": {
                "id": result.tier_id,
                "label": result.tier_label,
                "action": result.tier_action,
            },
            "summary": result.summary,
            "flags": result.flags,
            "contributing_factors": result.contributing_factors,
            "signals": result.signals,
            "trend_context": result.trend_context,
            "has_voice_data": _latest_acoustic is not None,
            "has_wearable_data": True,
            "cycle_state": prof,
            "transcript": _latest_transcript,
            "timestamp": result.timestamp,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/consolidated")
async def post_consolidated(
    file: UploadFile = File(None),
    profile: Optional[str] = Query(default=None),
):
    global _latest_acoustic, _latest_transcript, _latest_consolidated

    tmp_path = None
    try:
        if file and file.filename:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
            content = await file.read()
            tmp.write(content)
            tmp.close()
            tmp_path = tmp.name

            print(f"\n🎙️  Processing: {file.filename}")
            _latest_acoustic = analyze_audio(tmp_path)
            _latest_transcript = transcribe(tmp_path)

        prof = _resolve_profile(profile)
        snapshot = collect_snapshot(profile=prof)
        periods = await _get_cycle_periods_list()
        symptom_logs = await _get_symptom_logs(30)
        result = consolidate(
            acoustic_result=_latest_acoustic,
            wearable_snapshot=snapshot,
            profile=prof,
            symptom_logs=symptom_logs,
            cycle_periods_context=_cycle_periods_context(periods),
        )
        _latest_consolidated = result

        return {
            "status": "success",
            "vitality_index": result.vitality_index,
            "tier": {
                "id": result.tier_id,
                "label": result.tier_label,
                "action": result.tier_action,
            },
            "summary": result.summary,
            "flags": result.flags,
            "contributing_factors": result.contributing_factors,
            "signals": result.signals,
            "trend_context": result.trend_context,
            "cycle_state": prof,
            "transcript": _latest_transcript,
            "timestamp": result.timestamp,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.get("/status")
async def get_status():
    prof = _wearable_profile
    snapshot = collect_snapshot(profile=prof)
    periods = await _get_cycle_periods_list()
    symptom_logs = await _get_symptom_logs(30)
    result = consolidate(
        acoustic_result=_latest_acoustic,
        wearable_snapshot=snapshot,
        profile=prof,
        symptom_logs=symptom_logs,
        cycle_periods_context=_cycle_periods_context(periods),
    )

    return {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "cycle_state": prof,
        "vitality": {
            "index": result.vitality_index,
            "tier_id": result.tier_id,
            "tier_label": result.tier_label,
            "tier_action": result.tier_action,
            "flags": result.flags,
            "summary": result.summary,
        },
        "trend_context": result.trend_context,
        "wearable": {
            "apple_watch": _apple_watch.get_next_reading(),
            "oura_ring": _oura_ring.get_next_reading(),
            "dexcom_g7": _dexcom.get_next_reading(),
        },
        "voice": {
            "available": _latest_acoustic is not None,
            "transcript": _latest_transcript,
            "vibe": _latest_acoustic.vibe if _latest_acoustic else None,
            "distress_score": _latest_acoustic.distress_score if _latest_acoustic else None,
        },
    }


@app.get("/cycle/periods")
async def get_cycle_periods():
    periods = await _get_cycle_periods_list()
    periods_sorted = sorted(periods, key=lambda p: p.startDate)
    stats = _cycle_stats(periods_sorted)
    preds = _cycle_predictions(periods_sorted)

    return {
        "status": "success",
        "periods": [p.dict() for p in periods_sorted],
        "stats": stats,
        "predictions": preds,
    }


@app.post("/cycle/periods")
async def add_cycle_period(req: AddPeriodRequest):
    if db_service.MONGODB_URI:
        await db_service.db_upsert_cycle_period(
            req.startDate, req.endDate, req.flow, req.notes
        )
    else:
        global _cycle_periods
        if any(p.startDate == req.startDate for p in _cycle_periods):
            _cycle_periods = [p for p in _cycle_periods if p.startDate != req.startDate]
        _cycle_periods.append(PeriodEvent(
            startDate=req.startDate,
            endDate=req.endDate,
            flow=req.flow,
            notes=req.notes,
        ))
    periods = await _get_cycle_periods_list()
    periods_sorted = sorted(periods, key=lambda p: p.startDate)
    stats = _cycle_stats(periods_sorted)
    preds = _cycle_predictions(periods_sorted)
    return {
        "status": "success",
        "periods": [p.dict() for p in periods_sorted],
        "stats": stats,
        "predictions": preds,
    }


@app.get("/symptoms")
async def get_symptoms(days: int = 30):
    """Return recent body-map symptom logs for pipeline and display."""
    recent = await _get_symptom_logs(max(1, min(days, 365)))
    return {"status": "success", "symptoms": recent, "count": len(recent)}


@app.post("/symptoms")
async def add_symptom(entry: SymptomEntryPayload):
    """Append one body-map symptom log (from Body Map / SymptomContext)."""
    rec = {
        "id": f"s{datetime.utcnow().timestamp():.0f}",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "region": entry.region,
        "type": entry.type,
        "severity": entry.severity,
        "qualities": entry.qualities,
        "timing": entry.timing,
        "triggers": entry.triggers,
        "notes": entry.notes,
    }
    if db_service.MONGODB_URI:
        await db_service.db_add_symptom(rec)
        # PyMongo mutates rec and adds _id: ObjectId; make JSON-serializable
        return {"status": "success", "symptom": db_service._to_json_safe(rec)}
    else:
        global _symptom_logs
        _symptom_logs.append(rec)
    return {"status": "success", "symptom": rec}


@app.post("/symptoms/bulk")
async def add_symptoms_bulk(entries: List[SymptomEntryPayload]):
    """Sync multiple symptom entries (e.g. on app load)."""
    recs = []
    for entry in entries:
        recs.append({
            "id": f"s{datetime.utcnow().timestamp():.0f}",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "region": entry.region,
            "type": entry.type,
            "severity": entry.severity,
            "qualities": entry.qualities,
            "timing": entry.timing,
            "triggers": entry.triggers,
            "notes": entry.notes,
        })
    if db_service.MONGODB_URI:
        await db_service.db_add_symptoms_bulk(recs)
    else:
        global _symptom_logs
        _symptom_logs.extend(recs)
    return {"status": "success", "count": len(entries)}


@app.get("/calendar/appointments")
async def get_appointments(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
):
    """Return scheduled appointments. Optional from_date/to_date (YYYY-MM-DD) to filter."""
    out = await _get_appointments_list(from_date, to_date)
    return {"status": "success", "appointments": out}


@app.post("/calendar/appointments")
async def create_appointment(body: AppointmentCreate):
    """Patient schedules an appointment; shows on clinician calendar."""
    rec = {
        "id": f"apt_{datetime.utcnow().timestamp():.0f}",
        "date": body.date,
        "time": body.time,
        "type": body.type or "Visit",
        "patient_name": body.patient_name or "Patient",
    }
    if db_service.MONGODB_URI:
        await db_service.db_add_appointment(rec)
    else:
        global _appointments
        _appointments.append(rec)
    return {"status": "success", "appointment": rec}


@app.get("/settings/profiles")
async def get_profiles():
    """Return list of cycle/profile ids and labels (from DB when connected, else built-in)."""
    if db_service.MONGODB_URI:
        all_p = await db_service.db_get_all_profiles()
        return {"profiles": [{"id": pid, "label": (p.get("label") or pid.replace("_", " ").title())} for pid, p in all_p.items()]}
    return {"profiles": [{"id": pid, "label": WEARABLE_PROFILES.get(pid, {}).get("label", pid.replace("_", " ").title())} for pid in sorted(VALID_PROFILES)]}


@app.put("/settings/wearable-profile")
async def set_wearable_profile(profile: str = Query(...)):
    global _wearable_profile, _apple_watch, _oura_ring, _dexcom

    if profile not in VALID_PROFILES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid profile. Choose from: {sorted(VALID_PROFILES)}",
        )

    if db_service.MONGODB_URI:
        await db_service.db_set_wearable_profile(profile)
    _wearable_profile = profile
    _apple_watch = MockAppleWatch(profile=profile)
    _oura_ring = MockOuraRing(profile=profile)
    _dexcom = MockDexcomG7(profile=profile)

    return {"status": "ok", "cycle_state": profile}


@app.websocket("/ws/wearable")
async def wearable_stream(websocket: WebSocket):
    await websocket.accept()
    print("     Client connected to wearable stream")

    try:
        while True:
            data = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "cycle_state": _wearable_profile,
                "apple_watch": _apple_watch.get_next_reading(),
                "oura_ring": _oura_ring.get_next_reading(),
                "dexcom_g7": _dexcom.get_next_reading(),
            }
            await websocket.send_json(data)
            await asyncio.sleep(1.0)

    except WebSocketDisconnect:
        print("     Client disconnected from wearable stream")


@app.get("/intelligence/forecast")
async def get_forecast(profile: Optional[str] = Query(default=None)):
    try:
        result = await _ensure_consolidated(profile)
        return {"status": "success", "data": generate_predictive_risk_model(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/intelligence/coaching")
async def get_coaching_plan(profile: Optional[str] = Query(default=None)):
    try:
        result = await _ensure_consolidated(profile)
        return {"status": "success", "data": generate_lifestyle_coaching(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/intelligence/chat")
async def chat_with_assistant(req: ChatRequest, profile: Optional[str] = Query(default=None)):
    try:
        result = await _ensure_consolidated(profile)
        reply = handle_virtual_assistant(
            user_message=req.message,
            vitality_result=result,
            transcript=_latest_transcript,
            history=req.history or [],
        )
        return {"status": "success", "response": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/intelligence/alert")
async def get_smart_alert(profile: Optional[str] = Query(default=None)):
    try:
        result = await _ensure_consolidated(profile)
        return {"status": "success", "data": generate_smart_alert(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/history/vitality")
async def history_vitality(profile: Optional[str] = Query(default=None), days: int = Query(default=30, ge=1, le=365)):
    prof = _resolve_profile(profile)
    return {"profile": prof, "days": days, "history": get_historical_vitality(prof, days)}


@app.get("/history/hourly")
async def history_hourly(profile: Optional[str] = Query(default=None), hours: int = Query(default=48, ge=1, le=168)):
    prof = _resolve_profile(profile)
    return {"profile": prof, "hours": hours, "history": get_hourly_vitality(prof, hours)}


@app.get("/history/signal/{signal_name}")
async def history_signal(signal_name: str, profile: Optional[str] = Query(default=None), days: int = Query(default=30, ge=1, le=365)):
    prof = _resolve_profile(profile)
    data = get_signal_history(prof, signal_name, days)
    if data and "error" in data[0]:
        raise HTTPException(status_code=400, detail=data[0]["error"])
    return {"profile": prof, "signal": signal_name, "days": days, "history": data}


@app.get("/history/timeline")
async def history_timeline(profile: Optional[str] = Query(default=None), days: int = Query(default=30, ge=1, le=365)):
    prof = _resolve_profile(profile)
    return get_composite_timeline(prof, days)


@app.get("/history/events")
async def history_events(profile: Optional[str] = Query(default=None)):
    prof = _resolve_profile(profile)
    return {"profile": prof, "events": get_event_timeline(prof)}


@app.get("/history/trends")
async def history_trends(profile: Optional[str] = Query(default=None), days: int = Query(default=30, ge=1, le=365)):
    prof = _resolve_profile(profile)
    return {"profile": prof, "days": days, "trends": compute_all_trends(prof, days)}


@app.get("/history/week-comparison")
async def history_week_comparison(profile: Optional[str] = Query(default=None)):
    prof = _resolve_profile(profile)
    return get_week_comparison(prof)


# ═══════════════════════════════════════════════════════════════════════════════
# Twilio Call Intake — Voice webhook, Deepgram STT, rule triage, LLM extraction
# ═══════════════════════════════════════════════════════════════════════════════

_EMERGENCY_PATTERNS = [
    r"soak\w*\s+(pad|tampon)",
    r"can.?t\s+breath",
    r"faint\w*|syncop\w*|pass(?:ing|ed)\s+out|collaps\w+",
    r"severe\s+bleed",
    r"preg\w+.{0,60}\bbleed\w*\b|\bbleed\w*\b.{0,60}preg\w+",
    r"preg\w+.{0,60}\bpain\b|\bpain\b.{0,60}preg\w+",
    r"\bfever\b.{0,25}pelvic|pelvic.{0,25}\bfever\b",
    r"\b(10|9)\s*(?:out\s*of\s*(?:10|ten)|/\s*10)\b",
    r"help\s+me.{0,20}(bleed\w*|pain|nausea|hurt)",
]

_URGENT_PATTERNS = [
    r"\bfever\b",
    r"foul\s*(?:smell|discharge|odor)",
    r"after\s+iud|iud\s+pain",
    r"dizz\w+|lightheaded",
    r"\b(7|8)\s*(?:out\s*of\s*(?:10|ten)|/\s*10)\b",
    r"nausea\w*\s+and\s+vomit|vomit\w*\s+and\s+nausea",
    r"heavy\s+bleed",
]

_ROUTINE_PATTERNS = [
    r"\b(4|5|6)\s*(?:out\s*of\s*(?:10|ten)|/\s*10)\b",
    r"\b(week|weeks|month|months)\b.{0,20}\bpain\b",
    r"irregular\s+period",
    r"\bcramp\w+\b",
    r"\bdiscomfort\b",
]

_TRIAGE_DEFS = {
    "emergency": {
        "level": "emergency",
        "label": "Emergency",
        "color": "#ef4444",
        "bg": "#2d0c0c",
        "action": "Call 911 or go to the Emergency Room immediately.",
    },
    "urgent": {
        "level": "urgent",
        "label": "Same-Day Urgent",
        "color": "#f97316",
        "bg": "#2a1200",
        "action": "Contact your healthcare provider today for a same-day appointment.",
    },
    "routine": {
        "level": "routine",
        "label": "Routine Follow-Up",
        "color": "#eab308",
        "bg": "#1e1500",
        "action": "Schedule an appointment within the next few days.",
    },
    "self_care": {
        "level": "self_care",
        "label": "Self-Care & Monitor",
        "color": "#22c55e",
        "bg": "#061a0e",
        "action": "Monitor your symptoms. Seek care if they worsen or new symptoms appear.",
    },
}


def _match_any(patterns: list, text: str) -> Optional[str]:
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(0)
    return None


def rule_triage(text: str) -> dict:
    hit = _match_any(_EMERGENCY_PATTERNS, text)
    if hit:
        t = dict(_TRIAGE_DEFS["emergency"])
        t["reason"] = f'Red-flag phrase detected: "{hit}"'
        return t

    hit = _match_any(_URGENT_PATTERNS, text)
    if hit:
        t = dict(_TRIAGE_DEFS["urgent"])
        t["reason"] = f'Urgency indicator: "{hit}"'
        return t

    m = re.search(r"(\d+)\s*(?:out\s*of\s*(?:10|ten)|/\s*10)", text, re.IGNORECASE)
    if m:
        sev = int(m.group(1))
        if sev >= 9:
            t = dict(_TRIAGE_DEFS["emergency"])
            t["reason"] = f"Severity reported as {sev}/10"
            return t
        if sev >= 7:
            t = dict(_TRIAGE_DEFS["urgent"])
            t["reason"] = f"Severity reported as {sev}/10"
            return t
        if sev >= 4:
            t = dict(_TRIAGE_DEFS["routine"])
            t["reason"] = f"Severity reported as {sev}/10"
            return t

    hit = _match_any(_ROUTINE_PATTERNS, text)
    if hit:
        t = dict(_TRIAGE_DEFS["routine"])
        t["reason"] = f'Symptom indicator: "{hit}"'
        return t

    t = dict(_TRIAGE_DEFS["self_care"])
    t["reason"] = "No urgent flags detected in transcript."
    return t


_EXTRACTION_PROMPT = """\
You are a clinical intake assistant extracting structured data from a patient's spoken symptom description.

Return ONLY a valid JSON object with these exact fields (use null for unknown):
{
  "summary": "<one-sentence chief complaint>",
  "symptoms": ["<symptom1>", "..."],
  "body_regions": ["<region>"],
  "severity": <integer 0-10 or null>,
  "onset": "<when symptoms started or null>",
  "duration": "<how long or null>",
  "bleeding": <true | false | null>,
  "bleeding_amount": "<description or null>",
  "pregnancy_status": "<positive | negative | unknown>",
  "fever": <true | false | null>,
  "triggers": ["<trigger1>", "..."],
  "other_notes": "<anything else relevant or null>"
}

Patient transcript:
"""


def llm_extract(text: str) -> dict:
    if not OPENROUTER_KEY:
        return {"summary": "LLM extraction unavailable (configure OPENROUTER_API_KEY).", "error": "no_key"}

    try:
        import openai
        client = openai.OpenAI(
            api_key=OPENROUTER_KEY,
            base_url="https://openrouter.ai/api/v1",
            default_headers={"HTTP-Referer": "https://haxxess.app"},
        )
        resp = client.chat.completions.create(
            model="google/gemini-2.0-flash-exp:free",
            messages=[
                {"role": "system", "content": "You extract medical intake data. Return only valid JSON."},
                {"role": "user", "content": _EXTRACTION_PROMPT + text},
            ],
            temperature=0,
            max_tokens=600,
        )
        raw = resp.choices[0].message.content.strip()
        raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()
        return json.loads(raw)
    except Exception as e:
        print(f"LLM extraction error: {e}")
        return {"summary": "Extraction failed.", "error": str(e)}


def _extract_and_triage(call_sid: str):
    """Background thread: runs after a Twilio call ends."""
    _broadcast_call({"type": "processing", "call_sid": call_sid})

    with _transcripts_lock:
        lines = list(_call_transcripts.get(call_sid, []))

    full_text = " ".join(lines).strip()
    print(f"Processing transcript ({len(full_text)} chars) for {call_sid}")

    if not full_text:
        _broadcast_call({
            "type": "case_ready",
            "call_sid": call_sid,
            "transcript": "",
            "triage": {**_TRIAGE_DEFS["self_care"], "reason": "No speech captured."},
            "entities": {"summary": "No speech was detected during this call."},
        })
        return

    triage = rule_triage(full_text)
    entities = llm_extract(full_text)

    print(f"Triage [{call_sid}]: {triage['level']} — {triage['reason']}")

    _broadcast_call({
        "type": "case_ready",
        "call_sid": call_sid,
        "transcript": full_text,
        "triage": triage,
        "entities": entities,
    })

    with _transcripts_lock:
        _call_transcripts.pop(call_sid, None)


INTAKE_PROMPT = (
    "Hello. You have reached the symptom intake line. "
    "After this message, please describe your symptoms freely. "
    "Tell me where you feel discomfort, how severe it is on a scale of zero to ten, "
    "and how long you have been experiencing this. "
    "You may also mention any fever, bleeding, nausea, pregnancy, or other concerns. "
    "Take your time — I am listening."
)


@app.post("/voice")
async def twilio_voice_webhook():
    """Twilio voice webhook — returns TwiML that starts a media stream."""
    wss_url = NGROK_URL.replace("https://", "wss://")

    resp = VoiceResponse()
    resp.say(INTAKE_PROMPT, voice="alice")

    start = Start()
    start.stream(url=f"{wss_url}/media-stream")
    resp.append(start)

    resp.pause(length=75)

    resp.say(
        "Thank you. Your symptoms have been recorded and are being analyzed. "
        "You may hang up now.",
        voice="alice",
    )
    resp.pause(length=5)
    return Response(content=str(resp), media_type="text/xml")


@app.websocket("/media-stream")
async def twilio_media_stream(ws: WebSocket):
    """Twilio media stream → Deepgram Nova-2 real-time STT."""
    await ws.accept()
    print("Twilio media stream connected")

    call_sid_ref: list[Optional[str]] = [None]
    dg_ws_ref: list = [None]

    def on_dg_open(dg):
        dg_ws_ref[0] = dg
        print("Deepgram connection open")

    def on_dg_message(dg, message):
        data = json.loads(message)
        if data.get("type") != "Results":
            return
        alts = data.get("channel", {}).get("alternatives", [{}])
        transcript = alts[0].get("transcript", "") if alts else ""
        is_final = data.get("is_final", False)
        if not transcript:
            return

        if is_final and call_sid_ref[0]:
            with _transcripts_lock:
                _call_transcripts.setdefault(call_sid_ref[0], []).append(transcript)

        _broadcast_call({
            "type": "transcript",
            "text": transcript,
            "is_final": is_final,
            "call_sid": call_sid_ref[0],
        })

    def on_dg_error(dg, error):
        print(f"Deepgram error: {error}")
        _broadcast_call({"type": "error", "message": str(error)})

    def on_dg_close(dg, close_status_code, close_msg):
        print(f"Deepgram closed: {close_status_code} {close_msg}")

    dg = ws_client.WebSocketApp(
        DEEPGRAM_URL,
        header={"Authorization": f"Token {DEEPGRAM_KEY}"},
        on_open=on_dg_open,
        on_message=on_dg_message,
        on_error=on_dg_error,
        on_close=on_dg_close,
    )

    dg_thread = threading.Thread(target=dg.run_forever, daemon=True)
    dg_thread.start()

    for _ in range(30):
        if dg_ws_ref[0] is not None:
            break
        await asyncio.sleep(0.1)

    try:
        while True:
            msg = await ws.receive_text()
            data = json.loads(msg)
            event = data.get("event")

            if event == "start":
                call_sid_ref[0] = data["start"]["callSid"]
                print(f"Stream started | call: {call_sid_ref[0]}")
                _broadcast_call({"type": "call_started", "call_sid": call_sid_ref[0]})

            elif event == "media":
                if dg_ws_ref[0]:
                    audio = base64.b64decode(data["media"]["payload"])
                    dg_ws_ref[0].send(audio, ws_client.ABNF.OPCODE_BINARY)

            elif event == "stop":
                sid = call_sid_ref[0]
                print(f"Stream stopped | call: {sid}")
                _broadcast_call({"type": "call_ended", "call_sid": sid})
                if sid:
                    threading.Thread(
                        target=_extract_and_triage,
                        args=(sid,),
                        daemon=True,
                    ).start()
                break

    except WebSocketDisconnect:
        pass
    finally:
        if dg_ws_ref[0]:
            try:
                dg_ws_ref[0].close()
            except Exception:
                pass
        print("Media stream handler done")


@app.get("/transcript-stream")
async def transcript_stream():
    """SSE endpoint — browser subscribes for live call transcripts + triage results."""
    q: Queue = Queue()
    with _queues_lock:
        _browser_queues.append(q)

    async def generate():
        try:
            while True:
                try:
                    data = await asyncio.get_event_loop().run_in_executor(
                        None, lambda: q.get(timeout=20)
                    )
                    yield f"data: {json.dumps(data)}\n\n"
                except Empty:
                    yield ": keep-alive\n\n"
        finally:
            with _queues_lock:
                _browser_queues.remove(q)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/call-status")
async def call_status_webhook(
    CallSid: str = Form(None),
    CallStatus: str = Form(None),
):
    """Twilio status callback."""
    print(f"Call status [{CallSid}] {CallStatus}")
    _broadcast_call({"type": "call_status", "call_sid": CallSid, "status": CallStatus})
    return Response(status_code=204)


@app.get("/")
def health_check():
    return {
        "status": "ok",
        "service": "Vitality - Women's Health Intelligence API",
        "active_cycle_state": _wearable_profile,
        "voice_data_loaded": _latest_acoustic is not None,
    }


if __name__ == "__main__":
    print("\n Starting Vitality API on http://localhost:8000")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
