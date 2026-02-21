import math
from datetime import datetime, timedelta
from typing import Optional


PROFILE_CURVES = {
    "follicular": {
        "base": 88, "slope": 0.1, "volatility": 2.5,
        "hr_base": 65, "hrv_base": 58, "glucose_base": 95,
        "sleep_base": 85, "stress_base": 18, "temp_base": 36.2,
        "label": "Follicular Phase",
        "description": "Estrogen rising, energy high, stable vitals",
    },
    "ovulation": {
        "base": 85, "slope": 0.0, "volatility": 3.0,
        "hr_base": 68, "hrv_base": 55, "glucose_base": 92,
        "sleep_base": 82, "stress_base": 22, "temp_base": 36.4,
        "label": "Ovulation",
        "description": "LH surge, slight HR/temp rise, peak fertility",
    },
    "luteal_mild": {
        "base": 78, "slope": -0.3, "volatility": 3.5,
        "hr_base": 74, "hrv_base": 42, "glucose_base": 115,
        "sleep_base": 72, "stress_base": 38, "temp_base": 36.7,
        "label": "Early Luteal (Mild PMS)",
        "description": "Progesterone dominant, mild symptoms beginning",
    },
    "luteal_pms": {
        "base": 65, "slope": -0.7, "volatility": 6.0,
        "hr_base": 80, "hrv_base": 32, "glucose_base": 135,
        "sleep_base": 58, "stress_base": 62, "temp_base": 36.9,
        "label": "Late Luteal / PMS",
        "description": "Progesterone dropping, mood lability, cravings, poor sleep",
    },
    "pmdd_crisis": {
        "base": 38, "slope": -1.5, "volatility": 8.0,
        "hr_base": 92, "hrv_base": 18, "glucose_base": 155,
        "sleep_base": 35, "stress_base": 85, "temp_base": 37.1,
        "label": "PMDD Crisis",
        "description": "Severe late-luteal mood crash, suicidal ideation risk, autonomic dysregulation",
    },

    "pcos_flare": {
        "base": 58, "slope": -0.6, "volatility": 5.0,
        "hr_base": 82, "hrv_base": 28, "glucose_base": 175,
        "sleep_base": 55, "stress_base": 58, "temp_base": 36.5,
        "label": "PCOS Flare",
        "description": "Insulin resistance spike, erratic glucose, hormonal imbalance",
    },
    "perimenopause": {
        "base": 68, "slope": -0.4, "volatility": 7.0,
        "hr_base": 78, "hrv_base": 30, "glucose_base": 120,
        "sleep_base": 48, "stress_base": 52, "temp_base": 36.4,
        "label": "Perimenopause",
        "description": "Erratic estrogen, hot flashes, night sweats, sleep disruption",
    },

    "baseline": {
        "base": 85, "slope": 0.0, "volatility": 3.0,
        "hr_base": 72, "hrv_base": 52, "glucose_base": 105,
        "sleep_base": 80, "stress_base": 30, "temp_base": 36.3,
        "label": "Baseline",
        "description": "Standard monitoring, no active hormonal flags",
    },
}


def _get_curve(profile: str) -> dict:
    return PROFILE_CURVES.get(profile, PROFILE_CURVES["baseline"]).copy()


def _clamp(val: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, val))


def _deterministic_noise(seed_val: float, volatility: float) -> float:
    return math.sin(seed_val * 127.1 + 311.7) * volatility


def _seeded_random(seed_val: float, lo: float, hi: float) -> float:
    x = math.sin(seed_val * 43758.5453) * 10000
    frac = x - math.floor(x)
    return lo + frac * (hi - lo)


def get_historical_vitality(profile: str, days_back: int = 30) -> list[dict]:
    curve = _get_curve(profile)
    base = curve["base"]
    slope = curve["slope"]
    vol = curve["volatility"]
    now = datetime.utcnow()
    history = []

    for i in range(days_back, -1, -1):
        target = base - (slope * i)
        weekly = math.sin(i / 7.0 * math.pi) * 4.0
        noise = _deterministic_noise(i * 1.0, vol)

        score = _clamp(target + weekly + noise, 10, 100)

        if score >= 80:
            tier = "STABLE"
        elif score >= 55:
            tier = "WATCH"
        elif score >= 30:
            tier = "ELEVATED"
        else:
            tier = "CRITICAL"

        # Estimate cycle day (28-day cycle, day 1 = today - days_back)
        cycle_day = ((days_back - i) % 28) + 1

        if cycle_day <= 5:
            phase = "menstruation"
        elif cycle_day <= 13:
            phase = "follicular"
        elif cycle_day <= 15:
            phase = "ovulation"
        elif cycle_day <= 21:
            phase = "early_luteal"
        else:
            phase = "late_luteal"

        history.append({
            "date": (now - timedelta(days=i)).strftime("%Y-%m-%d"),
            "vitality_index": round(score, 1),
            "tier": tier,
            "cycle_day": cycle_day,
            "cycle_phase": phase,
        })

    return history


def get_hourly_vitality(profile: str, hours_back: int = 48) -> list[dict]:
    curve = _get_curve(profile)
    base = curve["base"]
    vol = curve["volatility"]
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    history = []

    for i in range(hours_back, -1, -1):
        hour_of_day = (now - timedelta(hours=i)).hour
        circadian = math.sin((hour_of_day - 5) / 24.0 * 2 * math.pi) * 3.0

        noise = _deterministic_noise(i * 0.7, vol * 0.5)
        score = _clamp(base + circadian + noise, 10, 100)

        if score >= 80:
            tier = "STABLE"
        elif score >= 55:
            tier = "WATCH"
        elif score >= 30:
            tier = "ELEVATED"
        else:
            tier = "CRITICAL"

        history.append({
            "timestamp": (now - timedelta(hours=i)).isoformat() + "Z",
            "vitality_index": round(score, 1),
            "tier": tier,
        })

    return history


def get_signal_history(
    profile: str,
    signal: str,
    days_back: int = 30,
) -> list[dict]:
    curve = _get_curve(profile)
    now = datetime.utcnow()
    history = []

    configs = {
        "heart_rate": {
            "base": curve["hr_base"], "lo": 45, "hi": 130, "vol": 4,
            "unit": "bpm", "good": (55, 85), "warn": (45, 100),
        },
        "hrv": {
            "base": curve["hrv_base"], "lo": 8, "hi": 95, "vol": 5,
            "unit": "ms", "good": (40, 95), "warn": (20, 40),
        },
        "glucose": {
            "base": curve["glucose_base"], "lo": 55, "hi": 300, "vol": 15,
            "unit": "mg/dL", "good": (70, 140), "warn": (55, 180),
        },
        "sleep_score": {
            "base": curve["sleep_base"], "lo": 10, "hi": 100, "vol": 6,
            "unit": "score", "good": (75, 100), "warn": (50, 75),
        },
        "stress": {
            "base": curve["stress_base"], "lo": 0, "hi": 100, "vol": 8,
            "unit": "level", "good": (0, 30), "warn": (30, 60),
            "inverted": True,
        },
        "spo2": {
            "base": 97, "lo": 88, "hi": 100, "vol": 1,
            "unit": "%", "good": (96, 100), "warn": (92, 96),
        },
        "blood_pressure": {
            "base": 118, "lo": 90, "hi": 160, "vol": 4,
            "unit": "mmHg (systolic)", "good": (100, 125), "warn": (90, 135),
        },
        "respiratory_rate": {
            "base": 15, "lo": 10, "hi": 28, "vol": 1.5,
            "unit": "brpm", "good": (12, 18), "warn": (10, 22),
        },
        "steps": {
            "base": 6000 if curve["base"] > 70 else 2500,
            "lo": 0, "hi": 20000, "vol": 1500,
            "unit": "steps", "good": (6000, 20000), "warn": (3000, 6000),
        },
        "basal_body_temp": {
            "base": curve.get("temp_base", 36.3), "lo": 35.5, "hi": 38.0, "vol": 0.15,
            "unit": "°C", "good": (36.0, 36.8), "warn": (35.8, 37.2),
        },
        "skin_temperature_delta": {
            "base": 0.0, "lo": -2.0, "hi": 3.0, "vol": 0.3,
            "unit": "°C (delta)", "good": (-0.5, 0.5), "warn": (-1.0, 1.0),
        },
    }

    # Cycle-phase modulated signals: BBT rises in luteal
    if signal == "basal_body_temp":
        # For luteal/pmdd profiles, the base is already elevated in the curve
        pass
    if signal == "skin_temperature_delta":
        # Delta correlates with phase - luteal profiles run hotter
        temp_base = curve.get("temp_base", 36.3)
        configs["skin_temperature_delta"]["base"] = round(temp_base - 36.3, 2)

    cfg = configs.get(signal)
    if cfg is None:
        return [{"error": f"Unknown signal: {signal}. Options: {list(configs.keys())}"}]

    inverted = cfg.get("inverted", False)
    good_lo, good_hi = cfg["good"]
    warn_lo, warn_hi = cfg["warn"]

    for i in range(days_back, -1, -1):
        slope_contrib = (curve["slope"] * 0.3) * (days_back - i) / days_back
        weekly = math.sin(i / 7.0 * math.pi) * (cfg["vol"] * 0.3)
        noise = _deterministic_noise(i * 3.7 + hash(signal) % 100, cfg["vol"])

        # Cycle-day modulation for BBT
        if signal == "basal_body_temp":
            cycle_day = ((days_back - i) % 28) + 1
            if cycle_day > 14:
                # Luteal rise
                luteal_rise = 0.3 * math.sin((cycle_day - 14) / 14.0 * math.pi)
                noise += luteal_rise

        val = _clamp(cfg["base"] + slope_contrib * cfg["vol"] + weekly + noise, cfg["lo"], cfg["hi"])

        if inverted:
            if val <= good_hi:
                zone = "good"
            elif val <= warn_hi:
                zone = "warning"
            else:
                zone = "critical"
        else:
            if good_lo <= val <= good_hi:
                zone = "good"
            elif warn_lo <= val <= warn_hi:
                zone = "warning"
            else:
                zone = "critical"

        entry = {
            "date": (now - timedelta(days=i)).strftime("%Y-%m-%d"),
            "value": round(val, 2 if signal in ("basal_body_temp", "skin_temperature_delta") else 1),
            "unit": cfg["unit"],
            "zone": zone,
        }

        # Add cycle day to hormone-relevant signals
        if signal in ("basal_body_temp", "skin_temperature_delta", "hrv", "stress"):
            cycle_day = ((days_back - i) % 28) + 1
            entry["cycle_day"] = cycle_day

        history.append(entry)

    return history


def get_composite_timeline(profile: str, days_back: int = 30) -> dict:
    signals = [
        "heart_rate", "hrv", "glucose", "sleep_score",
        "stress", "spo2", "blood_pressure", "respiratory_rate",
        "steps", "basal_body_temp", "skin_temperature_delta",
    ]

    curve = _get_curve(profile)

    return {
        "profile": profile,
        "profile_label": curve.get("label", profile),
        "profile_description": curve.get("description", ""),
        "days_back": days_back,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "vitality_index": get_historical_vitality(profile, days_back),
        "signals": {
            sig: get_signal_history(profile, sig, days_back)
            for sig in signals
        },
        "events": get_event_timeline(profile),
        "trends": compute_all_trends(profile, days_back),
    }


EVENT_TEMPLATES = {
    "follicular": [
        {"day": -2,  "type": "cycle",     "title": "Day 8 - Follicular phase", "detail": "Estrogen rising. Energy levels high, HRV improving."},
        {"day": -5,  "type": "workout",   "title": "HIIT session - 40 min", "detail": "Peak performance window. Avg HR 155bpm, recovery HR excellent."},
        {"day": -7,  "type": "check_in",  "title": "Weekly cycle check-in", "detail": "All vitals optimal for follicular phase. BBT stable at 36.2°C."},
        {"day": -10, "type": "cycle",     "title": "Menstruation ended", "detail": "Period ended Day 5. Iron levels recovering."},
        {"day": -14, "type": "check_in",  "title": "Cycle Day 1 - Period started", "detail": "New cycle began. Baseline measurements recorded."},
    ],
    "ovulation": [
        {"day": -1,  "type": "cycle",     "title": "Ovulation detected", "detail": "BBT rose 0.3°C overnight. LH surge confirmed by Oura temp pattern."},
        {"day": -2,  "type": "voice",     "title": "Vocal biomarker shift", "detail": "Pitch elevated slightly - consistent with estrogen peak at ovulation."},
        {"day": -3,  "type": "check_in",  "title": "Pre-ovulation check-in", "detail": "HRV 55ms, resting HR 68bpm. Cervical mucus pattern change noted in log."},
        {"day": -7,  "type": "workout",   "title": "Strength training PR", "detail": "Follicular phase strength peak. Squats +5kg from last cycle."},
    ],
    "luteal_mild": [
        {"day": -1,  "type": "cycle",     "title": "Day 18 - Early luteal", "detail": "BBT elevated to 36.7°C. Progesterone rising. Mild bloating noted."},
        {"day": -3,  "type": "glucose",   "title": "Glucose trending higher", "detail": "Post-meal spikes averaging 145 mg/dL (vs 110 in follicular). Insulin sensitivity dropping."},
        {"day": -5,  "type": "sleep",     "title": "Sleep quality dipping", "detail": "Score dropped from 85 to 72. Progesterone disrupting REM architecture."},
        {"day": -8,  "type": "check_in",  "title": "Ovulation confirmed", "detail": "BBT shift confirmed 3 days post-ovulation. Luteal phase began Day 15."},
        {"day": -12, "type": "voice",     "title": "Voice check - stable", "detail": "No significant vocal changes from baseline. Mood stable."},
    ],
    "luteal_pms": [
        {"day": -1,  "type": "alert",     "title": "PMS symptom escalation", "detail": "Vitality dropped to WATCH. HRV 32ms, stress 62/100, sleep score 58."},
        {"day": -2,  "type": "voice",     "title": "Vocal fatigue detected", "detail": "Pitch variance increased 40%. Speech rate slowed. Prosody flattened."},
        {"day": -3,  "type": "glucose",   "title": "Carb cravings + glucose spikes", "detail": "3 post-meal spikes above 170 mg/dL. Time in range dropped to 62%."},
        {"day": -5,  "type": "sleep",     "title": "Insomnia pattern emerging", "detail": "Sleep onset delayed 45min. 3 awakenings. Score: 52."},
        {"day": -7,  "type": "cycle",     "title": "Day 22 - Late luteal", "detail": "Progesterone peaking then dropping. PMS window opened."},
        {"day": -10, "type": "check_in",  "title": "Mid-luteal check-in", "detail": "Mild symptoms. Provider advised magnesium + B6 supplementation."},
    ],
    "pmdd_crisis": [
        {"day": -1,  "type": "alert",     "title": "⚠ PMDD crisis - provider notified", "detail": "Vitality Index crashed to 28 (CRITICAL). Severe mood symptoms. Safety check initiated."},
        {"day": -1,  "type": "voice",     "title": "⚠ Vocal distress markers critical", "detail": "Monotone speech, very low energy, long pauses between words. Distress score: 82/100."},
        {"day": -2,  "type": "alert",     "title": "PMDD symptom escalation", "detail": "HRV dropped to 18ms. Stress 85/100. Patient reported rage + hopelessness."},
        {"day": -3,  "type": "sleep",     "title": "Severe insomnia", "detail": "2.5 hours total sleep. Score: 22. 5 awakenings."},
        {"day": -4,  "type": "glucose",   "title": "Glucose dysregulation", "detail": "Reactive hypoglycemia episode (glucose 58 mg/dL). Followed by spike to 195."},
        {"day": -6,  "type": "cycle",     "title": "Day 24 - PMDD window", "detail": "Progesterone cliff. Historical pattern shows PMDD onset Days 23-26."},
        {"day": -10, "type": "check_in",  "title": "Provider alert set", "detail": "PMDD watch activated based on cycle tracking. Predictive alert armed for Days 22-28."},
        {"day": -14, "type": "cycle",     "title": "Ovulation confirmed", "detail": "BBT shift confirmed. 10-day countdown to PMDD risk window began."},
    ],
    "pcos_flare": [
        {"day": -1,  "type": "glucose",   "title": "⚠ Glucose instability worsening", "detail": "Time in range dropped to 38%. Fasting glucose 165 mg/dL. A1C trending up."},
        {"day": -2,  "type": "alert",     "title": "PCOS flare - care team notified", "detail": "Vitality dropped to ELEVATED. Multi-signal deterioration detected."},
        {"day": -4,  "type": "voice",     "title": "Vocal stress markers elevated", "detail": "Increased pitch variance, faster speech rate. Correlates with cortisol elevation."},
        {"day": -6,  "type": "sleep",     "title": "Sleep apnea pattern detected", "detail": "SpO2 dips during sleep. Oura detected 12 breathing disturbances."},
        {"day": -8,  "type": "cycle",     "title": "Day 42 - No ovulation detected", "detail": "Anovulatory cycle suspected. BBT remains flat, no luteal shift."},
        {"day": -14, "type": "check_in",  "title": "PCOS management review", "detail": "Metformin dosage discussed. Inositol supplementation started."},
        {"day": -21, "type": "glucose",   "title": "Glucose trend worsening", "detail": "7-day avg glucose climbed from 130 to 158 mg/dL."},
    ],
    "perimenopause": [
        {"day": -1,  "type": "alert",     "title": "Hot flash cluster detected", "detail": "Oura skin temp spiked +2.1°C at 2am, 4am, 6am. Heart rate elevated during events."},
        {"day": -2,  "type": "sleep",     "title": "Night sweats disrupted sleep", "detail": "4 awakenings from temperature events. Sleep score: 38. Deep sleep: 12 min."},
        {"day": -4,  "type": "voice",     "title": "Vocal fatigue pattern", "detail": "Low energy speech, slower rate. Consistent with sleep deprivation + estrogen fluctuation."},
        {"day": -6,  "type": "cycle",     "title": "Irregular cycle - Day 45", "detail": "No period for 45 days. Previous cycles: 28, 32, 38, 45 days. Pattern accelerating."},
        {"day": -10, "type": "check_in",  "title": "Perimenopause evaluation", "detail": "Provider ordered FSH/estradiol labs. HRT discussion scheduled."},
        {"day": -15, "type": "glucose",   "title": "Metabolic shift noted", "detail": "Fasting glucose crept from 95 to 118 mg/dL over 6 weeks. Insulin resistance emerging."},
        {"day": -20, "type": "sleep",     "title": "Chronic sleep deficit", "detail": "14-day sleep average: 52/100. Night sweats present 9 of 14 nights."},
    ],
    "baseline": [
        {"day": -2,  "type": "check_in",  "title": "Routine check-in", "detail": "All vitals within normal range. Cycle tracking active."},
        {"day": -7,  "type": "workout",   "title": "30-min morning walk", "detail": "HR avg 98bpm, 3200 steps."},
        {"day": -14, "type": "cycle",     "title": "Cycle Day 1", "detail": "New cycle began. Baselines recorded."},
    ],
}

EVENT_ICONS = {
    "check_in": "📋",
    "alert": "🚨",
    "voice": "🎤",
    "workout": "🏃",
    "sleep": "😴",
    "glucose": "📊",
    "medication": "💊",
    "cycle": "🌸",
}


def get_event_timeline(profile: str) -> list[dict]:
    templates = EVENT_TEMPLATES.get(profile, EVENT_TEMPLATES["baseline"])
    now = datetime.utcnow()

    events = []
    for tmpl in templates:
        event_date = now + timedelta(days=tmpl["day"])
        events.append({
            "date": event_date.strftime("%Y-%m-%d"),
            "timestamp": event_date.isoformat() + "Z",
            "type": tmpl["type"],
            "icon": EVENT_ICONS.get(tmpl["type"], "📌"),
            "title": tmpl["title"],
            "detail": tmpl["detail"],
        })

    return sorted(events, key=lambda e: e["date"])


def compute_trend_delta(history: list[dict], window: int = 7) -> float:
    if len(history) < window:
        return 0.0

    recent = history[-window:]
    key = "vitality_index" if "vitality_index" in recent[0] else "value"
    first = recent[0][key]
    last = recent[-1][key]
    return round((last - first) / window, 2)


def compute_all_trends(profile: str, days_back: int = 30) -> dict:
    vitality_hist = get_historical_vitality(profile, days_back)
    vitality_delta = compute_trend_delta(vitality_hist)

    trends = {
        "vitality_index": _format_trend(vitality_delta, "pts/day"),
    }

    signals = [
        "heart_rate", "hrv", "glucose", "sleep_score",
        "stress", "spo2", "blood_pressure", "respiratory_rate",
        "steps", "basal_body_temp",
    ]

    inverted = {"stress", "heart_rate", "glucose", "blood_pressure", "respiratory_rate"}

    units = {
        "heart_rate": "bpm/day", "hrv": "ms/day", "glucose": "mg/dL/day",
        "sleep_score": "pts/day", "stress": "pts/day", "spo2": "%/day",
        "blood_pressure": "mmHg/day", "respiratory_rate": "brpm/day",
        "steps": "steps/day", "basal_body_temp": "°C/day",
    }

    for sig in signals:
        hist = get_signal_history(profile, sig, days_back)
        delta = compute_trend_delta(hist)
        is_inverted = sig in inverted
        trends[sig] = _format_trend(delta, units.get(sig, "/day"), inverted=is_inverted)

    return trends


def _format_trend(delta: float, unit: str, inverted: bool = False) -> dict:
    if abs(delta) < 0.1:
        direction = "stable"
        sentiment = "neutral"
    elif delta > 0:
        direction = "rising"
        sentiment = "negative" if inverted else "positive"
    else:
        direction = "falling"
        sentiment = "positive" if inverted else "negative"

    arrows = {"rising": "↑", "falling": "↓", "stable": "→"}

    if abs(delta) > 2:
        severity = "significant"
    elif abs(delta) > 0.5:
        severity = "moderate"
    else:
        severity = "minor"

    return {
        "delta": delta,
        "unit": unit,
        "direction": direction,
        "arrow": arrows[direction],
        "sentiment": sentiment,
        "severity": severity,
        "description": f"{arrows[direction]} {abs(delta):.1f} {unit} ({severity} {direction})",
    }


def get_week_comparison(profile: str) -> dict:
    hist = get_historical_vitality(profile, days_back=14)

    if len(hist) < 14:
        return {"error": "Not enough history for comparison"}

    last_week = hist[:7]
    this_week = hist[7:]

    lw_avg = sum(d["vitality_index"] for d in last_week) / 7
    tw_avg = sum(d["vitality_index"] for d in this_week) / 7
    pct_change = round(((tw_avg - lw_avg) / lw_avg) * 100, 1) if lw_avg > 0 else 0

    result = {
        "vitality_index": {
            "last_week_avg": round(lw_avg, 1),
            "this_week_avg": round(tw_avg, 1),
            "change_pct": pct_change,
            "direction": "improving" if pct_change > 0 else "declining" if pct_change < 0 else "stable",
        },
        "signals": {},
    }

    signals = ["heart_rate", "hrv", "glucose", "sleep_score", "stress", "steps", "basal_body_temp"]
    inverted = {"stress", "heart_rate", "glucose"}

    for sig in signals:
        sig_hist = get_signal_history(profile, sig, days_back=14)
        if len(sig_hist) < 14:
            continue

        lw = sig_hist[:7]
        tw = sig_hist[7:]
        lw_avg_sig = sum(d["value"] for d in lw) / 7
        tw_avg_sig = sum(d["value"] for d in tw) / 7
        pct = round(((tw_avg_sig - lw_avg_sig) / lw_avg_sig) * 100, 1) if lw_avg_sig > 0 else 0

        is_inv = sig in inverted
        if pct > 0:
            direction = "worsening" if is_inv else "improving"
        elif pct < 0:
            direction = "improving" if is_inv else "worsening"
        else:
            direction = "stable"

        result["signals"][sig] = {
            "last_week_avg": round(lw_avg_sig, 2 if sig == "basal_body_temp" else 1),
            "this_week_avg": round(tw_avg_sig, 2 if sig == "basal_body_temp" else 1),
            "change_pct": pct,
            "direction": direction,
        }

    return result
