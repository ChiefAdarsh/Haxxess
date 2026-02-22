import { ArrowLeft, Phone, AlertTriangle, FileText, TrendingUp, Sparkles, Activity } from 'lucide-react'
import { triageLevelConfig } from '../../engine/triage'
import type { Patient } from '../../config/patients'
import type { TriageLevel, BodyRegion } from '../../types'

const mockCase = {
  level: 'emergency' as TriageLevel,
  reasons: [
    'Acoustic anomaly detected: High vocal jitter indicative of acute distress',
    'Oura Ring flagged sudden +1.4°C core temp spike over last 4 hours',
    'NLP extracted severe 9/10 pelvic pain radiating to lower back',
    'High risk of ectopic rupture or ovarian torsion based on multi-sensor context',
  ],
  transcript: [
    '[Vitality Voice Journal - 2:14 PM]',
    '"I don\'t know what\'s wrong, it suddenly hurts so bad on my right side..."',
    '"It started a couple hours ago but now I can barely stand up..."',
    '"I feel super nauseous and dizzy too..."',
    '[Audio flags: elevated pitch variance, trembling detected]',
  ],
  entities: {
    onset: 'Acute (2 hrs ago)',
    severity: '9/10 (Critical)',
    location: 'Right lower quadrant',
    vitals: 'Temp +1.4°C, HRV down 40%',
    nausea: 'Present / Dizzy',
    vocal_stress: 'High Variance',
  },
  regions: ['RLQ'] as BodyRegion[],
  trend: {
    baseline: 2,
    current: 9,
    change: '+7 from baseline',
  },
  nextSteps: [
    'Initiate immediate telehealth triage call',
    'Order urgent transvaginal ultrasound to rule out ovarian torsion/ectopic',
    'Direct patient to nearest ER if hemodynamic instability occurs',
    'Push Vitality notification for active continuous vitals monitoring',
  ],
}

interface CaseDetailProps {
  patient: Patient
  onBack: () => void
}

export default function CaseDetail({ patient, onBack }: CaseDetailProps) {
  const cfg = triageLevelConfig[mockCase.level]
  const isCritical = mockCase.level === 'emergency'

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          border: 'none', backgroundColor: 'transparent',
          cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 500,
          marginBottom: 20, padding: 0, transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#0f172a'}
        onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
      >
        <ArrowLeft size={16} /> Back to Triage Queue
      </button>

      {/* Patient Header + AI Triage Alert */}
      <div style={{
        backgroundColor: isCritical ? '#fffbfe' : cfg.bg,
        borderRadius: 16,
        border: `1px solid ${isCritical ? '#fbcfe8' : cfg.color + '30'}`,
        padding: '24px', marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        boxShadow: isCritical ? '0 8px 24px -4px rgba(190, 24, 93, 0.1)' : '0 4px 6px -1px rgba(0,0,0,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Avatar */}
          <div style={{
            width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 20, color: isCritical ? '#be185d' : '#475569',
            border: `3px solid ${isCritical ? '#be185d' : cfg.color}`,
            boxShadow: isCritical ? '0 0 16px rgba(190, 24, 93, 0.2)' : 'none'
          }}>
            {patient.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>{patient.name}</h2>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                backgroundColor: isCritical ? '#be185d' : '#fff', color: isCritical ? '#fff' : cfg.color,
                border: isCritical ? 'none' : `1px solid ${cfg.color}`,
                textTransform: 'uppercase', letterSpacing: '0.05em',
                display: 'flex', alignItems: 'center', gap: 4
              }}>
                {isCritical && <Sparkles size={12} />}
                {cfg.label} Level Alert
              </span>
            </div>
            <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0', fontWeight: 500 }}>Age {patient.age} &middot; Multimodal Anomaly Detected</p>
          </div>
        </div>

        {/* Call to Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, color: '#fff',
            boxShadow: '0 4px 12px rgba(190, 24, 93, 0.25)',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(190, 24, 93, 0.35)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(190, 24, 93, 0.25)'
          }}
          >
            <Phone size={16} /> Urgent Telehealth Call
          </button>
        </div>
      </div>

      {/* AI Red-Flag Reasoning */}
      <div style={{
        backgroundColor: '#fff', borderRadius: 16, border: '1px solid #f1f5f9',
        padding: '24px', marginBottom: 20,
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={18} color="#e11d48" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0, letterSpacing: '-0.01em' }}>Vitality AI Triage Reasoning</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mockCase.reasons.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#e11d48', marginTop: 8, flexShrink: 0 }} />
              <p style={{ fontSize: 14, color: '#334155', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                {r}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* NLP Transcript Summary */}
        <div style={{
          backgroundColor: '#fff', borderRadius: 16, border: '1px solid #f1f5f9', padding: '24px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={18} color="#3b82f6" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0, letterSpacing: '-0.01em' }}>Voice Journal Transcript</h3>
          </div>
          <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            {mockCase.transcript.map((line, i) => {
              const isMeta = line.startsWith('[')
              return (
                <p key={i} style={{
                  fontSize: 13,
                  color: isMeta ? '#94a3b8' : '#334155',
                  margin: '6px 0',
                  lineHeight: 1.6,
                  fontStyle: isMeta ? 'italic' : 'normal',
                  fontWeight: isMeta ? 600 : 400
                }}>
                  {line}
                </p>
              )
            })}
          </div>
        </div>

        {/* Extracted Multimodal Data */}
        <div style={{
          backgroundColor: '#fff', borderRadius: 16, border: '1px solid #f1f5f9', padding: '24px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={18} color="#10b981" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0, letterSpacing: '-0.01em' }}>Fused Telemetry Data</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(mockCase.entities).map(([key, val]) => (
              <div key={key} style={{
                display: 'flex', justifyContent: 'space-between', paddingBottom: 10,
                borderBottom: '1px solid #f1f5f9',
              }}>
                <span style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{key.replace('_', ' ')}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: val.includes('Critical') || val.includes('+1.4') || val.includes('High') ? '#be185d' : '#1e293b' }}>
                  {val}
                </span>
              </div>
            ))}
          </div>

          {/* Severity Trend */}
          <div style={{
            marginTop: 20, padding: '16px', borderRadius: 12,
            backgroundColor: '#fffbfe', border: '1px solid #fbcfe8',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={20} color="#be185d" />
            </div>
            <div>
              <p style={{ fontSize: 11, color: '#be185d', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Severity Trend</p>
              <p style={{ fontSize: 14, color: '#1e293b', margin: '4px 0 0', fontWeight: 600 }}>
                Baseline {mockCase.trend.baseline}/10 → Current <span style={{ color: '#be185d', fontWeight: 800 }}>{mockCase.trend.current}/10</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Suggested Next Steps */}
      <div style={{
        backgroundColor: '#fff', borderRadius: 16, border: '1px solid #f1f5f9', padding: '24px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>
          Suggested Protocols (Non-Diagnostic)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {mockCase.nextSteps.map((step, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '16px', borderRadius: 12, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0'
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: 6, backgroundColor: '#e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#475569', flexShrink: 0,
              }}>{i + 1}</span>
              <p style={{ fontSize: 14, color: '#334155', margin: 0, fontWeight: 500, lineHeight: 1.4 }}>{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
