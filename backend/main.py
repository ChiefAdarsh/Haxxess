"""
Live Call Transcript with PII Redaction
────────────────────────────────────────
Flow:
  Outbound call → Twilio Media Stream (WebSocket)
  → Deepgram Nova-2 via raw WebSocket (real-time STT + PII redaction)
  → SSE broadcast → React frontend
"""

import base64
import json
import os
import threading
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

TWILIO_NUMBER  = os.getenv("TWILIO_PHONE_NUMBER")
MY_NUMBER      = os.getenv("MY_PHONE_NUMBER")
NGROK_URL      = os.getenv("NGROK_URL", "").rstrip("/")
DEEPGRAM_KEY   = os.getenv("DEEPGRAM_API_KEY")

# Deepgram streaming URL — parameters set as query string (no SDK required)
DEEPGRAM_URL = (
    "wss://api.deepgram.com/v1/listen"
    "?model=nova-2"
    "&encoding=mulaw"
    "&sample_rate=8000"
    "&channels=1"
    "&interim_results=true"
    "&smart_format=true"
    "&redact=pci"          # credit card numbers
    "&redact=ssn"          # social security numbers
    "&redact=numbers"      # generic numbers
    "&redact=email_address"
    "&redact=phone_number"
)

# ── SSE broadcast ─────────────────────────────────────────────────────────────

_browser_queues: list[Queue] = []
_queues_lock = threading.Lock()


def broadcast(data: dict):
    """Push a JSON event to every connected browser tab."""
    with _queues_lock:
        for q in _browser_queues:
            q.put(data)


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


# ── Outbound call ─────────────────────────────────────────────────────────────

def make_call():
    call = twilio_client.calls.create(
        to=MY_NUMBER,
        from_=TWILIO_NUMBER,
        url=f"{NGROK_URL}/voice",
        status_callback=f"{NGROK_URL}/call-status",
        status_callback_method="POST",
    )
    print(f"📞 Calling {MY_NUMBER} …  SID: {call.sid}")


# ── /voice — answer the call and start a media stream ────────────────────────

@app.route("/voice", methods=["POST"])
def voice():
    wss_url = NGROK_URL.replace("https://", "wss://")

    resp = VoiceResponse()
    resp.say(
        "Connected. This call is being transcribed live. "
        "All personal information will be automatically redacted.",
        voice="alice",
    )

    start = Start()
    start.stream(url=f"{wss_url}/media-stream")
    resp.append(start)

    resp.pause(length=600)   # keep call alive up to 10 minutes
    return twiml(resp)


# ── /media-stream — Twilio audio → Deepgram (no SDK) ─────────────────────────

@sock.route("/media-stream")
def media_stream(ws):
    """
    Twilio sends mulaw audio frames here as base64 JSON.
    We open a direct WebSocket to Deepgram and forward the raw bytes.
    Deepgram responses come back as JSON on the same socket.
    """
    print("🔌 Twilio media stream connected")

    call_sid_ref = [None]       # mutable container so inner functions can write
    dg_ws_ref    = [None]       # Deepgram WebSocket instance

    # ── Deepgram event handlers ───────────────────────────────────────────────

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

    # ── Start Deepgram WebSocket in a background thread ───────────────────────

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

    # Wait up to 3 s for Deepgram to connect before we start forwarding audio
    for _ in range(30):
        if dg_ws_ref[0] is not None:
            break
        time.sleep(0.1)

    # ── Forward Twilio audio packets to Deepgram ──────────────────────────────

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
                print(f"⏹️  Stream stopped | call: {call_sid_ref[0]}")
                broadcast({"type": "call_ended", "call_sid": call_sid_ref[0]})
                break

    finally:
        if dg_ws_ref[0]:
            try:
                dg_ws_ref[0].close()
            except Exception:
                pass
        print("🔌 Media stream handler done")


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

# if __name__ == "__main__":
#     port = int(os.getenv("PORT", 5001))

#     print(f"🚀 Server on http://localhost:{port}")
#     print(f"🌐 Open http://localhost:5173 for the live transcript")

#     if MY_NUMBER and NGROK_URL:
#         threading.Timer(2.0, make_call).start()

#     app.run(host="0.0.0.0", port=port, threaded=True, debug=False)

# if __name__ == "__main__":
#     port = int(os.getenv("PORT", 5001))

#     print(f"🚀 Server on http://localhost:{port}")
#     print(f"🌐 Open http://localhost:5173 for the live transcript")

#     if MY_NUMBER and NGROK_URL:
#         threading.Timer(2.0, make_call).start()

#     app.run(host="0.0.0.0", port=port, threaded=True, debug=False)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))

    print(f"🚀 Server on http://localhost:{port}")
    print(f"🌐 Open http://localhost:5173 for the live transcript")

    if MY_NUMBER and NGROK_URL:
        threading.Timer(2.0, make_call).start()

    app.run(host="0.0.0.0", port=port, debug=False)