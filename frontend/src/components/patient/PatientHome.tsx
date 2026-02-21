import { useSymptoms } from '../../context/SymptomContext'
import { triageSymptoms, triageLevelConfig } from '../../engine/triage'
import { AlertTriangle, Activity, MapPin, Calendar } from 'lucide-react'
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
  const { symptoms, getRecent, maxSeverityByRegion } = useSymptoms()
  const recent7 = getRecent(7)
  const recent24 = getRecent(1)
  const triage = triageSymptoms(recent24)
  const cfg = triageLevelConfig[triage.level]
  const severityMap = maxSeverityByRegion()

  // most affected region
  const regionCounts: Partial<Record<BodyRegion, number>> = {}
  for (const s of recent7) {
    regionCounts[s.region] = (regionCounts[s.region] || 0) + 1
  }
  const topRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0]

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', margin: '0 0 20px' }}>Overview</h2>

      {/* triage status */}
      <div style={{
        backgroundColor: cfg.bg, borderRadius: 12, border: `1px solid ${cfg.color}30`,
        padding: '20px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 14,
      }}>
        <AlertTriangle size={22} color={cfg.color} style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: cfg.color, margin: '0 0 4px' }}>{cfg.label}</p>
          {triage.reasons.map((r, i) => (
            <p key={i} style={{ fontSize: 13, color: '#4b5563', margin: '2px 0' }}>{r}</p>
          ))}
        </div>
      </div>

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
            <p style={{ fontSize: 22, fontWeight: 700, color: '#1f2937', margin: '2px 0 0' }}>14</p>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>of 28-day cycle</p>
          </div>
        </div>
      </div>

      {/* region heatmap summary */}
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
