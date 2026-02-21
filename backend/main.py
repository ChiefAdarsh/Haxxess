import os
import tempfile
from datetime import datetime
from typing import Optional, Any
from dotenv import load_dotenv

import librosa
import whisper
import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
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

load_dotenv()

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


print("     Loading AI models...")
_whisper_model = whisper.load_model("base")
print("     Models loaded.")

app = FastAPI(
    title="Vitality - Women's Health Intelligence API",
    description=(
        "Multimodal biometric and vocal biomarker platform for proactive "
        "management of PMDD, PCOS, and perimenopause."
    ),
    version="1.0.0",
)

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
        )
    return _latest_consolidated


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


@app.get("/consolidated")
async def get_consolidated(
    profile: Optional[str] = Query(
        default=None,
        description="Cycle state: follicular, ovulation, luteal_mild, luteal_pms, pmdd_crisis, pcos_flare, perimenopause",
    ),
):
    global _latest_consolidated
    try:
        prof = _resolve_profile(profile)
        snapshot = collect_snapshot(profile=prof)

        result = consolidate(
            acoustic_result=_latest_acoustic,
            wearable_snapshot=snapshot,
            profile=prof,
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


@app.put("/settings/wearable-profile")
async def set_wearable_profile(
    profile: str = Query(
        ...,
        description="Cycle state: follicular, ovulation, luteal_mild, luteal_pms, pmdd_crisis, pcos_flare, perimenopause",
    ),
):
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
async def chat_with_assistant(
    req: ChatRequest,
    profile: Optional[str] = Query(default=None),
):
    try:
        result = _ensure_consolidated(profile)
        reply = handle_virtual_assistant(
            user_message=req.message,
            vitality_result=result,
            transcript=_latest_transcript,
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
async def history_vitality(
    profile: Optional[str] = Query(default=None),
    days: int = Query(default=30, ge=1, le=365),
):
    prof = _resolve_profile(profile)
    return {"profile": prof, "days": days, "history": get_historical_vitality(prof, days)}


@app.get("/history/hourly")
async def history_hourly(
    profile: Optional[str] = Query(default=None),
    hours: int = Query(default=48, ge=1, le=168),
):
    prof = _resolve_profile(profile)
    return {"profile": prof, "hours": hours, "history": get_hourly_vitality(prof, hours)}


@app.get("/history/signal/{signal_name}")
async def history_signal(
    signal_name: str,
    profile: Optional[str] = Query(default=None),
    days: int = Query(default=30, ge=1, le=365),
):
    prof = _resolve_profile(profile)
    data = get_signal_history(prof, signal_name, days)
    if data and "error" in data[0]:
        raise HTTPException(status_code=400, detail=data[0]["error"])
    return {"profile": prof, "signal": signal_name, "days": days, "history": data}


@app.get("/history/timeline")
async def history_timeline(
    profile: Optional[str] = Query(default=None),
    days: int = Query(default=30, ge=1, le=365),
):
    prof = _resolve_profile(profile)
    return get_composite_timeline(prof, days)


@app.get("/history/events")
async def history_events(profile: Optional[str] = Query(default=None)):
    prof = _resolve_profile(profile)
    return {"profile": prof, "events": get_event_timeline(prof)}


@app.get("/history/trends")
async def history_trends(
    profile: Optional[str] = Query(default=None),
    days: int = Query(default=30, ge=1, le=365),
):
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
