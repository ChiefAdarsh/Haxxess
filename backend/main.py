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

from services.acoustics import analyze_audio, AcousticAnalysisResult
from services.wearable import MockOuraRing, MockAppleWatch, collect_snapshot, MockDexcomG7
from services.consolidate import consolidate

from pydantic import BaseModel
from services.intelligence import (
    generate_predictive_risk_model,
    generate_lifestyle_coaching,
    handle_virtual_assistant,
    generate_smart_alert
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


class ChatRequest(BaseModel):
    message: str


print("     Loading AI models...")
_whisper_model = whisper.load_model("base")
print("     Models loaded.")

app = FastAPI(title="Haxxess Acoustic API")

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
_wearable_profile: str = "baseline"

_apple_watch = MockAppleWatch(profile=_wearable_profile)
_oura_ring = MockOuraRing(profile=_wearable_profile)
_dexcom = MockDexcomG7(profile=_wearable_profile)


def transcribe(file_path: str) -> str:
    print("     Transcribing voice...")
    audio, _ = librosa.load(file_path, sr=16000, mono=True)
    return _whisper_model.transcribe(audio, fp16=False)["text"].strip()


@app.post("/analyze")
async def analyze_voice(file: UploadFile = File(...)):
    """
    Receives an audio file from the frontend, runs acoustic analysis
    and transcription, and returns the combined results.
    Also stores the result so /consolidated can use it.
    """
    global _latest_acoustic, _latest_transcript

    tmp_path = None
    try:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        content = await file.read()
        tmp.write(content)
        tmp.close()
        tmp_path = tmp.name

        print(f"\n🎙️  Processing uploaded file: {file.filename}")

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
        print(f"Error processing audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.get("/consolidated")
async def get_consolidated(
        profile: Optional[str] = Query(
            default=None,
            description="Wearable sim profile: baseline, anxious, depressed, active, fatigued, calm",
        ),
):
    """
    Returns the unified Vitality Index by fusing:
      - Latest voice/acoustic analysis (from most recent /analyze call)
      - Current wearable snapshot (Apple Watch + Oura Ring)
      - (Future: NLP, behavioral)

    Vitality Index tiers:
      80–100  STABLE    → Continue logging & monitoring
      55–79   WATCH     → Alert patient + doctor
      30–54   ELEVATED  → Notify care team for service
       0–29   CRITICAL  → Escalate to 911 + doctor

    Query params:
      ?profile=anxious  → override the wearable simulation profile for this request
    """
    global _latest_consolidated
    try:
        wearable_prof = profile if profile else _wearable_profile
        wearable_snapshot = collect_snapshot(profile=wearable_prof)

        result = consolidate(
            acoustic_result=_latest_acoustic,
            wearable_snapshot=wearable_snapshot,
            # transcript_analysis=some_nlp_result,
            # behavioral_data=some_behavioral_result,
            profile=wearable_prof,
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
            "has_voice_data": _latest_acoustic is not None,
            "has_wearable_data": True,
            "transcript": _latest_transcript,
            "timestamp": result.timestamp,
        }

    except Exception as e:
        print(f"Error in consolidation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/consolidated")
async def post_consolidated(
        file: UploadFile = File(None),
        profile: Optional[str] = Query(default=None),
):
    """
    All-in-one endpoint: upload audio + get back the full Vitality Index
    in a single call. If no file is provided, uses the latest cached voice data.
    """
    global _latest_acoustic, _latest_transcript, _latest_consolidated

    tmp_path = None
    try:
        if file and file.filename:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
            content = await file.read()
            tmp.write(content)
            tmp.close()
            tmp_path = tmp.name

            print(f"\n🎙️  Processing uploaded file: {file.filename}")
            _latest_acoustic = analyze_audio(tmp_path)
            _latest_transcript = transcribe(tmp_path)

        wearable_prof = profile if profile else _wearable_profile
        wearable_snapshot = collect_snapshot(profile=wearable_prof)

        result = consolidate(
            acoustic_result=_latest_acoustic,
            wearable_snapshot=wearable_snapshot,
            profile=wearable_prof,
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
            "transcript": _latest_transcript,
            "timestamp": result.timestamp,
        }

    except Exception as e:
        print(f"Error in consolidated analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.put("/settings/wearable-profile")
async def set_wearable_profile(
        profile: str = Query(..., description="One of: baseline, anxious, depressed, active, fatigued, calm"),
):
    """Change the simulated wearable profile globally."""
    global _wearable_profile, _apple_watch, _oura_ring

    valid = {"baseline", "anxious", "depressed", "active", "fatigued", "calm"}
    if profile not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid profile. Choose from: {valid}")

    _wearable_profile = profile
    _apple_watch = MockAppleWatch(profile=profile)
    _oura_ring = MockOuraRing(profile=profile)

    return {"status": "ok", "profile": profile}


@app.websocket("/ws/wearable")
async def wearable_stream(websocket: WebSocket):
    """
    WebSocket endpoint that pushes Apple Watch + Oura Ring + Glucose monitor data to the frontend every 1 second.
    """
    await websocket.accept()
    print("     Frontend connected to wearable stream!")

    try:
        while True:
            data = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "apple_watch": _apple_watch.get_next_reading(),
                "oura_ring": _oura_ring.get_next_reading(),
                "dexcom_g7": _dexcom.get_next_reading(),
            }

            await websocket.send_json(data)
            await asyncio.sleep(1.0)

    except WebSocketDisconnect:
        print("     Frontend disconnected from wearable stream.")


@app.get("/intelligence/forecast")
async def get_forecast(profile: Optional[str] = Query(default=None)):
    """Returns the 72-hour stochastic risk forecast."""
    global _latest_consolidated
    try:
        if profile or not _latest_consolidated:
            wearable_prof = profile if profile else _wearable_profile
            wearable_snapshot = collect_snapshot(profile=wearable_prof)
            _latest_consolidated = consolidate(acoustic_result=_latest_acoustic, wearable_snapshot=wearable_snapshot)

        forecast_data = generate_predictive_risk_model(_latest_consolidated)
        return {"status": "success", "data": forecast_data}
    except Exception as e:
        print(f"Error generating forecast: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/intelligence/coaching")
async def get_coaching_plan(profile: Optional[str] = Query(default=None)):
    """Returns the personalized diet & lifestyle coaching plan."""
    global _latest_consolidated
    try:
        if profile or not _latest_consolidated:
            wearable_prof = profile if profile else _wearable_profile
            wearable_snapshot = collect_snapshot(profile=wearable_prof)
            _latest_consolidated = consolidate(acoustic_result=_latest_acoustic, wearable_snapshot=wearable_snapshot)

        coaching_data = generate_lifestyle_coaching(_latest_consolidated)
        return {"status": "success", "data": coaching_data}
    except Exception as e:
        print(f"Error generating coaching plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/intelligence/chat")
async def chat_with_assistant(
        req: ChatRequest,
        profile: Optional[str] = Query(default=None)
):
    """The Virtual Assistant endpoint. Talks back using live data."""
    global _latest_consolidated
    try:
        if profile or not _latest_consolidated:
            wearable_prof = profile if profile else _wearable_profile
            wearable_snapshot = collect_snapshot(profile=wearable_prof)
            _latest_consolidated = consolidate(acoustic_result=_latest_acoustic, wearable_snapshot=wearable_snapshot)

        ai_reply = handle_virtual_assistant(
            user_message=req.message,
            vitality_result=_latest_consolidated,
            transcript=_latest_transcript
        )

        return {"status": "success", "response": ai_reply}
    except Exception as e:
        print(f"Error in virtual assistant chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/intelligence/alert")
async def get_smart_alert(profile: Optional[str] = Query(default=None)):
    """Generates an SMS-friendly smart alert for caregivers if needed."""
    global _latest_consolidated
    try:
        if profile or not _latest_consolidated:
            wearable_prof = profile if profile else _wearable_profile
            wearable_snapshot = collect_snapshot(profile=wearable_prof)
            _latest_consolidated = consolidate(acoustic_result=_latest_acoustic, wearable_snapshot=wearable_snapshot)

        alert_data = generate_smart_alert(_latest_consolidated)
        return {"status": "success", "data": alert_data}
    except Exception as e:
        print(f"Error generating smart alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/history/vitality")
async def history_vitality(
    profile: Optional[str] = Query(default=None),
    days: int = Query(default=30, ge=1, le=365),
):
    prof = profile or _wearable_profile
    return {
        "profile": prof,
        "days": days,
        "history": get_historical_vitality(prof, days),
    }


@app.get("/history/hourly")
async def history_hourly(
    profile: Optional[str] = Query(default=None),
    hours: int = Query(default=48, ge=1, le=168),
):
    prof = profile or _wearable_profile
    return {
        "profile": prof,
        "hours": hours,
        "history": get_hourly_vitality(prof, hours),
    }


@app.get("/history/signal/{signal_name}")
async def history_signal(
    signal_name: str,
    profile: Optional[str] = Query(default=None),
    days: int = Query(default=30, ge=1, le=365),
):
    prof = profile or _wearable_profile
    data = get_signal_history(prof, signal_name, days)
    if data and "error" in data[0]:
        raise HTTPException(status_code=400, detail=data[0]["error"])
    return {
        "profile": prof,
        "signal": signal_name,
        "days": days,
        "history": data,
    }


@app.get("/history/timeline")
async def history_timeline(
    profile: Optional[str] = Query(default=None),
    days: int = Query(default=30, ge=1, le=365),
):
    prof = profile or _wearable_profile
    return get_composite_timeline(prof, days)


@app.get("/history/events")
async def history_events(
    profile: Optional[str] = Query(default=None),
):
    prof = profile or _wearable_profile
    return {
        "profile": prof,
        "events": get_event_timeline(prof),
    }


@app.get("/history/trends")
async def history_trends(
    profile: Optional[str] = Query(default=None),
    days: int = Query(default=30, ge=1, le=365),
):
    prof = profile or _wearable_profile
    return {
        "profile": prof,
        "days": days,
        "trends": compute_all_trends(prof, days),
    }


@app.get("/history/week-comparison")
async def history_week_comparison(
    profile: Optional[str] = Query(default=None),
):
    prof = profile or _wearable_profile
    return get_week_comparison(prof)


@app.get("/")
def health_check():
    return {"status": "ok", "message": "Acoustic Analysis API is running!"}


if __name__ == "__main__":
    print("\nStarting FastAPI server on http://localhost:8000")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
