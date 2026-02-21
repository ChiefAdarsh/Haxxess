import { AlertTriangle, Users, Clock, Activity } from 'lucide-react'
import { triageLevelConfig } from '../../engine/triage'
import { patients } from '../../config/patients'
import type { Patient } from '../../config/patients'
import type { TriageLevel } from '../../types'

// mock triage cases combining symptom + call data
const triageCases = [
  {
    id: 'c1', patient: patients[0], level: 'emergency' as TriageLevel,
    summary: 'heavy bleeding, soaking pad in 2 hours',
    source: 'symptom log', time: '12 min ago',
  },
  {
    id: 'c2', patient: patients[3], level: 'emergency' as TriageLevel,
    summary: 'severe right-sided pelvic pain with nausea',
    source: 'call-in', time: '34 min ago',
  },
  {
    id: 'c3', patient: patients[5], level: 'same_day' as TriageLevel,
    summary: 'burning with urination, pelvic pressure 7/10',
    source: 'symptom log', time: '1 hr ago',
  },
  {
    id: 'c4', patient: patients[1], level: 'same_day' as TriageLevel,
    summary: 'fever reported with pelvic midline pain',
    source: 'call-in', time: '2 hrs ago',
  },
  {
    id: 'c5', patient: patients[2], level: 'routine' as TriageLevel,
    summary: 'recurring dull cramps, cycle day 14',
    source: 'symptom log', time: '3 hrs ago',
  },
  {
    id: 'c6', patient: patients[4], level: 'self_care' as TriageLevel,
    summary: 'mild low back discomfort after exercise',
    source: 'symptom log', time: '5 hrs ago',
  },
]

const stats = [
  { label: 'Active Cases', value: triageCases.length.toString(), icon: Activity, color: '#dc2626' },
  { label: 'Emergency', value: triageCases.filter(c => c.level === 'emergency').length.toString(), icon: AlertTriangle, color: '#dc2626' },
  { label: 'Same-Day', value: triageCases.filter(c => c.level === 'same_day').length.toString(), icon: Clock, color: '#f59e0b' },
  { label: 'Total Patients', value: patients.length.toString(), icon: Users, color: '#2563eb' },
]

interface DashboardHomeProps {
  onSelectPatient: (patient: Patient) => void
}

export default function DashboardHome({ onSelectPatient }: DashboardHomeProps) {
  return (
    <div>
      {/* stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} style={{
              backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
              padding: '18px', display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10, backgroundColor: `${s.color}10`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={20} color={s.color} />
              </div>
              <div>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{s.label}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: '#1f2937', margin: '2px 0 0' }}>{s.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* triage queue */}
      <div style={{
        backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>Triage Queue</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {triageCases.map((c) => {
            const cfg = triageLevelConfig[c.level]
            return (
              <button
                key={c.id}
                onClick={() => onSelectPatient(c.patient)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 10,
                  border: '1px solid #e5e7eb', backgroundColor: '#fff',
                  borderLeft: `4px solid ${cfg.color}`,
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#d1d5db' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb' }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 19, backgroundColor: '#f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 600, fontSize: 13, color: '#4b5563', flexShrink: 0,
                }}>
                  {c.patient.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>{c.patient.name}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                      backgroundColor: cfg.bg, color: cfg.color,
                    }}>
                      {cfg.label}
                    </span>
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 4,
                      backgroundColor: '#f3f4f6', color: '#6b7280',
                    }}>
                      {c.source}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0' }}>{c.summary}</p>
                </div>
                <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{c.time}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
