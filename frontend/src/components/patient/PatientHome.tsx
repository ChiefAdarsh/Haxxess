import { useSymptoms } from '../../context/SymptomContext'
import { Activity, MapPin, Calendar } from 'lucide-react'
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
  // @ts-ignore
  const { symptoms, getRecent, maxSeverityByRegion } = useSymptoms()
  const recent7 = getRecent(7)
  const severityMap = maxSeverityByRegion()

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

      {/* stat cards (FROM TEAMMATE) */}
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
