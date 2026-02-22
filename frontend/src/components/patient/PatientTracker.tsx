import { useMemo } from 'react'
import { useSymptoms } from '../../context/SymptomContext'
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

export default function PatientTracker() {
  // @ts-ignore
  const { getRecent } = useSymptoms()
  const recent7 = getRecent(7)

  const summary = useMemo(() => {
    const count = recent7.length
    const maxSeverity = count ? Math.max(...recent7.map((s: any) => s.severity ?? 0)) : 0

    const regionCounts: Partial<Record<BodyRegion, number>> = {}
    for (const s of recent7) regionCounts[s.region] = (regionCounts[s.region] || 0) + 1
    const topRegion = Object.entries(regionCounts).sort((a, b) => (b[1] as number) - (a[1] as number))[0]

    return {
      count,
      maxSeverity,
      topRegion: topRegion ? (topRegion[0] as BodyRegion) : null,
      topRegionCount: topRegion ? (topRegion[1] as number) : 0,
    }
  }, [recent7])

  const dailyMax = useMemo(() => {
    // Build last 7 days bars
    const map = new Map<string, number>()
    for (const s of recent7) {
      const d = new Date(s.timestamp ?? Date.now())
      d.setHours(0, 0, 0, 0)
      const key = d.toISOString()
      map.set(key, Math.max(map.get(key) ?? 0, s.severity ?? 0))
    }

    const out: { label: string; max: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString()
      out.push({
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        max: map.get(key) ?? 0,
      })
    }
    return out
  }, [recent7])

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', margin: '0 0 20px' }}>Symptom Tracker</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <Card title="Reports (7d)" value={String(summary.count)} />
        <Card title="Max severity" value={`${summary.maxSeverity}/10`} />
        <Card
          title="Top region"
          value={summary.topRegion ? regionLabels[summary.topRegion] : '—'}
          sub={summary.topRegion ? `${summary.topRegionCount} entries` : 'Log symptoms to see patterns'}
        />
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', margin: '0 0 14px' }}>7-day severity trend (daily max)</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 120 }}>
          {dailyMax.map((d) => (
            <div key={d.label} style={{ flex: 1, textAlign: 'center' }}>
              <div
                style={{
                  height: `${(d.max / 10) * 100}%`,
                  borderRadius: 10,
                  background: 'rgba(0,0,0,0.12)',
                }}
                title={`${d.label}: ${d.max}/10`}
              />
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{d.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', margin: '0 0 14px' }}>Recent reports</h3>
        {recent7.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>No reports logged yet — use the Body Map to create your first report.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {recent7.slice(0, 10).map((s: any, idx: number) => (
              <div key={idx} style={{ padding: 12, borderRadius: 12, background: 'rgba(0,0,0,0.03)' }}>
                <div style={{ fontWeight: 600, color: '#1f2937' }}>
                  {regionLabels[s.region as BodyRegion] ?? s.region} • {s.severity}/10
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {new Date(s.timestamp ?? Date.now()).toLocaleString()}
                  {s.notes ? ` — ${s.notes}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Card({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 18 }}>
      <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{title}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: '#1f2937', margin: '6px 0 0' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  )
}