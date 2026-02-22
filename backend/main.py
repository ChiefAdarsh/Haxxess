"""
Symptom Intake · Triage · Live Transcript
──────────────────────────────────────────
Flow:
  Inbound/Outbound call → Twilio Media Stream (WebSocket)
  → Deepgram Nova-2 (real-time STT + PII redaction)
  → Transcript accumulation per call
  → On call end: rule-based triage + LLM entity extraction
  → SSE broadcast → React frontend
"""

import base64
import json
import os
import re
import threading
from typing import Optional
import time
from queue import Empty, Queue

import websocket  # websocket-client (sync)
from dotenv import load_dotenv
from flask import Flask, Response, make_response, request
from flask_sock import Sock
from twilio.rest import Client
from twilio.twiml.voice_response import Start, VoiceResponse

load_dotenv()

app = Flask(__name__)
sock = Sock(app)

# ── Clients ───────────────────────────────────────────────────────────────────

twilio_client = Client(
    os.getenv("TWILIO_ACCOUNT_SID"),
    os.getenv("TWILIO_AUTH_TOKEN"),
)

TWILIO_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
NGROK_URL     = os.getenv("NGROK_URL", "").rstrip("/")
DEEPGRAM_KEY  = os.getenv("DEEPGRAM_API_KEY")
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

# ── SSE broadcast ─────────────────────────────────────────────────────────────

_browser_queues: list[Queue] = []
_queues_lock = threading.Lock()


def broadcast(data: dict):
    with _queues_lock:
        for q in _browser_queues:
            q.put(data)


# ── Per-call transcript store ─────────────────────────────────────────────────

_call_transcripts: dict[str, list[str]] = {}
_transcripts_lock = threading.Lock()

# ── TwiML helper ──────────────────────────────────────────────────────────────

def twiml(response: VoiceResponse):
    r = make_response(str(response))
    r.headers["Content-Type"] = "text/xml"
    return r


# ── CORS / ngrok headers ──────────────────────────────────────────────────────

@app.after_request
def add_headers(response):
    response.headers["ngrok-skip-browser-warning"] = "true"
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response




# ── /voice — answer call + start media stream ─────────────────────────────────

INTAKE_PROMPT = (
    "Hello. You have reached the symptom intake line. "
    "After this message, please describe your symptoms freely. "
    "Tell me where you feel discomfort, how severe it is on a scale of zero to ten, "
    "and how long you have been experiencing this. "
    "You may also mention any fever, bleeding, nausea, pregnancy, or other concerns. "
    "Take your time — I am listening."
)


@app.route("/voice", methods=["POST"])
def voice():
    wss_url = NGROK_URL.replace("https://", "wss://")

    resp = VoiceResponse()
    resp.say(INTAKE_PROMPT, voice="alice")

    start = Start()
    start.stream(url=f"{wss_url}/media-stream")
    resp.append(start)

    # Give the caller up to 10 seconds to describe symptoms
    resp.pause(length=75)

    resp.say(
        "Thank you. Your symptoms have been recorded and are being analyzed. "
        "You may hang up now.",
        voice="alice",
    )

    resp.pause(length=5)
    return twiml(resp)


# ── /media-stream — Twilio audio → Deepgram ──────────────────────────────────

@sock.route("/media-stream")
def media_stream(ws):
    print("🔌 Twilio media stream connected")

    call_sid_ref = [None]
    dg_ws_ref    = [None]

    def on_dg_open(dg):
        dg_ws_ref[0] = dg
        print("Deepgram connection open")

    def on_dg_message(dg, message):
        data = json.loads(message)
        if data.get("type") != "Results":
            return

        alts       = data.get("channel", {}).get("alternatives", [{}])
        transcript = alts[0].get("transcript", "") if alts else ""
        is_final   = data.get("is_final", False)

        if not transcript:
            return

        label = "✅ FINAL" if is_final else "💬 interim"
        print(f"{label} [{call_sid_ref[0]}]: {transcript}")

        # Accumulate finals for post-call extraction
        if is_final and call_sid_ref[0]:
            with _transcripts_lock:
                _call_transcripts.setdefault(call_sid_ref[0], []).append(transcript)

        broadcast({
            "type":     "transcript",
            "text":     transcript,
            "is_final": is_final,
            "call_sid": call_sid_ref[0],
        })

    def on_dg_error(dg, error):
        print(f"❌ Deepgram error: {error}")
        broadcast({"type": "error", "message": str(error)})

    def on_dg_close(dg, close_status_code, close_msg):
        print(f"🔌 Deepgram closed: {close_status_code} {close_msg}")

    dg = websocket.WebSocketApp(
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
        time.sleep(0.1)

    try:
        while True:
            msg = ws.receive()
            if msg is None:
                break

            data  = json.loads(msg)
            event = data.get("event")

            if event == "start":
                call_sid_ref[0] = data["start"]["callSid"]
                print(f"▶️  Stream started | call: {call_sid_ref[0]}")
                broadcast({"type": "call_started", "call_sid": call_sid_ref[0]})

            elif event == "media":
                if dg_ws_ref[0]:
                    audio = base64.b64decode(data["media"]["payload"])
                    dg_ws_ref[0].send(audio, websocket.ABNF.OPCODE_BINARY)

            elif event == "stop":
                sid = call_sid_ref[0]
                print(f"⏹️  Stream stopped | call: {sid}")
                broadcast({"type": "call_ended", "call_sid": sid})
                if sid:
                    threading.Thread(
                        target=extract_and_triage,
                        args=(sid,),
                        daemon=True,
                    ).start()
                break

    finally:
        if dg_ws_ref[0]:
            try:
                dg_ws_ref[0].close()
            except Exception:
                pass
        print("🔌 Media stream handler done")


# ── Rule-based triage engine ──────────────────────────────────────────────────

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
        "level":  "emergency",
        "label":  "🚨 Emergency",
        "color":  "#ef4444",
        "bg":     "#2d0c0c",
        "action": "Call 911 or go to the Emergency Room immediately.",
    },
    "urgent": {
        "level":  "urgent",
        "label":  "⚠️ Same-Day Urgent",
        "color":  "#f97316",
        "bg":     "#2a1200",
        "action": "Contact your healthcare provider today for a same-day appointment.",
    },
    "routine": {
        "level":  "routine",
        "label":  "📅 Routine Follow-Up",
        "color":  "#eab308",
        "bg":     "#1e1500",
        "action": "Schedule an appointment within the next few days.",
    },
    "self_care": {
        "level":  "self_care",
        "label":  "🟢 Self-Care & Monitor",
        "color":  "#22c55e",
        "bg":     "#061a0e",
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

    # Severity number fallback
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


# ── LLM entity extraction ─────────────────────────────────────────────────────

_EXTRACTION_PROMPT = """\
You are a clinical intake assistant extracting structured data from a patient's spoken symptom description.

Return ONLY a valid JSON object with these exact fields (use null for unknown):
{
  "summary": "<one-sentence chief complaint>",
  "symptoms": ["<symptom1>", "..."],
  "body_regions": ["<region: LLQ | RLQ | pelvic_midline | vulva | low_back | thighs | upper_abdomen | diffuse | other>"],
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
        print("⚠️  OPENROUTER_API_KEY not set — skipping LLM extraction")
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
                {"role": "user",   "content": _EXTRACTION_PROMPT + text},
            ],
            temperature=0,
            max_tokens=600,
        )
        raw = resp.choices[0].message.content.strip()
        # Strip markdown code fences if model adds them
        raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()
        return json.loads(raw)
    except Exception as e:
        print(f"❌ LLM extraction error: {e}")
        return {"summary": "Extraction failed.", "error": str(e)}


# ── extract_and_triage (runs in background after call ends) ──────────────────

def extract_and_triage(call_sid: str):
    broadcast({"type": "processing", "call_sid": call_sid})

    with _transcripts_lock:
        lines = list(_call_transcripts.get(call_sid, []))

    full_text = " ".join(lines).strip()
    print(f"📝 Processing transcript ({len(full_text)} chars) for {call_sid}")

    if not full_text:
        broadcast({
            "type":       "case_ready",
            "call_sid":   call_sid,
            "transcript": "",
            "triage":     dict(_TRIAGE_DEFS["self_care"]) | {"reason": "No speech captured."},
            "entities":   {"summary": "No speech was detected during this call."},
        })
        return

    triage   = rule_triage(full_text)
    entities = llm_extract(full_text)

    print(f"🏥 Triage [{call_sid}]: {triage['level']} — {triage['reason']}")

    broadcast({
        "type":       "case_ready",
        "call_sid":   call_sid,
        "transcript": full_text,
        "triage":     triage,
        "entities":   entities,
    })

    with _transcripts_lock:
        _call_transcripts.pop(call_sid, None)


# ── /transcript-stream — SSE to browser ──────────────────────────────────────

@app.route("/transcript-stream")
def transcript_stream():
    q: Queue = Queue()
    with _queues_lock:
        _browser_queues.append(q)

    def generate():
        try:
            while True:
                try:
                    data = q.get(timeout=20)
                    yield f"data: {json.dumps(data)}\n\n"
                except Empty:
                    yield ": keep-alive\n\n"
        finally:
            with _queues_lock:
                _browser_queues.remove(q)

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── /call-status — Twilio status callback ────────────────────────────────────

@app.route("/call-status", methods=["POST"])
def call_status():
    sid    = request.form.get("CallSid")
    status = request.form.get("CallStatus")
    print(f"📊 [{sid}] {status}")
    broadcast({"type": "call_status", "call_sid": sid, "status": status})
    return "", 204


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))

    print(f"🚀 Server on http://localhost:{port}")
    print(f"🌐 Open http://localhost:5173 for the live transcript")
    print(f"📞 Set your Twilio number's Voice webhook → {NGROK_URL}/voice")
    print(f"   Patients call {TWILIO_NUMBER} to log symptoms.")

    app.run(host="0.0.0.0", port=port, debug=False)