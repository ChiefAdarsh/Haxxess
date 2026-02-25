# 🌸 Vitality

**Vitality turns symptoms into signals.**  
A multimodal women’s health platform that treats symptom tracking with the same importance as vital signs.

## 🧠 Inspiration

Women’s health symptoms are often under-documented, dismissed, or only discussed during short clinic visits. Pelvic pain, abnormal bleeding, and hormonal shifts frequently go unstructured, making it difficult to detect patterns or identify escalation early.

We built Vitality to transform subjective symptoms into structured, longitudinal data that empowers both patients and clinicians.

## 🎯 What It Does

Vitality is a real-time symptom intelligence platform that combines:

- 🧍 3D body-based symptom reporting  
- 🩸 Cycle phase tracking and pattern analysis  
- 📞 Voice-based symptom logging  
- 🚨 Transparent, rule-based triage

Patients log “where + what + how severe,” and Vitality converts that into structured data for trend detection, flare monitoring, and urgency guidance.

## 🔍 Key Features

### 🧍 Interactive 3D Body Map

Built with Three.js, patients tap anatomical regions to log symptoms with severity, quality, timing, triggers, and notes. Markers are surface-pinned using raycasting to ensure anatomical accuracy.

### 🩸 Cycle Intelligence

An interactive cycle ring tracks phases, bleeding duration, and symptom correlations. Backend logic analyzes recurring high-severity windows and deviations from baseline to support personalized predictions.

### 📞 Voice Logging + NLP Extraction

Patients can record symptom journals. Transcripts are processed via Twilio to extract severity, region, bleeding, fever, pregnancy mentions, and onset timing.

### 🚨 Explainable Triage Engine

Safety-first red-flag logic flags urgent patterns (e.g., heavy bleeding, severe one-sided pain + nausea, pregnancy + bleeding). Each triage decision includes a transparent explanation — not a diagnosis.

## 🏗️ How We Built It

### Frontend

- React + TypeScript  
- Three.js / React Three Fiber  
- Tailwind

### Backend

- Twilio + Deepgram  
- Uvicorn  
- Librosa

## 🧩 Challenges

- Accurate 3D surface pinning on anatomical models  
- Designing a safe, explainable triage engine  
- Structuring multimodal data (voice + spatial + cycle) into one coherent system

## 🎉 Accomplishments

- Built a multimodal women’s health tracking platform in 24 hours  
- Implemented surface-accurate 3D anatomical mapping  
- Created transparent red-flag triage logic  
- Designed personalized cycle phase tracking  
- Integrated voice-to-structured symptom extraction

## 🔭 What’s Next

- Personalized flare prediction  
- Cycle anomaly alerts  
- EMR integration  
- Explainable AI overlays for risk scoring

