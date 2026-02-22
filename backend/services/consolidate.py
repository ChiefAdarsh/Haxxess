import logging
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict, field
from typing import Optional, Any, List
import json

logger = logging.getLogger("consolidate")

TIERS = [
    {"id": "CRITICAL", "range": (0, 29), "label": "Critical",
     "action": "Escalate immediately - notify provider + emergency contact"},
    {"id": "ELEVATED", "range": (30, 54), "label": "Elevated",
     "action": "Notify care team - possible hormonal crisis or PMDD flare"},
    {"id": "WATCH", "range": (55, 79), "label": "Watch",
     "action": "Flag for review - monitor symptom progression"},
    {"id": "STABLE", "range": (80, 100), "label": "Stable",
     "action": "Continue cycle-synced monitoring"},
]


def _get_tier(score: float) -> dict:
    for tier in TIERS:
        lo, hi = tier["range"]
        if lo <= score <= hi:
            return tier
    return TIERS[0]


CYCLE_MODIFIERS = {
    "follicular": {
        "label": "Follicular Phase (Days 1-13)",
        "hr_offset": 0,  # baseline - lowest resting HR
        "hrv_offset": 0,  # baseline - highest HRV
        "temp_offset": 0.0,  # baseline - lowest BBT
        "glucose_tolerance": 0,  # normal insulin sensitivity
        "mood_weight": 1.0,  # voice/mood scored normally
        "sleep_tolerance": 0,
        "expected_symptoms": [],
    },
    "ovulation": {
        "label": "Ovulation (Days 13-15)",
        "hr_offset": 3,  # slight HR increase from LH surge
        "hrv_offset": -3,  # minor HRV dip is normal
        "temp_offset": 0.2,  # BBT begins to rise
        "glucose_tolerance": 0,
        "mood_weight": 1.0,
        "sleep_tolerance": 0,
        "expected_symptoms": ["mild pelvic discomfort", "increased energy"],
    },
    "luteal_mild": {
        "label": "Early Luteal Phase (Days 15-21)",
        "hr_offset": 5,  # progesterone raises resting HR 3-8bpm
        "hrv_offset": -8,  # HRV normally drops in luteal phase
        "temp_offset": 0.4,  # BBT rise of 0.3-0.6°C is expected
        "glucose_tolerance": 15,  # insulin resistance increases - glucose runs higher
        "mood_weight": 0.9,
        "sleep_tolerance": 5,  # slightly worse sleep is physiological
        "expected_symptoms": ["mild bloating", "breast tenderness"],
    },
    "luteal_pms": {
        "label": "Late Luteal / PMS (Days 21-28)",
        "hr_offset": 7,
        "hrv_offset": -12,  # significant HRV suppression expected
        "temp_offset": 0.5,
        "glucose_tolerance": 20,  # carb cravings + insulin resistance
        "mood_weight": 0.8,  # reduce mood signal weight - some distress is expected
        "sleep_tolerance": 10,
        "expected_symptoms": ["mood lability", "fatigue", "cravings", "cramping"],
    },
    "pmdd_crisis": {
        "label": "PMDD Crisis (Severe Late Luteal)",
        "hr_offset": 10,
        "hrv_offset": -15,
        "temp_offset": 0.6,
        "glucose_tolerance": 25,
        "mood_weight": 1.3,  # AMPLIFY mood signal - PMDD voice changes are clinically significant
        "sleep_tolerance": 0,  # sleep disruption in PMDD is pathological, not physiological
        "expected_symptoms": ["severe mood crash", "suicidal ideation risk", "insomnia", "rage/irritability"],
    },
    "pcos_flare": {
        "label": "PCOS Flare",
        "hr_offset": 5,
        "hrv_offset": -10,
        "temp_offset": 0.2,
        "glucose_tolerance": -10,  # PCOS = worse insulin resistance - be stricter on glucose
        "mood_weight": 1.1,
        "sleep_tolerance": 5,
        "expected_symptoms": ["glucose instability", "weight gain", "acne flare", "irregular cycle"],
    },
    "perimenopause": {
        "label": "Perimenopause",
        "hr_offset": 8,
        "hrv_offset": -10,
        "temp_offset": 0.0,  # hot flashes cause spikes, not sustained elevation
        "glucose_tolerance": 10,
        "mood_weight": 1.1,
        "sleep_tolerance": 8,
        "expected_symptoms": ["hot flashes", "night sweats", "irregular cycles", "mood shifts"],
    },
    "baseline": {
        "label": "Baseline",
        "hr_offset": 0,
        "hrv_offset": 0,
        "temp_offset": 0.0,
        "glucose_tolerance": 0,
        "mood_weight": 1.0,
        "sleep_tolerance": 0,
        "expected_symptoms": [],
    },
}


def _get_cycle_mod(profile: Optional[str]) -> dict:
    return CYCLE_MODIFIERS.get(profile or "baseline", CYCLE_MODIFIERS["baseline"])


@dataclass
class SignalInput:
    source: str
    score: float
    confidence: float
    weight: float
    flags: list[str] = field(default_factory=list)
    raw_data: Optional[dict] = None


@dataclass
class VitalityResult:
    vitality_index: float
    tier_id: str
    tier_label: str
    tier_action: str
    signals: list[dict]
    flags: list[str]
    contributing_factors: list[str]
    timestamp: str
    summary: str
    cycle_phase: Optional[dict] = None
    trend_context: Optional[dict] = None

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, default=str)


def score_voice(acoustic_result: Any, cycle_mod: Optional[dict] = None) -> SignalInput:
    if acoustic_result is None:
        return SignalInput(
            source="voice", score=75.0, confidence=0.0,
            weight=0.0, flags=["No voice data available"],
        )

    mod = cycle_mod or _get_cycle_mod(None)
    mood_weight_mult = mod.get("mood_weight", 1.0)

    distress = acoustic_result.distress_score
    vitality = round(max(0, min(100, 100 - distress)), 2)

    duration = acoustic_result.features.temporal.duration
    voiced_frac = acoustic_result.features.voice_quality.voiced_fraction

    if duration < 3 or voiced_frac < 0.15:
        confidence = 0.3
    elif duration < 10 or voiced_frac < 0.3:
        confidence = 0.6
    elif duration < 30:
        confidence = 0.8
    else:
        confidence = 0.95

    cluster_flags = [f for f in acoustic_result.flags if f.startswith("⚠")]
    if cluster_flags:
        confidence = min(confidence + 0.1, 1.0)

    flags = list(acoustic_result.flags)

    # Hormonal vocal biomarker context
    if mod.get("mood_weight", 1.0) > 1.0 and distress > 50:
        flags.append(
            f"Vocal distress elevated during {mod['label']} - "
            f"hormonal mood amplification likely"
        )
    elif mod.get("mood_weight", 1.0) < 1.0 and distress > 40:
        flags.append(
            f"Mild vocal stress during {mod['label']} - "
            f"may be physiological (progesterone-related)"
        )

    # Adjust weight based on cycle phase
    base_weight = 35.0 * mood_weight_mult

    return SignalInput(
        source="voice",
        score=vitality,
        confidence=round(confidence, 2),
        weight=round(base_weight, 1),
        flags=flags,
        raw_data={
            "distress_score": distress,
            "vibe": acoustic_result.vibe,
            "valence": acoustic_result.emotion_axes.valence,
            "arousal": acoustic_result.emotion_axes.arousal,
            "dominance": acoustic_result.emotion_axes.dominance,
            "cycle_mood_weight": mood_weight_mult,
        },
    )


def score_wearable(snapshot: Optional[dict], cycle_mod: Optional[dict] = None) -> SignalInput:
    if snapshot is None or not snapshot.get("devices"):
        return SignalInput(
            source="wearable", score=75.0, confidence=0.0,
            weight=0.0, flags=["No wearable data available"],
        )

    mod = cycle_mod or _get_cycle_mod(None)
    hr_off = mod.get("hr_offset", 0)
    hrv_off = mod.get("hrv_offset", 0)
    temp_off = mod.get("temp_offset", 0.0)
    glucose_tol = mod.get("glucose_tolerance", 0)
    sleep_tol = mod.get("sleep_tolerance", 0)

    sub_scores = []
    flags = []
    device_count = 0

    aw = snapshot.get("devices", {}).get("apple_watch", {})
    if aw:
        device_count += 1
        rt = aw.get("realtime", {})

        hr = rt.get("heart_rate_bpm", 72)
        # Adjust thresholds for cycle phase
        hr_adjusted = hr - hr_off  # "normalize" to follicular equivalent
        if hr_adjusted < 50:
            sub_scores.append(30)
            flags.append(f"Bradycardia detected (HR={hr}bpm, cycle-adjusted={hr_adjusted}bpm)")
        elif hr_adjusted > 110:
            sub_scores.append(35)
            flags.append(f"Tachycardia detected (HR={hr}bpm, above luteal-adjusted threshold)")
        elif hr_adjusted > 95:
            sub_scores.append(60)
            flags.append(f"Elevated resting HR ({hr}bpm, cycle-adjusted={hr_adjusted}bpm)")
        elif 55 <= hr_adjusted <= 85:
            sub_scores.append(95)
        else:
            sub_scores.append(80)

        hrv = rt.get("heart_rate_variability_ms", 50)
        hrv_adjusted = hrv - hrv_off  # offset is negative, so this raises the effective HRV
        if hrv_adjusted < 20:
            sub_scores.append(25)
            flags.append(f"Very low HRV ({hrv}ms) - below expected even for {mod['label']}")
        elif hrv_adjusted < 35:
            sub_scores.append(55)
            flags.append(f"Below-average HRV ({hrv}ms, cycle-adjusted={hrv_adjusted}ms)")
        elif hrv_adjusted > 60:
            sub_scores.append(95)
        else:
            sub_scores.append(80)

        spo2 = rt.get("blood_oxygen_pct", 98)
        if spo2 < 92:
            sub_scores.append(10)
            flags.append(f"⚠ CRITICAL SpO2 ({spo2}%) - hypoxemia")
        elif spo2 < 95:
            sub_scores.append(40)
            flags.append(f"Low blood oxygen ({spo2}%)")
        elif spo2 >= 97:
            sub_scores.append(95)
        else:
            sub_scores.append(80)

        bp = rt.get("blood_pressure", {})
        sys_bp = bp.get("systolic_mmhg", 120)
        dia_bp = bp.get("diastolic_mmhg", 80)
        if sys_bp > 140 or dia_bp > 90:
            sub_scores.append(40)
            flags.append(f"Hypertension ({sys_bp}/{dia_bp}mmHg)")
        elif sys_bp > 130 or dia_bp > 85:
            sub_scores.append(65)
            flags.append(f"Elevated blood pressure ({sys_bp}/{dia_bp}mmHg)")
        elif sys_bp < 90 or dia_bp < 60:
            sub_scores.append(35)
            flags.append(f"Hypotension detected ({sys_bp}/{dia_bp}mmHg)")
        else:
            sub_scores.append(90)

        resp = rt.get("respiratory_rate_brpm", 15)
        if resp > 24:
            sub_scores.append(30)
            flags.append(f"Tachypnea ({resp} breaths/min)")
        elif resp > 20:
            sub_scores.append(60)
            flags.append(f"Elevated respiratory rate ({resp}/min)")
        elif resp < 10:
            sub_scores.append(35)
            flags.append(f"Abnormally low respiratory rate ({resp}/min)")
        else:
            sub_scores.append(90)

        if rt.get("fall_detected"):
            sub_scores.append(5)
            flags.append("⚠ FALL DETECTED")
        if rt.get("atrial_fibrillation_detected"):
            sub_scores.append(15)
            flags.append("⚠ Atrial fibrillation detected")

        sleep = aw.get("sleep", {})
        sleep_score = sleep.get("sleep_score")
        if sleep_score is not None:
            adj_sleep = sleep_score + sleep_tol
            if adj_sleep < 40:
                sub_scores.append(35)
                flags.append(f"Very poor sleep (score: {sleep_score}, beyond cycle-expected reduction)")
            elif adj_sleep < 60:
                sub_scores.append(55)
                flags.append(f"Below-average sleep (score: {sleep_score})")
            elif adj_sleep >= 80:
                sub_scores.append(95)
            else:
                sub_scores.append(75)

    oura = snapshot.get("devices", {}).get("oura_ring", {})
    if oura:
        device_count += 1
        rt = oura.get("realtime", {})

        hrv = rt.get("heart_rate_variability_ms", 50)
        hrv_adjusted = hrv - hrv_off
        if hrv_adjusted < 18:
            sub_scores.append(20)
            flags.append(f"Oura: critically low HRV ({hrv}ms) - abnormal for {mod['label']}")
        elif hrv_adjusted < 30:
            sub_scores.append(50)
            flags.append(f"Oura: low HRV ({hrv}ms, cycle-adjusted={hrv_adjusted}ms)")
        elif hrv_adjusted > 65:
            sub_scores.append(95)
        else:
            sub_scores.append(80)

        temp_delta = rt.get("skin_temperature_delta_c", 0.0)
        # Adjust for expected BBT rise in luteal phase
        temp_adjusted = abs(temp_delta) - temp_off
        if temp_adjusted > 1.5:
            sub_scores.append(35)
            if temp_delta > 0:
                flags.append(
                    f"Oura: skin temp +{temp_delta:.2f}°C - exceeds {mod['label']} expected rise of +{temp_off:.1f}°C"
                )
            else:
                flags.append(f"Oura: significant skin temp deviation ({temp_delta:+.2f}°C)")
        elif temp_adjusted > 0.8:
            sub_scores.append(60)
            flags.append(f"Oura: moderate temp deviation ({temp_delta:+.2f}°C, expected offset: +{temp_off:.1f}°C)")
        else:
            sub_scores.append(90)

        scores_data = oura.get("daily_scores", {})
        readiness = scores_data.get("readiness_score")
        if readiness is not None:
            if readiness < 30:
                sub_scores.append(25)
                flags.append(f"Oura readiness critically low ({readiness})")
            elif readiness < 55:
                sub_scores.append(50)
                flags.append(f"Oura readiness below average ({readiness})")
            elif readiness >= 80:
                sub_scores.append(95)
            else:
                sub_scores.append(75)

        stress_level = scores_data.get("stress_level")
        if stress_level is not None:
            if stress_level > 75:
                sub_scores.append(30)
                flags.append(f"Oura: high stress level ({stress_level}/100)")
            elif stress_level > 55:
                sub_scores.append(55)
                flags.append(f"Oura: moderate stress ({stress_level}/100)")
            else:
                sub_scores.append(90)

        sleep = oura.get("sleep", {})
        sleep_score = sleep.get("sleep_score")
        if sleep_score is not None:
            adj_sleep = sleep_score + sleep_tol
            if adj_sleep < 40:
                sub_scores.append(30)
                flags.append(f"Oura: poor sleep (score: {sleep_score}, beyond cycle-expected reduction)")
            elif adj_sleep < 60:
                sub_scores.append(55)
                flags.append(f"Oura: below-average sleep (score: {sleep_score})")
            elif adj_sleep >= 80:
                sub_scores.append(95)
            else:
                sub_scores.append(75)

    cgm = snapshot.get("devices", {}).get("dexcom_g7", {})
    if cgm:
        device_count += 1
        rt = cgm.get("realtime", {})

        glucose = rt.get("glucose_mg_dl", 100)
        trend = rt.get("trend_key", "flat")

        # Luteal phase + PCOS = higher glucose is somewhat expected
        high_thresh = 180 + glucose_tol
        very_high_thresh = 250 + glucose_tol
        ideal_upper = 140 + glucose_tol

        if glucose <= 54:
            sub_scores.append(5)
            flags.append(f"⚠ URGENT LOW glucose ({glucose} mg/dL) - hypoglycemia")
        elif glucose <= 69:
            sub_scores.append(35)
            flags.append(f"Low glucose ({glucose} mg/dL)")
        elif glucose >= very_high_thresh:
            sub_scores.append(10)
            flags.append(f"⚠ URGENT HIGH glucose ({glucose} mg/dL)")
        elif glucose >= high_thresh:
            sub_scores.append(45)
            flags.append(f"High glucose ({glucose} mg/dL, threshold adjusted for {mod['label']})")
        elif 70 <= glucose <= ideal_upper:
            sub_scores.append(95)
        else:
            sub_scores.append(75)

        if trend in ("rising_fast", "falling_fast"):
            sub_scores.append(30)
            arrow = rt.get("trend_arrow", "?")
            flags.append(f"Glucose changing rapidly ({arrow} {rt.get('trend_description', trend)})")
        elif trend in ("rising", "falling"):
            sub_scores.append(60)

        daily = cgm.get("daily_summary", {})
        tir = daily.get("time_in_range", {})
        in_range_pct = tir.get("in_range_pct", 70)

        # Slightly more lenient TIR target during luteal/PCOS
        tir_target = max(55, 70 - abs(glucose_tol) * 0.5)
        if in_range_pct < tir_target - 15:
            sub_scores.append(30)
            flags.append(f"CGM: poor time in range ({in_range_pct}% - target ≥{tir_target:.0f}%)")
        elif in_range_pct < tir_target:
            sub_scores.append(55)
            flags.append(f"CGM: below-target time in range ({in_range_pct}%)")
        elif in_range_pct >= tir_target + 10:
            sub_scores.append(95)
        else:
            sub_scores.append(80)

        cv = daily.get("coefficient_of_variation_pct", 30)
        if cv > 36:
            sub_scores.append(45)
            flags.append(f"CGM: high glycemic variability (CV={cv}%)")

        alerts = rt.get("alerts", [])
        for alert in alerts:
            if alert.get("severity") == "critical":
                sub_scores.append(5)
                flags.append(f"⚠ CGM ALERT: {alert.get('message', 'Unknown')}")

    if not sub_scores:
        return SignalInput(
            source="wearable", score=75.0, confidence=0.0,
            weight=0.0, flags=["No scoreable wearable data"],
        )

    avg_score = round(sum(sub_scores) / len(sub_scores), 2)
    confidence = min(0.5 + device_count * 0.15 + len(sub_scores) * 0.02, 1.0)

    critical_flags = [f for f in flags if f.startswith("⚠")]
    if critical_flags:
        avg_score = min(avg_score, 30.0)
        confidence = min(confidence + 0.1, 1.0)

    return SignalInput(
        source="wearable",
        score=avg_score,
        confidence=round(confidence, 2),
        weight=30.0,
        flags=flags,
        raw_data={
            "sub_scores": sub_scores,
            "device_count": device_count,
            "cycle_phase": mod.get("label", "Unknown"),
            "adjustments_applied": {
                "hr_offset": hr_off,
                "hrv_offset": hrv_off,
                "temp_offset": temp_off,
                "glucose_tolerance": glucose_tol,
                "sleep_tolerance": sleep_tol,
            },
        },
    )


def score_trend(profile: Optional[str] = None) -> tuple[SignalInput, dict]:
    if profile is None:
        return (
            SignalInput(
                source="trend", score=75.0, confidence=0.0,
                weight=0.0, flags=["No historical profile available"],
            ),
            {},
        )

    try:
        from services.history import (
            get_historical_vitality,
            compute_trend_delta,
            compute_all_trends,
            get_week_comparison,
            get_event_timeline,
        )
    except ImportError:
        try:
            from history import (
                get_historical_vitality,
                compute_trend_delta,
                compute_all_trends,
                get_week_comparison,
                get_event_timeline,
            )
        except ImportError:
            return (
                SignalInput(
                    source="trend", score=75.0, confidence=0.0,
                    weight=0.0, flags=["History module not available"],
                ),
                {},
            )

    history_30d = get_historical_vitality(profile, days_back=30)
    history_7d = history_30d[-7:] if len(history_30d) >= 7 else history_30d

    if len(history_30d) < 3:
        return (
            SignalInput(
                source="trend", score=75.0, confidence=0.0,
                weight=0.0, flags=["Insufficient history for trend analysis"],
            ),
            {},
        )

    delta_7d = compute_trend_delta(history_30d, window=7)
    delta_30d = compute_trend_delta(history_30d, window=min(30, len(history_30d)))

    sub_scores = []
    flags = []

    if delta_7d >= 1.5:
        sub_scores.append(95)
    elif delta_7d >= 0.5:
        sub_scores.append(88)
    elif delta_7d >= -0.2:
        sub_scores.append(78)
    elif delta_7d >= -0.8:
        sub_scores.append(60)
        flags.append(f"7-day vitality declining ({delta_7d:+.1f} pts/day)")
    elif delta_7d >= -1.5:
        sub_scores.append(40)
        flags.append(f"Significant 7-day decline ({delta_7d:+.1f} pts/day)")
    elif delta_7d >= -2.5:
        sub_scores.append(25)
        flags.append(f"⚠ Rapid 7-day decline ({delta_7d:+.1f} pts/day)")
    else:
        sub_scores.append(10)
        flags.append(f"⚠ Critical trajectory - vitality in freefall ({delta_7d:+.1f} pts/day)")

    if delta_30d < -0.5 and delta_7d < -0.3:
        sub_scores.append(30)
        flags.append(f"Sustained monthly decline ({delta_30d:+.1f} pts/day over 30d)")
    elif delta_30d > 0.3 and delta_7d > 0:
        sub_scores.append(92)
    elif abs(delta_30d) <= 0.3:
        sub_scores.append(80)

    scores_only = [d["vitality_index"] for d in history_7d]
    std_dev = 0.0
    if len(scores_only) >= 3:
        avg = sum(scores_only) / len(scores_only)
        variance = sum((s - avg) ** 2 for s in scores_only) / len(scores_only)
        std_dev = variance ** 0.5

        if std_dev > 12:
            sub_scores.append(35)
            flags.append(f"High vitality volatility (σ={std_dev:.1f} over 7d)")
        elif std_dev > 7:
            sub_scores.append(55)
            flags.append(f"Moderate vitality swings (σ={std_dev:.1f} over 7d)")
        elif std_dev < 3:
            sub_scores.append(90)

    critical_days = sum(1 for d in history_7d if d.get("tier") == "CRITICAL")
    elevated_days = sum(1 for d in history_7d if d.get("tier") == "ELEVATED")

    if critical_days >= 2:
        sub_scores.append(10)
        flags.append(f"⚠ {critical_days} CRITICAL days in the last week")
    elif critical_days == 1:
        sub_scores.append(30)
        flags.append("1 CRITICAL day in the last week")

    if elevated_days >= 3:
        sub_scores.append(35)
        flags.append(f"{elevated_days} ELEVATED days in the last week")
    elif elevated_days >= 1:
        sub_scores.append(55)

    wow = get_week_comparison(profile)
    wow_vitality = wow.get("vitality_index", {})
    wow_change = wow_vitality.get("change_pct", 0)

    if wow_change < -15:
        sub_scores.append(20)
        flags.append(f"⚠ Week-over-week vitality dropped {abs(wow_change):.1f}%")
    elif wow_change < -8:
        sub_scores.append(45)
        flags.append(f"Week-over-week vitality down {abs(wow_change):.1f}%")
    elif wow_change > 10:
        sub_scores.append(92)
        flags.append(f"Week-over-week vitality improved {wow_change:.1f}%")
    else:
        sub_scores.append(78)

    all_trends = compute_all_trends(profile)
    deteriorating_signals = []
    for sig_name, trend_data in all_trends.items():
        if sig_name == "vitality_index":
            continue
        if trend_data.get("sentiment") == "negative" and trend_data.get("severity") in ("significant", "moderate"):
            deteriorating_signals.append(sig_name)

    if len(deteriorating_signals) >= 4:
        sub_scores.append(25)
        flags.append(f"⚠ Multi-signal deterioration: {', '.join(deteriorating_signals)}")
    elif len(deteriorating_signals) >= 2:
        sub_scores.append(50)
        flags.append(f"Multiple signals trending negative: {', '.join(deteriorating_signals)}")

    events = get_event_timeline(profile)
    recent_alerts = [
        e for e in events
        if e.get("type") == "alert"
           and (datetime.utcnow() - datetime.fromisoformat(e["timestamp"].rstrip("Z"))).days <= 3
    ]
    if len(recent_alerts) >= 2:
        sub_scores.append(30)
        flags.append(f"{len(recent_alerts)} alert events in the last 3 days")
    elif len(recent_alerts) == 1:
        sub_scores.append(55)

    trend_score = round(sum(sub_scores) / len(sub_scores), 2) if sub_scores else 75.0

    days_available = len(history_30d)
    if days_available >= 21:
        confidence = 0.85
    elif days_available >= 14:
        confidence = 0.7
    elif days_available >= 7:
        confidence = 0.55
    else:
        confidence = 0.3

    trend_context = {
        "delta_7d": delta_7d,
        "delta_30d": delta_30d,
        "volatility_7d": round(std_dev, 1) if len(scores_only) >= 3 else None,
        "critical_days_7d": critical_days,
        "elevated_days_7d": elevated_days,
        "week_over_week": wow_vitality,
        "deteriorating_signals": deteriorating_signals,
        "recent_alert_count": len(recent_alerts),
        "trajectory": (
            "improving" if delta_7d > 0.3
            else "stable" if abs(delta_7d) <= 0.3
            else "declining" if delta_7d > -1.5
            else "critical_decline"
        ),
        "days_of_history": days_available,
        "all_trends": all_trends,
    }

    return (
        SignalInput(
            source="trend",
            score=trend_score,
            confidence=round(confidence, 2),
            weight=20.0,
            flags=flags,
            raw_data={
                "delta_7d": delta_7d,
                "delta_30d": delta_30d,
                "sub_scores": sub_scores,
                "deteriorating_count": len(deteriorating_signals),
            },
        ),
        trend_context,
    )


def score_nlp(transcript_analysis: Optional[Any] = None) -> SignalInput:
    if transcript_analysis is None:
        return SignalInput(
            source="nlp", score=75.0, confidence=0.0,
            weight=0.0, flags=["NLP module not connected"],
        )
    return SignalInput(source="nlp", score=75.0, confidence=0.0, weight=0.0)


def score_behavioral(behavioral_data: Optional[Any] = None) -> SignalInput:
    if behavioral_data is None:
        return SignalInput(
            source="behavioral", score=75.0, confidence=0.0,
            weight=0.0, flags=["Behavioral module not connected"],
        )
    return SignalInput(source="behavioral", score=75.0, confidence=0.0, weight=0.0)


def score_symptoms(symptom_logs: Optional[List[dict]] = None) -> SignalInput:
    """Score body-map symptom logs (last 7 days). High severity / pelvic flags reduce score."""
    if not symptom_logs:
        return SignalInput(
            source="symptoms", score=75.0, confidence=0.0,
            weight=0.0, flags=["No body-map symptom data"],
        )
    now = datetime.utcnow()
    cutoff = (now - timedelta(days=7)).isoformat() + "Z"
    recent = [s for s in symptom_logs if (s.get("timestamp") or "") >= cutoff]
    if not recent:
        return SignalInput(
            source="symptoms", score=75.0, confidence=0.0,
            weight=0.0, flags=["No symptoms in last 7 days"],
        )
    max_severity = max((s.get("severity") or 0) for s in recent)
    pelvic_regions = {"pelvic_midline", "suprapubic", "vulva", "LLQ", "RLQ"}
    high_severity_pelvic = [
        s for s in recent
        if (s.get("region") in pelvic_regions) and (s.get("severity") or 0) >= 6
    ]
    bleeding = [s for s in recent if (s.get("type") or "").lower() == "bleeding"]
    flags = []
    score = 75.0
    if max_severity >= 8:
        score -= 18
        flags.append(f"Severe symptom reported (max severity {max_severity}/10)")
    elif max_severity >= 6:
        score -= 10
        flags.append(f"Moderate-severe symptoms in last 7 days (max {max_severity}/10)")
    if high_severity_pelvic:
        score -= 8
        flags.append(f"Pelvic/abdominal symptoms (severity ≥6): {len(high_severity_pelvic)} entries")
    if bleeding:
        score -= 5
        flags.append("Bleeding logged in body map")
    score = max(15.0, min(100.0, score))
    confidence = 0.7 if len(recent) >= 2 else 0.5
    return SignalInput(
        source="symptoms",
        score=round(score, 1),
        confidence=confidence,
        weight=15.0,
        flags=flags or [f"{len(recent)} symptom(s) in last 7 days"],
    )


def _fuse_signals(signals: list[SignalInput]) -> tuple[float, list[str]]:
    contributing = []
    factors = []

    for sig in signals:
        ew = sig.weight * sig.confidence
        if ew <= 0:
            continue
        contributing.append((sig.score, ew, sig.source))
        factors.append(
            f"{sig.source}: {sig.score:.0f}/100 (weight={sig.weight}, conf={sig.confidence})"
        )

    if not contributing:
        return 75.0, ["No signals with confidence > 0 - defaulting to 75"]

    total_weight = sum(ew for _, ew, _ in contributing)
    fused = sum(score * ew for score, ew, _ in contributing) / total_weight

    for sig in signals:
        if sig.confidence >= 0.5 and sig.score < 25:
            cap = 35.0
            if fused > cap:
                factors.append(
                    f"⚠ {sig.source} critically low ({sig.score:.0f}) - capping fused score at {cap}"
                )
                fused = min(fused, cap)

    return round(fused, 2), factors


def consolidate(
        acoustic_result: Optional[Any] = None,
        wearable_snapshot: Optional[dict] = None,
        transcript_analysis: Optional[Any] = None,
        behavioral_data: Optional[Any] = None,
        profile: Optional[str] = None,
        symptom_logs: Optional[List[dict]] = None,
        cycle_periods_context: Optional[dict] = None,
) -> VitalityResult:
    logger.info("═══════════════════════════════════════")
    logger.info("   VITALITY INDEX - consolidating")
    logger.info("═══════════════════════════════════════")

    cycle_mod = _get_cycle_mod(profile)
    logger.info(f"  Cycle phase: {cycle_mod['label']}")

    if cycle_periods_context and cycle_periods_context.get("cycle_day") is not None:
        logger.info(f"  Cycle tracker: day {cycle_periods_context.get('cycle_day')} (from periods)")

    if cycle_mod.get("expected_symptoms"):
        logger.info(f"  Expected symptoms: {', '.join(cycle_mod['expected_symptoms'])}")

    trend_signal, trend_context = score_trend(profile)

    signals = [
        score_voice(acoustic_result, cycle_mod),
        score_wearable(wearable_snapshot, cycle_mod),
        trend_signal,
        score_symptoms(symptom_logs),
        score_nlp(transcript_analysis),
        score_behavioral(behavioral_data),
    ]

    active_signals = [s for s in signals if s.confidence > 0]
    logger.info(f"Active signals: {[s.source for s in active_signals]}")

    for sig in active_signals:
        logger.info(
            f"  {sig.source:12s} → score={sig.score:5.1f}  "
            f"conf={sig.confidence:.2f}  weight={sig.weight}"
        )

    vitality_index, contributing_factors = _fuse_signals(signals)

    # Post-fusion trajectory adjustments
    trajectory = trend_context.get("trajectory", "stable")
    delta_7d = trend_context.get("delta_7d", 0)

    if trajectory == "critical_decline" and vitality_index > 40:
        penalty = min(abs(delta_7d) * 3, 15)
        vitality_index = round(max(20, vitality_index - penalty), 2)
        contributing_factors.append(
            f"⚠ Trajectory penalty: -{penalty:.0f} pts (critical decline at {delta_7d:+.1f}/day)"
        )
    elif trajectory == "declining" and vitality_index > 55:
        penalty = min(abs(delta_7d) * 2, 8)
        vitality_index = round(max(30, vitality_index - penalty), 2)
        contributing_factors.append(
            f"Trajectory penalty: -{penalty:.0f} pts (declining at {delta_7d:+.1f}/day)"
        )
    elif trajectory == "improving" and vitality_index < 90:
        bonus = min(delta_7d * 1.5, 5)
        vitality_index = round(min(100, vitality_index + bonus), 2)
        contributing_factors.append(
            f"Trajectory bonus: +{bonus:.0f} pts (improving at {delta_7d:+.1f}/day)"
        )

    deteriorating = trend_context.get("deteriorating_signals", [])
    if len(deteriorating) >= 4 and vitality_index > 35:
        vitality_index = round(max(25, vitality_index - 10), 2)
        contributing_factors.append(
            f"⚠ Multi-signal deterioration penalty: -10 pts ({len(deteriorating)} signals declining)"
        )
    elif len(deteriorating) >= 2 and vitality_index > 50:
        vitality_index = round(max(35, vitality_index - 5), 2)
        contributing_factors.append(
            f"Multi-signal deterioration penalty: -5 pts ({len(deteriorating)} signals declining)"
        )

    critical_days = trend_context.get("critical_days_7d", 0)
    if critical_days >= 2 and vitality_index > 35:
        vitality_index = round(max(20, vitality_index - 8), 2)
        contributing_factors.append(
            f"⚠ Recent crisis penalty: -8 pts ({critical_days} CRITICAL days in last 7d)"
        )

    # PMDD-specific: if in pmdd_crisis profile and voice distress is high, amplify
    if profile == "pmdd_crisis":
        voice_sig = next((s for s in signals if s.source == "voice" and s.confidence > 0.5), None)
        if voice_sig and voice_sig.score < 40:
            pmdd_penalty = 8
            vitality_index = round(max(15, vitality_index - pmdd_penalty), 2)
            contributing_factors.append(
                f"⚠ PMDD crisis + vocal distress amplifier: -{pmdd_penalty} pts"
            )

    vitality_index = round(max(0, min(100, vitality_index)), 2)

    all_flags = []
    for sig in signals:
        for flag in sig.flags:
            all_flags.append(f"[{sig.source}] {flag}")

    # Add expected symptoms as informational flags
    expected = cycle_mod.get("expected_symptoms", [])
    if expected:
        all_flags.append(f"[cycle] Expected for {cycle_mod['label']}: {', '.join(expected)}")
    if cycle_periods_context and cycle_periods_context.get("cycle_day") is not None:
        day = cycle_periods_context["cycle_day"]
        phase = cycle_periods_context.get("phase_estimate") or "unknown"
        all_flags.append(f"[cycle_tracker] Estimated day {day} ({phase})")
        if cycle_periods_context.get("in_period"):
            all_flags.append("[cycle_tracker] Currently in period window")

    tier = _get_tier(vitality_index)

    active_sources = ", ".join(s.source for s in active_signals) or "none"
    summary = (
        f"Vitality Index: {vitality_index:.0f}/100 → {tier['label'].upper()}. "
        f"Cycle phase: {cycle_mod['label']}. "
        f"Based on: {active_sources}. "
        f"{tier['action']}."
    )

    if trajectory == "critical_decline":
        summary += f" ⚠ Vitality in rapid decline ({delta_7d:+.1f} pts/day)."
    elif trajectory == "declining":
        summary += f" Trend declining ({delta_7d:+.1f} pts/day) - monitor closely."
    elif trajectory == "improving":
        summary += f" Positive trajectory ({delta_7d:+.1f} pts/day)."

    if vitality_index < 30:
        summary += " ⚠ IMMEDIATE ATTENTION REQUIRED."

    if profile == "pmdd_crisis" and vitality_index < 40:
        summary += " PMDD crisis protocol activated - provider notification sent."

    cycle_phase_info = {
        "phase": profile or "baseline",
        "label": cycle_mod["label"],
        "expected_symptoms": expected,
        "adjustments": {
            "hr_offset_bpm": cycle_mod["hr_offset"],
            "hrv_offset_ms": cycle_mod["hrv_offset"],
            "bbt_offset_c": cycle_mod["temp_offset"],
            "glucose_tolerance_mg_dl": cycle_mod["glucose_tolerance"],
            "mood_signal_weight": cycle_mod["mood_weight"],
            "sleep_tolerance_pts": cycle_mod["sleep_tolerance"],
        },
    }

    logger.info(f"  VITALITY INDEX = {vitality_index:.1f} → {tier['id']}")
    logger.info(f"  Cycle: {cycle_mod['label']}")
    logger.info(f"  Trajectory: {trajectory} ({delta_7d:+.1f}/day)")
    logger.info(f"  Action: {tier['action']}")
    logger.info("═══════════════════════════════════════")

    return VitalityResult(
        vitality_index=vitality_index,
        tier_id=tier["id"],
        tier_label=tier["label"],
        tier_action=tier["action"],
        signals=[asdict(s) for s in signals],
        flags=all_flags,
        contributing_factors=contributing_factors,
        timestamp=datetime.utcnow().isoformat() + "Z",
        summary=summary,
        cycle_phase=cycle_phase_info,
        trend_context=trend_context if trend_context else None,
    )
