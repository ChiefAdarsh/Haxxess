import os
import tempfile
from datetime import datetime

import librosa
import whisper
import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from services.acoustics import analyze_audio
import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from services.wearable import MockOuraRing, MockAppleWatch
from services.symptom_extract import extract_symptoms
from pydantic import BaseModel

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


def transcribe(file_path: str) -> str:
    print("📝  Transcribing voice...")
    audio, _ = librosa.load(file_path, sr=16000, mono=True)

    return _whisper_model.transcribe(audio, fp16=False)["text"].strip()


@app.post("/analyze")
async def analyze_voice(file: UploadFile = File(...)):
    """
    Receives an audio file from the frontend, runs acoustic analysis and transcription, and returns the combined results.
    """
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

        return {
            "status": "success",
            "transcript": transcript,
            "analysis": acoustics_result.to_dict()
        }

    except Exception as e:
        print(f"Error processing audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.websocket("/ws/wearable")
async def wearable_stream(websocket: WebSocket):
    """
    WebSocket endpoint that pushes Apple Watch + Oura Ring data to the frontend every 1 second.
    """
    await websocket.accept()
    print("     Frontend connected to wearable stream!")

    apple_watch = MockAppleWatch(profile="baseline")
    oura_ring = MockOuraRing(profile="baseline")

    try:
        while True:
            data = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "apple_watch": apple_watch.get_next_reading(),
                "oura_ring": oura_ring.get_next_reading(),
            }

            await websocket.send_json(data)
            await asyncio.sleep(1.0)

    except WebSocketDisconnect:
        print("     Frontend disconnected from wearable stream.")


class TranscriptRequest(BaseModel):
    transcript: str


@app.post("/extract-symptoms")
async def extract_symptoms_endpoint(req: TranscriptRequest):
    result = extract_symptoms(req.transcript)
    return {"status": "success", **result}


@app.post("/call-triage")
async def call_triage(file: UploadFile = File(...)):
    tmp_path = None
    try:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
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


@app.get("/")
def health_check():
    return {"status": "ok", "message": "Vitality API is running!"}


if __name__ == "__main__":
    print("\nStarting FastAPI server on http://localhost:8000")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
