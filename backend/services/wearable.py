import random
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from typing import Optional
import json


PROFILES = {
    "baseline": {
        "hr": 72, "hrv": 52, "spo2": 98, "sys": 120, "dia": 80,
        "resp_rate": 15.0, "skin_temp": 33.2, "steps": 3450,
        "calories": 180, "stress": 30, "readiness": 82,
        "sleep_score": 80, "activity_score": 75,
        "glucose": 105, "glucose_trend": "flat",
    },
    "anxious": {
        "hr": 93, "hrv": 24, "spo2": 97, "sys": 132, "dia": 86,
        "resp_rate": 21.0, "skin_temp": 33.9, "steps": 1200,
        "calories": 85, "stress": 72, "readiness": 48,
        "sleep_score": 52, "activity_score": 35,
        "glucose": 145, "glucose_trend": "rising",
    },
    "depressed": {
        "hr": 64, "hrv": 32, "spo2": 97, "sys": 114, "dia": 74,
        "resp_rate": 13.0, "skin_temp": 32.4, "steps": 650,
        "calories": 40, "stress": 55, "readiness": 40,
        "sleep_score": 55, "activity_score": 20,
        "glucose": 95, "glucose_trend": "flat",
    },
    "active": {
        "hr": 108, "hrv": 62, "spo2": 99, "sys": 126, "dia": 78,
        "resp_rate": 23.0, "skin_temp": 34.6, "steps": 9800,
        "calories": 540, "stress": 18, "readiness": 90,
        "sleep_score": 88, "activity_score": 95,
        "glucose": 88, "glucose_trend": "falling_slowly",
    },
    "fatigued": {
        "hr": 77, "hrv": 28, "spo2": 96, "sys": 117, "dia": 77,
        "resp_rate": 14.0, "skin_temp": 32.7, "steps": 980,
        "calories": 55, "stress": 60, "readiness": 35,
        "sleep_score": 42, "activity_score": 18,
        "glucose": 165, "glucose_trend": "rising_fast",
    },
    "calm": {
        "hr": 62, "hrv": 68, "spo2": 99, "sys": 115, "dia": 72,
        "resp_rate": 12.5, "skin_temp": 33.5, "steps": 4200,
        "calories": 200, "stress": 12, "readiness": 88,
        "sleep_score": 90, "activity_score": 65,
        "glucose": 98, "glucose_trend": "flat",
    },
}


def _get_profile(name: str) -> dict:
    return PROFILES.get(name, PROFILES["baseline"]).copy()


def _clamp(val, lo, hi):
    return max(lo, min(hi, val))


def _walk_int(current, lo, hi, step=(-2, 2)):
    return _clamp(current + random.randint(step[0], step[1]), lo, hi)


def _walk_float(current, lo, hi, step=(-0.2, 0.2)):
    return round(_clamp(current + random.uniform(step[0], step[1]), lo, hi), 2)


def _generate_sleep(device_label: str, profile: dict) -> dict:
    """Generate a realistic last-night sleep summary."""
    bedtime_hour = random.choice([22, 23, 23, 23, 0])
    bedtime_min = random.randint(0, 55)
    bed = datetime.utcnow().replace(
        hour=bedtime_hour, minute=bedtime_min, second=0, microsecond=0
    ) - timedelta(days=1 if bedtime_hour >= 22 else 0)

    sleep_hours = random.uniform(4.5, 9.0)
    if profile.get("readiness", 80) < 50:
        sleep_hours = random.uniform(3.5, 6.5)

    wake = bed + timedelta(hours=sleep_hours)
    total_min = round((wake - bed).total_seconds() / 60)

    deep = random.uniform(0.10, 0.25)
    rem = random.uniform(0.15, 0.28)
    awake_frac = random.uniform(0.03, 0.10)
    light = round(1.0 - deep - rem - awake_frac, 3)

    return {
        "device": device_label,
        "sleep_date": bed.strftime("%Y-%m-%d"),
        "bedtime": bed.isoformat() + "Z",
        "wake_time": wake.isoformat() + "Z",
        "total_sleep_minutes": total_min,
        "time_in_bed_minutes": total_min + random.randint(5, 30),
        "sleep_latency_minutes": random.randint(3, 40),
        "awake_minutes": random.randint(3, 35),
        "deep_sleep_pct": round(deep * 100, 1),
        "rem_sleep_pct": round(rem * 100, 1),
        "light_sleep_pct": round(light * 100, 1),
        "lowest_resting_hr_bpm": random.randint(48, 64),
        "avg_sleeping_hr_bpm": random.randint(52, 68),
        "avg_sleeping_hrv_ms": _clamp(profile["hrv"] + random.randint(-8, 8), 10, 90),
        "respiratory_rate_brpm": round(random.uniform(12.0, 17.0), 1),
        "sleep_score": _clamp(profile["sleep_score"] + random.randint(-3, 3), 10, 100),
        "restfulness_score": random.randint(50, 95),
    }


class MockAppleWatch:
    DEVICE_ID = "apple_watch"
    DEVICE_LABEL = "Apple Watch Series 9"

    def __init__(self, profile: str = "baseline"):
        p = _get_profile(profile)
        self._hr = p["hr"]
        self._hrv = p["hrv"]
        self._spo2 = p["spo2"]
        self._sys = p["sys"]
        self._dia = p["dia"]
        self._resp_rate = p["resp_rate"]
        self._skin_temp = p["skin_temp"]
        self._steps = p["steps"]
        self._calories = p["calories"]
        self._profile = p

    def get_next_reading(self) -> dict:
        self._hr = _walk_int(self._hr, 45, 130)
        self._hrv = _walk_int(self._hrv, 10, 95)
        self._spo2 = _walk_int(self._spo2, 92, 100, step=(-1, 1))
        if random.random() > 0.5:
            self._sys = _walk_int(self._sys, 100, 150, step=(-1, 1))
            self._dia = _walk_int(self._dia, 60, 100, step=(-1, 1))
        self._resp_rate = _walk_float(self._resp_rate, 10.0, 28.0, step=(-0.3, 0.3))
        self._skin_temp = _walk_float(self._skin_temp, 31.0, 37.0, step=(-0.05, 0.05))
        self._steps += random.randint(0, 4)
        self._calories += random.randint(0, 3)

        return {
            "device": self.DEVICE_LABEL,
            "device_id": self.DEVICE_ID,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "heart_rate_bpm": self._hr,
            "heart_rate_variability_ms": self._hrv,
            "blood_oxygen_pct": self._spo2,
            "blood_pressure": {
                "systolic_mmhg": self._sys,
                "diastolic_mmhg": self._dia,
            },
            "respiratory_rate_brpm": self._resp_rate,
            "wrist_skin_temperature_c": self._skin_temp,
            "steps_today": self._steps,
            "active_energy_kcal": self._calories,
            "stand_hours_today": random.randint(3, 12),
            "exercise_minutes_today": random.randint(0, 60),
            "ambient_noise_db": round(random.uniform(40, 82), 1),
            "atrial_fibrillation_detected": False,
            "fall_detected": False,
        }

    def get_sleep(self) -> dict:
        return _generate_sleep(self.DEVICE_LABEL, self._profile)

    def get_workout_summary(self) -> dict:
        workout_types = ["walking", "running", "cycling", "yoga", "strength", "swimming"]
        wtype = random.choice(workout_types)
        duration = random.randint(15, 75)
        return {
            "device": self.DEVICE_LABEL,
            "timestamp": (datetime.utcnow() - timedelta(hours=random.randint(1, 8))).isoformat() + "Z",
            "workout_type": wtype,
            "duration_minutes": duration,
            "avg_heart_rate_bpm": random.randint(95, 160),
            "max_heart_rate_bpm": random.randint(140, 190),
            "calories_burned_kcal": random.randint(80, 500),
            "distance_km": round(random.uniform(0.5, 12.0), 2) if wtype in ("walking", "running", "cycling") else None,
            "vo2_max_estimate": round(random.uniform(28, 55), 1),
        }


class MockOuraRing:
    DEVICE_ID = "oura_ring"
    DEVICE_LABEL = "Oura Ring Gen 3"

    def __init__(self, profile: str = "baseline"):
        p = _get_profile(profile)
        self._hr = p["hr"]
        self._hrv = p["hrv"]
        self._spo2 = p["spo2"]
        self._resp_rate = p["resp_rate"]
        self._skin_temp_delta = round(p["skin_temp"] - 33.2, 2)
        self._readiness = p["readiness"]
        self._sleep_score = p["sleep_score"]
        self._activity_score = p["activity_score"]
        self._stress = p["stress"]
        self._steps = p["steps"]
        self._calories = p["calories"]
        self._profile = p

    def get_next_reading(self) -> dict:
        self._hr = _walk_int(self._hr, 45, 120, step=(-1, 1))
        self._hrv = _walk_int(self._hrv, 8, 95, step=(-2, 2))
        self._spo2 = _walk_int(self._spo2, 92, 100, step=(-1, 1))
        self._resp_rate = _walk_float(self._resp_rate, 10.0, 26.0, step=(-0.2, 0.2))
        self._skin_temp_delta = _walk_float(self._skin_temp_delta, -2.0, 3.0, step=(-0.05, 0.05))

        return {
            "device": self.DEVICE_LABEL,
            "device_id": self.DEVICE_ID,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "heart_rate_bpm": self._hr,
            "heart_rate_variability_ms": self._hrv,
            "blood_oxygen_pct": self._spo2,
            "respiratory_rate_brpm": self._resp_rate,
            "skin_temperature_delta_c": self._skin_temp_delta,
        }

    def get_daily_scores(self) -> dict:
        self._readiness = _walk_int(self._readiness, 15, 100, step=(-1, 1))
        self._sleep_score = _walk_int(self._sleep_score, 15, 100, step=(-1, 1))
        self._activity_score = _walk_int(self._activity_score, 10, 100, step=(-1, 1))
        self._stress = _walk_int(self._stress, 0, 100, step=(-2, 2))

        body_battery = _clamp(self._readiness + random.randint(-10, 5), 5, 100)
        recovery_index = round(
            self._readiness * 0.35 + self._sleep_score * 0.35 + self._hrv * 0.30, 1
        )

        return {
            "device": self.DEVICE_LABEL,
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "readiness_score": self._readiness,
            "sleep_score": self._sleep_score,
            "activity_score": self._activity_score,
            "stress_level": self._stress,
            "recovery_index": recovery_index,
            "body_battery": body_battery,
            "steps_today": self._steps + random.randint(0, 50),
            "total_calories_kcal": self._calories + random.randint(600, 900),
            "inactive_minutes": random.randint(200, 600),
        }

    def get_sleep(self) -> dict:
        return _generate_sleep(self.DEVICE_LABEL, self._profile)

    def get_readiness_breakdown(self) -> dict:
        return {
            "device": self.DEVICE_LABEL,
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "readiness_score": self._readiness,
            "contributors": {
                "resting_heart_rate": random.choice(["optimal", "good", "fair", "attention"]),
                "hrv_balance": random.choice(["optimal", "good", "fair", "attention"]),
                "body_temperature": random.choice(["optimal", "good", "fair", "attention"]),
                "recovery_index": random.choice(["optimal", "good", "fair", "attention"]),
                "sleep_balance": random.choice(["optimal", "good", "fair", "attention"]),
                "previous_day_activity": random.choice(["optimal", "good", "fair", "attention"]),
                "activity_balance": random.choice(["optimal", "good", "fair", "attention"]),
            },
        }


GLUCOSE_TRENDS = {
    "rising_fast":    {"arrow": "↑↑", "label": "Rising quickly",      "rate_range": (3, 5)},
    "rising":         {"arrow": "↑",  "label": "Rising",              "rate_range": (1.5, 3)},
    "rising_slowly":  {"arrow": "↗",  "label": "Rising slowly",       "rate_range": (0.5, 1.5)},
    "flat":           {"arrow": "→",  "label": "Stable",              "rate_range": (-0.5, 0.5)},
    "falling_slowly": {"arrow": "↘",  "label": "Falling slowly",      "rate_range": (-1.5, -0.5)},
    "falling":        {"arrow": "↓",  "label": "Falling",             "rate_range": (-3, -1.5)},
    "falling_fast":   {"arrow": "↓↓", "label": "Falling quickly",     "rate_range": (-5, -3)},
}

GLUCOSE_RANGES = {
    "very_low":  {"range": (0, 54),    "label": "Urgent Low",   "urgency": "critical"},
    "low":       {"range": (55, 69),   "label": "Low",          "urgency": "warning"},
    "normal":    {"range": (70, 180),  "label": "In Range",     "urgency": "normal"},
    "high":      {"range": (181, 250), "label": "High",         "urgency": "warning"},
    "very_high": {"range": (251, 400), "label": "Urgent High",  "urgency": "critical"},
}


def _classify_glucose(mg_dl: int) -> dict:
    """Classify a glucose reading into Dexcom's clinical ranges."""
    for key, info in GLUCOSE_RANGES.items():
        lo, hi = info["range"]
        if lo <= mg_dl <= hi:
            return {"zone": key, "label": info["label"], "urgency": info["urgency"]}
    if mg_dl > 400:
        return {"zone": "very_high", "label": "Urgent High", "urgency": "critical"}
    return {"zone": "very_low", "label": "Urgent Low", "urgency": "critical"}


class MockDexcomG7:
    """
    Simulates a Dexcom G7 Continuous Glucose Monitor. We simulate at 1Hz for the live dashboard (interpolated), with a get_daily_summary() for the 24hr view.
    """
    DEVICE_ID = "dexcom_g7"
    DEVICE_LABEL = "Dexcom G7 CGM"

    def __init__(self, profile: str = "baseline"):
        p = _get_profile(profile)
        self._glucose = p["glucose"]
        self._trend_key = p["glucose_trend"]
        self._profile = p

        self._tick = 0
        self._meal_spike_remaining = 0  # ticks of post-meal spike left
        self._insulin_drop_remaining = 0  # ticks of insulin correction left
        self._dawn_effect_active = False

        self._history: list[int] = [self._glucose] * 20  # seed with some readings

    def _simulate_dynamics(self):
        if self._meal_spike_remaining <= 0 and random.random() < 0.05:
            self._meal_spike_remaining = random.randint(15, 40)
            self._trend_key = random.choice(["rising", "rising_fast"])

        if self._insulin_drop_remaining <= 0 and self._glucose > 160 and random.random() < 0.03:
            self._insulin_drop_remaining = random.randint(20, 50)
            self._trend_key = random.choice(["falling", "falling_slowly"])

        if self._meal_spike_remaining > 0:
            self._glucose += random.randint(1, 4)
            self._meal_spike_remaining -= 1
            if self._meal_spike_remaining <= 0:
                self._trend_key = "falling_slowly"  # post-meal descent

        elif self._insulin_drop_remaining > 0:
            self._glucose -= random.randint(1, 3)
            self._insulin_drop_remaining -= 1
            if self._insulin_drop_remaining <= 0:
                self._trend_key = "flat"

        trend_info = GLUCOSE_TRENDS.get(self._trend_key, GLUCOSE_TRENDS["flat"])
        rate_lo, rate_hi = trend_info["rate_range"]
        drift = random.uniform(rate_lo, rate_hi) * 0.3  # scale down since we tick faster than 5min
        self._glucose = round(self._glucose + drift)

        self._glucose += random.randint(-2, 2)

        self._glucose = _clamp(self._glucose, 40, 400)

        if self._meal_spike_remaining <= 0 and self._insulin_drop_remaining <= 0:
            if random.random() < 0.08:
                self._trend_key = random.choice(["flat", "flat", "rising_slowly", "falling_slowly"])

        self._history.append(self._glucose)
        if len(self._history) > 288:
            self._history = self._history[-288:]

        self._tick += 1

    def get_next_reading(self) -> dict:
        """Get the current CGM reading (simulated at ~1Hz for live dashboard)."""
        self._simulate_dynamics()

        trend = GLUCOSE_TRENDS.get(self._trend_key, GLUCOSE_TRENDS["flat"])
        classification = _classify_glucose(self._glucose)

        alerts = []
        if self._glucose <= 54:
            alerts.append({"type": "urgent_low", "message": f"⚠ URGENT LOW: {self._glucose} mg/dL", "severity": "critical"})
        elif self._glucose <= 69:
            alerts.append({"type": "low", "message": f"Low glucose: {self._glucose} mg/dL", "severity": "warning"})
        elif self._glucose >= 250:
            alerts.append({"type": "urgent_high", "message": f"⚠ URGENT HIGH: {self._glucose} mg/dL", "severity": "critical"})
        elif self._glucose >= 180:
            alerts.append({"type": "high", "message": f"High glucose: {self._glucose} mg/dL", "severity": "warning"})

        if self._trend_key in ("rising_fast", "falling_fast"):
            alerts.append({
                "type": "rapid_change",
                "message": f"Glucose {trend['label'].lower()} ({trend['arrow']})",
                "severity": "warning",
            })

        return {
            "device": self.DEVICE_LABEL,
            "device_id": self.DEVICE_ID,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "glucose_mg_dl": self._glucose,
            "glucose_mmol_l": round(self._glucose / 18.0, 1),
            "trend_arrow": trend["arrow"],
            "trend_description": trend["label"],
            "trend_key": self._trend_key,
            "zone": classification["zone"],
            "zone_label": classification["label"],
            "zone_urgency": classification["urgency"],
            "alerts": alerts,
            "sensor_age_days": random.randint(1, 10),  # G7 lasts 10 days
        }

    def get_daily_summary(self) -> dict:
        """
        24-hour glucose summary — the kind of view you'd see in the Dexcom Clarity app.
        Includes time-in-range, averages, and estimated A1C.
        """
        if not self._history:
            return {"device": self.DEVICE_LABEL, "error": "No data yet"}

        readings = self._history
        avg = round(sum(readings) / len(readings))
        std = round((sum((r - avg) ** 2 for r in readings) / len(readings)) ** 0.5, 1)

        very_low = sum(1 for r in readings if r <= 54)
        low = sum(1 for r in readings if 55 <= r <= 69)
        in_range = sum(1 for r in readings if 70 <= r <= 180)
        high = sum(1 for r in readings if 181 <= r <= 250)
        very_high = sum(1 for r in readings if r > 250)
        total = len(readings)

        estimated_a1c = round((avg + 46.7) / 28.7, 1)

        gmi = round(3.31 + (0.02392 * avg), 1)

        cv = round((std / avg) * 100, 1) if avg > 0 else 0

        return {
            "device": self.DEVICE_LABEL,
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "readings_count": total,
            "average_glucose_mg_dl": avg,
            "std_dev_mg_dl": std,
            "coefficient_of_variation_pct": cv,
            "glucose_management_indicator": gmi,
            "estimated_a1c_pct": estimated_a1c,
            "min_glucose_mg_dl": min(readings),
            "max_glucose_mg_dl": max(readings),
            "time_in_range": {
                "very_low_pct":  round(very_low / total * 100, 1),
                "low_pct":       round(low / total * 100, 1),
                "in_range_pct":  round(in_range / total * 100, 1),
                "high_pct":      round(high / total * 100, 1),
                "very_high_pct": round(very_high / total * 100, 1),
            },
            # Clinical targets (ADA guidelines)
            "targets": {
                "time_in_range_goal_pct": 70,
                "time_below_range_goal_pct": 4,
                "time_above_range_goal_pct": 25,
                "cv_goal_below_pct": 36,
            },
            "meets_targets": {
                "time_in_range": round(in_range / total * 100, 1) >= 70,
                "glycemic_variability": cv < 36,
            },
        }

    def get_recent_history(self, count: int = 30) -> list[dict]:
        """Last N glucose readings — for sparkline / mini chart on dashboard."""
        recent = self._history[-count:]
        now = datetime.utcnow()
        return [
            {
                "timestamp": (now - timedelta(minutes=(len(recent) - i) * 5)).isoformat() + "Z",
                "glucose_mg_dl": val,
                "zone": _classify_glucose(val)["zone"],
            }
            for i, val in enumerate(recent)
        ]


def collect_snapshot(
    profile: str = "baseline",
    devices: Optional[list[str]] = None,
) -> dict:
    """
    Build a full wearable context snapshot.

    Args:
        profile: One of "baseline", "anxious", "depressed", "active", "fatigued", "calm"
        devices: List of device ids to include. None = all.

    Returns:
        Nested dict keyed by device id.
    """
    if devices is None:
        devices = ["apple_watch", "oura_ring", "dexcom_g7"]

    snapshot = {
        "collected_at": datetime.utcnow().isoformat() + "Z",
        "profile_hint": profile,
        "devices": {},
    }

    if "apple_watch" in devices:
        aw = MockAppleWatch(profile=profile)
        snapshot["devices"]["apple_watch"] = {
            "info": {
                "device_name": aw.DEVICE_LABEL,
                "device_id": aw.DEVICE_ID,
            },
            "realtime": aw.get_next_reading(),
            "sleep": aw.get_sleep(),
            "last_workout": aw.get_workout_summary(),
        }

    if "oura_ring" in devices:
        oura = MockOuraRing(profile=profile)
        snapshot["devices"]["oura_ring"] = {
            "info": {
                "device_name": oura.DEVICE_LABEL,
                "device_id": oura.DEVICE_ID,
            },
            "realtime": oura.get_next_reading(),
            "daily_scores": oura.get_daily_scores(),
            "sleep": oura.get_sleep(),
            "readiness_breakdown": oura.get_readiness_breakdown(),
        }

    if "dexcom_g7" in devices:
        cgm = MockDexcomG7(profile=profile)
        for _ in range(30):
            cgm._simulate_dynamics()
        snapshot["devices"]["dexcom_g7"] = {
            "info": {
                "device_name": cgm.DEVICE_LABEL,
                "device_id": cgm.DEVICE_ID,
            },
            "realtime": cgm.get_next_reading(),
            "daily_summary": cgm.get_daily_summary(),
            "recent_history": cgm.get_recent_history(count=30),
        }

    return snapshot


class MockWearable:
    """Original simple interface, kept for backward compatibility."""

    def __init__(self):
        self.hr = 72
        self.spo2 = 98
        self.sys = 120
        self.dia = 80
        self.steps = 3450

    def get_next_reading(self) -> dict:
        self.hr = _walk_int(self.hr, 60, 110)
        self.spo2 = _walk_int(self.spo2, 94, 100, step=(-1, 1))
        if random.random() > 0.5:
            self.sys = _walk_int(self.sys, 110, 135, step=(-1, 1))
            self.dia = _walk_int(self.dia, 70, 85, step=(-1, 1))
        self.steps += random.randint(0, 2)

        return {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "heartRate": self.hr,
            "bloodOxygen": self.spo2,
            "bloodPressure": f"{self.sys}/{self.dia}",
            "steps": self.steps,
            "hrv": random.randint(45, 55),
        }


wearable_sim = MockWearable()
apple_watch_sim = MockAppleWatch()
oura_ring_sim = MockOuraRing()
dexcom_sim = MockDexcomG7()


if __name__ == "__main__":
    for profile_name in ["baseline", "anxious", "depressed", "fatigued", "calm"]:
        print(f"\n{'═' * 60}")
        print(f"  PROFILE: {profile_name.upper()}")
        print(f"{'═' * 60}")
        snap = collect_snapshot(profile=profile_name)
        print(json.dumps(snap, indent=2, default=str))