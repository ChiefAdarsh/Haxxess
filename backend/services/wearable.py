import random
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from typing import Optional
import json


PROFILES = {
    "follicular": {
        "hr": 65, "hrv": 58, "spo2": 99, "sys": 115, "dia": 73,
        "resp_rate": 14.0, "skin_temp": 33.0, "steps": 7200,
        "calories": 320, "stress": 18, "readiness": 88,
        "sleep_score": 85, "activity_score": 82,
        "glucose": 95, "glucose_trend": "flat",
        "bbt": 36.2,  # basal body temp - lowest in follicular
        "temp_delta": -0.1,  # Oura skin temp delta from baseline
        "label": "Follicular Phase",
    },
    "ovulation": {
        "hr": 68, "hrv": 55, "spo2": 99, "sys": 118, "dia": 75,
        "resp_rate": 14.5, "skin_temp": 33.3, "steps": 8500,
        "calories": 380, "stress": 22, "readiness": 85,
        "sleep_score": 82, "activity_score": 88,
        "glucose": 92, "glucose_trend": "flat",
        "bbt": 36.4,  # beginning to rise
        "temp_delta": 0.1,
        "label": "Ovulation",
    },
    "luteal_mild": {
        "hr": 74, "hrv": 42, "spo2": 98, "sys": 120, "dia": 78,
        "resp_rate": 15.5, "skin_temp": 33.6, "steps": 5200,
        "calories": 240, "stress": 38, "readiness": 68,
        "sleep_score": 72, "activity_score": 60,
        "glucose": 115, "glucose_trend": "rising_slowly",
        "bbt": 36.7,  # progesterone-mediated rise
        "temp_delta": 0.4,
        "label": "Early Luteal (Mild PMS)",
    },
    "luteal_pms": {
        "hr": 80, "hrv": 32, "spo2": 97, "sys": 125, "dia": 82,
        "resp_rate": 16.5, "skin_temp": 33.8, "steps": 3200,
        "calories": 160, "stress": 62, "readiness": 48,
        "sleep_score": 58, "activity_score": 35,
        "glucose": 135, "glucose_trend": "rising",
        "bbt": 36.9,  # peak BBT
        "temp_delta": 0.6,
        "label": "Late Luteal / PMS",
    },
    "pmdd_crisis": {
        "hr": 92, "hrv": 18, "spo2": 97, "sys": 132, "dia": 86,
        "resp_rate": 19.0, "skin_temp": 34.1, "steps": 800,
        "calories": 60, "stress": 85, "readiness": 22,
        "sleep_score": 32, "activity_score": 12,
        "glucose": 155, "glucose_trend": "rising_fast",
        "bbt": 37.1,  # elevated before period drop
        "temp_delta": 0.8,
        "label": "PMDD Crisis",
    },

    "pcos_flare": {
        "hr": 82, "hrv": 28, "spo2": 97, "sys": 128, "dia": 84,
        "resp_rate": 16.0, "skin_temp": 33.5, "steps": 2800,
        "calories": 130, "stress": 58, "readiness": 42,
        "sleep_score": 55, "activity_score": 28,
        "glucose": 175, "glucose_trend": "rising",
        "bbt": 36.5,  # flat - no ovulation detected
        "temp_delta": 0.2,
        "label": "PCOS Flare",
    },
    "perimenopause": {
        "hr": 78, "hrv": 30, "spo2": 97, "sys": 130, "dia": 83,
        "resp_rate": 16.0, "skin_temp": 34.2, "steps": 3500,
        "calories": 170, "stress": 52, "readiness": 45,
        "sleep_score": 42, "activity_score": 38,
        "glucose": 120, "glucose_trend": "flat",
        "bbt": 36.4,  # erratic in perimenopause
        "temp_delta": 0.0,  # but with spikes (handled in dynamics)
        "label": "Perimenopause",
    },

    "baseline": {
        "hr": 72, "hrv": 52, "spo2": 98, "sys": 120, "dia": 80,
        "resp_rate": 15.0, "skin_temp": 33.2, "steps": 5000,
        "calories": 240, "stress": 30, "readiness": 82,
        "sleep_score": 80, "activity_score": 75,
        "glucose": 105, "glucose_trend": "flat",
        "bbt": 36.3,
        "temp_delta": 0.0,
        "label": "Baseline",
    },
}

# When MongoDB is used, main seeds and loads profiles into this; wearable then uses DB data.
PROFILES_SOURCE: Optional[dict] = None


def set_profiles_source(profiles_dict: Optional[dict]) -> None:
    """Set profile definitions from DB (id -> { label, hr, hrv, ... }). None = use built-in PROFILES."""
    global PROFILES_SOURCE
    PROFILES_SOURCE = profiles_dict


def _get_profile(name: str) -> dict:
    source = PROFILES_SOURCE if PROFILES_SOURCE is not None else PROFILES
    base = PROFILES.get("baseline", {})
    return source.get(name, source.get("baseline", base)).copy()


def _clamp(val, lo, hi):
    return max(lo, min(hi, val))


def _walk_int(current, lo, hi, step=(-2, 2)):
    return _clamp(current + random.randint(step[0], step[1]), lo, hi)


def _walk_float(current, lo, hi, step=(-0.2, 0.2)):
    return round(_clamp(current + random.uniform(step[0], step[1]), lo, hi), 2)


def _generate_sleep(device_label: str, profile: dict) -> dict:
    bedtime_hour = random.choice([22, 23, 23, 23, 0])
    bedtime_min = random.randint(0, 55)
    bed = datetime.utcnow().replace(
        hour=bedtime_hour, minute=bedtime_min, second=0, microsecond=0
    ) - timedelta(days=1 if bedtime_hour >= 22 else 0)

    readiness = profile.get("readiness", 80)
    label = profile.get("label", "")

    # Sleep duration is cycle-phase dependent
    if readiness >= 75:
        sleep_hours = random.uniform(6.5, 8.5)
    elif readiness >= 50:
        sleep_hours = random.uniform(5.0, 7.5)
    else:
        sleep_hours = random.uniform(3.5, 6.0)

    wake = bed + timedelta(hours=sleep_hours)
    total_min = round((wake - bed).total_seconds() / 60)

    deep = random.uniform(0.10, 0.25)
    rem = random.uniform(0.15, 0.28)
    awake_frac = random.uniform(0.03, 0.10)

    # PMDD / perimenopause = more awakenings, less deep sleep
    if "PMDD" in label or "Perimenopause" in label:
        deep = random.uniform(0.05, 0.12)
        awake_frac = random.uniform(0.08, 0.18)

    light = round(1.0 - deep - rem - awake_frac, 3)

    # Night sweats for perimenopause
    night_sweats = None
    if "Perimenopause" in label:
        night_sweats = {
            "events": random.randint(2, 6),
            "avg_temp_spike_c": round(random.uniform(1.2, 2.5), 1),
            "sleep_disruptions": random.randint(2, 5),
        }

    result = {
        "device": device_label,
        "sleep_date": bed.strftime("%Y-%m-%d"),
        "bedtime": bed.isoformat() + "Z",
        "wake_time": wake.isoformat() + "Z",
        "total_sleep_minutes": total_min,
        "time_in_bed_minutes": total_min + random.randint(5, 30),
        "sleep_latency_minutes": random.randint(3, 40),
        "awake_minutes": random.randint(3, 45) if readiness < 50 else random.randint(3, 20),
        "deep_sleep_pct": round(deep * 100, 1),
        "rem_sleep_pct": round(rem * 100, 1),
        "light_sleep_pct": round(light * 100, 1),
        "lowest_resting_hr_bpm": random.randint(48, 64),
        "avg_sleeping_hr_bpm": random.randint(52, 68),
        "avg_sleeping_hrv_ms": _clamp(profile["hrv"] + random.randint(-8, 8), 10, 90),
        "respiratory_rate_brpm": round(random.uniform(12.0, 17.0), 1),
        "sleep_score": _clamp(profile["sleep_score"] + random.randint(-3, 3), 10, 100),
        "restfulness_score": random.randint(50, 95) if readiness >= 60 else random.randint(25, 60),
    }

    if night_sweats:
        result["night_sweats"] = night_sweats

    return result


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
        self._profile_name = profile

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
        # Cycle-phase appropriate workout types
        phase_workouts = {
            "follicular": ["running", "HIIT", "strength", "cycling", "swimming"],
            "ovulation": ["running", "HIIT", "strength", "cycling", "dance"],
            "luteal_mild": ["walking", "yoga", "pilates", "swimming", "cycling"],
            "luteal_pms": ["walking", "yoga", "stretching", "gentle swimming"],
            "pmdd_crisis": ["walking", "gentle stretching"],
            "pcos_flare": ["walking", "strength", "yoga", "resistance training"],
            "perimenopause": ["walking", "swimming", "yoga", "cycling"],
        }
        options = phase_workouts.get(self._profile_name, ["walking", "running", "yoga"])
        wtype = random.choice(options)
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
        self._skin_temp_delta = p.get("temp_delta", 0.0)
        self._readiness = p["readiness"]
        self._sleep_score = p["sleep_score"]
        self._activity_score = p["activity_score"]
        self._stress = p["stress"]
        self._steps = p["steps"]
        self._calories = p["calories"]
        self._profile = p
        self._profile_name = profile
        self._hot_flash_cooldown = 0

    def get_next_reading(self) -> dict:
        self._hr = _walk_int(self._hr, 45, 120, step=(-1, 1))
        self._hrv = _walk_int(self._hrv, 8, 95, step=(-2, 2))
        self._spo2 = _walk_int(self._spo2, 92, 100, step=(-1, 1))
        self._resp_rate = _walk_float(self._resp_rate, 10.0, 26.0, step=(-0.2, 0.2))
        self._skin_temp_delta = _walk_float(
            self._skin_temp_delta, -2.0, 3.0, step=(-0.05, 0.05)
        )

        # Perimenopause hot flash simulation
        hot_flash_event = None
        if self._profile_name == "perimenopause":
            if self._hot_flash_cooldown > 0:
                self._hot_flash_cooldown -= 1
            elif random.random() < 0.03:  # ~3% chance per tick
                spike = round(random.uniform(1.5, 2.8), 1)
                self._skin_temp_delta += spike
                self._hot_flash_cooldown = random.randint(30, 90)
                hot_flash_event = {
                    "detected": True,
                    "temp_spike_c": spike,
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                }

        reading = {
            "device": self.DEVICE_LABEL,
            "device_id": self.DEVICE_ID,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "heart_rate_bpm": self._hr,
            "heart_rate_variability_ms": self._hrv,
            "blood_oxygen_pct": self._spo2,
            "respiratory_rate_brpm": self._resp_rate,
            "skin_temperature_delta_c": self._skin_temp_delta,
        }

        if hot_flash_event:
            reading["hot_flash_event"] = hot_flash_event

        return reading

    def get_daily_scores(self) -> dict:
        self._readiness = _walk_int(self._readiness, 15, 100, step=(-1, 1))
        self._sleep_score = _walk_int(self._sleep_score, 15, 100, step=(-1, 1))
        self._activity_score = _walk_int(self._activity_score, 10, 100, step=(-1, 1))
        self._stress = _walk_int(self._stress, 0, 100, step=(-2, 2))

        body_battery = _clamp(self._readiness + random.randint(-10, 5), 5, 100)
        recovery_index = round(
            self._readiness * 0.35 + self._sleep_score * 0.35 + self._hrv * 0.30, 1
        )

        # Cycle day estimation (shown in Oura's actual app)
        cycle_day = random.randint(1, 28)
        cycle_phase_map = {
            "follicular": random.randint(6, 12),
            "ovulation": random.randint(13, 15),
            "luteal_mild": random.randint(16, 21),
            "luteal_pms": random.randint(22, 27),
            "pmdd_crisis": random.randint(24, 28),
            "pcos_flare": None,  # irregular/anovulatory
            "perimenopause": None,  # irregular
        }
        est_day = cycle_phase_map.get(self._profile_name, random.randint(1, 28))

        result = {
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

        if est_day is not None:
            result["estimated_cycle_day"] = est_day
        else:
            result["cycle_note"] = "Irregular cycle - ovulation not detected"

        return result

    def get_sleep(self) -> dict:
        return _generate_sleep(self.DEVICE_LABEL, self._profile)

    def get_readiness_breakdown(self) -> dict:
        # More granular contributors for cycle-aware readiness
        if self._profile_name in ("pmdd_crisis", "luteal_pms"):
            temp_status = "attention"
            hrv_status = "attention"
            sleep_status = random.choice(["attention", "fair"])
        elif self._profile_name == "follicular":
            temp_status = "optimal"
            hrv_status = random.choice(["optimal", "good"])
            sleep_status = random.choice(["optimal", "good"])
        else:
            temp_status = random.choice(["optimal", "good", "fair", "attention"])
            hrv_status = random.choice(["optimal", "good", "fair", "attention"])
            sleep_status = random.choice(["optimal", "good", "fair", "attention"])

        return {
            "device": self.DEVICE_LABEL,
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "readiness_score": self._readiness,
            "contributors": {
                "resting_heart_rate": random.choice(["optimal", "good", "fair", "attention"]),
                "hrv_balance": hrv_status,
                "body_temperature": temp_status,
                "recovery_index": random.choice(["optimal", "good", "fair", "attention"]),
                "sleep_balance": sleep_status,
                "previous_day_activity": random.choice(["optimal", "good", "fair", "attention"]),
                "activity_balance": random.choice(["optimal", "good", "fair", "attention"]),
            },
        }

    def get_cycle_insights(self) -> dict:
        """Oura Ring Gen 3 cycle tracking data."""
        bbt = self._profile.get("bbt", 36.3)
        bbt_reading = round(bbt + random.uniform(-0.1, 0.1), 2)

        insight = {
            "device": self.DEVICE_LABEL,
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "basal_body_temperature_c": bbt_reading,
            "skin_temperature_delta_c": self._skin_temp_delta,
            "cycle_phase_estimate": self._profile.get("label", "Unknown"),
        }

        if self._profile_name == "ovulation":
            insight["ovulation_prediction"] = {
                "likely": True,
                "confidence": "high",
                "bbt_shift_detected": True,
                "shift_magnitude_c": round(bbt_reading - 36.2, 2),
            }
        elif self._profile_name in ("luteal_mild", "luteal_pms", "pmdd_crisis"):
            insight["luteal_confirmation"] = {
                "confirmed": True,
                "days_post_ovulation": random.randint(3, 14),
                "bbt_sustained_above_baseline": True,
            }
        elif self._profile_name == "pcos_flare":
            insight["ovulation_prediction"] = {
                "likely": False,
                "confidence": "low",
                "bbt_shift_detected": False,
                "note": "Flat BBT pattern - anovulatory cycle suspected",
            }
        elif self._profile_name == "perimenopause":
            insight["cycle_regularity"] = {
                "regular": False,
                "last_3_cycle_lengths_days": [28, 35, 42],
                "note": "Increasing cycle length variability - perimenopause pattern",
            }

        return insight

GLUCOSE_TRENDS = {
    "rising_fast":    {"arrow": "↑↑", "label": "Rising quickly",  "rate_range": (3, 5)},
    "rising":         {"arrow": "↑",  "label": "Rising",          "rate_range": (1.5, 3)},
    "rising_slowly":  {"arrow": "↗",  "label": "Rising slowly",   "rate_range": (0.5, 1.5)},
    "flat":           {"arrow": "→",  "label": "Stable",          "rate_range": (-0.5, 0.5)},
    "falling_slowly": {"arrow": "↘",  "label": "Falling slowly",  "rate_range": (-1.5, -0.5)},
    "falling":        {"arrow": "↓",  "label": "Falling",         "rate_range": (-3, -1.5)},
    "falling_fast":   {"arrow": "↓↓", "label": "Falling quickly", "rate_range": (-5, -3)},
}

GLUCOSE_RANGES = {
    "very_low":  {"range": (0, 54),    "label": "Urgent Low",  "urgency": "critical"},
    "low":       {"range": (55, 69),   "label": "Low",         "urgency": "warning"},
    "normal":    {"range": (70, 180),  "label": "In Range",    "urgency": "normal"},
    "high":      {"range": (181, 250), "label": "High",        "urgency": "warning"},
    "very_high": {"range": (251, 400), "label": "Urgent High", "urgency": "critical"},
}


def _classify_glucose(mg_dl: int) -> dict:
    for key, info in GLUCOSE_RANGES.items():
        lo, hi = info["range"]
        if lo <= mg_dl <= hi:
            return {"zone": key, "label": info["label"], "urgency": info["urgency"]}
    if mg_dl > 400:
        return {"zone": "very_high", "label": "Urgent High", "urgency": "critical"}
    return {"zone": "very_low", "label": "Urgent Low", "urgency": "critical"}


class MockDexcomG7:
    DEVICE_ID = "dexcom_g7"
    DEVICE_LABEL = "Dexcom G7 CGM"

    def __init__(self, profile: str = "baseline"):
        p = _get_profile(profile)
        self._glucose = p["glucose"]
        self._trend_key = p["glucose_trend"]
        self._profile = p
        self._profile_name = profile

        self._tick = 0
        self._meal_spike_remaining = 0
        self._insulin_drop_remaining = 0
        self._reactive_hypo_remaining = 0  # PCOS/PMDD reactive hypoglycemia

        self._history: list[int] = [self._glucose] * 20

    def _simulate_dynamics(self):
        # Meal spike - more frequent in luteal/PCOS due to cravings
        meal_prob = 0.05
        if self._profile_name in ("luteal_pms", "pmdd_crisis", "pcos_flare"):
            meal_prob = 0.08  # more frequent eating episodes

        if self._meal_spike_remaining <= 0 and random.random() < meal_prob:
            self._meal_spike_remaining = random.randint(15, 40)
            self._trend_key = random.choice(["rising", "rising_fast"])

        # Insulin correction
        if self._insulin_drop_remaining <= 0 and self._glucose > 160 and random.random() < 0.03:
            self._insulin_drop_remaining = random.randint(20, 50)
            self._trend_key = random.choice(["falling", "falling_slowly"])

        # Reactive hypoglycemia - PMDD and PCOS specific
        if (self._profile_name in ("pmdd_crisis", "pcos_flare")
            and self._reactive_hypo_remaining <= 0
            and self._glucose > 140
            and random.random() < 0.02):
            self._reactive_hypo_remaining = random.randint(10, 25)
            self._trend_key = "falling_fast"

        # Apply dynamics
        if self._meal_spike_remaining > 0:
            self._glucose += random.randint(1, 4)
            self._meal_spike_remaining -= 1
            if self._meal_spike_remaining <= 0:
                self._trend_key = "falling_slowly"

        elif self._reactive_hypo_remaining > 0:
            self._glucose -= random.randint(2, 5)
            self._reactive_hypo_remaining -= 1
            if self._reactive_hypo_remaining <= 0:
                self._trend_key = "rising_slowly"  # rebound

        elif self._insulin_drop_remaining > 0:
            self._glucose -= random.randint(1, 3)
            self._insulin_drop_remaining -= 1
            if self._insulin_drop_remaining <= 0:
                self._trend_key = "flat"

        # Trend drift
        trend_info = GLUCOSE_TRENDS.get(self._trend_key, GLUCOSE_TRENDS["flat"])
        rate_lo, rate_hi = trend_info["rate_range"]
        drift = random.uniform(rate_lo, rate_hi) * 0.3
        self._glucose = round(self._glucose + drift)
        self._glucose += random.randint(-2, 2)
        self._glucose = _clamp(self._glucose, 40, 400)

        # Random trend changes
        if (self._meal_spike_remaining <= 0
            and self._insulin_drop_remaining <= 0
            and self._reactive_hypo_remaining <= 0):
            if random.random() < 0.08:
                self._trend_key = random.choice(["flat", "flat", "rising_slowly", "falling_slowly"])

        self._history.append(self._glucose)
        if len(self._history) > 288:
            self._history = self._history[-288:]

        self._tick += 1

    def get_next_reading(self) -> dict:
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

        # Reactive hypoglycemia alert - specific to hormonal profiles
        if (self._reactive_hypo_remaining > 0
            and self._glucose < 70
            and self._profile_name in ("pmdd_crisis", "pcos_flare")):
            alerts.append({
                "type": "reactive_hypoglycemia",
                "message": f"Reactive hypoglycemia ({self._glucose} mg/dL) - common in {self._profile.get('label', 'this phase')}",
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
            "sensor_age_days": random.randint(1, 10),
        }

    def get_daily_summary(self) -> dict:
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

        result = {
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

        # Hormonal glucose context
        if self._profile_name in ("luteal_pms", "pmdd_crisis", "pcos_flare"):
            result["hormonal_context"] = {
                "insulin_resistance_expected": True,
                "phase": self._profile.get("label", "Unknown"),
                "note": (
                    "Elevated glucose patterns may be partially explained by "
                    "progesterone-mediated insulin resistance"
                    if self._profile_name != "pcos_flare"
                    else "PCOS-related insulin resistance is likely contributing to glucose instability"
                ),
            }

        return result

    def get_recent_history(self, count: int = 30) -> list[dict]:
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
    if devices is None:
        devices = ["apple_watch", "oura_ring", "dexcom_g7"]

    snapshot = {
        "collected_at": datetime.utcnow().isoformat() + "Z",
        "profile_hint": profile,
        "cycle_phase": PROFILES.get(profile, PROFILES["baseline"]).get("label", "Unknown"),
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
            "cycle_insights": oura.get_cycle_insights(),
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
