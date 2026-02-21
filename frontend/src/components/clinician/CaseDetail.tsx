import { ArrowLeft, Phone, AlertTriangle, MapPin, FileText, TrendingUp } from 'lucide-react'
import { triageLevelConfig } from '../../engine/triage'
import type { Patient } from '../../config/patients'
import type { TriageLevel, BodyRegion } from '../../types'

const regionLabels: Record<BodyRegion, string> = {
  LLQ: 'Left Lower Quad.',
  RLQ: 'Right Lower Quad.',
  pelvic_midline: 'Pelvic Midline',
  suprapubic: 'Suprapubic',
  vulva: 'Vulva',
  low_back: 'Lower Back',
  left_thigh: 'Left Thigh',
  right_thigh: 'Right Thigh',
}

// mock case data
const mockCase = {
  level: 'emergency' as TriageLevel,
  reasons: [
    'severe one-sided pelvic pain with nausea',
    'pain severity 9/10 — sharp, radiating',
    'sudden onset — no prior history in this region',
  ],
  transcript: [
    'patient reports sudden sharp pain on the right side',
    'started about 2 hours ago, getting worse',
    'rates pain as 9 out of 10',
    'experiencing nausea but no vomiting',
    'no fever, no bleeding currently',
    'last period was 2 weeks ago, regular cycle',
  ],
  entities: {
    onset: '2 hours ago',
    severity: '9/10',
    location: 'Right lower quadrant',
    bleeding: 'None currently',
    fever: 'Denied',
    nausea: 'Present',
  },
  regions: ['RLQ'] as BodyRegion[],
  trend: {
    baseline: 2,
    current: 9,
    change: '+7 from baseline',
  },
  nextSteps: [
    'urgent pelvic exam recommended',
    'consider transvaginal ultrasound to rule out ovarian torsion/ectopic',
    'monitor for signs of hemodynamic instability',
    'pain management per protocol',
  ],
}

interface CaseDetailProps {
  patient: Patient
  onBack: () => void
}

export default function CaseDetail({ patient, onBack }: CaseDetailProps) {
  const cfg = triageLevelConfig[mockCase.level]

  return (
    <div>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        border: 'none', backgroundColor: 'transparent',
        cursor: 'pointer', fontSize: 13, color: '#6b7280',
        marginBottom: 16, padding: 0,
      }}>
        <ArrowLeft size={16} /> back to queue
      </button>

      {/* patient header + triage */}
      <div style={{
        backgroundColor: cfg.bg, borderRadius: 12, border: `1px solid ${cfg.color}30`,
        padding: '20px', marginBottom: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 600, fontSize: 16, color: '#4b5563',
            border: `3px solid ${cfg.color}`,
          }}>
            {patient.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', margin: 0 }}>{patient.name}</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '3px 0 0' }}>Age {patient.age}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
            backgroundColor: '#fff', color: cfg.color, border: `1px solid ${cfg.color}`,
          }}>
            {cfg.label}
          </span>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, border: 'none',
            backgroundColor: '#dc2626', cursor: 'pointer',
            fontSize: 12, fontWeight: 500, color: '#fff',
          }}>
            <Phone size={14} /> Call Patient
          </button>
        </div>
      </div>

      {/* red-flag reasoning */}
      <div style={{
        backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
        padding: '20px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <AlertTriangle size={16} color={cfg.color} />
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', margin: 0 }}>triage reasoning</h3>
        </div>
        {mockCase.reasons.map((r, i) => (
          <p key={i} style={{ fontSize: 13, color: '#4b5563', margin: '4px 0', paddingLeft: 24 }}>
            • {r}
          </p>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* transcript summary */}
        <div style={{
          backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <FileText size={16} color="#6b7280" />
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', margin: 0 }}>transcript summary</h3>
          </div>
          {mockCase.transcript.map((line, i) => (
            <p key={i} style={{ fontSize: 12, color: '#4b5563', margin: '4px 0', lineHeight: 1.5 }}>
              • {line}
            </p>
          ))}
        </div>

        {/* extracted entities */}
        <div style={{
          backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <MapPin size={16} color="#6b7280" />
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', margin: 0 }}>extracted data</h3>
          </div>
          {Object.entries(mockCase.entities).map(([key, val]) => (
            <div key={key} style={{
              display: 'flex', justifyContent: 'space-between', padding: '6px 0',
              borderBottom: '1px solid #f3f4f6',
            }}>
              <span style={{ fontSize: 12, color: '#9ca3af', textTransform: 'capitalize' }}>{key}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#1f2937' }}>{val}</span>
            </div>
          ))}

          {/* change from baseline */}
          <div style={{
            marginTop: 14, padding: '10px', borderRadius: 8,
            backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <TrendingUp size={14} color="#dc2626" />
            <div>
              <p style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, margin: 0 }}>change from baseline</p>
              <p style={{ fontSize: 12, color: '#4b5563', margin: '2px 0 0' }}>
                baseline {mockCase.trend.baseline}/10 → current {mockCase.trend.current}/10 ({mockCase.trend.change})
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* suggested next steps */}
      <div style={{
        backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px',
      }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', margin: '0 0 12px' }}>
          suggested next steps (non-diagnostic)
        </h3>
        {mockCase.nextSteps.map((step, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8,
          }}>
            <span style={{
              width: 20, height: 20, borderRadius: 10, backgroundColor: '#dc262610',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, color: '#dc2626', flexShrink: 0,
            }}>{i + 1}</span>
            <p style={{ fontSize: 13, color: '#4b5563', margin: 0 }}>{step}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
