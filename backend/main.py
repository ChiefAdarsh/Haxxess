import os
import tempfile
from datetime import datetime, timedelta
from typing import Optional, Any, List, Dict
from dotenv import load_dotenv

import librosa
import whisper
import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from services.acoustics import analyze_audio, AcousticAnalysisResult
from services.wearable import MockOuraRing, MockAppleWatch, MockDexcomG7, collect_snapshot
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

_env_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(_env_dir), ".env"))

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


# In-memory stores (hackathon-safe). In production, replace with DB keyed by patient_id.
_cycle_periods: List[PeriodEvent] = []
_symptom_logs: List[Dict[str, Any]] = []
_appointments: List[Dict[str, Any]] = []


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


def _resolve_profile(profile: Optional[str]) -> str:
    return profile if profile and profile in VALID_PROFILES else _wearable_profile


def _ensure_consolidated(profile: Optional[str] = None) -> Any:
    """Rebuild consolidated result if needed."""
    global _latest_consolidated
    prof = _resolve_profile(profile)
    if profile or not _latest_consolidated:
        snapshot = collect_snapshot(profile=prof)
        _latest_consolidated = consolidate(
            acoustic_result=_latest_acoustic,
            wearable_snapshot=snapshot,
            profile=prof,
            symptom_logs=_symptom_logs,
            cycle_periods_context=_cycle_periods_context(_cycle_periods),
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

        result = consolidate(
            acoustic_result=_latest_acoustic,
            wearable_snapshot=snapshot,
            profile=prof,
            symptom_logs=_symptom_logs,
            cycle_periods_context=_cycle_periods_context(_cycle_periods),
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

        result = consolidate(
            acoustic_result=_latest_acoustic,
            wearable_snapshot=snapshot,
            profile=prof,
            symptom_logs=_symptom_logs,
            cycle_periods_context=_cycle_periods_context(_cycle_periods),
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

    result = consolidate(
        acoustic_result=_latest_acoustic,
        wearable_snapshot=snapshot,
        profile=prof,
        symptom_logs=_symptom_logs,
        cycle_periods_context=_cycle_periods_context(_cycle_periods),
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
    periods_sorted = sorted(_cycle_periods, key=lambda p: p.startDate)
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
    global _cycle_periods
    if any(p.startDate == req.startDate for p in _cycle_periods):
        _cycle_periods = [p for p in _cycle_periods if p.startDate != req.startDate]

    _cycle_periods.append(PeriodEvent(
        startDate=req.startDate,
        endDate=req.endDate,
        flow=req.flow,
        notes=req.notes,
    ))

    periods_sorted = sorted(_cycle_periods, key=lambda p: p.startDate)
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
    cutoff = (datetime.utcnow() - timedelta(days=max(1, min(days, 365)))).isoformat() + "Z"
    recent = [s for s in _symptom_logs if (s.get("timestamp") or "") >= cutoff]
    return {"status": "success", "symptoms": recent, "count": len(recent)}


@app.post("/symptoms")
async def add_symptom(entry: SymptomEntryPayload):
    """Append one body-map symptom log (from Body Map / SymptomContext)."""
    global _symptom_logs
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
    _symptom_logs.append(rec)
    return {"status": "success", "symptom": rec}


@app.post("/symptoms/bulk")
async def add_symptoms_bulk(entries: List[SymptomEntryPayload]):
    """Sync multiple symptom entries (e.g. on app load)."""
    global _symptom_logs
    for entry in entries:
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
        _symptom_logs.append(rec)
    return {"status": "success", "count": len(entries)}


@app.get("/calendar/appointments")
async def get_appointments(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
):
    """Return scheduled appointments. Optional from_date/to_date (YYYY-MM-DD) to filter."""
    out = list(_appointments)
    if from_date:
        out = [a for a in out if (a.get("date") or "") >= from_date]
    if to_date:
        out = [a for a in out if (a.get("date") or "") <= to_date]
    out.sort(key=lambda a: (a.get("date", ""), a.get("time", "")))
    return {"status": "success", "appointments": out}


@app.post("/calendar/appointments")
async def create_appointment(body: AppointmentCreate):
    """Patient schedules an appointment; shows on clinician calendar."""
    global _appointments
    rec = {
        "id": f"apt_{datetime.utcnow().timestamp():.0f}",
        "date": body.date,
        "time": body.time,
        "type": body.type or "Visit",
        "patient_name": body.patient_name or "Patient",
    }
    _appointments.append(rec)
    return {"status": "success", "appointment": rec}


@app.put("/settings/wearable-profile")
async def set_wearable_profile(profile: str = Query(...)):
    global _wearable_profile, _apple_watch, _oura_ring, _dexcom

    if profile not in VALID_PROFILES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid profile. Choose from: {sorted(VALID_PROFILES)}",
        )

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
        result = _ensure_consolidated(profile)
        return {"status": "success", "data": generate_predictive_risk_model(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/intelligence/coaching")
async def get_coaching_plan(profile: Optional[str] = Query(default=None)):
    try:
        result = _ensure_consolidated(profile)
        return {"status": "success", "data": generate_lifestyle_coaching(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/intelligence/chat")
async def chat_with_assistant(req: ChatRequest, profile: Optional[str] = Query(default=None)):
    try:
        result = _ensure_consolidated(profile)
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
        result = _ensure_consolidated(profile)
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


@app.get("/")
def health_check():
    return {
        "status": "ok",
        "service": "Vitality - Women's Health Intelligence API",
        "active_cycle_state": _wearable_profile,
        "voice_data_loaded": _latest_acoustic is not None,
    }


if __name__ == "__main__":
    print("\n🌸 Starting Vitality API on http://localhost:8000")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
