import { Users, AlertTriangle, Calendar, TrendingUp } from 'lucide-react'
import { patients } from '../../config/patients'
import type { Patient } from '../../config/patients'

const urgencyColor = {
  critical: '#dc2626',
  moderate: '#f59e0b',
  stable: '#10b981',
}

const stats = [
  { label: 'Total Patients', value: patients.length.toString(), icon: Users, color: '#dc2626' },
  { label: 'Active Alerts', value: '3', icon: AlertTriangle, color: '#f59e0b' },
  { label: 'Visits This Week', value: '8', icon: Calendar, color: '#2563eb' },
  { label: 'Avg Risk Score', value: '42', icon: TrendingUp, color: '#10b981' },
]

const needsAttention = patients
  .filter((p) => p.urgency === 'critical' || p.urgency === 'moderate')
  .sort((a, b) => (a.urgency === 'critical' ? -1 : 1) - (b.urgency === 'critical' ? -1 : 1))

const todaySchedule = [
  { time: '9:00 AM', patient: patients[3], type: 'Follow-up' },
  { time: '10:30 AM', patient: patients[0], type: 'Check-up' },
  { time: '2:00 PM', patient: patients[2], type: 'Prenatal' },
]

interface DashboardHomeProps {
  onSelectPatient: (patient: Patient) => void
}

export default function DashboardHome({ onSelectPatient }: DashboardHomeProps) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} style={{
              backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
              padding: '20px', display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, backgroundColor: `${s.color}10`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={22} color={s.color} />
              </div>
              <div>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{s.label}</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: '#1f2937', margin: '2px 0 0' }}>{s.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <div style={{
          backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px',
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>
            Needs Attention
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {needsAttention.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectPatient(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 10,
                  border: '1px solid #e5e7eb', backgroundColor: '#fff',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#d1d5db' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb' }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 20,
                  border: `3px solid ${urgencyColor[p.urgency]}`,
                  backgroundColor: '#f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 600, fontSize: 14, color: '#4b5563', flexShrink: 0,
                }}>
                  {p.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>{p.name}</span>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{p.condition}</p>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                  backgroundColor: `${urgencyColor[p.urgency]}15`, color: urgencyColor[p.urgency],
                }}>
                  {p.urgency}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div style={{
          backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px',
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>
            Today's Schedule
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {todaySchedule.map((appt, i) => (
              <div key={i} style={{
                padding: '12px', borderRadius: 8, backgroundColor: '#f9fafb',
                borderLeft: `3px solid ${urgencyColor[appt.patient.urgency]}`,
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', margin: 0 }}>{appt.time}</p>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#1f2937', margin: '4px 0 2px' }}>{appt.patient.name}</p>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{appt.type}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
