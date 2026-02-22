import { useState, useEffect } from 'react'
import { useSymptoms } from '../../context/SymptomContext'
import { getConsolidated, getSmartAlert } from '../../api/client'
import { Activity, MapPin, Calendar, Shield, AlertTriangle, Loader2 } from 'lucide-react'
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
  const { getRecent, maxSeverityByRegion } = useSymptoms()
  const recent7 = getRecent(7)
  const severityMap = maxSeverityByRegion()

  const [vitality, setVitality] = useState<any>(null)
  const [alert, setAlert] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [vRes, aRes] = await Promise.all([getConsolidated(), getSmartAlert()])
        if (cancelled) return
        setVitality(vRes)
        setAlert(aRes)
      } catch {
        // backend may not be running
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // most affected region
  const regionCounts: Partial<Record<BodyRegion, number>> = {}
  for (const s of recent7) {
    regionCounts[s.region] = (regionCounts[s.region] || 0) + 1
  }
  const topRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0]

  // cycle info (from Cycle tab localStorage)
  const cycleInfo = (() => {
    try {
      const raw = localStorage.getItem('vitality_cycle_profile_v1')
      if (!raw) return { day: null as number | null, length: 28 }
      const p = JSON.parse(raw)
      const last = p.lastPeriodStart as string | undefined
      const length = Math.max(20, Math.min(45, Number(p.cycleLength || 28)))
      if (!last) return { day: null as number | null, length }
      const start = new Date(last + 'T00:00:00')
      const now = new Date()
      const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      const day = ((diffDays % length) + length) % length + 1
      return { day, length }
    } catch {
      return { day: null as number | null, length: 28 }
    }
  })()

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', margin: '0 0 20px' }}>Patient Dashboard</h2>

      {/* vitality index + alert from backend */}
      {loading ? (
        <div style={{
          backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
          padding: '24px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <Loader2 size={18} color="#9ca3af" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13, color: '#9ca3af' }}>connecting to vitality backend...</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : vitality ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
            padding: '20px', display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 28,
              background: `conic-gradient(${vitality.vitality_index >= 60 ? '#10b981' : vitality.vitality_index >= 35 ? '#f59e0b' : '#dc2626'} ${vitality.vitality_index}%, #f3f4f6 0)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 18, color: '#1f2937',
              }}>
                {vitality.vitality_index}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>vitality index</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#1f2937', margin: '2px 0 0' }}>
                {vitality.tier?.label || 'Unknown'}
              </p>
              <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>
                {vitality.tier?.action || ''}
              </p>
            </div>
          </div>

          {alert?.data ? (
            <div style={{
              backgroundColor: alert.data.severity === 'critical' ? '#fef2f2' : '#fffbeb',
              borderRadius: 12,
              border: `1px solid ${alert.data.severity === 'critical' ? '#fecaca' : '#fde68a'}`,
              padding: '20px', display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <AlertTriangle size={20} color={alert.data.severity === 'critical' ? '#dc2626' : '#f59e0b'} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', margin: '0 0 4px' }}>
                  {alert.data.title || 'Alert'}
                </p>
                <p style={{ fontSize: 12, color: '#4b5563', margin: 0, lineHeight: 1.4 }}>
                  {alert.data.message || alert.data.summary || 'check your vitals'}
                </p>
              </div>
            </div>
          ) : (
            <div style={{
              backgroundColor: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0',
              padding: '20px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <Shield size={20} color="#10b981" />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#15803d', margin: 0 }}>all clear</p>
                <p style={{ fontSize: 12, color: '#4b5563', margin: '2px 0 0' }}>no active alerts</p>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* stat cards */}
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
            <p style={{ fontSize: 22, fontWeight: 700, color: '#1f2937', margin: '2px 0 0' }}>
              {cycleInfo.day ?? '—'}
            </p>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
              {cycleInfo.day ? `of ${cycleInfo.length}-day cycle` : 'set in Cycle tab'}
            </p>
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
