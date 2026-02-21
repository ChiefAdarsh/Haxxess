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
    },
    "anxious": {
        "hr": 93, "hrv": 24, "spo2": 97, "sys": 132, "dia": 86,
        "resp_rate": 21.0, "skin_temp": 33.9, "steps": 1200,
        "calories": 85, "stress": 72, "readiness": 48,
        "sleep_score": 52, "activity_score": 35,
    },
    "depressed": {
        "hr": 64, "hrv": 32, "spo2": 97, "sys": 114, "dia": 74,
        "resp_rate": 13.0, "skin_temp": 32.4, "steps": 650,
        "calories": 40, "stress": 55, "readiness": 40,
        "sleep_score": 55, "activity_score": 20,
    },
    "active": {
        "hr": 108, "hrv": 62, "spo2": 99, "sys": 126, "dia": 78,
        "resp_rate": 23.0, "skin_temp": 34.6, "steps": 9800,
        "calories": 540, "stress": 18, "readiness": 90,
        "sleep_score": 88, "activity_score": 95,
    },
    "fatigued": {
        "hr": 77, "hrv": 28, "spo2": 96, "sys": 117, "dia": 77,
        "resp_rate": 14.0, "skin_temp": 32.7, "steps": 980,
        "calories": 55, "stress": 60, "readiness": 35,
        "sleep_score": 42, "activity_score": 18,
    },
    "calm": {
        "hr": 62, "hrv": 68, "spo2": 99, "sys": 115, "dia": 72,
        "resp_rate": 12.5, "skin_temp": 33.5, "steps": 4200,
        "calories": 200, "stress": 12, "readiness": 88,
        "sleep_score": 90, "activity_score": 65,
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
        """Simulate the most recent workout."""
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
        """Oura's readiness contributors."""
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
        devices = ["apple_watch", "oura_ring"]

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


if __name__ == "__main__":
    for profile_name in ["baseline", "anxious", "depressed", "fatigued", "calm"]:
        print(f"\n{'═' * 60}")
        print(f"  PROFILE: {profile_name.upper()}")
        print(f"{'═' * 60}")
        snap = collect_snapshot(profile=profile_name)
        print(json.dumps(snap, indent=2, default=str))