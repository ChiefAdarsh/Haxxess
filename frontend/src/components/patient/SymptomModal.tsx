import { useState } from 'react'
import { X } from 'lucide-react'
import { useSymptoms } from '../../context/SymptomContext'
import type { BodyRegion, SymptomType, QualityTag, Timing, Trigger } from '../../types'

const symptomTypes: SymptomType[] = ['pain', 'cramp', 'burning', 'pressure', 'itch', 'bleeding', 'discharge', 'gi']
const qualityTags: QualityTag[] = ['stabbing', 'dull', 'throbbing', 'radiating']
const timings: Timing[] = ['sudden', 'gradual', 'constant', 'intermittent']
const triggers: Trigger[] = ['sex', 'urination', 'bowel_movement', 'exercise']

const triggerLabels: Record<Trigger, string> = {
  sex: 'Sex',
  urination: 'Urination',
  bowel_movement: 'Bowel Movement',
  exercise: 'Exercise',
}

function TagButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
      border: active ? '1px solid #dc2626' : '1px solid #e5e7eb',
      backgroundColor: active ? '#fef2f2' : '#fff',
      color: active ? '#dc2626' : '#6b7280',
      cursor: 'pointer', transition: 'all 0.15s',
    }}>
      {label}
    </button>
  )
}

interface SymptomModalProps {
  region: BodyRegion
  regionLabel: string
  onClose: () => void
}

export default function SymptomModal({ region, regionLabel, onClose }: SymptomModalProps) {
  const { addSymptom } = useSymptoms()
  const [type, setType] = useState<SymptomType>('pain')
  const [severity, setSeverity] = useState(5)
  const [qualities, setQualities] = useState<QualityTag[]>([])
  const [timing, setTiming] = useState<Timing>('sudden')
  const [selectedTriggers, setSelectedTriggers] = useState<Trigger[]>([])
  const [notes, setNotes] = useState('')

  const toggleQuality = (q: QualityTag) =>
    setQualities((prev) => prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q])

  const toggleTrigger = (t: Trigger) =>
    setSelectedTriggers((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])

  const submit = () => {
    addSymptom({ region, type, severity, qualities, timing, triggers: selectedTriggers, notes })
    onClose()
  }

  const severityColor = severity <= 3 ? '#fde68a' : severity <= 6 ? '#fb923c' : '#dc2626'

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        backgroundColor: '#fff', borderRadius: 16, width: 480,
        maxHeight: '85vh', overflow: 'auto', padding: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1f2937', margin: 0 }}>Log Symptom</h2>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: '2px 0 0' }}>{regionLabel}</p>
          </div>
          <button onClick={onClose} style={{
            border: 'none', backgroundColor: 'transparent', cursor: 'pointer', padding: 4,
          }}>
            <X size={20} color="#9ca3af" />
          </button>
        </div>

        {/* symptom type */}
        <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 8 }}>
          type
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {symptomTypes.map((s) => (
            <TagButton key={s} label={s} active={type === s} onClick={() => setType(s)} />
          ))}
        </div>

        {/* severity slider */}
        <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 8 }}>
          severity: {severity}/10
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>0</span>
          <input
            type="range" min={0} max={10} value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            style={{ flex: 1, accentColor: severityColor }}
          />
          <span style={{ fontSize: 12, color: '#9ca3af' }}>10</span>
          <span style={{
            width: 32, height: 32, borderRadius: 8, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: severityColor, color: severity > 6 ? '#fff' : '#1f2937',
            fontWeight: 700, fontSize: 14,
          }}>{severity}</span>
        </div>

        {/* quality */}
        <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 8 }}>
          quality
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {qualityTags.map((q) => (
            <TagButton key={q} label={q} active={qualities.includes(q)} onClick={() => toggleQuality(q)} />
          ))}
        </div>

        {/* timing */}
        <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 8 }}>
          timing
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {timings.map((t) => (
            <TagButton key={t} label={t} active={timing === t} onClick={() => setTiming(t)} />
          ))}
        </div>

        {/* triggers */}
        <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 8 }}>
          triggers
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {triggers.map((t) => (
            <TagButton key={t} label={triggerLabels[t]} active={selectedTriggers.includes(t)} onClick={() => toggleTrigger(t)} />
          ))}
        </div>

        {/* notes */}
        <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 8 }}>
          notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="anything else..."
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: '1px solid #e5e7eb', fontSize: 13, resize: 'vertical',
            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          }}
        />

        {/* submit */}
        <button onClick={submit} style={{
          width: '100%', marginTop: 20, padding: '12px',
          borderRadius: 10, border: 'none', backgroundColor: '#dc2626',
          color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>
          Log Symptom
        </button>
      </div>
    </div>
  )
}
