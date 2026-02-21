import logging
from datetime import datetime
from dataclasses import dataclass, asdict, field
from typing import Optional, Any
import json

logger = logging.getLogger("consolidate")

TIERS = [
    {"id": "CRITICAL", "range": (0, 29), "label": "Critical",
     "action": "Escalate to 911 + notify physician immediately"},
    {"id": "ELEVATED", "range": (30, 54), "label": "Elevated",
     "action": "Notify care team — schedule immediate service"},
    {"id": "WATCH", "range": (55, 79), "label": "Watch", "action": "Alert patient & doctor — monitor closely"},
    {"id": "STABLE", "range": (80, 100), "label": "Stable", "action": "Continue routine logging & monitoring"},
]


def _get_tier(score: float) -> dict:
    for tier in TIERS:
        lo, hi = tier["range"]
        if lo <= score <= hi:
            return tier
    return TIERS[0]


@dataclass
class SignalInput:
    """
    A single scored signal fed into the consolidator.
    """
    source: str  # i.e. "voice", "wearable", "nlp", "facial", "behavioral"
    score: float  # 0–100 where 100 = perfectly healthy
    confidence: float  # 0.0–1.0 how much we trust this reading
    weight: float  # relative importance (will be normalized)
    flags: list[str] = field(default_factory=list)
    raw_data: Optional[dict] = None  # attach whatever you want for audit trail


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

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, default=str)


def score_voice(acoustic_result: Any) -> SignalInput:
    """
    Convert an AcousticAnalysisResult → SignalInput. The acoustic engine gives a distress_score (0–100 where 100 = max distress). We invert it: vitality = 100 - distress.
    """
    if acoustic_result is None:
        return SignalInput(
            source="voice",
            score=75.0,  # neutral assumption when missing
            confidence=0.0,
            weight=0.0,
            flags=["No voice data available"],
        )

    distress = acoustic_result.distress_score
    vitality = round(max(0, min(100, 100 - distress)), 2)

    # confidence based on how much speech we actually got
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

    return SignalInput(
        source="voice",
        score=vitality,
        confidence=round(confidence, 2),
        weight=35.0,
        flags=acoustic_result.flags,
        raw_data={
            "distress_score": distress,
            "vibe": acoustic_result.vibe,
            "valence": acoustic_result.emotion_axes.valence,
            "arousal": acoustic_result.emotion_axes.arousal,
            "dominance": acoustic_result.emotion_axes.dominance,
        },
    )


def score_wearable(snapshot: Optional[dict]) -> SignalInput:
    """
    Convert a wearable snapshot dict → SignalInput. Scores each vital against clinical norms and averages.
    """
    if snapshot is None or not snapshot.get("devices"):
        return SignalInput(
            source="wearable",
            score=75.0,
            confidence=0.0,
            weight=0.0,
            flags=["No wearable data available"],
        )

    sub_scores = []
    flags = []
    device_count = 0

    aw = snapshot.get("devices", {}).get("apple_watch", {})
    if aw:
        device_count += 1
        rt = aw.get("realtime", {})

        hr = rt.get("heart_rate_bpm", 72)
        if hr < 50:
            sub_scores.append(30)
            flags.append(f"Bradycardia detected (HR={hr}bpm)")
        elif hr > 110:
            sub_scores.append(35)
            flags.append(f"Tachycardia detected (HR={hr}bpm)")
        elif hr > 95:
            sub_scores.append(60)
            flags.append(f"Elevated resting heart rate ({hr}bpm)")
        elif 55 <= hr <= 85:
            sub_scores.append(95)
        else:
            sub_scores.append(80)

        hrv = rt.get("heart_rate_variability_ms", 50)
        if hrv < 20:
            sub_scores.append(25)
            flags.append(f"Very low HRV ({hrv}ms) — high physiological stress")
        elif hrv < 35:
            sub_scores.append(55)
            flags.append(f"Below-average HRV ({hrv}ms)")
        elif hrv > 60:
            sub_scores.append(95)
        else:
            sub_scores.append(80)

        spo2 = rt.get("blood_oxygen_pct", 98)
        if spo2 < 92:
            sub_scores.append(10)
            flags.append(f"⚠ CRITICAL SpO2 ({spo2}%) — hypoxemia")
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
            flags.append(f"Hypertension stage 1+ ({sys_bp}/{dia_bp}mmHg)")
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
            if sleep_score < 40:
                sub_scores.append(35)
                flags.append(f"Very poor sleep quality (score: {sleep_score})")
            elif sleep_score < 60:
                sub_scores.append(55)
                flags.append(f"Below-average sleep (score: {sleep_score})")
            elif sleep_score >= 80:
                sub_scores.append(95)
            else:
                sub_scores.append(75)

    oura = snapshot.get("devices", {}).get("oura_ring", {})
    if oura:
        device_count += 1
        rt = oura.get("realtime", {})

        hrv = rt.get("heart_rate_variability_ms", 50)
        if hrv < 18:
            sub_scores.append(20)
            flags.append(f"Oura: critically low HRV ({hrv}ms)")
        elif hrv < 30:
            sub_scores.append(50)
            flags.append(f"Oura: low HRV ({hrv}ms)")
        elif hrv > 65:
            sub_scores.append(95)
        else:
            sub_scores.append(80)

        temp_delta = rt.get("skin_temperature_delta_c", 0.0)
        if abs(temp_delta) > 1.5:
            sub_scores.append(35)
            flags.append(f"Oura: significant skin temp deviation ({temp_delta:+.2f}°C)")
        elif abs(temp_delta) > 0.8:
            sub_scores.append(60)
            flags.append(f"Oura: skin temp deviation ({temp_delta:+.2f}°C)")
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
            if sleep_score < 40:
                sub_scores.append(30)
                flags.append(f"Oura: very poor sleep (score: {sleep_score})")
            elif sleep_score < 60:
                sub_scores.append(55)
                flags.append(f"Oura: below-average sleep (score: {sleep_score})")
            elif sleep_score >= 80:
                sub_scores.append(95)
            else:
                sub_scores.append(75)

    cgm = snapshot.get("devices", {}).get("dexcom_g7", {})
    if cgm:
        device_count += 1
        rt = cgm.get("realtime", {})

        glucose = rt.get("glucose_mg_dl", 100)
        trend = rt.get("trend_key", "flat")
        zone = rt.get("zone_urgency", "normal")

        if glucose <= 54:
            sub_scores.append(5)
            flags.append(f"⚠ URGENT LOW glucose ({glucose} mg/dL) — hypoglycemia")
        elif glucose <= 69:
            sub_scores.append(35)
            flags.append(f"Low glucose ({glucose} mg/dL)")
        elif glucose >= 250:
            sub_scores.append(10)
            flags.append(f"⚠ URGENT HIGH glucose ({glucose} mg/dL) — severe hyperglycemia")
        elif glucose >= 180:
            sub_scores.append(45)
            flags.append(f"High glucose ({glucose} mg/dL)")
        elif 70 <= glucose <= 140:
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

        if in_range_pct < 50:
            sub_scores.append(30)
            flags.append(f"CGM: poor time in range ({in_range_pct}% — target ≥70%)")
        elif in_range_pct < 70:
            sub_scores.append(55)
            flags.append(f"CGM: below-target time in range ({in_range_pct}%)")
        elif in_range_pct >= 80:
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
        },
    )


def score_nlp(transcript_analysis: Optional[Any] = None) -> SignalInput:
    """
    Placeholder for NLP sentiment.
    """
    if transcript_analysis is None:
        return SignalInput(
            source="nlp",
            score=75.0,
            confidence=0.0,
            weight=0.0,
            flags=["NLP module not connected"],
        )
    # TODO: implement
    return SignalInput(source="nlp", score=75.0, confidence=0.0, weight=0.0)


def score_behavioral(behavioral_data: Optional[Any] = None) -> SignalInput:
    """
    Placeholder for behavioral signals(?)
    """
    if behavioral_data is None:
        return SignalInput(
            source="behavioral",
            score=75.0,
            confidence=0.0,
            weight=0.0,
            flags=["Behavioral module not connected"],
        )
    # TODO: implement
    return SignalInput(source="behavioral", score=75.0, confidence=0.0, weight=0.0)


def _fuse_signals(signals: list[SignalInput]) -> tuple[float, list[str]]:
    """
    Weighted average with confidence gating.

    effective_weight = weight × confidence

    If confidence is 0, the signal is ignored entirely

    Also applies a "drag-down" rule: if ANY signal is in critical range
    and has reasonable confidence, cap the fused score.
    """
    contributing = []
    factors = []

    for sig in signals:
        ew = sig.weight * sig.confidence
        if ew <= 0:
            continue
        contributing.append((sig.score, ew, sig.source))
        factors.append(f"{sig.source}: {sig.score:.0f}/100 (weight={sig.weight}, conf={sig.confidence})")

    if not contributing:
        return 75.0, ["No signals with confidence > 0 — defaulting to 75"]

    total_weight = sum(ew for _, ew, _ in contributing)
    fused = sum(score * ew for score, ew, _ in contributing) / total_weight

    # Critical drag-down
    # If any confident signal is screaming danger, don't let the average
    # paper over it. A great sleep score shouldn't mask an SpO2 of 88%.
    for sig in signals:
        if sig.confidence >= 0.5 and sig.score < 25:
            cap = 35.0
            if fused > cap:
                factors.append(
                    f"⚠ {sig.source} critically low ({sig.score:.0f}) — capping fused score at {cap}"
                )
                fused = min(fused, cap)

    return round(fused, 2), factors


def consolidate(
        acoustic_result: Optional[Any] = None,
        wearable_snapshot: Optional[dict] = None,
        transcript_analysis: Optional[Any] = None,
        facial_analysis: Optional[Any] = None,
        behavioral_data: Optional[Any] = None,
) -> VitalityResult:
    """
    The main entry point. Feed it whatever you have, get back a VitalityResult.
    Signals with no data are gracefully ignored (confidence=0, weight=0).
    """
    logger.info("═══════════════════════════════════════")
    logger.info("  VITALITY INDEX — consolidating signals")
    logger.info("═══════════════════════════════════════")

    signals = [
        score_voice(acoustic_result),
        score_wearable(wearable_snapshot),
        score_nlp(transcript_analysis),
        score_behavioral(behavioral_data),
    ]

    active_signals = [s for s in signals if s.confidence > 0]
    logger.info(f"Active signals: {[s.source for s in active_signals]}")

    for sig in active_signals:
        logger.info(f"  {sig.source:12s} → score={sig.score:5.1f}  conf={sig.confidence:.2f}  weight={sig.weight}")

    vitality_index, contributing_factors = _fuse_signals(signals)

    all_flags = []
    for sig in signals:
        for flag in sig.flags:
            all_flags.append(f"[{sig.source}] {flag}")

    tier = _get_tier(vitality_index)

    active_sources = ", ".join(s.source for s in active_signals) or "none"
    summary = (
        f"Vitality Index: {vitality_index:.0f}/100 → {tier['label'].upper()}. "
        f"Based on: {active_sources}. "
        f"{tier['action']}."
    )

    if vitality_index < 30:
        summary += " ⚠ IMMEDIATE ATTENTION REQUIRED."

    logger.info(f"  VITALITY INDEX = {vitality_index:.1f} → {tier['id']}")
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
    )


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    from wearable import collect_snapshot

    print("\n" + "=" * 60)
    print("  VITALITY INDEX DEMO — all profiles")
    print("=" * 60)

    for profile in ["baseline", "calm", "anxious", "depressed", "fatigued"]:
        snap = collect_snapshot(profile=profile)
        result = consolidate(wearable_snapshot=snap)

        print(f"\n{'─' * 50}")
        print(f"  Profile: {profile.upper()}")
        print(f"  Vitality Index: {result.vitality_index}/100")
        print(f"  Tier: {result.tier_id} — {result.tier_action}")
        print(f"  Flags: {len(result.flags)}")
        for f in result.flags[:5]:
            print(f"    • {f}")
        if len(result.flags) > 5:
            print(f"    ... and {len(result.flags) - 5} more")

    print(f"\n{'─' * 50}")
    print("  FULL JSON (anxious profile):")
    print("─" * 50)
    snap = collect_snapshot(profile="anxious")
    result = consolidate(wearable_snapshot=snap)
    print(result.to_json())
