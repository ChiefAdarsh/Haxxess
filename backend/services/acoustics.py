import logging
import warnings
from dataclasses import dataclass, asdict, field
from typing import Optional

import numpy as np
import librosa
import scipy.signal
import scipy.stats

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("acoustics_engine")


@dataclass
class VoiceQualityMetrics:
    """Clinical voice‑quality features used in speech pathology."""
    harmonics_to_noise_ratio: float  # dB — higher = cleaner voice
    jitter_local: float  # cycle‑to‑cycle pitch perturbation (%)
    shimmer_local: float  # cycle‑to‑cycle amplitude perturbation (%)
    voiced_fraction: float  # proportion of frames that are voiced


@dataclass
class PitchContourStats:
    """Statistics computed on the *voiced* f0 contour only."""
    mean: float
    median: float
    std: float
    iqr: float  # inter‑quartile range — robust spread
    range: float  # max − min
    slope: float  # linear trend over time (Hz/s)
    curvature: float  # mean |second derivative| — how "wobbly"
    pct_rising: float  # % of frames where pitch is going up
    estimated_gender: str  # "male" | "female" | "unknown"


@dataclass
class EnergyContourStats:
    mean: float
    std: float
    peak: float
    dynamic_range_db: float  # difference between loud and quiet passages
    slope: float  # trending louder or softer over time
    low_energy_fraction: float  # fraction of frames below 30th‑percentile


@dataclass
class TemporalFeatures:
    duration: float
    speech_rate: float  # onsets / sec
    articulation_rate: float  # onsets / sec of *voiced* segments only
    pause_count: int
    mean_pause_duration: float
    longest_pause: float
    pause_to_speech_ratio: float  # total pause time / total speech time
    rhythm_regularity: float  # std of inter‑onset intervals (lower = more regular)


@dataclass
class SpectralFeatures:
    mfcc_mean: list[float]
    mfcc_std: list[float]
    delta_mfcc_mean: list[float]  # velocity of MFCC trajectories
    spectral_centroid_mean: float
    spectral_centroid_std: float
    spectral_bandwidth_mean: float
    spectral_rolloff_mean: float
    spectral_flatness_mean: float  # tonal vs noisy (0 = tonal, 1 = white noise)
    spectral_contrast_mean: list[float]
    chroma_mean: list[float]
    tonnetz_mean: list[float]


@dataclass
class AcousticFeatures:
    pitch: PitchContourStats
    energy: EnergyContourStats
    temporal: TemporalFeatures
    spectral: SpectralFeatures
    voice_quality: VoiceQualityMetrics


@dataclass
class EmotionalAxes:
    """Russell's circumplex + dominance, all on 0‑100 scales."""
    valence: float  # 0 = negative / sad, 100 = positive / happy
    arousal: float  # 0 = calm / lethargic, 100 = excited / agitated
    dominance: float  # 0 = submissive / withdrawn, 100 = dominant / assertive


@dataclass
class AcousticAnalysisResult:
    features: AcousticFeatures
    emotion_axes: EmotionalAxes
    distress_score: float
    vibe: str
    energy_level: str
    pitch_affect: str
    speech_activity: str
    flags: list[str]
    summary: str

    def to_dict(self) -> dict:
        return asdict(self)


def _load_and_clean(file_path: str, sr: int = 22050):
    """Load, convert to mono, strip silence, isolate harmonic content."""
    y, sr = librosa.load(file_path, sr=sr, mono=True)

    # Strip leading/trailing silence
    y, _ = librosa.effects.trim(y, top_db=30)

    # Harmonic / percussive separation — keep the harmonic (voice) part
    y_harmonic, _ = librosa.effects.hpss(y, margin=3.0)

    # Pre‑emphasis to counteract low‑freq mic rumble
    y_clean = librosa.effects.preemphasis(y_harmonic, coef=0.97)

    # Bandpass 60–5000 Hz (voice fundamentals + first few formants)
    sos = scipy.signal.butter(
        5, [60, 5000], btype="band", fs=sr, output="sos"
    )
    y_clean = scipy.signal.sosfiltfilt(sos, y_clean).astype(np.float32)

    return y, y_clean, sr


def _extract_pitch(y_clean: np.ndarray, sr: int) -> PitchContourStats:
    """Use pyin — probabilistic YIN — for robust monophonic f0 tracking."""
    logger.info("Extracting pitch (pyin)...")
    f0, voiced_flag, voiced_prob = librosa.pyin(
        y_clean, fmin=50, fmax=600, sr=sr, fill_na=0.0
    )
    voiced = f0[voiced_flag]

    if len(voiced) < 5:
        logger.warning("Almost no voiced frames detected.")
        return PitchContourStats(
            mean=0, median=0, std=0, iqr=0, range=0,
            slope=0, curvature=0, pct_rising=0, estimated_gender="unknown",
        )

    mean = float(np.mean(voiced))
    median = float(np.median(voiced))
    std = float(np.std(voiced))
    iqr = float(np.percentile(voiced, 75) - np.percentile(voiced, 25))
    f0_range = float(np.max(voiced) - np.min(voiced))

    # Slope: linear regression of pitch over time
    x = np.arange(len(voiced), dtype=float)
    slope = float(np.polyfit(x, voiced, 1)[0]) if len(voiced) > 2 else 0.0

    # Curvature: mean absolute second derivative
    if len(voiced) > 2:
        d2 = np.diff(voiced, n=2)
        curvature = float(np.mean(np.abs(d2)))
    else:
        curvature = 0.0

    # Pct rising
    d1 = np.diff(voiced)
    pct_rising = float(np.sum(d1 > 0) / len(d1)) if len(d1) > 0 else 0.5

    # Rough gender estimate for threshold normalisation
    gender = "female" if median > 165 else "male" if median < 165 else "unknown"

    return PitchContourStats(
        mean=round(mean, 2),
        median=round(median, 2),
        std=round(std, 2),
        iqr=round(iqr, 2),
        range=round(f0_range, 2),
        slope=round(slope, 4),
        curvature=round(curvature, 4),
        pct_rising=round(pct_rising, 3),
        estimated_gender=gender,
    )


def _extract_energy(y: np.ndarray, sr: int) -> EnergyContourStats:
    logger.info("Extracting energy contour...")
    rms = librosa.feature.rms(y=y)[0]
    rms_db = librosa.amplitude_to_db(rms + 1e-10)

    mean = float(np.mean(rms))
    std = float(np.std(rms))
    peak = float(np.max(rms))

    # Dynamic range: difference between 90th and 10th percentile in dB
    dynamic_range = float(
        np.percentile(rms_db, 90) - np.percentile(rms_db, 10)
    )

    # Slope (energy trending up or down over the recording)
    x = np.arange(len(rms), dtype=float)
    slope = float(np.polyfit(x, rms, 1)[0]) if len(rms) > 2 else 0.0

    # Low‑energy fraction
    threshold = np.percentile(rms, 30)
    low_frac = float(np.sum(rms < threshold) / len(rms))

    return EnergyContourStats(
        mean=round(mean, 6),
        std=round(std, 6),
        peak=round(peak, 6),
        dynamic_range_db=round(dynamic_range, 2),
        slope=round(slope, 10),
        low_energy_fraction=round(low_frac, 3),
    )


def _extract_temporal(y: np.ndarray, sr: int) -> TemporalFeatures:
    logger.info("Extracting temporal / rhythm features...")
    duration = librosa.get_duration(y=y, sr=sr)

    # Onset detection
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, units="frames")
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)
    speech_rate = len(onset_frames) / duration if duration > 0 else 0.0

    # Inter‑onset intervals
    if len(onset_times) > 1:
        iois = np.diff(onset_times)
        rhythm_regularity = float(np.std(iois))
    else:
        iois = np.array([])
        rhythm_regularity = 0.0

    # Pause detection via RMS silence segmentation
    rms = librosa.feature.rms(y=y)[0]
    frame_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr)
    silence_threshold = np.percentile(rms, 25) * 0.5
    is_silent = rms < silence_threshold

    # Group consecutive silent frames into pauses
    pauses = []
    in_pause = False
    pause_start = 0.0
    min_pause = 0.15  # ignore gaps < 150ms

    for i, silent in enumerate(is_silent):
        t = frame_times[i]
        if silent and not in_pause:
            in_pause = True
            pause_start = t
        elif not silent and in_pause:
            in_pause = False
            pause_dur = t - pause_start
            if pause_dur >= min_pause:
                pauses.append(pause_dur)

    pause_count = len(pauses)
    mean_pause = float(np.mean(pauses)) if pauses else 0.0
    longest_pause = float(np.max(pauses)) if pauses else 0.0
    total_pause = float(np.sum(pauses)) if pauses else 0.0
    speech_time = duration - total_pause
    pause_ratio = total_pause / speech_time if speech_time > 0 else 0.0

    # Articulation rate (onsets per second of actual speech, not pauses)
    articulation_rate = len(onset_frames) / speech_time if speech_time > 0 else 0.0

    return TemporalFeatures(
        duration=round(duration, 2),
        speech_rate=round(speech_rate, 3),
        articulation_rate=round(articulation_rate, 3),
        pause_count=pause_count,
        mean_pause_duration=round(mean_pause, 3),
        longest_pause=round(longest_pause, 3),
        pause_to_speech_ratio=round(pause_ratio, 3),
        rhythm_regularity=round(rhythm_regularity, 4),
    )


def _extract_spectral(y_clean: np.ndarray, sr: int) -> SpectralFeatures:
    logger.info("Extracting spectral features...")
    # MFCCs (20 coefficients for richer timbre capture)
    mfccs = librosa.feature.mfcc(y=y_clean, sr=sr, n_mfcc=20)
    delta_mfccs = librosa.feature.delta(mfccs)

    centroid = librosa.feature.spectral_centroid(y=y_clean, sr=sr)[0]
    bandwidth = librosa.feature.spectral_bandwidth(y=y_clean, sr=sr)[0]
    rolloff = librosa.feature.spectral_rolloff(y=y_clean, sr=sr)[0]
    flatness = librosa.feature.spectral_flatness(y=y_clean)[0]
    contrast = librosa.feature.spectral_contrast(y=y_clean, sr=sr)
    chroma = librosa.feature.chroma_stft(y=y_clean, sr=sr)
    tonnetz = librosa.feature.tonnetz(y=y_clean, sr=sr)

    return SpectralFeatures(
        mfcc_mean=np.mean(mfccs, axis=1).round(4).tolist(),
        mfcc_std=np.std(mfccs, axis=1).round(4).tolist(),
        delta_mfcc_mean=np.mean(delta_mfccs, axis=1).round(4).tolist(),
        spectral_centroid_mean=round(float(np.mean(centroid)), 2),
        spectral_centroid_std=round(float(np.std(centroid)), 2),
        spectral_bandwidth_mean=round(float(np.mean(bandwidth)), 2),
        spectral_rolloff_mean=round(float(np.mean(rolloff)), 2),
        spectral_flatness_mean=round(float(np.mean(flatness)), 6),
        spectral_contrast_mean=np.mean(contrast, axis=1).round(4).tolist(),
        chroma_mean=np.mean(chroma, axis=1).round(4).tolist(),
        tonnetz_mean=np.mean(tonnetz, axis=1).round(6).tolist(),
    )


def _extract_voice_quality(
    y_clean: np.ndarray, sr: int, f0: Optional[np.ndarray] = None
) -> VoiceQualityMetrics:
    logger.info("Extracting voice quality metrics (jitter, shimmer, HNR)...")

    # Get pyin pitch again (cheap to recompute, keeps function pure)
    if f0 is None:
        f0, voiced_flag, _ = librosa.pyin(
            y_clean, fmin=50, fmax=600, sr=sr, fill_na=0.0
        )
    else:
        voiced_flag = f0 > 0

    voiced_f0 = f0[voiced_flag]
    voiced_fraction = float(np.sum(voiced_flag) / len(f0)) if len(f0) > 0 else 0.0

    # Jitter (local): mean absolute difference between consecutive periods / mean period
    if len(voiced_f0) > 1:
        periods = 1.0 / (voiced_f0 + 1e-10)
        jitter = float(np.mean(np.abs(np.diff(periods))) / np.mean(periods) * 100)
    else:
        jitter = 0.0

    # Shimmer: same idea but on amplitude peaks per cycle
    # Approximate via RMS over pitch‑synchronous windows
    rms = librosa.feature.rms(y=y_clean, frame_length=512, hop_length=128)[0]
    if len(rms) > 1:
        shimmer = float(
            np.mean(np.abs(np.diff(rms))) / (np.mean(rms) + 1e-10) * 100
        )
    else:
        shimmer = 0.0

    # HNR: harmonic‑to‑noise ratio via autocorrelation
    hnr = _estimate_hnr(y_clean, sr)

    return VoiceQualityMetrics(
        harmonics_to_noise_ratio=round(hnr, 2),
        jitter_local=round(jitter, 4),
        shimmer_local=round(shimmer, 4),
        voiced_fraction=round(voiced_fraction, 3),
    )


def _estimate_hnr(y: np.ndarray, sr: int, frame_len: int = 2048) -> float:
    """Estimate HNR using autocorrelation method (Boersma‑style)."""
    n_frames = len(y) // frame_len
    hnrs = []
    for i in range(n_frames):
        frame = y[i * frame_len : (i + 1) * frame_len]
        if np.max(np.abs(frame)) < 1e-6:
            continue
        autocorr = np.correlate(frame, frame, mode="full")
        autocorr = autocorr[len(autocorr) // 2 :]
        autocorr /= autocorr[0] + 1e-10

        # Search for peak in plausible pitch period range (50–600 Hz)
        min_lag = sr // 600
        max_lag = sr // 50
        max_lag = min(max_lag, len(autocorr) - 1)
        if min_lag >= max_lag:
            continue
        search = autocorr[min_lag:max_lag]
        if len(search) == 0:
            continue
        peak = float(np.max(search))
        if peak > 0 and peak < 1.0:
            hnr_frame = 10 * np.log10(peak / (1 - peak + 1e-10))
            hnrs.append(hnr_frame)

    return float(np.mean(hnrs)) if hnrs else 0.0


def extract_features(file_path: str) -> AcousticFeatures:
    y_raw, y_clean, sr = _load_and_clean(file_path)
    pitch = _extract_pitch(y_clean, sr)
    energy = _extract_energy(y_raw, sr)
    temporal = _extract_temporal(y_raw, sr)
    spectral = _extract_spectral(y_clean, sr)
    voice_quality = _extract_voice_quality(y_clean, sr)

    return AcousticFeatures(
        pitch=pitch,
        energy=energy,
        temporal=temporal,
        spectral=spectral,
        voice_quality=voice_quality,
    )


def _estimate_emotion_axes(f: AcousticFeatures) -> EmotionalAxes:
    """
    Map acoustic features → valence / arousal / dominance.

    Based on meta‑analytic findings (Scherer 2003, Juslin & Laukka 2003,
    Eyben et al. 2016) that link specific acoustic cues to affect dimensions.
    All outputs are clamped to [0, 100].
    """

    # High arousal ↔ high pitch, high energy, fast rate, wide pitch range, high HF energy
    arousal = 50.0
    # Pitch contribution (z‑score‑ish against typical conversational norms)
    norm_pitch = 175 if f.pitch.estimated_gender == "female" else 120
    arousal += np.clip((f.pitch.mean - norm_pitch) / norm_pitch * 40, -30, 30)
    # Energy
    arousal += np.clip((f.energy.mean - 0.04) / 0.04 * 20, -20, 20)
    # Rate
    arousal += np.clip((f.temporal.speech_rate - 3.5) / 3.5 * 15, -15, 15)
    # Pitch range
    arousal += np.clip((f.pitch.range - 60) / 60 * 10, -10, 10)
    # Spectral centroid (brightness)
    arousal += np.clip((f.spectral.spectral_centroid_mean - 1800) / 1800 * 10, -10, 10)
    # Jitter/shimmer (voice instability → high arousal)
    arousal += np.clip(f.voice_quality.jitter_local * 2, 0, 8)

    # Positive valence ↔ higher pitch, wider range, more rising contours, higher spectral centroid, lower jitter, higher HNR
    valence = 50.0
    valence += np.clip((f.pitch.mean - norm_pitch) / norm_pitch * 15, -15, 15)
    valence += np.clip((f.pitch.iqr - 30) / 30 * 10, -10, 10)
    valence += np.clip((f.pitch.pct_rising - 0.5) * 30, -15, 15)
    valence -= np.clip(f.voice_quality.jitter_local * 3, 0, 12)
    valence += np.clip((f.voice_quality.harmonics_to_noise_ratio - 10) / 10 * 10, -10, 10)
    # Spectral flatness: more tonal (lower flatness) → slightly more positive
    valence -= np.clip(f.spectral.spectral_flatness_mean * 40, 0, 8)
    # Falling energy slope → tiredness/sadness
    valence += np.clip(f.energy.slope * 1e5, -10, 10)
    # Long pauses → negative
    valence -= np.clip(f.temporal.pause_to_speech_ratio * 15, 0, 12)

    # High dominance ↔ loud, low pitch, low pitch variability, fast, low HF
    dominance = 50.0
    dominance += np.clip((f.energy.mean - 0.04) / 0.04 * 25, -25, 25)
    dominance -= np.clip((f.pitch.mean - norm_pitch) / norm_pitch * 15, -15, 15)
    dominance += np.clip((f.temporal.speech_rate - 3.5) / 3.5 * 10, -10, 10)
    dominance -= np.clip((f.temporal.pause_to_speech_ratio) * 20, 0, 15)
    dominance += np.clip(f.energy.dynamic_range_db / 3, 0, 10)

    clamp = lambda v: round(float(np.clip(v, 0, 100)), 1)
    return EmotionalAxes(
        valence=clamp(valence),
        arousal=clamp(arousal),
        dominance=clamp(dominance),
    )


_VIBE_MAP = [
    # (min_valence, max_valence, min_arousal, max_arousal, label)
    (0,  30,  0,  30, "defeated"),
    (0,  30, 30,  55, "melancholic"),
    (0,  30, 55, 100, "distressed"),
    (30, 50,  0,  30, "drained"),
    (30, 50, 30,  55, "flat"),
    (30, 50, 55,  75, "tense"),
    (30, 50, 75, 100, "agitated"),
    (50, 65,  0,  30, "mellow"),
    (50, 65, 30,  55, "chill"),
    (50, 65, 55,  75, "engaged"),
    (50, 65, 75, 100, "fired-up"),
    (65, 100,  0,  30, "serene"),
    (65, 100, 30,  55, "content"),
    (65, 100, 55,  75, "upbeat"),
    (65, 100, 75, 100, "euphoric"),
]


def _classify_vibe(axes: EmotionalAxes) -> str:
    for v_lo, v_hi, a_lo, a_hi, label in _VIBE_MAP:
        if v_lo <= axes.valence < v_hi and a_lo <= axes.arousal < a_hi:
            return label
    return "unreadable"


def _classify_energy(e: EnergyContourStats) -> str:
    if e.mean < 0.008:
        return "very low"
    if e.mean < 0.02:
        return "low"
    if e.mean < 0.08:
        return "moderate"
    if e.mean < 0.15:
        return "high"
    return "very high"


def _classify_pitch_affect(p: PitchContourStats) -> str:
    if p.mean == 0:
        return "undetected"
    if p.std < 10 and p.iqr < 15:
        return "monotone"
    if p.iqr < 25:
        return "flat"
    if p.mean > 250 and p.estimated_gender == "male":
        return "elevated"
    if p.mean > 300 and p.estimated_gender == "female":
        return "elevated"
    if p.range > 150:
        return "expressive"
    return "normal"


def _classify_speech_activity(t: TemporalFeatures) -> str:
    if t.speech_rate < 1.5:
        return "very slow"
    if t.speech_rate < 3.0:
        return "reduced"
    if t.speech_rate > 6.0:
        return "rapid"
    if t.pause_to_speech_ratio > 0.6:
        return "pause-heavy"
    return "normal"


def _compute_distress_score(f: AcousticFeatures, axes: EmotionalAxes) -> tuple[float, list[str]]:
    score = 0.0
    flags: list[str] = []

    if f.energy.mean < 0.006:
        score += 20
        flags.append("Critically low vocal energy — possible severe fatigue or withdrawal")
    elif f.energy.mean < 0.015:
        score += 12
        flags.append("Low vocal energy")
    elif f.energy.mean > 0.18:
        score += 10
        flags.append("Unusually high energy (potential agitation)")

    if f.energy.slope < -1e-6:
        score += 8
        flags.append("Energy fading over the recording (running out of steam)")

    norm = 175 if f.pitch.estimated_gender == "female" else 120
    if f.pitch.mean == 0:
        score += 20
        flags.append("No voiced pitch detected — extremely low speech content")
    elif f.pitch.mean < norm * 0.7:
        score += 15
        flags.append("Pitch significantly below expected range (depressive indicator)")
    elif f.pitch.mean > norm * 1.8:
        score += 12
        flags.append("Pitch significantly above expected range (acute stress marker)")

    if 0 < f.pitch.std < 10:
        score += 12
        flags.append("Near‑zero pitch variation — strong monotone / flat affect")
    elif f.pitch.std < 18:
        score += 6
        flags.append("Low pitch variation")

    if f.pitch.curvature > 15:
        score += 8
        flags.append("Erratic pitch contour — possible emotional instability")

    if f.temporal.speech_rate < 1.2:
        score += 15
        flags.append("Very low speech rate — possible cognitive lag or withdrawal")
    elif f.temporal.speech_rate < 2.5:
        score += 8
        flags.append("Below‑average speech rate")
    elif f.temporal.speech_rate > 6.5:
        score += 10
        flags.append("Pressured / rapid speech (anxiety marker)")

    if f.temporal.pause_to_speech_ratio > 0.8:
        score += 12
        flags.append("Excessive pausing relative to speech")
    elif f.temporal.pause_to_speech_ratio > 0.5:
        score += 6
        flags.append("High pause‑to‑speech ratio")

    if f.temporal.longest_pause > 4.0:
        score += 8
        flags.append(f"Long silence detected ({f.temporal.longest_pause:.1f}s)")

    if f.voice_quality.jitter_local > 3.0:
        score += 10
        flags.append("Elevated jitter — vocal tremor / instability")
    if f.voice_quality.shimmer_local > 8.0:
        score += 8
        flags.append("Elevated shimmer — breathy or strained voice")
    if f.voice_quality.harmonics_to_noise_ratio < 5:
        score += 10
        flags.append("Low HNR — hoarse or noisy voice quality")
    if f.voice_quality.voiced_fraction < 0.3:
        score += 10
        flags.append("Mostly unvoiced — very little actual speech detected")

    if f.spectral.spectral_centroid_mean < 900:
        score += 6
        flags.append("Low spectral brightness — muffled / withdrawn vocal quality")
    if f.spectral.spectral_flatness_mean > 0.3:
        score += 6
        flags.append("High spectral flatness — voice sounds noisy / breathy")

    # Low energy + flat pitch + slow rate → classic depression cluster
    if f.energy.mean < 0.02 and f.pitch.std < 15 and f.temporal.speech_rate < 2.5:
        score += 15
        flags.append("⚠ Depression‑linked vocal pattern cluster detected (low energy + flat pitch + slow rate)")

    # High pitch + rapid rate + high energy → panic / acute anxiety
    if (f.pitch.mean > norm * 1.4 and f.temporal.speech_rate > 5.0 and f.energy.mean > 0.08):
        score += 12
        flags.append("⚠ Acute anxiety vocal pattern cluster detected (high pitch + rapid speech + high energy)")

    # Emotional axes as a bonus sanity check
    if axes.valence < 25 and axes.arousal < 25:
        score += 8
        flags.append("Emotional profile: very low valence + very low arousal (hopelessness risk)")

    final = round(float(np.clip(score, 0, 100)), 2)
    logger.info(f"Distress score: {final}/100 | Flags: {len(flags)}")
    return final, flags


def _build_summary(
    vibe: str,
    distress: float,
    axes: EmotionalAxes,
    energy: str,
    pitch: str,
    speech: str,
    flags: list[str],
) -> str:
    parts = []

    parts.append(f'Detected vibe: **{vibe}**.')

    parts.append(
        f"Valence {axes.valence:.0f}/100 · Arousal {axes.arousal:.0f}/100 · Dominance {axes.dominance:.0f}/100."
    )

    parts.append(f"Voice profile: {energy} energy, {pitch} pitch, {speech} speech activity.")

    if distress >= 65:
        parts.append(
            f"🔴 Distress score {distress:.0f}/100 — significant concern. "
            "Recommend immediate caregiver / clinician review."
        )
    elif distress >= 40:
        parts.append(
            f"🟡 Distress score {distress:.0f}/100 — moderate concern. "
            "Recommend follow‑up within 24 hours."
        )
    elif distress >= 20:
        parts.append(f"🟢 Distress score {distress:.0f}/100 — mild indicators. Worth monitoring.")
    else:
        parts.append(f"🟢 Distress score {distress:.0f}/100 — within healthy range.")

    cluster_flags = [fl for fl in flags if fl.startswith("⚠")]
    if cluster_flags:
        parts.append("Key patterns: " + "; ".join(cluster_flags))

    return " ".join(parts)


def analyze_audio(file_path: str) -> AcousticAnalysisResult:
    logger.info("═══════════════════════════════════════")
    logger.info("  ACOUSTIC ENGINE — starting")
    logger.info("═══════════════════════════════════════")

    features = extract_features(file_path)

    # Log raw values
    logger.info("── Raw Feature Summary ──")
    logger.info(f"  Pitch        : μ={features.pitch.mean:.1f} Hz  σ={features.pitch.std:.1f}  IQR={features.pitch.iqr:.1f}  range={features.pitch.range:.1f}")
    logger.info(f"  Energy       : μ={features.energy.mean:.5f}  peak={features.energy.peak:.5f}  ΔdB={features.energy.dynamic_range_db:.1f}")
    logger.info(f"  Temporal     : rate={features.temporal.speech_rate:.2f}/s  pauses={features.temporal.pause_count}  pause_ratio={features.temporal.pause_to_speech_ratio:.2f}")
    logger.info(f"  Voice quality: HNR={features.voice_quality.harmonics_to_noise_ratio:.1f}dB  jitter={features.voice_quality.jitter_local:.2f}%  shimmer={features.voice_quality.shimmer_local:.2f}%")
    logger.info(f"  Gender est.  : {features.pitch.estimated_gender}")

    axes = _estimate_emotion_axes(features)
    logger.info(f"  Emotion axes : V={axes.valence:.1f}  A={axes.arousal:.1f}  D={axes.dominance:.1f}")

    vibe = _classify_vibe(axes)
    logger.info(f"  Vibe         : {vibe}")

    distress_score, flags = _compute_distress_score(features, axes)

    if flags:
        for flag in flags:
            lvl = logging.WARNING if flag.startswith("⚠") else logging.INFO
            logger.log(lvl, f"  FLAG → {flag}")

    energy_level = _classify_energy(features.energy)
    pitch_affect = _classify_pitch_affect(features.pitch)
    speech_activity = _classify_speech_activity(features.temporal)

    summary = _build_summary(
        vibe, distress_score, axes, energy_level, pitch_affect, speech_activity, flags
    )

    logger.info("═══════════════════════════════════════")
    logger.info("  ACOUSTIC ENGINE — complete")
    logger.info("═══════════════════════════════════════")

    return AcousticAnalysisResult(
        features=features,
        emotion_axes=axes,
        distress_score=distress_score,
        vibe=vibe,
        energy_level=energy_level,
        pitch_affect=pitch_affect,
        speech_activity=speech_activity,
        flags=flags,
        summary=summary,
    )
