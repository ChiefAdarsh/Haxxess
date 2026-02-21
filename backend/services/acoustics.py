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
    """Clinical voice-quality features used in speech pathology."""
    harmonics_to_noise_ratio: float
    jitter_local: float
    shimmer_local: float
    voiced_fraction: float


@dataclass
class PitchContourStats:
    mean: float
    median: float
    std: float
    iqr: float
    range: float
    slope: float
    curvature: float
    pct_rising: float
    estimated_gender: str


@dataclass
class EnergyContourStats:
    mean: float
    std: float
    peak: float
    dynamic_range_db: float
    slope: float
    low_energy_fraction: float


@dataclass
class TemporalFeatures:
    duration: float
    speech_rate: float
    articulation_rate: float
    pause_count: int
    mean_pause_duration: float
    longest_pause: float
    pause_to_speech_ratio: float
    rhythm_regularity: float


@dataclass
class SpectralFeatures:
    mfcc_mean: list[float]
    mfcc_std: list[float]
    delta_mfcc_mean: list[float]
    spectral_centroid_mean: float
    spectral_centroid_std: float
    spectral_bandwidth_mean: float
    spectral_rolloff_mean: float
    spectral_flatness_mean: float
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
    """Russell's circumplex + dominance, all on 0-100 scales."""
    valence: float
    arousal: float
    dominance: float


@dataclass
class HormonalVocalMarkers:
    """
    Acoustic features specifically relevant to hormonal state detection.
    These are derived from the same raw features but interpreted through
    the lens of reproductive endocrinology.
    """
    pitch_depression: float  # how much lower than expected (0 = normal, 100 = severely depressed)
    vocal_fold_edema_index: float  # jitter + shimmer composite - progesterone indicator
    vocal_fatigue_index: float  # energy decline + HNR drop composite
    prosodic_flatness: float  # pitch std + range composite - mood indicator
    speech_withdrawal: float  # pause ratio + low rate composite
    hormonal_voice_flags: list[str] = field(default_factory=list)


@dataclass
class AcousticAnalysisResult:
    features: AcousticFeatures
    emotion_axes: EmotionalAxes
    hormonal_markers: HormonalVocalMarkers
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
    y, sr = librosa.load(file_path, sr=sr, mono=True)
    y, _ = librosa.effects.trim(y, top_db=30)
    y_harmonic, _ = librosa.effects.hpss(y, margin=3.0)
    y_clean = librosa.effects.preemphasis(y_harmonic, coef=0.97)

    sos = scipy.signal.butter(
        5, [60, 5000], btype="band", fs=sr, output="sos"
    )
    y_clean = scipy.signal.sosfiltfilt(sos, y_clean).astype(np.float32)

    return y, y_clean, sr


def _extract_pitch(y_clean: np.ndarray, sr: int) -> PitchContourStats:
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

    x = np.arange(len(voiced), dtype=float)
    slope = float(np.polyfit(x, voiced, 1)[0]) if len(voiced) > 2 else 0.0

    if len(voiced) > 2:
        d2 = np.diff(voiced, n=2)
        curvature = float(np.mean(np.abs(d2)))
    else:
        curvature = 0.0

    d1 = np.diff(voiced)
    pct_rising = float(np.sum(d1 > 0) / len(d1)) if len(d1) > 0 else 0.5

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

    dynamic_range = float(
        np.percentile(rms_db, 90) - np.percentile(rms_db, 10)
    )

    x = np.arange(len(rms), dtype=float)
    slope = float(np.polyfit(x, rms, 1)[0]) if len(rms) > 2 else 0.0

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

    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, units="frames")
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)
    speech_rate = len(onset_frames) / duration if duration > 0 else 0.0

    if len(onset_times) > 1:
        iois = np.diff(onset_times)
        rhythm_regularity = float(np.std(iois))
    else:
        iois = np.array([])
        rhythm_regularity = 0.0

    rms = librosa.feature.rms(y=y)[0]
    frame_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr)
    silence_threshold = np.percentile(rms, 25) * 0.5
    is_silent = rms < silence_threshold

    pauses = []
    in_pause = False
    pause_start = 0.0
    min_pause = 0.15

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

    if f0 is None:
        f0, voiced_flag, _ = librosa.pyin(
            y_clean, fmin=50, fmax=600, sr=sr, fill_na=0.0
        )
    else:
        voiced_flag = f0 > 0

    voiced_f0 = f0[voiced_flag]
    voiced_fraction = float(np.sum(voiced_flag) / len(f0)) if len(f0) > 0 else 0.0

    if len(voiced_f0) > 1:
        periods = 1.0 / (voiced_f0 + 1e-10)
        jitter = float(np.mean(np.abs(np.diff(periods))) / np.mean(periods) * 100)
    else:
        jitter = 0.0

    rms = librosa.feature.rms(y=y_clean, frame_length=512, hop_length=128)[0]
    if len(rms) > 1:
        shimmer = float(
            np.mean(np.abs(np.diff(rms))) / (np.mean(rms) + 1e-10) * 100
        )
    else:
        shimmer = 0.0

    hnr = _estimate_hnr(y_clean, sr)

    return VoiceQualityMetrics(
        harmonics_to_noise_ratio=round(hnr, 2),
        jitter_local=round(jitter, 4),
        shimmer_local=round(shimmer, 4),
        voiced_fraction=round(voiced_fraction, 3),
    )


def _estimate_hnr(y: np.ndarray, sr: int, frame_len: int = 2048) -> float:
    n_frames = len(y) // frame_len
    hnrs = []
    for i in range(n_frames):
        frame = y[i * frame_len: (i + 1) * frame_len]
        if np.max(np.abs(frame)) < 1e-6:
            continue
        autocorr = np.correlate(frame, frame, mode="full")
        autocorr = autocorr[len(autocorr) // 2:]
        autocorr /= autocorr[0] + 1e-10

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
    norm_pitch = 175 if f.pitch.estimated_gender == "female" else 120

    # Arousal
    arousal = 50.0
    arousal += np.clip((f.pitch.mean - norm_pitch) / norm_pitch * 40, -30, 30)
    arousal += np.clip((f.energy.mean - 0.04) / 0.04 * 20, -20, 20)
    arousal += np.clip((f.temporal.speech_rate - 3.5) / 3.5 * 15, -15, 15)
    arousal += np.clip((f.pitch.range - 60) / 60 * 10, -10, 10)
    arousal += np.clip((f.spectral.spectral_centroid_mean - 1800) / 1800 * 10, -10, 10)
    arousal += np.clip(f.voice_quality.jitter_local * 2, 0, 8)

    # Valence
    valence = 50.0
    valence += np.clip((f.pitch.mean - norm_pitch) / norm_pitch * 15, -15, 15)
    valence += np.clip((f.pitch.iqr - 30) / 30 * 10, -10, 10)
    valence += np.clip((f.pitch.pct_rising - 0.5) * 30, -15, 15)
    valence -= np.clip(f.voice_quality.jitter_local * 3, 0, 12)
    valence += np.clip((f.voice_quality.harmonics_to_noise_ratio - 10) / 10 * 10, -10, 10)
    valence -= np.clip(f.spectral.spectral_flatness_mean * 40, 0, 8)
    valence += np.clip(f.energy.slope * 1e5, -10, 10)
    valence -= np.clip(f.temporal.pause_to_speech_ratio * 15, 0, 12)

    # Dominance
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


def _extract_hormonal_markers(f: AcousticFeatures) -> HormonalVocalMarkers:
    """
    Derive hormone-relevant composite indices from raw acoustic features.
    """
    flags = []
    norm_pitch = 175 if f.pitch.estimated_gender == "female" else 120

    # Progesterone → vocal fold thickening → lower F0
    if f.pitch.mean > 0:
        pitch_ratio = f.pitch.mean / norm_pitch
        pitch_depression = float(np.clip((1.0 - pitch_ratio) * 100, 0, 100))
        if pitch_depression > 20 and f.pitch.estimated_gender == "female":
            flags.append(
                f"F0 depressed {pitch_depression:.0f}% below expected - "
                f"consistent with progesterone-mediated vocal fold edema (luteal phase marker)"
            )
    else:
        pitch_depression = 50.0

    # Composite of jitter + shimmer - both increase with hormonal edema
    # Normal jitter < 1.0%, normal shimmer < 3.0%
    edema_index = float(np.clip(
        (f.voice_quality.jitter_local / 1.0 * 30) +
        (f.voice_quality.shimmer_local / 3.0 * 30) +
        (max(0, 10 - f.voice_quality.harmonics_to_noise_ratio) / 10 * 40),
        0, 100
    ))
    if edema_index > 50 and f.pitch.estimated_gender == "female":
        flags.append(
            f"Vocal fold edema index elevated ({edema_index:.0f}/100) - "
            f"jitter {f.voice_quality.jitter_local:.1f}%, shimmer {f.voice_quality.shimmer_local:.1f}%. "
            f"Progesterone effect or vocal fatigue."
        )

    # Energy declining + HNR dropping + high low-energy fraction
    fatigue_index = float(np.clip(
        (max(0, -f.energy.slope * 1e6) * 20) +
        (max(0, 10 - f.voice_quality.harmonics_to_noise_ratio) / 10 * 30) +
        (f.energy.low_energy_fraction * 50),
        0, 100
    ))
    if fatigue_index > 45:
        flags.append(
            f"Vocal fatigue index elevated ({fatigue_index:.0f}/100) - "
            f"energy declining, voice quality degrading. "
            f"Common in late luteal, PMDD, and perimenopause."
        )

    # Strong PMDD/depression marker
    prosodic_flatness = float(np.clip(
        (max(0, 25 - f.pitch.std) / 25 * 50) +
        (max(0, 60 - f.pitch.range) / 60 * 30) +
        (max(0, 30 - f.pitch.iqr) / 30 * 20),
        0, 100
    ))
    if prosodic_flatness > 55:
        flags.append(
            f"Prosodic flatness index {prosodic_flatness:.0f}/100 - "
            f"monotone speech pattern. Correlates with PMDD mood symptoms "
            f"and progesterone-related affect blunting."
        )

    # High pause ratio + slow rate + low voiced fraction
    speech_withdrawal = float(np.clip(
        (f.temporal.pause_to_speech_ratio * 40) +
        (max(0, 3.0 - f.temporal.speech_rate) / 3.0 * 30) +
        (max(0, 0.5 - f.voice_quality.voiced_fraction) / 0.5 * 30),
        0, 100
    ))
    if speech_withdrawal > 50:
        flags.append(
            f"Speech withdrawal index {speech_withdrawal:.0f}/100 - "
            f"excessive pausing, slow rate, reduced voicing. "
            f"Associated with hormonal mood crises and fatigue."
        )

    if (edema_index > 40 and prosodic_flatness > 40 and fatigue_index > 35):
        flags.append(
            "⚠ Hormonal vocal crisis cluster: elevated edema + prosodic flatness + vocal fatigue. "
            "Pattern consistent with severe late-luteal / PMDD episode."
        )

    return HormonalVocalMarkers(
        pitch_depression=round(pitch_depression, 1),
        vocal_fold_edema_index=round(edema_index, 1),
        vocal_fatigue_index=round(fatigue_index, 1),
        prosodic_flatness=round(prosodic_flatness, 1),
        speech_withdrawal=round(speech_withdrawal, 1),
        hormonal_voice_flags=flags,
    )


_VIBE_MAP = [
    (0, 30, 0, 30, "defeated"),
    (0, 30, 30, 55, "melancholic"),
    (0, 30, 55, 100, "distressed"),
    (30, 50, 0, 30, "drained"),
    (30, 50, 30, 55, "flat"),
    (30, 50, 55, 75, "tense"),
    (30, 50, 75, 100, "agitated"),
    (50, 65, 0, 30, "mellow"),
    (50, 65, 30, 55, "chill"),
    (50, 65, 55, 75, "engaged"),
    (50, 65, 75, 100, "fired-up"),
    (65, 100, 0, 30, "serene"),
    (65, 100, 30, 55, "content"),
    (65, 100, 55, 75, "upbeat"),
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


def _compute_distress_score(
        f: AcousticFeatures,
        axes: EmotionalAxes,
        hormonal: HormonalVocalMarkers,
) -> tuple[float, list[str]]:
    score = 0.0
    flags: list[str] = []

    if f.energy.mean < 0.006:
        score += 20
        flags.append("Critically low vocal energy - possible severe fatigue or withdrawal")
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
        flags.append("No voiced pitch detected - extremely low speech content")
    elif f.pitch.mean < norm * 0.7:
        score += 15
        flags.append("Pitch significantly below expected range (depressive or hormonal indicator)")
    elif f.pitch.mean > norm * 1.8:
        score += 12
        flags.append("Pitch significantly above expected range (acute stress marker)")

    if 0 < f.pitch.std < 10:
        score += 12
        flags.append("Near-zero pitch variation - strong monotone / flat affect")
    elif f.pitch.std < 18:
        score += 6
        flags.append("Low pitch variation")

    if f.pitch.curvature > 15:
        score += 8
        flags.append("Erratic pitch contour - possible emotional instability")

    if f.temporal.speech_rate < 1.2:
        score += 15
        flags.append("Very low speech rate - possible cognitive lag or withdrawal")
    elif f.temporal.speech_rate < 2.5:
        score += 8
        flags.append("Below-average speech rate")
    elif f.temporal.speech_rate > 6.5:
        score += 10
        flags.append("Pressured / rapid speech (anxiety marker)")

    if f.temporal.pause_to_speech_ratio > 0.8:
        score += 12
        flags.append("Excessive pausing relative to speech")
    elif f.temporal.pause_to_speech_ratio > 0.5:
        score += 6
        flags.append("High pause-to-speech ratio")

    if f.temporal.longest_pause > 4.0:
        score += 8
        flags.append(f"Long silence detected ({f.temporal.longest_pause:.1f}s)")

    if f.voice_quality.jitter_local > 3.0:
        score += 10
        flags.append("Elevated jitter - vocal tremor / instability")
    if f.voice_quality.shimmer_local > 8.0:
        score += 8
        flags.append("Elevated shimmer - breathy or strained voice")
    if f.voice_quality.harmonics_to_noise_ratio < 5:
        score += 10
        flags.append("Low HNR - hoarse or noisy voice quality")
    if f.voice_quality.voiced_fraction < 0.3:
        score += 10
        flags.append("Mostly unvoiced - very little actual speech detected")

    if f.spectral.spectral_centroid_mean < 900:
        score += 6
        flags.append("Low spectral brightness - muffled / withdrawn vocal quality")
    if f.spectral.spectral_flatness_mean > 0.3:
        score += 6
        flags.append("High spectral flatness - voice sounds noisy / breathy")

    # Depression cluster
    if f.energy.mean < 0.02 and f.pitch.std < 15 and f.temporal.speech_rate < 2.5:
        score += 15
        flags.append(
            "⚠ Depression-linked vocal pattern cluster detected "
            "(low energy + flat pitch + slow rate)"
        )

    # Anxiety cluster
    if (f.pitch.mean > norm * 1.4 and f.temporal.speech_rate > 5.0 and f.energy.mean > 0.08):
        score += 12
        flags.append(
            "⚠ Acute anxiety vocal pattern cluster detected "
            "(high pitch + rapid speech + high energy)"
        )

    # Hormonal crisis cluster (from hormonal markers)
    if hormonal.vocal_fold_edema_index > 50 and hormonal.prosodic_flatness > 50:
        score += 10
        flags.append(
            "⚠ Hormonal vocal deterioration pattern - "
            "elevated edema markers + prosodic flatness suggest late-luteal or PMDD episode"
        )

    # Vocal fatigue + withdrawal combined
    if hormonal.vocal_fatigue_index > 50 and hormonal.speech_withdrawal > 50:
        score += 8
        flags.append(
            "⚠ Severe vocal fatigue + speech withdrawal - "
            "pattern associated with hormonal mood crisis or perimenopause fatigue"
        )

    # Emotional axes cross-check
    if axes.valence < 25 and axes.arousal < 25:
        score += 8
        flags.append("Emotional profile: very low valence + very low arousal (hopelessness risk)")

    # Include hormonal flags
    for hf in hormonal.hormonal_voice_flags:
        if hf not in flags:
            flags.append(hf)

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
        hormonal: HormonalVocalMarkers,
        flags: list[str],
) -> str:
    parts = []

    parts.append(f'Detected vibe: **{vibe}**.')

    parts.append(
        f"Valence {axes.valence:.0f}/100 · "
        f"Arousal {axes.arousal:.0f}/100 · "
        f"Dominance {axes.dominance:.0f}/100."
    )

    parts.append(
        f"Voice profile: {energy} energy, {pitch} pitch, {speech} speech activity."
    )

    # Hormonal marker summary
    hormonal_concerns = []
    if hormonal.vocal_fold_edema_index > 40:
        hormonal_concerns.append(f"vocal fold edema index {hormonal.vocal_fold_edema_index:.0f}/100")
    if hormonal.prosodic_flatness > 40:
        hormonal_concerns.append(f"prosodic flatness {hormonal.prosodic_flatness:.0f}/100")
    if hormonal.vocal_fatigue_index > 40:
        hormonal_concerns.append(f"vocal fatigue {hormonal.vocal_fatigue_index:.0f}/100")
    if hormonal.pitch_depression > 25 and pitch != "undetected":
        hormonal_concerns.append(f"pitch depression {hormonal.pitch_depression:.0f}%")

    if hormonal_concerns:
        parts.append(
            f"Hormonal vocal markers: {', '.join(hormonal_concerns)}."
        )

    if distress >= 65:
        parts.append(
            f"🔴 Distress score {distress:.0f}/100 - significant concern. "
            "Recommend immediate provider review. Check for PMDD/hormonal crisis."
        )
    elif distress >= 40:
        parts.append(
            f"🟡 Distress score {distress:.0f}/100 - moderate concern. "
            "Recommend follow-up within 24 hours. Correlate with cycle phase."
        )
    elif distress >= 20:
        parts.append(
            f"🟢 Distress score {distress:.0f}/100 - mild indicators. "
            "Monitor across cycle. May be normal luteal variation."
        )
    else:
        parts.append(
            f"🟢 Distress score {distress:.0f}/100 - within healthy range."
        )

    cluster_flags = [fl for fl in flags if fl.startswith("⚠")]
    if cluster_flags:
        parts.append("Key patterns: " + "; ".join(cluster_flags))

    return " ".join(parts)


def analyze_audio(file_path: str) -> AcousticAnalysisResult:
    logger.info("═══════════════════════════════════════")
    logger.info("  ACOUSTIC ENGINE - starting")
    logger.info("═══════════════════════════════════════")

    features = extract_features(file_path)

    logger.info("── Raw Feature Summary ──")
    logger.info(
        f"  Pitch        : μ={features.pitch.mean:.1f} Hz  σ={features.pitch.std:.1f}  IQR={features.pitch.iqr:.1f}  range={features.pitch.range:.1f}")
    logger.info(
        f"  Energy       : μ={features.energy.mean:.5f}  peak={features.energy.peak:.5f}  ΔdB={features.energy.dynamic_range_db:.1f}")
    logger.info(
        f"  Temporal     : rate={features.temporal.speech_rate:.2f}/s  pauses={features.temporal.pause_count}  pause_ratio={features.temporal.pause_to_speech_ratio:.2f}")
    logger.info(
        f"  Voice quality: HNR={features.voice_quality.harmonics_to_noise_ratio:.1f}dB  jitter={features.voice_quality.jitter_local:.2f}%  shimmer={features.voice_quality.shimmer_local:.2f}%")
    logger.info(f"  Gender est.  : {features.pitch.estimated_gender}")

    axes = _estimate_emotion_axes(features)
    logger.info(f"  Emotion axes : V={axes.valence:.1f}  A={axes.arousal:.1f}  D={axes.dominance:.1f}")

    hormonal = _extract_hormonal_markers(features)
    logger.info(
        f"  Hormonal     : edema={hormonal.vocal_fold_edema_index:.0f}  fatigue={hormonal.vocal_fatigue_index:.0f}  flatness={hormonal.prosodic_flatness:.0f}  withdrawal={hormonal.speech_withdrawal:.0f}")

    vibe = _classify_vibe(axes)
    logger.info(f"  Vibe         : {vibe}")

    distress_score, flags = _compute_distress_score(features, axes, hormonal)

    if flags:
        for flag in flags:
            lvl = logging.WARNING if flag.startswith("⚠") else logging.INFO
            logger.log(lvl, f"  FLAG → {flag}")

    energy_level = _classify_energy(features.energy)
    pitch_affect = _classify_pitch_affect(features.pitch)
    speech_activity = _classify_speech_activity(features.temporal)

    summary = _build_summary(
        vibe, distress_score, axes, energy_level,
        pitch_affect, speech_activity, hormonal, flags,
    )

    logger.info("═══════════════════════════════════════")
    logger.info("  ACOUSTIC ENGINE - complete")
    logger.info("═══════════════════════════════════════")

    return AcousticAnalysisResult(
        features=features,
        emotion_axes=axes,
        hormonal_markers=hormonal,
        distress_score=distress_score,
        vibe=vibe,
        energy_level=energy_level,
        pitch_affect=pitch_affect,
        speech_activity=speech_activity,
        flags=flags,
        summary=summary,
    )
