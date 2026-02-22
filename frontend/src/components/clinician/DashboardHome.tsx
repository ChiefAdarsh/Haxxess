import { useState, useEffect } from 'react'
import { AlertTriangle, Users, Clock, Activity, Sparkles, Wifi, WifiOff } from 'lucide-react'
import { triageLevelConfig } from '../../engine/triage'
import { patients } from '../../config/patients'
import { getStatus, getSmartAlert } from '../../api/client'
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
  const [backendStatus, setBackendStatus] = useState<'connecting' | 'online' | 'offline'>('connecting')
  const [liveAlert, setLiveAlert] = useState<any>(null)

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const [status, alert] = await Promise.all([getStatus(), getSmartAlert()])
        if (cancelled) return
        setBackendStatus('online')
        setLiveAlert(alert?.data || null)
      } catch {
        if (!cancelled) setBackendStatus('offline')
      }
    }
    check()
    const interval = setInterval(check, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>
            Welcome Dr. See
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0', fontWeight: 500 }}>
            Vitality has flagged {triageCases.filter(c => c.level === 'emergency').length} critical cases requiring your attention.
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 10,
          backgroundColor: backendStatus === 'online' ? '#f0fdf4' : backendStatus === 'offline' ? '#fef2f2' : '#f8fafc',
          border: `1px solid ${backendStatus === 'online' ? '#bbf7d0' : backendStatus === 'offline' ? '#fecaca' : '#e2e8f0'}`,
        }}>
          {backendStatus === 'online'
            ? <Wifi size={14} color="#10b981" />
            : <WifiOff size={14} color={backendStatus === 'offline' ? '#ef4444' : '#94a3b8'} />
          }
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: backendStatus === 'online' ? '#15803d' : backendStatus === 'offline' ? '#991b1b' : '#64748b',
          }}>
            {backendStatus === 'online' ? 'Backend Live' : backendStatus === 'offline' ? 'Backend Offline' : 'Connecting...'}
          </span>
        </div>
      </div>

      {liveAlert && (
        <div style={{
          padding: '14px 20px', borderRadius: 12, marginBottom: 20,
          backgroundColor: liveAlert.severity === 'critical' ? '#fef2f2' : '#fffbeb',
          border: `1px solid ${liveAlert.severity === 'critical' ? '#fecaca' : '#fde68a'}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <AlertTriangle size={18} color={liveAlert.severity === 'critical' ? '#dc2626' : '#f59e0b'} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{liveAlert.title || 'AI Alert'}</span>
            <span style={{ fontSize: 12, color: '#64748b', marginLeft: 10 }}>{liveAlert.message || liveAlert.summary || ''}</span>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
            backgroundColor: '#be185d', color: '#fff', textTransform: 'uppercase',
          }}>live</span>
        </div>
      )}

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
