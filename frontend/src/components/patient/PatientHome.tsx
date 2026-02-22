import { useState, useEffect, useRef } from 'react'
import { useSymptoms } from '../../context/SymptomContext'
import { triageSymptoms, triageLevelConfig } from '../../engine/triage'
import { AlertTriangle, Activity, MapPin, Calendar, Mic, Square, Loader2 } from 'lucide-react'
import type { BodyRegion } from '../../types'

const regionLabels: Record<BodyRegion, string> = {
  LLQ: 'Left Lower Quadrant',
  RLQ: 'Right Lower Quadrant',
  pelvic_midline: 'Pelvic Midline',
  suprapubic: 'Suprapubic',
  vulva: 'Vulva',
  low_back: 'Lower Back',
  left_thigh: 'Left Thigh',
  right_thigh: 'Right Thigh',
}

export default function PatientHome() {
  // @ts-ignore
  const { symptoms, getRecent, maxSeverityByRegion } = useSymptoms()
  const recent7 = getRecent(7)
  const recent24 = getRecent(1)
  const triage = triageSymptoms(recent24)
  const cfg = triageLevelConfig[triage.level]
  const severityMap = maxSeverityByRegion()

  // most affected region
  const regionCounts: Partial<Record<BodyRegion, number>> = {}
  for (const s of recent7) {
    regionCounts[s.region] = (regionCounts[s.region] || 0) + 1
  }
  const topRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0]

  // --- OUR NEW BACKEND STATE ---
  const [healthScore, setHealthScore] = useState<number | null>(null)
  const [tierLabel, setTierLabel] = useState<string>("Loading...")
  const [isRecording, setIsRecording] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const fetchScore = async () => {
    try {
      const res = await fetch('http://localhost:8000/consolidated')
      const data = await res.json()
      if (data.status === 'success') {
        setHealthScore(Math.round(data.vitality_index))
        setTierLabel(data.tier.label)
      }
    } catch (err) {
      console.error("Failed to fetch score", err)
    }
  }

  useEffect(() => {
    fetchScore()
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error("Microphone access denied", err)
      alert("Please allow microphone access to record your voice journal.")
    }
  }

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return

    mediaRecorderRef.current.onstop = async () => {
      setIsRecording(false)
      setIsAnalyzing(true)

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
      const formData = new FormData()
      formData.append('file', audioBlob, 'journal.wav')

      try {
        const res = await fetch('http://localhost:8000/analyze', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()

        if (data.status === 'success') {
          setTranscript(data.transcript)
          await fetchScore() // Refresh the score with the new vocal biomarkers
        }
      } catch (err) {
        console.error("Failed to analyze audio", err)
      } finally {
        setIsAnalyzing(false)
      }
    }

    mediaRecorderRef.current.stop()
    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', margin: '0 0 20px' }}>Patient Dashboard</h2>

      {/* Voice Journal Section (OUR NEW BACKEND FEATURE) */}
      <div style={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1f2937', margin: 0 }}>Daily Vocal Biomarker Check-in</h3>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0', maxWidth: 400 }}>
            Hold the button and describe your hormonal symptoms today. Vitality will analyze your vocal folds and transcribe your entry.
          </p>

          {healthScore !== null && (
            <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', backgroundColor: '#f3f4f6', borderRadius: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#4b5563' }}>Fused Vitality Score:</span>
              <span style={{
                fontSize: 14, fontWeight: 700,
                color: healthScore >= 80 ? '#10b981' : healthScore >= 55 ? '#f59e0b' : '#dc2626'
              }}>
                {healthScore}/100
              </span>
              <span style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase' }}>({tierLabel})</span>
            </div>
          )}
        </div>

        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          disabled={isAnalyzing}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px',
            borderRadius: 30, border: 'none', cursor: isAnalyzing ? 'not-allowed' : 'pointer',
            backgroundColor: isRecording ? '#dc2626' : '#ec4899', // Pinkish theme for FemTech
            color: '#fff', fontSize: 14, fontWeight: 600,
            boxShadow: isRecording ? '0 0 0 4px rgba(220, 38, 38, 0.2)' : 'none',
            transition: 'all 0.2s', flexShrink: 0
          }}
        >
          {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : isRecording ? <Square size={18} fill="#fff" /> : <Mic size={18} />}
          {isAnalyzing ? "Analyzing..." : isRecording ? "Release to Send" : "Hold to Record"}
        </button>
      </div>

      {/* Transcript Result */}
      {transcript && (
        <div style={{ padding: 16, backgroundColor: '#fdf2f8', borderRadius: 12, border: '1px solid #fbcfe8', marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#be185d', margin: '0 0 8px', textTransform: 'uppercase' }}>Transcript Logged</p>
          <p style={{ fontSize: 14, color: '#831843', margin: 0, fontStyle: 'italic' }}>"{transcript}"</p>
        </div>
      )}

      {/* triage status (FROM TEAMMATE) */}
      <div style={{
        backgroundColor: cfg.bg, borderRadius: 12, border: `1px solid ${cfg.color}30`,
        padding: '20px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 14,
      }}>
        <AlertTriangle size={22} color={cfg.color} style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: cfg.color, margin: '0 0 4px' }}>{cfg.label}</p>
          {triage.reasons.map((r, i) => (
            <p key={i} style={{ fontSize: 13, color: '#4b5563', margin: '2px 0' }}>{r}</p>
          ))}
        </div>
      </div>

      {/* stat cards (FROM TEAMMATE) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <div style={{
          backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Activity size={20} color="#dc2626" />
          <div>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>last 7 days</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#1f2937', margin: '2px 0 0' }}>{recent7.length}</p>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>symptoms logged</p>
          </div>
        </div>

        <div style={{
          backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <MapPin size={20} color="#7c3aed" />
          <div>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>most affected</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#1f2937', margin: '2px 0 0' }}>
              {topRegion ? regionLabels[topRegion[0] as BodyRegion] : 'none'}
            </p>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
              {topRegion ? `${topRegion[1]} entries` : ''}
            </p>
          </div>
        </div>

        <div style={{
          backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Calendar size={20} color="#2563eb" />
          <div>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>cycle day</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#1f2937', margin: '2px 0 0' }}>14</p>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>of 28-day cycle</p>
          </div>
        </div>
      </div>

      {/* region heatmap summary (FROM TEAMMATE) */}
      <div style={{
        backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', margin: '0 0 14px' }}>7-Day Region Summary</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(Object.entries(severityMap) as [BodyRegion, number][]).map(([region, sev]) => {
            const color = sev <= 3 ? '#fde68a' : sev <= 6 ? '#fb923c' : '#dc2626'
            return (
              <div key={region} style={{
                padding: '8px 14px', borderRadius: 8,
                backgroundColor: `${color}20`, border: `1px solid ${color}40`,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 4, backgroundColor: color,
                }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>
                  {regionLabels[region]}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color }}>{sev}/10</span>
              </div>
            )
          })}
          {Object.keys(severityMap).length === 0 && (
            <p style={{ fontSize: 13, color: '#9ca3af' }}>no symptoms logged this week</p>
          )}
        </div>
      </div>
    </div>
  )
}
