import os
import tempfile
import numpy as np
import librosa
import whisper
import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from services.acoustics import analyze_audio

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
    Receives an audio file from the frontend, runs acoustic analysis
    and transcription, and returns the combined results.
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


@app.get("/")
def health_check():
    return {"status": "ok", "message": "Acoustic Analysis API is running!"}


if __name__ == "__main__":
    print("\nStarting FastAPI server on http://localhost:8000")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
