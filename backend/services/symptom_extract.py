import re

SYMPTOM_KEYWORDS = {
    "pain": ["pain", "hurt", "ache", "sore"],
    "cramp": ["cramp", "cramping"],
    "burning": ["burn", "burning", "sting"],
    "pressure": ["pressure", "heavy", "fullness"],
    "bleeding": ["bleed", "bleeding", "blood", "spotting", "soaking"],
    "discharge": ["discharge"],
    "nausea": ["nausea", "nauseous", "vomit", "throwing up"],
}

REGION_KEYWORDS = {
    "RLQ": ["right side", "right lower", "right pelvic"],
    "LLQ": ["left side", "left lower", "left pelvic"],
    "pelvic_midline": ["pelvic", "pelvis", "middle"],
    "suprapubic": ["lower abdomen", "below belly", "suprapubic", "bladder"],
    "vulva": ["vulva", "vaginal", "genital"],
    "low_back": ["back", "lower back", "lumbar"],
}

RED_FLAGS = {
    "heavy_bleeding": ["soaking", "pad per hour", "hemorrhage", "heavy bleeding"],
    "fever": ["fever", "temperature", "101", "102", "103"],
    "pregnant": ["pregnant", "pregnancy", "missed period"],
    "syncope": ["faint", "dizzy", "lightheaded", "passed out", "syncope"],
    "severe_pain": ["worst pain", "10 out of 10", "9 out of 10", "unbearable"],
}

DISTRESS_KEYWORDS = [
    "can't breathe", "panicking", "feel faint", "scared",
    "help me", "emergency", "dying", "so much pain",
]


def extract_severity(text: str) -> int | None:
    # look for patterns like "8 out of 10" or "severity 7"
    match = re.search(r"(\d+)\s*(?:out of|\/)\s*10", text.lower())
    if match:
        return min(int(match.group(1)), 10)
    return None


def extract_symptoms(transcript: str) -> dict:
    lower = transcript.lower()

    # find symptoms
    found_symptoms = []
    for symptom, keywords in SYMPTOM_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            found_symptoms.append(symptom)

    # find regions
    found_regions = []
    for region, keywords in REGION_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            found_regions.append(region)

    # check red flags
    found_flags = []
    for flag, keywords in RED_FLAGS.items():
        if any(kw in lower for kw in keywords):
            found_flags.append(flag)

    # distress cues
    distress_score = sum(1 for kw in DISTRESS_KEYWORDS if kw in lower)

    severity = extract_severity(transcript)

    # triage
    triage = "self_care"
    reasons = []

    if "heavy_bleeding" in found_flags:
        triage = "emergency"
        reasons.append("heavy bleeding reported")
    if "syncope" in found_flags and "bleeding" in found_symptoms:
        triage = "emergency"
        reasons.append("bleeding with dizziness/syncope")
    if "pregnant" in found_flags and ("bleeding" in found_symptoms or (severity and severity >= 7)):
        triage = "emergency"
        reasons.append("possible pregnancy with bleeding or severe pain")
    if "severe_pain" in found_flags:
        triage = "emergency"
        reasons.append("severe pain reported")
    if "fever" in found_flags and ("pelvic_midline" in found_regions or "discharge" in found_symptoms):
        if triage != "emergency":
            triage = "same_day"
        reasons.append("fever with pelvic symptoms")
    if severity and severity >= 7 and triage not in ("emergency",):
        triage = "same_day"
        reasons.append(f"pain severity {severity}/10")
    if not reasons:
        if severity and severity >= 4:
            triage = "routine"
            reasons.append("moderate symptoms")
        else:
            reasons.append("mild symptoms — continue monitoring")

    return {
        "symptoms": found_symptoms,
        "regions": found_regions,
        "severity": severity,
        "red_flags": found_flags,
        "distress_score": min(distress_score, 5),
        "triage_level": triage,
        "triage_reasons": reasons,
    }
