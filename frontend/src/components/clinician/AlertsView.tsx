import { useState } from 'react'
import { Phone, Check, AlertTriangle, Heart, Pill } from 'lucide-react'
import { patients } from '../../config/patients'

interface Alert {
  id: string
  patient: typeof patients[0]
  message: string
  type: 'vitals' | 'medication' | 'risk'
  urgency: 'critical' | 'moderate'
  time: string
  acknowledged: boolean
}

const initialAlerts: Alert[] = [
  { id: '1', patient: patients[0], message: 'BP spiked to 158/96', type: 'vitals', urgency: 'critical', time: '12 min ago', acknowledged: false },
  { id: '2', patient: patients[3], message: 'Missed heart medication 2 days in a row', type: 'medication', urgency: 'critical', time: '34 min ago', acknowledged: false },
  { id: '3', patient: patients[5], message: 'Glucose trending up over 2 weeks', type: 'risk', urgency: 'moderate', time: '1 hr ago', acknowledged: false },
  { id: '4', patient: patients[1], message: 'Post-op pain score increased to 7/10', type: 'vitals', urgency: 'moderate', time: '2 hrs ago', acknowledged: false },
  { id: '5', patient: patients[0], message: 'A1C lab results ready for review', type: 'risk', urgency: 'moderate', time: '3 hrs ago', acknowledged: false },
  { id: '6', patient: patients[3], message: 'Irregular heartbeat detected by wearable', type: 'vitals', urgency: 'critical', time: '5 hrs ago', acknowledged: true },
]

const urgencyColor = { critical: '#dc2626', moderate: '#f59e0b' }
const typeIcon = { vitals: Heart, medication: Pill, risk: AlertTriangle }

export default function AlertsView() {
  const [alerts, setAlerts] = useState(initialAlerts)

  const acknowledge = (id: string) => {
    setAlerts(alerts.map((a) => a.id === id ? { ...a, acknowledged: true } : a))
  }

  const active = alerts.filter((a) => !a.acknowledged)
  const resolved = alerts.filter((a) => a.acknowledged)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', margin: 0 }}>Smart Alerts</h2>
        {active.length > 0 && (
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
            backgroundColor: '#fef2f2', color: '#dc2626',
          }}>
            {active.length} active
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {active.map((alert) => {
          const Icon = typeIcon[alert.type]
          return (
            <div key={alert.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 20px', borderRadius: 12,
              backgroundColor: '#fff', border: '1px solid #e5e7eb',
              borderLeft: `4px solid ${urgencyColor[alert.urgency]}`,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                backgroundColor: `${urgencyColor[alert.urgency]}10`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon size={20} color={urgencyColor[alert.urgency]} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>{alert.patient.name}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{alert.time}</span>
                </div>
                <p style={{ fontSize: 13, color: '#4b5563', margin: '3px 0 0' }}>{alert.message}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => acknowledge(alert.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 8,
                    border: '1px solid #e5e7eb', backgroundColor: '#fff',
                    cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#374151',
                  }}
                >
                  <Check size={14} /> Acknowledge
                </button>
                <button style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8,
                  border: 'none', backgroundColor: '#dc2626',
                  cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#fff',
                }}>
                  <Phone size={14} /> Call
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {resolved.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#9ca3af', margin: '28px 0 12px' }}>Acknowledged</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {resolved.map((alert) => {
              const Icon = typeIcon[alert.type]
              return (
                <div key={alert.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 20px', borderRadius: 12,
                  backgroundColor: '#f9fafb', border: '1px solid #f3f4f6',
                  opacity: 0.6,
                }}>
                  <Icon size={18} color="#9ca3af" />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500, fontSize: 13, color: '#6b7280' }}>{alert.patient.name}</span>
                    <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>{alert.message}</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#d1d5db' }}>{alert.time}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
