import { Heart, Droplets, Moon, TrendingUp, TrendingDown, Minus } from 'lucide-react'

const vitals = [
  {
    label: 'Heart Rate',
    value: '72',
    unit: 'bpm',
    trend: 'stable' as const,
    trendText: 'same as last week',
    icon: Heart,
    color: '#dc2626',
    history: [68, 71, 74, 70, 72, 69, 72],
  },
  {
    label: 'Blood Pressure',
    value: '128/84',
    unit: 'mmHg',
    trend: 'up' as const,
    trendText: '+6 from last week',
    icon: TrendingUp,
    color: '#f59e0b',
    history: [122, 124, 126, 125, 128, 127, 128],
  },
  {
    label: 'Blood Glucose',
    value: '105',
    unit: 'mg/dL',
    trend: 'down' as const,
    trendText: '-8 from last week',
    icon: Droplets,
    color: '#2563eb',
    history: [118, 115, 112, 110, 108, 106, 105],
  },
  {
    label: 'Sleep',
    value: '6.2',
    unit: 'hrs',
    trend: 'up' as const,
    trendText: '+0.5 from last week',
    icon: Moon,
    color: '#7c3aed',
    history: [5.5, 5.8, 6.0, 5.7, 6.1, 6.3, 6.2],
  },
]

const trendIcon = { up: TrendingUp, down: TrendingDown, stable: Minus }
const trendColor = { up: '#f59e0b', down: '#10b981', stable: '#9ca3af' }

function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 180
  const h = 50
  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`
  ).join(' ')

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function VitalsView() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', margin: 0 }}>My Vitals</h2>
        <span style={{ fontSize: 13, color: '#9ca3af' }}>Last synced: 5 min ago</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {vitals.map((v) => {
          const Icon = v.icon
          const TIcon = trendIcon[v.trend]
          return (
            <div key={v.label} style={{
              backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '22px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, backgroundColor: `${v.color}10`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={20} color={v.color} />
                  </div>
                  <div>
                    <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{v.label}</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 28, fontWeight: 700, color: '#1f2937' }}>{v.value}</span>
                      <span style={{ fontSize: 13, color: '#9ca3af' }}>{v.unit}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <TIcon size={14} color={trendColor[v.trend]} />
                  <span style={{ fontSize: 11, color: trendColor[v.trend] }}>{v.trendText}</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <MiniChart data={v.history} color={v.color} />
                <div style={{ display: 'flex', gap: 8 }}>
                  {days.map((d) => (
                    <span key={d} style={{ fontSize: 10, color: '#d1d5db' }}>{d}</span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
