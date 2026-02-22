import { AlertTriangle, Users, Clock, Activity, Sparkles } from 'lucide-react'
import { triageLevelConfig } from '../../engine/triage'
import { patients } from '../../config/patients'
import type { Patient } from '../../config/patients'
import type { TriageLevel } from '../../types'

// mock triage cases combining symptom + call data
const triageCases = [
  {
    id: 'c1', patient: patients[0], level: 'emergency' as TriageLevel,
    summary: 'Acoustic vocal tremor + Heavy bleeding, soaking pad in 2 hours',
    source: 'multimodal flag', time: '12 min ago',
  },
  {
    id: 'c2', patient: patients[3], level: 'emergency' as TriageLevel,
    summary: 'Oura Temp spike + Severe right-sided pelvic pain with nausea',
    source: 'sensor fusion', time: '34 min ago',
  },
  {
    id: 'c3', patient: patients[5], level: 'same_day' as TriageLevel,
    summary: 'Burning with urination, pelvic pressure 7/10',
    source: 'symptom log', time: '1 hr ago',
  },
  {
    id: 'c4', patient: patients[1], level: 'same_day' as TriageLevel,
    summary: 'Fever reported with pelvic midline pain',
    source: 'call-in', time: '2 hrs ago',
  },
  {
    id: 'c5', patient: patients[2], level: 'routine' as TriageLevel,
    summary: 'Recurring dull cramps, cycle day 14',
    source: 'symptom log', time: '3 hrs ago',
  },
  {
    id: 'c6', patient: patients[4], level: 'self_care' as TriageLevel,
    summary: 'Mild low back discomfort after exercise',
    source: 'symptom log', time: '5 hrs ago',
  },
]

const stats = [
  { label: 'Active Cases', value: triageCases.length.toString(), icon: Activity, color: '#be185d', bg: '#fdf2f8' },
  { label: 'Critical / ER', value: triageCases.filter(c => c.level === 'emergency').length.toString(), icon: AlertTriangle, color: '#e11d48', bg: '#fef2f2' },
  { label: 'Same-Day Risk', value: triageCases.filter(c => c.level === 'same_day').length.toString(), icon: Clock, color: '#f59e0b', bg: '#fffbeb' },
  { label: 'Total Patients', value: patients.length.toString(), icon: Users, color: '#3b82f6', bg: '#eff6ff' },
]

interface DashboardHomeProps {
  onSelectPatient: (patient: Patient) => void
}

export default function DashboardHome({ onSelectPatient }: DashboardHomeProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>
            Good afternoon, Dr. Mitchell
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0', fontWeight: 500 }}>
            Vitality has flagged {triageCases.filter(c => c.level === 'emergency').length} critical cases requiring your attention.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }}>
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} style={{
              backgroundColor: '#fff', borderRadius: 16, border: '1px solid #f1f5f9',
              padding: '20px', display: 'flex', alignItems: 'center', gap: 16,
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.02)',
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'default'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12, backgroundColor: s.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `inset 0 2px 4px rgba(255,255,255,0.8), 0 4px 8px ${s.color}15`
              }}>
                <Icon size={24} color={s.color} />
              </div>
              <div>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0, fontWeight: 600 }}>{s.label}</p>
                <p style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', margin: '2px 0 0', letterSpacing: '-0.03em' }}>{s.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{
        backgroundColor: '#fff', borderRadius: 16, border: '1px solid #f1f5f9', padding: '24px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={18} color="#fff" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0, letterSpacing: '-0.01em' }}>Vitality Triage Queue</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {triageCases.map((c) => {
            const cfg = triageLevelConfig[c.level]
            const isCritical = c.level === 'emergency'

            return (
              <button
                key={c.id}
                onClick={() => onSelectPatient(c.patient)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px 20px', borderRadius: 12,
                  border: isCritical ? '1px solid #fbcfe8' : '1px solid #f1f5f9',
                  backgroundColor: isCritical ? '#fffbfe' : '#fff',
                  borderLeft: `4px solid ${isCritical ? '#be185d' : cfg.color}`,
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isCritical ? '0 4px 12px rgba(190, 24, 93, 0.05)' : 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateX(4px)'
                  e.currentTarget.style.borderColor = isCritical ? '#f9a8d4' : '#e2e8f0'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateX(0)'
                  e.currentTarget.style.borderColor = isCritical ? '#fbcfe8' : '#f1f5f9'
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: isCritical ? '#fdf2f8' : '#f8fafc',
                  border: `2px solid ${isCritical ? '#fbcfe8' : '#e2e8f0'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 15, color: isCritical ? '#be185d' : '#475569', flexShrink: 0,
                }}>
                  {c.patient.name.split(' ').map(n => n[0]).join('')}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{c.patient.name}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                      backgroundColor: isCritical ? '#be185d' : cfg.bg,
                      color: isCritical ? '#fff' : cfg.color,
                      textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>
                      {cfg.label}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '4px 8px', borderRadius: 4,
                      backgroundColor: '#f1f5f9', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.02em'
                    }}>
                      {c.source}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#475569', margin: '6px 0 0', fontWeight: 500 }}>{c.summary}</p>
                </div>

                <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', flexShrink: 0 }}>{c.time}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
