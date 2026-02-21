import os
import json
import logging
import requests
from typing import Any, Optional

logger = logging.getLogger("intelligence")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL_ID = "arcee-ai/trinity-large-preview:free"
REQUEST_TIMEOUT = 20


def _call_openrouter(
    system_prompt: str,
    user_prompt: str,
    json_mode: bool = False,
    temperature: float = 0.4,
    max_tokens: int = 1024,
) -> str:
    if not OPENROUTER_API_KEY:
        logger.warning("OPENROUTER_API_KEY not set — returning empty response.")
        return ""

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:8000",
        "X-Title": "Haxxess Vitality Engine",
    }

    payload = {
        "model": MODEL_ID,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    try:
        resp = requests.post(
            OPENROUTER_URL, headers=headers, json=payload, timeout=REQUEST_TIMEOUT
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    except requests.Timeout:
        logger.error("OpenRouter request timed out.")
        return ""
    except requests.HTTPError as e:
        logger.error(f"OpenRouter HTTP error: {e} — {resp.text[:300]}")
        return ""
    except Exception as e:
        logger.error(f"OpenRouter call failed: {e}")
        return ""


def _safe_parse_json(raw: str, fallback: dict) -> dict:
    if not raw:
        return fallback
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Some models wrap JSON in markdown code fences
        stripped = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            logger.error(f"Failed to parse LLM JSON. Raw response: {raw[:200]}")
            return fallback


def _extract_vitality_data(vitality_result: Any) -> dict:
    if vitality_result is None:
        return {"vitality_index": 75, "flags": [], "signals": [], "summary": ""}
    if hasattr(vitality_result, "to_dict"):
        return vitality_result.to_dict()
    if isinstance(vitality_result, dict):
        return vitality_result
    return {"vitality_index": 75, "flags": [], "signals": [], "summary": ""}


def _format_signals_context(v_data: dict) -> str:
    """Build a compact context string from all available signal data."""
    lines = [f"Vitality Index: {v_data.get('vitality_index', '?')}/100"]
    lines.append(f"Tier: {v_data.get('tier_id', '?')} — {v_data.get('tier_label', '?')}")

    flags = v_data.get("flags", [])
    if flags:
        lines.append(f"Active flags ({len(flags)}):")
        for f in flags[:10]:
            lines.append(f"  • {f}")
        if len(flags) > 10:
            lines.append(f"  ... and {len(flags) - 10} more")

    signals = v_data.get("signals", [])
    for sig in signals:
        if sig.get("confidence", 0) > 0:
            lines.append(
                f"Signal [{sig['source']}]: score={sig['score']:.0f} "
                f"conf={sig['confidence']:.0%}"
            )
            raw = sig.get("raw_data", {})
            if raw:
                for k, val in raw.items():
                    if k != "sub_scores":
                        lines.append(f"    {k}: {val}")

    return "\n".join(lines)


RISK_SYSTEM_PROMPT = """\
You are a predictive clinical risk modeling engine. You receive a patient's current \
vitality score, physiological signals, and active health flags. Your job is to project \
their health trajectory for the next 72 hours at 24-hour intervals.

For each interval, identify the most likely risk factor based on the current data \
trajectory and assign a probability. Be specific — reference actual metrics from \
the data (e.g., "HRV has been declining and is now at 22ms, suggesting autonomic \
dysregulation that typically worsens over 48hrs without intervention").

If the patient is stable, say so — don't manufacture risk for drama.

Return ONLY valid JSON:
{
  "risk_level": "low|moderate|high|critical",
  "forecast": [
    {
      "hour": 24,
      "predicted_score": <int 0-100>,
      "risk_factor": "<specific clinical reasoning>",
      "probability_pct": <int 0-100>,
      "recommended_intervention": "<what should happen>"
    }
  ],
  "confidence_note": "<brief note on forecast confidence given available data>"
}"""


def generate_predictive_risk_model(vitality_result: Any) -> dict:
    v_data = _extract_vitality_data(vitality_result)
    current_score = v_data.get("vitality_index", 75)
    context = _format_signals_context(v_data)

    user_prompt = f"Current patient state:\n{context}\n\nGenerate the 72-hour risk forecast."

    raw = _call_openrouter(RISK_SYSTEM_PROMPT, user_prompt, json_mode=True, temperature=0.3)

    fallback = {
        "risk_level": "moderate" if current_score < 60 else "low",
        "forecast": [
            {
                "hour": 24,
                "predicted_score": max(10, current_score - 5),
                "risk_factor": "Continued physiological stress markers if current trajectory holds.",
                "probability_pct": 70,
                "recommended_intervention": "Increase monitoring frequency to every 4 hours.",
            },
            {
                "hour": 48,
                "predicted_score": max(10, current_score - 12),
                "risk_factor": "Compounding sleep deficit and autonomic strain.",
                "probability_pct": 55,
                "recommended_intervention": "Schedule telehealth check-in with care team.",
            },
            {
                "hour": 72,
                "predicted_score": max(10, current_score - 18),
                "risk_factor": "Elevated likelihood of acute event without intervention.",
                "probability_pct": 40,
                "recommended_intervention": "In-person clinical evaluation recommended.",
            },
        ],
        "confidence_note": "Forecast generated from fallback model — LLM unavailable.",
    }

    return _safe_parse_json(raw, fallback)


COACHING_SYSTEM_PROMPT = """\
You are an AI lifestyle coach integrated into a real-time health monitoring system. \
You have access to the patient's live biometrics from wearables (heart rate, HRV, SpO2, \
blood pressure, glucose, sleep data) and acoustic vocal biomarkers (pitch, energy, \
speech rate, emotional valence).

Generate a personalized 3-step action plan for the next 12 hours. Each step must:
1. Reference specific data points from their current readings
2. Be actionable and time-bound
3. Explain WHY this matters given their specific metrics

Adjust tone based on their state — don't tell someone with a vitality score of 25 to \
"try a fun new recipe." Be direct when the situation is serious, warm when they're doing well.

Return ONLY valid JSON:
{
  "urgency": "routine|attention|urgent",
  "coaching_plan": [
    {
      "timeframe": "Immediate (next 30 min)",
      "category": "hydration|nutrition|movement|breathing|sleep|medication|social",
      "action": "<specific action>",
      "reasoning": "<why, referencing their data>"
    }
  ],
  "encouragement": "<one line of genuine encouragement based on what IS going well>"
}"""


def generate_lifestyle_coaching(vitality_result: Any) -> dict:
    v_data = _extract_vitality_data(vitality_result)
    current_score = v_data.get("vitality_index", 75)
    context = _format_signals_context(v_data)

    user_prompt = f"Patient's current state:\n{context}\n\nGenerate the 12-hour coaching plan."

    raw = _call_openrouter(COACHING_SYSTEM_PROMPT, user_prompt, json_mode=True, temperature=0.5)

    fallback = {
        "urgency": "attention" if current_score < 60 else "routine",
        "coaching_plan": [
            {
                "timeframe": "Immediate (next 30 min)",
                "category": "breathing",
                "action": "Do a 5-minute box breathing exercise (4s in, 4s hold, 4s out, 4s hold).",
                "reasoning": "Your HRV is below optimal and vocal stress markers are elevated — controlled breathing directly stimulates the parasympathetic nervous system.",
            },
            {
                "timeframe": "Next 2-4 hours",
                "category": "nutrition",
                "action": "Eat a balanced meal with complex carbs, protein, and healthy fats. Avoid caffeine.",
                "reasoning": "Your glucose trend suggests you need stable energy. Caffeine would further suppress your already-low HRV.",
            },
            {
                "timeframe": "This evening",
                "category": "sleep",
                "action": "Begin winding down 90 minutes before bed. No screens, dim lights, cool room.",
                "reasoning": "Your sleep score has been below target. Sleep is the single biggest lever for recovering your vitality score.",
            },
        ],
        "encouragement": "Your body is telling you what it needs — the fact that you're checking in is already a good sign.",
    }

    return _safe_parse_json(raw, fallback)


ASSISTANT_SYSTEM_PROMPT = """\
You are the Vitality Assistant — an empathetic, clinically-informed AI health companion. \
You have real-time access to the patient's wearable biometrics, acoustic vocal analysis, \
glucose monitoring, and their unified Vitality Index score.

Guidelines:
- Reference their actual data when responding. Don't be vague — say "your heart rate is \
  sitting at 93bpm which is elevated for rest" not "your vitals seem a bit off."
- Match your tone to their state. If they're in crisis, be calm and direct. If they're \
  doing well, be warm and encouraging.
- If they ask something outside your scope, say so honestly.
- Never diagnose. You monitor, inform, and recommend — you are not a doctor.
- Keep responses concise. 2-4 sentences for simple questions, up to a short paragraph \
  for complex ones.
- If their vitality score is below 30, always recommend they contact their care team \
  or emergency services."""


def handle_virtual_assistant(
    user_message: str,
    vitality_result: Any,
    transcript: Optional[str] = None,
) -> str:
    v_data = _extract_vitality_data(vitality_result)
    score = v_data.get("vitality_index", 75)
    context = _format_signals_context(v_data)

    user_prompt = f"Patient's live data:\n{context}\n"

    if transcript:
        user_prompt += f"\nLatest voice journal transcript: \"{transcript}\"\n"

    user_prompt += f"\nPatient says: \"{user_message}\""

    raw = _call_openrouter(
        ASSISTANT_SYSTEM_PROMPT,
        user_prompt,
        json_mode=False,
        temperature=0.6,
        max_tokens=512,
    )

    if not raw:
        tier = v_data.get("tier_id", "STABLE")
        if tier == "CRITICAL":
            return (
                f"Your Vitality Score is at {score}/100, which is in the critical range. "
                f"I strongly recommend contacting your care team or calling 911 right away. "
                f"I'm here to help, but you need a human in the loop right now."
            )
        elif tier == "ELEVATED":
            return (
                f"Your Vitality Score is at {score}/100. I'm seeing some concerning signals "
                f"in your data. I'd recommend reaching out to your care team today for a check-in."
            )
        else:
            return (
                f"Your Vitality Score is currently {score}/100. "
                f"I'm monitoring your vitals and everything looks within expected ranges. "
                f"Let me know if you have any specific concerns."
            )

    return raw


ALERT_SYSTEM_PROMPT = """\
You are a clinical alert composer. Given a patient's health flags, generate a brief, \
actionable alert message suitable for sending to their caregiver or physician via SMS/push notification.

Rules:
- Lead with the most critical finding
- Include 1-2 specific data points
- End with a recommended action
- Max 280 characters (SMS-friendly)
- No medical jargon a caregiver wouldn't understand

Return ONLY valid JSON:
{"alert_message": "<the alert text>", "priority": "routine|urgent|emergency"}"""


def generate_smart_alert(vitality_result: Any) -> dict:
    v_data = _extract_vitality_data(vitality_result)
    score = v_data.get("vitality_index", 75)
    tier = v_data.get("tier_id", "STABLE")
    flags = v_data.get("flags", [])

    if tier == "STABLE":
        return {
            "alert_message": None,
            "priority": "routine",
            "should_send": False,
        }

    context = _format_signals_context(v_data)
    user_prompt = f"Patient state:\n{context}\n\nCompose the alert."

    raw = _call_openrouter(ALERT_SYSTEM_PROMPT, user_prompt, json_mode=True, temperature=0.2, max_tokens=256)

    priority_map = {"CRITICAL": "emergency", "ELEVATED": "urgent", "WATCH": "routine"}

    fallback = {
        "alert_message": (
            f"Vitality alert: score dropped to {score}/100. "
            f"Top concern: {flags[0] if flags else 'Multiple flags detected'}. "
            f"Please check in."
        )[:280],
        "priority": priority_map.get(tier, "routine"),
    }

    result = _safe_parse_json(raw, fallback)
    result["should_send"] = tier in ("CRITICAL", "ELEVATED", "WATCH")
    return result
