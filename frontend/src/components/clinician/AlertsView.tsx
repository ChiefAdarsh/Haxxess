import { useState } from 'react'
import { Phone, Check, Activity, Droplets, Thermometer, BrainCircuit, Sparkles } from 'lucide-react'
import { patients } from '../../config/patients'
import { triageLevelConfig } from '../../engine/triage'
import type { TriageLevel } from '../../types'

interface Alert {
  id: string
  patient: typeof patients[0]
  message: string
  level: TriageLevel
  icon: 'vitals' | 'bleeding' | 'temp' | 'voice'
  time: string
  acknowledged: boolean
}

const initialAlerts: Alert[] = [
  { id: '1', patient: patients[0], message: 'Acoustic vocal tremor + Heavy bleeding, soaking pad in 2 hours', level: 'emergency', icon: 'voice', time: '12 min ago', acknowledged: false },
  { id: '2', patient: patients[3], message: 'Oura Temp spike + Severe right-sided pelvic pain with nausea', level: 'emergency', icon: 'temp', time: '34 min ago', acknowledged: false },
  { id: '3', patient: patients[5], message: 'HRV dropped 30% below baseline with reported pelvic pressure', level: 'same_day', icon: 'vitals', time: '1 hr ago', acknowledged: false },
  { id: '4', patient: patients[1], message: 'Burning with urination, suprapubic pressure 7/10', level: 'same_day', icon: 'vitals', time: '2 hrs ago', acknowledged: false },
  { id: '5', patient: patients[2], message: 'Pain pattern shifted from diffuse to right-sided over 6 hrs', level: 'same_day', icon: 'vitals', time: '3 hrs ago', acknowledged: false },
  { id: '6', patient: patients[4], message: 'Mild cramping resolved after rest (Vitality Index stable)', level: 'self_care', icon: 'vitals', time: '5 hrs ago', acknowledged: true },
]

const iconMap = {
  vitals: Activity,
  bleeding: Droplets,
  temp: Thermometer,
  voice: BrainCircuit
}

export default function AlertsView() {
  const [alerts, setAlerts] = useState(initialAlerts)

  const acknowledge = (id: string) => {
    setAlerts(alerts.map((a) => a.id === id ? { ...a, acknowledged: true } : a))
  }

  const active = alerts.filter((a) => !a.acknowledged)
  const resolved = alerts.filter((a) => a.acknowledged)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>Vitality Live Alerts</h2>
            {active.length > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                backgroundColor: '#fdf2f8', color: '#be185d', border: '1px solid #fbcfe8',
                display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.05em', textTransform: 'uppercase'
              }}>
                <Sparkles size={12} /> {active.length} Active Flags
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0', fontWeight: 500 }}>
            Continuous telemetry and AI triage notifications
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {active.map((alert) => {
          const Icon = iconMap[alert.icon]
          const cfg = triageLevelConfig[alert.level]
          const isCritical = alert.level === 'emergency'

          return (
            <div key={alert.id} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '20px 24px', borderRadius: 16,
              backgroundColor: isCritical ? '#fffbfe' : '#fff',
              border: isCritical ? '1px solid #fbcfe8' : '1px solid #f1f5f9',
              borderLeft: `4px solid ${isCritical ? '#be185d' : cfg.color}`,
              boxShadow: isCritical ? '0 8px 24px -4px rgba(190, 24, 93, 0.1)' : '0 4px 6px -1px rgba(0,0,0,0.02)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(4px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(0)' }}
            >
              {/* Alert Icon */}
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                backgroundColor: isCritical ? '#fdf2f8' : cfg.bg,
                border: `1px solid ${isCritical ? '#fbcfe8' : 'transparent'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon size={24} color={isCritical ? '#be185d' : cfg.color} />
              </div>

              {/* Alert Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', letterSpacing: '-0.01em' }}>{alert.patient.name}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                    backgroundColor: isCritical ? '#be185d' : cfg.bg,
                    color: isCritical ? '#fff' : cfg.color,
                    textTransform: 'uppercase', letterSpacing: '0.05em'
                  }}>
                    {cfg.label}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>{alert.time}</span>
                </div>
                <p style={{ fontSize: 14, color: '#475569', margin: '6px 0 0', fontWeight: 500, lineHeight: 1.4 }}>{alert.message}</p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                <button onClick={() => acknowledge(alert.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 16px', borderRadius: 10,
                  border: '1px solid #e2e8f0', backgroundColor: '#fff',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)', transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                >
                  <Check size={16} /> Ack
                </button>
                <button style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 18px', borderRadius: 10, border: 'none',
                  background: isCritical ? 'linear-gradient(135deg, #be185d 0%, #db2777 100%)' : '#3b82f6',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff',
                  boxShadow: isCritical ? '0 4px 12px rgba(190, 24, 93, 0.25)' : '0 4px 12px rgba(59, 130, 246, 0.25)',
                  transition: 'transform 0.15s, box-shadow 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = isCritical ? '0 6px 16px rgba(190, 24, 93, 0.35)' : '0 6px 16px rgba(59, 130, 246, 0.35)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = isCritical ? '0 4px 12px rgba(190, 24, 93, 0.25)' : '0 4px 12px rgba(59, 130, 246, 0.25)'
                }}
                >
                  <Phone size={16} /> Urgent Call
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Acknowledged/Resolved Alerts Section */}
      {resolved.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>
            Acknowledged Flags
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {resolved.map((alert) => {
              const Icon = iconMap[alert.icon]
              return (
                <div key={alert.id} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px 24px', borderRadius: 12,
                  backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', opacity: 0.7,
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, backgroundColor: '#f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <Icon size={18} color="#94a3b8" />
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#64748b', width: 140 }}>{alert.patient.name}</span>
                    <span style={{ fontSize: 13, color: '#94a3b8', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{alert.message}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>{alert.time}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
