import math
import random
from datetime import datetime, timedelta
from typing import Optional


PROFILE_CURVES = {
    "baseline": {
        "base": 85, "slope": 0.0, "volatility": 3.0,
        "hr_base": 72, "hrv_base": 52, "glucose_base": 105,
        "sleep_base": 80, "stress_base": 30,
    },
    "anxious": {
        "base": 65, "slope": -0.5, "volatility": 8.0,
        "hr_base": 93, "hrv_base": 24, "glucose_base": 145,
        "sleep_base": 52, "stress_base": 72,
    },
    "depressed": {
        "base": 80, "slope": -1.2, "volatility": 2.0,
        "hr_base": 64, "hrv_base": 32, "glucose_base": 95,
        "sleep_base": 55, "stress_base": 55,
    },
    "fatigued": {
        "base": 75, "slope": -0.8, "volatility": 4.0,
        "hr_base": 77, "hrv_base": 28, "glucose_base": 165,
        "sleep_base": 42, "stress_base": 60,
    },
    "active": {
        "base": 80, "slope": 0.3, "volatility": 3.0,
        "hr_base": 68, "hrv_base": 62, "glucose_base": 88,
        "sleep_base": 88, "stress_base": 18,
    },
    "calm": {
        "base": 90, "slope": 0.1, "volatility": 2.0,
        "hr_base": 62, "hrv_base": 68, "glucose_base": 98,
        "sleep_base": 90, "stress_base": 12,
    },
}

def _get_curve(profile: str) -> dict:
    return PROFILE_CURVES.get(profile, PROFILE_CURVES["baseline"]).copy()


def _clamp(val: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, val))


def _deterministic_noise(seed_val: float, volatility: float) -> float:
    """Deterministic-ish noise from a seed so charts are stable across reloads."""
    return math.sin(seed_val * 127.1 + 311.7) * volatility


def _seeded_random(seed_val: float, lo: float, hi: float) -> float:
    """Seeded pseudo-random float for reproducible daily variation."""
    x = math.sin(seed_val * 43758.5453) * 10000
    frac = x - math.floor(x)
    return lo + frac * (hi - lo)


def get_historical_vitality(profile: str, days_back: int = 30) -> list[dict]:
    """
    Generates a deterministic daily Vitality Index history.
    Same profile + days_back = same output every time.
    """
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

        # Determine tier at that point
        if score >= 80:
            tier = "STABLE"
        elif score >= 55:
            tier = "WATCH"
        elif score >= 30:
            tier = "ELEVATED"
        else:
            tier = "CRITICAL"

        history.append({
            "date": (now - timedelta(days=i)).strftime("%Y-%m-%d"),
            "vitality_index": round(score, 1),
            "tier": tier,
        })

    return history


def get_hourly_vitality(profile: str, hours_back: int = 48) -> list[dict]:
    """
    Hourly granularity for the last N hours.
    Useful for zoomed-in dashboard views.
    """
    curve = _get_curve(profile)
    base = curve["base"]
    vol = curve["volatility"]
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    history = []

    for i in range(hours_back, -1, -1):
        # Circadian rhythm: lower at 3-5am, higher at 10am-2pm
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
    """
    Historical data for a specific biometric signal.

    Supported signals:
        heart_rate, hrv, glucose, sleep_score, stress,
        spo2, blood_pressure, respiratory_rate, steps

    Returns daily data points with the signal value and a zone classification.
    """
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
            "inverted": True,  # lower is better
        },
        "spo2": {
            "base": 97, "lo": 88, "hi": 100, "vol": 1,
            "unit": "%", "good": (96, 100), "warn": (92, 96),
        },
        "blood_pressure": {
            "base": 120, "lo": 90, "hi": 160, "vol": 4,
            "unit": "mmHg (systolic)", "good": (100, 125), "warn": (90, 135),
        },
        "respiratory_rate": {
            "base": 15, "lo": 10, "hi": 28, "vol": 1.5,
            "unit": "brpm", "good": (12, 18), "warn": (10, 22),
        },
        "steps": {
            "base": 5000 if curve["base"] > 70 else 2000,
            "lo": 0, "hi": 20000, "vol": 1500,
            "unit": "steps", "good": (6000, 20000), "warn": (3000, 6000),
        },
    }

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

        history.append({
            "date": (now - timedelta(days=i)).strftime("%Y-%m-%d"),
            "value": round(val, 1),
            "unit": cfg["unit"],
            "zone": zone,
        })

    return history


def get_composite_timeline(profile: str, days_back: int = 30) -> dict:
    """
    Returns vitality index + all signal histories in one payload.
    This is the one call the frontend needs for the full timeline view.
    """
    signals = [
        "heart_rate", "hrv", "glucose", "sleep_score",
        "stress", "spo2", "blood_pressure", "respiratory_rate", "steps",
    ]

    return {
        "profile": profile,
        "days_back": days_back,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "vitality_index": get_historical_vitality(profile, days_back),
        "signals": {
            sig: get_signal_history(profile, sig, days_back)
            for sig in signals
        },
        "trends": compute_all_trends(profile, days_back),
    }


EVENT_TEMPLATES = {
    "baseline": [
        {"day": -2,  "type": "check_in",  "title": "Routine check-in", "detail": "All vitals within normal range."},
        {"day": -7,  "type": "workout",   "title": "30-min morning walk", "detail": "HR avg 98bpm, 3200 steps."},
        {"day": -14, "type": "check_in",  "title": "Routine check-in", "detail": "Slight dip in sleep quality noted."},
    ],
    "anxious": [
        {"day": -1,  "type": "alert",     "title": "Elevated stress detected", "detail": "Vitality dropped to WATCH tier. Stress level 72/100, HRV 24ms."},
        {"day": -3,  "type": "voice",     "title": "Voice analysis flagged", "detail": "Acoustic markers: elevated pitch variance, rapid speech rate."},
        {"day": -5,  "type": "glucose",   "title": "Glucose spike", "detail": "Post-meal glucose hit 195 mg/dL, above target range."},
        {"day": -8,  "type": "sleep",     "title": "Poor sleep trend", "detail": "3rd consecutive night below 55 sleep score."},
        {"day": -12, "type": "check_in",  "title": "Doctor follow-up", "detail": "Physician notified of declining trend."},
    ],
    "depressed": [
        {"day": -1,  "type": "alert",     "title": "Sustained low activity", "detail": "Steps below 1000 for 5 consecutive days."},
        {"day": -2,  "type": "voice",     "title": "Vocal biomarker shift", "detail": "Monotone pitch, reduced speech energy, long pauses detected."},
        {"day": -6,  "type": "sleep",     "title": "Sleep pattern disrupted", "detail": "Excessive sleep (11hrs) with poor quality (score: 42)."},
        {"day": -10, "type": "alert",     "title": "HRV declining", "detail": "7-day HRV average dropped from 45ms to 28ms."},
        {"day": -15, "type": "check_in",  "title": "Baseline established", "detail": "Initial readings normal. Monitoring began."},
    ],
    "fatigued": [
        {"day": -1,  "type": "glucose",   "title": "Glucose instability", "detail": "Time in range dropped to 48%. Multiple spikes above 200 mg/dL."},
        {"day": -3,  "type": "alert",     "title": "Vitality dropped to ELEVATED", "detail": "Score hit 38. Care team notified."},
        {"day": -5,  "type": "sleep",     "title": "Severe sleep deficit", "detail": "Avg 4.2hrs/night over last 5 days."},
        {"day": -9,  "type": "check_in",  "title": "Medication adjustment", "detail": "Provider adjusted dosage based on trend data."},
    ],
    "active": [
        {"day": -1,  "type": "workout",   "title": "Morning run — 5.2km", "detail": "Avg HR 142bpm, VO2max estimate 48.3."},
        {"day": -3,  "type": "check_in",  "title": "Weekly review", "detail": "All metrics trending positive. Time in range 87%."},
        {"day": -7,  "type": "workout",   "title": "Strength training", "detail": "45min session, 320kcal burned."},
        {"day": -14, "type": "sleep",     "title": "Sleep streak", "detail": "7 consecutive nights with sleep score above 85."},
    ],
    "calm": [
        {"day": -3,  "type": "check_in",  "title": "Routine check-in", "detail": "Vitality Index stable at 88-92 range."},
        {"day": -7,  "type": "workout",   "title": "Yoga session", "detail": "HRV improved by 8ms post-session."},
        {"day": -12, "type": "check_in",  "title": "Monthly review", "detail": "All targets met. Glucose time-in-range 91%."},
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
}


def get_event_timeline(profile: str) -> list[dict]:
    """
    Returns a list of notable health events for the given profile.
    These are the "story beats" that show up as markers on the timeline.
    """
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
    """
    Average daily change over the last N days.
    Negative = declining, Positive = improving.
    """
    if len(history) < window:
        return 0.0

    recent = history[-window:]
    key = "vitality_index" if "vitality_index" in recent[0] else "value"
    first = recent[0][key]
    last = recent[-1][key]
    return round((last - first) / window, 2)


def compute_all_trends(profile: str, days_back: int = 30) -> dict:
    """
    Computes 7-day trend deltas for every tracked signal + the vitality index.
    Returns a dict of signal → {delta, direction, description}.
    """
    vitality_hist = get_historical_vitality(profile, days_back)
    vitality_delta = compute_trend_delta(vitality_hist)

    trends = {
        "vitality_index": _format_trend(vitality_delta, "pts/day"),
    }

    signals = [
        "heart_rate", "hrv", "glucose", "sleep_score",
        "stress", "spo2", "blood_pressure", "respiratory_rate", "steps",
    ]

    # Signals where "going down" is actually good
    inverted = {"stress", "heart_rate", "glucose", "blood_pressure", "respiratory_rate"}

    units = {
        "heart_rate": "bpm/day", "hrv": "ms/day", "glucose": "mg/dL/day",
        "sleep_score": "pts/day", "stress": "pts/day", "spo2": "%/day",
        "blood_pressure": "mmHg/day", "respiratory_rate": "brpm/day", "steps": "steps/day",
    }

    for sig in signals:
        hist = get_signal_history(profile, sig, days_back)
        delta = compute_trend_delta(hist)
        is_inverted = sig in inverted
        trends[sig] = _format_trend(delta, units.get(sig, "/day"), inverted=is_inverted)

    return trends


def _format_trend(delta: float, unit: str, inverted: bool = False) -> dict:
    """Package a trend delta into a frontend-friendly object."""
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
    """
    Compares this week vs last week across all signals.
    Returns averages and percent change for each.
    """
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

    signals = ["heart_rate", "hrv", "glucose", "sleep_score", "stress", "steps"]
    inverted = {"stress", "heart_rate", "glucose"}

    for sig in signals:
        sig_hist = get_signal_history(profile, sig, days_back=14)
        if len(sig_hist) < 14:
            continue

        lw = sig_hist[:7]
        tw = sig_hist[7:]
        lw_avg = sum(d["value"] for d in lw) / 7
        tw_avg = sum(d["value"] for d in tw) / 7
        pct = round(((tw_avg - lw_avg) / lw_avg) * 100, 1) if lw_avg > 0 else 0

        is_inv = sig in inverted
        if pct > 0:
            direction = "worsening" if is_inv else "improving"
        elif pct < 0:
            direction = "improving" if is_inv else "worsening"
        else:
            direction = "stable"

        result["signals"][sig] = {
            "last_week_avg": round(lw_avg, 1),
            "this_week_avg": round(tw_avg, 1),
            "change_pct": pct,
            "direction": direction,
        }

    return result
