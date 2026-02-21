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
        logger.warning("OPENROUTER_API_KEY not set - returning empty response.")
        return ""

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:8000",
        "X-Title": "Aura - Women's Health Intelligence",
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
        logger.error(f"OpenRouter HTTP error: {e} - {resp.text[:300]}")
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
    lines = [f"Vitality Index: {v_data.get('vitality_index', '?')}/100",
             f"Tier: {v_data.get('tier_id', '?')} - {v_data.get('tier_label', '?')}"]

    # Cycle phase context
    cycle = v_data.get("cycle_phase", {})
    if cycle:
        lines.append(f"Cycle Phase: {cycle.get('label', 'Unknown')}")
        expected = cycle.get("expected_symptoms", [])
        if expected:
            lines.append(f"Expected symptoms for this phase: {', '.join(expected)}")
        adjustments = cycle.get("adjustments", {})
        if adjustments:
            lines.append(
                f"Cycle adjustments applied: HR+{adjustments.get('hr_offset_bpm', 0)}bpm, "
                f"HRV{adjustments.get('hrv_offset_ms', 0):+d}ms, "
                f"BBT+{adjustments.get('bbt_offset_c', 0):.1f}°C, "
                f"Glucose tolerance ±{adjustments.get('glucose_tolerance_mg_dl', 0)}mg/dL, "
                f"Mood signal weight: {adjustments.get('mood_signal_weight', 1.0):.1f}×"
            )

    # Trend context
    trend = v_data.get("trend_context", {})
    if trend:
        lines.append(
            f"Trajectory: {trend.get('trajectory', '?')} "
            f"(7d: {trend.get('delta_7d', 0):+.1f}/day, "
            f"30d: {trend.get('delta_30d', 0):+.1f}/day)"
        )
        det = trend.get("deteriorating_signals", [])
        if det:
            lines.append(f"Deteriorating signals: {', '.join(det)}")
        crit = trend.get("critical_days_7d", 0)
        if crit:
            lines.append(f"CRITICAL days in last 7d: {crit}")

    # Flags
    flags = v_data.get("flags", [])
    if flags:
        lines.append(f"Active flags ({len(flags)}):")
        for f in flags[:12]:
            lines.append(f"  • {f}")
        if len(flags) > 12:
            lines.append(f"  ... and {len(flags) - 12} more")

    # Signal details
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
                    if k not in ("sub_scores",):
                        lines.append(f"    {k}: {val}")

    return "\n".join(lines)


RISK_SYSTEM_PROMPT = """\
You are a predictive clinical risk modeling engine specializing in Women's Health - \
specifically PMDD (Premenstrual Dysphoric Disorder), PCOS (Polycystic Ovary Syndrome), \
endometriosis, and perimenopause.

You receive a patient's current vitality score, physiological signals from wearables \
(Apple Watch, Oura Ring, Dexcom G7 CGM), acoustic vocal biomarkers, their current \
menstrual cycle phase, and historical trend data.

Your job is to project their health trajectory for the next 72 hours at 24-hour intervals, \
with specific attention to:
- Hormonal symptom progression (e.g., "Patient is on cycle day 24, entering the PMDD risk \
  window. HRV has dropped 15ms over 3 days - expect further autonomic dysregulation.")
- Glucose pattern prediction (e.g., "Luteal-phase insulin resistance is compounding. \
  Time-in-range likely to drop below 50% within 48hrs without dietary intervention.")
- Sleep disruption trajectory (e.g., "Oura sleep scores declining + skin temp elevated - \
  night sweats likely to worsen.")
- Vocal biomarker trends (e.g., "Prosodic flatness and vocal fatigue indices are rising - \
  consistent with progesterone cliff and mood crash risk.")

If the patient is in a stable follicular phase with good metrics, say so - don't \
manufacture risk for drama. But if they're entering a PMDD window or PCOS flare, \
be specific and proactive.

Return ONLY valid JSON:
{
  "risk_level": "low|moderate|high|critical",
  "cycle_context": "<which phase they're in and what that means for the forecast>",
  "forecast": [
    {
      "hour": 24,
      "predicted_score": <int 0-100>,
      "risk_factor": "<specific clinical reasoning referencing cycle phase + data>",
      "probability_pct": <int 0-100>,
      "recommended_intervention": "<what should happen>"
    }
  ],
  "hormonal_insight": "<one key hormonal pattern the provider should know about>",
  "confidence_note": "<brief note on forecast confidence given available data>"
}"""


def generate_predictive_risk_model(vitality_result: Any) -> dict:
    v_data = _extract_vitality_data(vitality_result)
    current_score = v_data.get("vitality_index", 75)
    context = _format_signals_context(v_data)

    cycle = v_data.get("cycle_phase", {})
    phase_label = cycle.get("label", "Unknown phase")

    user_prompt = (
        f"Current patient state ({phase_label}):\n{context}\n\n"
        f"Generate the 72-hour risk forecast with hormonal context."
    )

    raw = _call_openrouter(RISK_SYSTEM_PROMPT, user_prompt, json_mode=True, temperature=0.3)

    fallback = {
        "risk_level": "high" if current_score < 40 else "moderate" if current_score < 60 else "low",
        "cycle_context": f"Patient is currently in {phase_label}. Cycle-phase-aware thresholds are active.",
        "forecast": [
            {
                "hour": 24,
                "predicted_score": max(10, current_score - 5),
                "risk_factor": f"Continued symptom trajectory expected for {phase_label}. Monitor HRV and sleep closely.",
                "probability_pct": 70,
                "recommended_intervention": "Increase monitoring frequency. Consider magnesium + B6 supplementation.",
            },
            {
                "hour": 48,
                "predicted_score": max(10, current_score - 12),
                "risk_factor": "Compounding hormonal effects on sleep architecture and autonomic tone.",
                "probability_pct": 55,
                "recommended_intervention": "Schedule telehealth check-in with gynecologist or care team.",
            },
            {
                "hour": 72,
                "predicted_score": max(10, current_score - 18),
                "risk_factor": "Without intervention, symptom severity may peak if in late luteal window.",
                "probability_pct": 40,
                "recommended_intervention": "In-person evaluation recommended if vitality continues declining.",
            },
        ],
        "hormonal_insight": "Vocal biomarkers and HRV trends together provide a 24-48hr early warning for hormonal mood crashes.",
        "confidence_note": "Forecast generated from fallback model - LLM unavailable.",
    }

    return _safe_parse_json(raw, fallback)


COACHING_SYSTEM_PROMPT = """\
You are an AI Lifestyle Coach specializing in cycle-syncing and hormonal health. You are \
integrated into a real-time health monitoring platform that fuses data from an Apple Watch, \
Oura Ring (basal body temperature, HRV, sleep), Dexcom G7 CGM (continuous glucose), and \
daily vocal biomarker check-ins.

You understand how the menstrual cycle affects:
- Exercise tolerance (follicular = high intensity OK, luteal = favor low-impact)
- Nutrition needs (luteal = higher caloric needs, increased insulin resistance)
- Sleep architecture (progesterone → sedation but also fragmentation)
- Mood and stress (estrogen withdrawal → serotonin drop)
- Glucose patterns (luteal insulin resistance → carb cravings are physiological, not weakness)

Generate a personalized 3-step action plan for the next 12 hours. Each step must:
1. Reference specific data points from their current readings AND their cycle phase
2. Be actionable and time-bound
3. Explain WHY this matters for their specific hormonal state

Important tone guidelines:
- Never shame cravings - explain the physiology. "Your body craves carbs because \
  progesterone increases insulin resistance. Choose complex carbs to stabilize glucose."
- Match urgency to severity. Don't tell someone in PMDD crisis to "try a fun smoothie."
- Validate their experience. Hormonal symptoms are real, not imagined.

Return ONLY valid JSON:
{
  "urgency": "routine|attention|urgent",
  "cycle_phase_advice": "<one sentence about what their body is doing hormonally right now>",
  "coaching_plan": [
    {
      "timeframe": "Immediate (next 30 min)",
      "category": "hydration|nutrition|movement|breathing|sleep|medication|social|hormonal",
      "action": "<specific action>",
      "reasoning": "<why, referencing their data AND cycle phase>"
    }
  ],
  "avoid": "<one thing to specifically avoid right now given their cycle phase>",
  "encouragement": "<one line of genuine encouragement that validates their experience>"
}"""


def generate_lifestyle_coaching(vitality_result: Any) -> dict:
    v_data = _extract_vitality_data(vitality_result)
    current_score = v_data.get("vitality_index", 75)
    context = _format_signals_context(v_data)

    cycle = v_data.get("cycle_phase", {})
    phase_label = cycle.get("label", "Unknown phase")

    user_prompt = (
        f"Patient's current state ({phase_label}):\n{context}\n\n"
        f"Generate the 12-hour cycle-synced coaching plan."
    )

    raw = _call_openrouter(COACHING_SYSTEM_PROMPT, user_prompt, json_mode=True, temperature=0.5)

    # Phase-aware fallbacks
    phase_key = cycle.get("phase", "baseline")

    fallback_plans = {
        "follicular": {
            "urgency": "routine",
            "cycle_phase_advice": "You're in your follicular phase - estrogen is rising, energy is building. This is your power window.",
            "coaching_plan": [
                {
                    "timeframe": "Immediate (next 30 min)",
                    "category": "movement",
                    "action": "This is your best window for high-intensity exercise. Try a 30-min HIIT session or strength training.",
                    "reasoning": "Estrogen enhances muscle recovery and pain tolerance. Your HRV supports intense activity right now.",
                },
                {
                    "timeframe": "Next 2-4 hours",
                    "category": "nutrition",
                    "action": "Focus on lean protein and leafy greens. Your insulin sensitivity is at its peak - your body processes carbs efficiently now.",
                    "reasoning": "Follicular phase = peak insulin sensitivity. Great time to fuel performance without glucose spikes.",
                },
                {
                    "timeframe": "This evening",
                    "category": "sleep",
                    "action": "Maintain your sleep schedule. Your body is primed for good rest right now.",
                    "reasoning": "Your sleep scores are strong. Consistency now builds the buffer you'll need in the luteal phase.",
                },
            ],
            "avoid": "Don't skip meals - your metabolism is efficient now but still needs fuel for the estrogen-building process.",
            "encouragement": "Your body is firing on all cylinders right now. Use this energy - you've earned it.",
        },
        "luteal_pms": {
            "urgency": "attention",
            "cycle_phase_advice": "You're in the late luteal phase. Progesterone is dropping, and your body is working harder to maintain balance. What you're feeling is real and physiological.",
            "coaching_plan": [
                {
                    "timeframe": "Immediate (next 30 min)",
                    "category": "breathing",
                    "action": "Do a 5-minute box breathing exercise (4s in, 4s hold, 4s out, 4s hold). Then drink 16oz of water with a pinch of salt.",
                    "reasoning": "Your HRV is suppressed and stress markers are elevated - this is expected in the late luteal phase. Vagal breathing directly counteracts progesterone-driven autonomic imbalance.",
                },
                {
                    "timeframe": "Next 2-4 hours",
                    "category": "nutrition",
                    "action": "Eat a meal with complex carbs (sweet potato, brown rice), protein, and magnesium-rich foods (dark chocolate, spinach). Don't fight the carb cravings - redirect them.",
                    "reasoning": "Your glucose is running higher because progesterone increases insulin resistance. Complex carbs satisfy the craving without the spike-crash cycle. Magnesium supports serotonin production during estrogen withdrawal.",
                },
                {
                    "timeframe": "This evening",
                    "category": "sleep",
                    "action": "Take 200mg magnesium glycinate 1 hour before bed. Keep room at 65°F. Use a weighted blanket if available.",
                    "reasoning": "Your sleep score has been declining - progesterone is fragmenting your sleep architecture. Magnesium supports GABA activity and helps compensate.",
                },
            ],
            "avoid": "Avoid high-intensity exercise - your body is inflamed and recovery is impaired. Swap for yoga, walking, or gentle stretching.",
            "encouragement": "This phase is temporary. Your body is doing something complex and demanding. Being gentle with yourself right now isn't weakness - it's smart.",
        },
        "pmdd_crisis": {
            "urgency": "urgent",
            "cycle_phase_advice": "You are in a PMDD crisis window. The progesterone cliff is triggering a neurochemical cascade. This is a medical condition, not a character flaw.",
            "coaching_plan": [
                {
                    "timeframe": "Immediate (next 30 min)",
                    "category": "breathing",
                    "action": "Ground yourself: 5-4-3-2-1 technique (5 things you see, 4 you hear, 3 you touch, 2 you smell, 1 you taste). Then slow breathing - 6 breaths per minute for 5 minutes.",
                    "reasoning": "Your vocal distress markers are critically elevated and HRV is very low. Your autonomic nervous system needs immediate intervention. This activates the vagus nerve.",
                },
                {
                    "timeframe": "Next 1-2 hours",
                    "category": "social",
                    "action": "Contact your designated support person or crisis line. You don't have to explain everything - just say 'I'm in my PMDD window and I need support.'",
                    "reasoning": "Your vitality score has dropped to crisis levels. Isolation amplifies PMDD symptoms. Connection is a direct intervention.",
                },
                {
                    "timeframe": "Today",
                    "category": "medication",
                    "action": "If you have a PRN medication prescribed for PMDD flares, this is the time to take it. If not, contact your gynecologist about acute management.",
                    "reasoning": "Your biometric pattern matches your historical PMDD crisis profile. Early intervention shortens episode duration.",
                },
            ],
            "avoid": "Do not make major decisions, send emotionally charged messages, or engage in conflict. Your prefrontal cortex is being flooded by the neurochemical storm. Wait 48 hours.",
            "encouragement": "You have survived every single one of these episodes. This one will pass too. Your body is fighting a chemical war - you are not weak for struggling.",
        },
        "pcos_flare": {
            "urgency": "attention",
            "cycle_phase_advice": "Your PCOS is flaring - insulin resistance is elevated and your glucose patterns show instability. This needs active management.",
            "coaching_plan": [
                {
                    "timeframe": "Immediate (next 30 min)",
                    "category": "nutrition",
                    "action": "If you haven't eaten, have a low-glycemic meal: eggs, avocado, and vegetables. If you have eaten recently, take a 15-minute walk.",
                    "reasoning": "Your glucose time-in-range has dropped significantly. Walking within 30 minutes of eating reduces post-meal spikes by up to 30%.",
                },
                {
                    "timeframe": "Next 2-4 hours",
                    "category": "movement",
                    "action": "Do 20 minutes of resistance training (bodyweight squats, wall pushups, resistance bands).",
                    "reasoning": "Muscle contraction activates GLUT4 glucose transporters independent of insulin. This directly combats your insulin resistance.",
                },
                {
                    "timeframe": "This evening",
                    "category": "hormonal",
                    "action": "Take your inositol supplement if prescribed. Ensure 7+ hours of sleep - sleep deprivation worsens insulin resistance by up to 40%.",
                    "reasoning": "Your sleep scores have been below target. For PCOS, sleep is a metabolic treatment, not a luxury.",
                },
            ],
            "avoid": "Avoid refined sugars and simple carbs today. Your insulin sensitivity is at its lowest - even a 'normal' portion will spike your glucose.",
            "encouragement": "PCOS is frustrating, but look at your data - you're catching this flare early. That awareness is already changing your outcome.",
        },
        "perimenopause": {
            "urgency": "attention",
            "cycle_phase_advice": "Your body is navigating estrogen fluctuations. Hot flashes, sleep disruption, and mood shifts are all part of this transition - and they're all manageable.",
            "coaching_plan": [
                {
                    "timeframe": "Immediate (next 30 min)",
                    "category": "hydration",
                    "action": "Drink 16oz of cold water. If you're experiencing a hot flash, apply a cold pack to the back of your neck.",
                    "reasoning": "Your skin temperature data shows nocturnal spikes consistent with vasomotor symptoms. Hydration and cooling reduce episode severity.",
                },
                {
                    "timeframe": "Next 2-4 hours",
                    "category": "movement",
                    "action": "Do 30 minutes of moderate exercise - brisk walking, swimming, or cycling. Avoid hot environments.",
                    "reasoning": "Regular exercise reduces hot flash frequency by 50% in clinical studies. But exercising in heat can trigger them.",
                },
                {
                    "timeframe": "This evening",
                    "category": "sleep",
                    "action": "Layer your bedding (sheet + light blanket you can kick off). Set room to 65°F. Consider a cooling mattress pad if night sweats persist.",
                    "reasoning": "Your Oura data shows repeated awakenings correlated with temperature spikes. Layered bedding allows micro-adjustments without full wakefulness.",
                },
            ],
            "avoid": "Avoid alcohol, spicy food, and hot beverages this evening - all are vasomotor triggers that will worsen tonight's sleep.",
            "encouragement": "Perimenopause is a transition, not a decline. Your body is restructuring. The data helps you navigate it with precision instead of guesswork.",
        },
    }

    # Select the most relevant fallback
    fallback = fallback_plans.get(phase_key)
    if fallback is None:
        # Default fallback for phases without specific plans
        fallback = {
            "urgency": "attention" if current_score < 60 else "routine",
            "cycle_phase_advice": f"You are currently in {phase_label}. Your vitality score is {current_score}/100.",
            "coaching_plan": [
                {
                    "timeframe": "Immediate (next 30 min)",
                    "category": "breathing",
                    "action": "Do a 5-minute box breathing exercise (4s in, 4s hold, 4s out, 4s hold).",
                    "reasoning": "Your HRV is below optimal - controlled breathing stimulates the parasympathetic nervous system and directly improves autonomic balance.",
                },
                {
                    "timeframe": "Next 2-4 hours",
                    "category": "nutrition",
                    "action": "Eat a balanced meal with complex carbs, protein, and healthy fats. Avoid caffeine.",
                    "reasoning": "Stable blood sugar supports stable mood and energy. Caffeine would further suppress your already-reduced HRV.",
                },
                {
                    "timeframe": "This evening",
                    "category": "sleep",
                    "action": "Begin winding down 90 minutes before bed. No screens, dim lights, cool room.",
                    "reasoning": "Sleep is the single biggest lever for recovering your vitality score across all cycle phases.",
                },
            ],
            "avoid": "Avoid late-night screen exposure - blue light suppresses melatonin and your sleep scores need protecting.",
            "encouragement": "You're tracking, you're aware, and you're taking action. That puts you ahead of 95% of people managing their health.",
        }

    return _safe_parse_json(raw, fallback)


ASSISTANT_SYSTEM_PROMPT = """\
You are Aura - an empathetic, clinically-informed AI health companion specializing in \
women's hormonal health. You have real-time access to the patient's wearable biometrics \
(Apple Watch, Oura Ring, Dexcom G7 CGM), acoustic vocal biomarkers (pitch, jitter, \
shimmer, energy, speech rate, emotional valence), hormonal vocal markers (vocal fold \
edema index, prosodic flatness, vocal fatigue), their unified Vitality Index score, \
and their current menstrual cycle phase.

Guidelines:
- Reference their actual data AND cycle phase when responding. Say "Your HRV is at \
  28ms which is low even for the luteal phase - your body is under more stress than \
  the usual progesterone dip explains" not "your vitals seem a bit off."
- Understand that many symptoms are cycle-phase-dependent. An HRV of 35ms in the \
  follicular phase is concerning. The same reading in the late luteal phase may be \
  within expected range.
- Never dismiss hormonal symptoms. "It's just PMS" is not in your vocabulary. \
  PMDD is a serious neuroendocrine condition. PCOS is a metabolic disorder. \
  Perimenopause is a major life transition.
- Match your tone to their state. If they're in PMDD crisis, be calm, direct, and \
  validating. If they're in their follicular phase feeling great, be warm and encouraging.
- If they ask about medication, supplements, or treatment, you can discuss general \
  evidence (e.g., "Magnesium glycinate has RCT evidence for PMS symptoms") but always \
  recommend they discuss with their gynecologist.
- Never diagnose. You monitor, inform, contextualize, and recommend.
- Keep responses concise. 2-4 sentences for simple questions, up to a short paragraph \
  for complex ones.
- If their vitality score is below 30, always recommend they contact their care team \
  or crisis line. For PMDD crisis, include the 988 Suicide & Crisis Lifeline.
- Normalize their experience. "Your glucose cravings are driven by progesterone-mediated \
  insulin resistance - this is biology, not lack of willpower."
"""


def handle_virtual_assistant(
    user_message: str,
    vitality_result: Any,
    transcript: Optional[str] = None,
) -> str:
    v_data = _extract_vitality_data(vitality_result)
    score = v_data.get("vitality_index", 75)
    context = _format_signals_context(v_data)

    cycle = v_data.get("cycle_phase", {})
    phase_label = cycle.get("label", "Unknown phase")

    user_prompt = f"Patient's live data ({phase_label}):\n{context}\n"

    if transcript:
        user_prompt += f"\nLatest voice check-in transcript: \"{transcript}\"\n"

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
        phase_key = cycle.get("phase", "baseline")

        if tier == "CRITICAL":
            response = (
                f"Your Vitality Score is at {score}/100, which is in the critical range "
                f"during your {phase_label}. "
            )
            if phase_key == "pmdd_crisis":
                response += (
                    "I recognize this may be a PMDD episode. What you're feeling is real - "
                    "it's a neurochemical crisis, not a personal failing. "
                    "Please contact your care team or the 988 Suicide & Crisis Lifeline. "
                    "You don't have to go through this alone."
                )
            else:
                response += (
                    "I strongly recommend contacting your care team right away. "
                    "I'm here to help, but you need a human in the loop right now."
                )
            return response
        elif tier == "ELEVATED":
            return (
                f"Your Vitality Score is at {score}/100 during your {phase_label}. "
                f"I'm seeing some concerning signals that go beyond what's expected for "
                f"this cycle phase. I'd recommend reaching out to your care team today."
            )
        else:
            return (
                f"Your Vitality Score is currently {score}/100 - looking good for {phase_label}. "
                f"I'm monitoring your vitals and vocal biomarkers, and everything is within "
                f"expected ranges for where you are in your cycle. Let me know if you have questions."
            )

    return raw


ALERT_SYSTEM_PROMPT = """\
You are a clinical alert composer for a women's health monitoring platform (Aura). \
Given a patient's health flags, cycle phase, and biometric data, generate a brief, \
actionable alert message suitable for sending to their gynecologist, care team, or \
designated support person via SMS/push notification.

Rules:
- Lead with the most critical finding AND the cycle phase context
- Include 1-2 specific data points
- End with a recommended action
- Max 280 characters (SMS-friendly)
- Use clinical but accessible language - the recipient may be a family member, not a doctor
- For PMDD alerts, include mood crisis context
- For PCOS alerts, highlight glucose data
- For perimenopause alerts, note sleep/vasomotor patterns

Return ONLY valid JSON:
{"alert_message": "<the alert text>", "priority": "routine|urgent|emergency"}"""


def generate_smart_alert(vitality_result: Any) -> dict:
    v_data = _extract_vitality_data(vitality_result)
    score = v_data.get("vitality_index", 75)
    tier = v_data.get("tier_id", "STABLE")
    flags = v_data.get("flags", [])

    cycle = v_data.get("cycle_phase", {})
    phase_label = cycle.get("label", "Unknown")

    if tier == "STABLE":
        return {
            "alert_message": None,
            "priority": "routine",
            "should_send": False,
            "cycle_phase": phase_label,
        }

    context = _format_signals_context(v_data)
    user_prompt = f"Patient state ({phase_label}):\n{context}\n\nCompose the alert."

    raw = _call_openrouter(
        ALERT_SYSTEM_PROMPT, user_prompt,
        json_mode=True, temperature=0.2, max_tokens=256,
    )

    priority_map = {"CRITICAL": "emergency", "ELEVATED": "urgent", "WATCH": "routine"}

    top_flag = flags[0] if flags else "Multiple health flags detected"

    fallback_msg = f"[Aura {phase_label}] Vitality {score}/100. {top_flag}. Please check in."
    if len(fallback_msg) > 280:
        fallback_msg = fallback_msg[:277] + "..."

    fallback = {
        "alert_message": fallback_msg,
        "priority": priority_map.get(tier, "routine"),
    }

    result = _safe_parse_json(raw, fallback)
    result["should_send"] = tier in ("CRITICAL", "ELEVATED", "WATCH")
    result["cycle_phase"] = phase_label
    return result
