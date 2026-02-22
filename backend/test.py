"""
Run this to diagnose what's failing:
  python test.py
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

# ── 1. Test Groq API ─────────────────────────────────────────────────────────
print("=" * 50)
print("TEST 1: Groq API")
print("=" * 50)
try:
    from groq import Groq
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": "Say hello in one sentence."}],
        max_tokens=50,
    )
    print("✅ Groq works! Response:", completion.choices[0].message.content)
except Exception as e:
    print("❌ Groq FAILED:", e)

# ── 2. Test /voice endpoint ───────────────────────────────────────────────────
print()
print("=" * 50)
print("TEST 2: /voice endpoint")
print("=" * 50)
try:
    r = requests.post("http://127.0.0.1:5000/voice", data={"CallSid": "TEST123"})
    print(f"Status: {r.status_code}")
    print("Response:", r.text[:300])
    if "<Response>" in r.text:
        print("✅ /voice returns valid TwiML")
    else:
        print("❌ /voice response is NOT valid TwiML")
except Exception as e:
    print("❌ /voice FAILED:", e)
    print("   Is the Flask server running? (python main.py)")

# ── 3. Test /respond endpoint ─────────────────────────────────────────────────
print()
print("=" * 50)
print("TEST 3: /respond endpoint (simulates Twilio sending speech)")
print("=" * 50)
try:
    r = requests.post("http://127.0.0.1:5000/respond", data={
        "CallSid": "TEST123",
        "SpeechResult": "What is the capital of France?",
    })
    print(f"Status: {r.status_code}")
    print("Response:", r.text[:500])
    if "<Response>" in r.text:
        print("✅ /respond returns valid TwiML")
    else:
        print("❌ /respond response is NOT valid TwiML")
except Exception as e:
    print("❌ /respond FAILED:", e)
    print("   Is the Flask server running? (python main.py)")
