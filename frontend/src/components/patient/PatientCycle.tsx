import React, { useEffect, useMemo, useState } from 'react'

type PeriodEvent = {
  startDate: string // YYYY-MM-DD
  endDate?: string
  flow?: 'light' | 'medium' | 'heavy'
  notes?: string
}

type CycleStats = {
  median_cycle_length: number | null
  variability_days: number | null
  median_period_length: number | null
  confidence: 'low' | 'medium' | 'high'
}

type CyclePredictions = {
  next_period_start: string | null
  ovulation_date: string | null
}

import { getCyclePeriods, addCyclePeriod } from '../../api/client'

const LS_KEY = 'vitality_cycle_periods_v2'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #fbcfe8',
  background: '#fff',
  fontSize: 14,
  color: '#111827',
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString()
  } catch {
    return d
  }
}

export default function PatientCycle() {
  const [periods, setPeriods] = useState<PeriodEvent[]>([])
  const [stats, setStats] = useState<CycleStats>({
    median_cycle_length: null,
    variability_days: null,
    median_period_length: null,
    confidence: 'low',
  })
  const [preds, setPreds] = useState<CyclePredictions>({
    next_period_start: null,
    ovulation_date: null,
  })

  const [draft, setDraft] = useState<PeriodEvent>({ startDate: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const data = await getCyclePeriods()
        if (!cancelled && data?.status === 'success') {
          setPeriods(data.periods || [])
          setStats(data.stats || stats)
          setPreds(data.predictions || preds)
          localStorage.setItem(LS_KEY, JSON.stringify({ periods: data.periods || [] }))
          setLoading(false)
          return
        }
      } catch {
        // backend unavailable; fallback to local
      }

      // local fallback
      try {
        const raw = localStorage.getItem(LS_KEY)
        const parsed = raw ? JSON.parse(raw) : null
        if (!cancelled) setPeriods(parsed?.periods || [])
      } catch {
        if (!cancelled) setPeriods([])
      }

      if (!cancelled) {
        setLoading(false)
        setError('Backend unavailable — using local cycle history')
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const computed = useMemo(() => {
    if (!periods.length) return null

    const periodsSorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate))
    const last = periodsSorted[periodsSorted.length - 1]
    if (!last?.startDate) return null

    const cycleLength = stats.median_cycle_length ? Math.round(stats.median_cycle_length) : 28

    const start = new Date(last.startDate + 'T00:00:00')
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const day = ((diffDays % cycleLength) + cycleLength) % cycleLength + 1
    const progress = (day - 1) / cycleLength

    const periodLength = stats.median_period_length ? Math.round(stats.median_period_length) : 5
    const ovulationDayApprox = cycleLength - 14

    let phase: 'Menstrual' | 'Follicular' | 'Ovulation' | 'Luteal' = 'Follicular'
    if (day <= periodLength) phase = 'Menstrual'
    else if (day >= ovulationDayApprox - 1 && day <= ovulationDayApprox + 1) phase = 'Ovulation'
    else if (day > ovulationDayApprox + 1) phase = 'Luteal'

    const phaseInfo: Record<typeof phase, { subtitle: string; symptoms: string[] }> = {
      Menstrual: {
        subtitle: 'Shedding the uterine lining. Energy may dip; cramps can be more common.',
        symptoms: ['cramping', 'fatigue', 'bloating', 'lower back pain', 'headache'],
      },
      Follicular: {
        subtitle: 'Estrogen rises. Many people feel steadier energy and mood.',
        symptoms: ['lighter symptoms', 'improving energy', 'better focus', 'less bloating'],
      },
      Ovulation: {
        subtitle: 'Ovulation window. Some people notice one-sided pelvic pain or increased discharge.',
        symptoms: ['one-sided pelvic twinges', 'increased discharge', 'mild bloating', 'libido changes'],
      },
      Luteal: {
        subtitle: 'Progesterone rises. PMS-type symptoms may increase for some.',
        symptoms: ['breast tenderness', 'mood changes', 'bloating', 'acne', 'sleep changes'],
      },
    }

    return {
      day,
      cycleLength,
      phase,
      progress,
      phaseSubtitle: phaseInfo[phase].subtitle,
      phaseSymptoms: phaseInfo[phase].symptoms,
    }
  }, [periods, stats.median_cycle_length, stats.median_period_length])

  const ringBackground = useMemo(() => {
    if (!computed) return 'conic-gradient(#fbcfe8 0deg, #fbcfe8 360deg)'
    const deg = Math.round(computed.progress * 360)
    return `conic-gradient(#ec4899 0deg ${deg}deg, #fbcfe8 ${deg}deg 360deg)`
  }, [computed])

  const addPeriod = async () => {
    if (!draft.startDate) return
    setError(null)

    const optimistic = [...periods, { ...draft }].sort((a, b) => a.startDate.localeCompare(b.startDate))
    setPeriods(optimistic)
    localStorage.setItem(LS_KEY, JSON.stringify({ periods: optimistic }))

    try {
      const data = await addCyclePeriod(draft)
      if (data?.status === 'success') {
        setPeriods(data.periods || optimistic)
        setStats(data.stats || stats)
        setPreds(data.predictions || preds)
        localStorage.setItem(LS_KEY, JSON.stringify({ periods: data.periods || optimistic }))
      }
    } catch {
      setError('Saved locally — backend unavailable')
    }

    setDraft({ startDate: '' })
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Cycle</h2>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px', maxWidth: 680 }}>
        Log periods over time — Vitality learns your typical cycle length and variability, then forecasts your next cycle phase.
      </p>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #fbcfe8', padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Period history
          </p>
          <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>
            {loading ? 'Loading…' : `${periods.length} logged`}
          </p>
        </div>

        {periods.length === 0 && !loading ? (
          <p style={{ margin: '10px 0 0', fontSize: 13, color: '#6b7280' }}>No periods logged yet.</p>
        ) : (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[...periods]
              .sort((a, b) => b.startDate.localeCompare(a.startDate))
              .slice(0, 10)
              .map((p) => (
                <span
                  key={p.startDate}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: '#fdf2f8',
                    border: '1px solid #fbcfe8',
                    fontSize: 12,
                    color: '#be185d',
                    fontWeight: 700,
                  }}
                >
                  {p.startDate}
                  {p.flow ? ` • ${p.flow}` : ''}
                </span>
              ))}
          </div>
        )}

        {error && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#ef4444' }}>{error}</p>}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #fbcfe8', padding: 14, marginBottom: 14 }}>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Add a period
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <label>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>Start</p>
            <input
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
              style={inputStyle}
            />
          </label>

          <label>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>End (optional)</p>
            <input
              type="date"
              value={draft.endDate || ''}
              onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value || undefined }))}
              style={inputStyle}
            />
          </label>

          <label>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>Flow (optional)</p>
            <select
              value={draft.flow || ''}
              onChange={(e) => setDraft((d) => ({ ...d, flow: (e.target.value || undefined) as any }))}
              style={{ ...inputStyle, height: 42 }}
            >
              <option value="">—</option>
              <option value="light">Light</option>
              <option value="medium">Medium</option>
              <option value="heavy">Heavy</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
          <button
            onClick={addPeriod}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #fbcfe8',
              background: '#ec4899',
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Add
          </button>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>Add at least 2 periods to personalize predictions.</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            aria-label="Cycle progress ring"
            style={{
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: ringBackground,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
              border: '1px solid #fbcfe8',
            }}
          >
            <div
              style={{
                width: 170,
                height: 170,
                borderRadius: '50%',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                border: '1px solid #fbcfe8',
              }}
            >
              <div style={{ fontSize: 40, fontWeight: 900, color: '#be185d', lineHeight: 1 }}>
                {computed ? computed.day : '—'}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
                {computed ? `day of ${computed.cycleLength}` : 'add a period to start'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #fbcfe8', padding: 14 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Phase & guidance
          </p>

          <h3 style={{ margin: '10px 0 6px', color: '#111827', fontSize: 18 }}>
            {computed ? computed.phase : 'Add a period to begin'}
          </h3>

          <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
            {computed ? computed.phaseSubtitle : 'Vitality will estimate your phase and learn patterns as you log more cycles.'}
          </p>

          {computed && (
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {computed.phaseSymptoms.map((s) => (
                <span
                  key={s}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: '#fdf2f8',
                    border: '1px solid #fbcfe8',
                    fontSize: 12,
                    color: '#be185d',
                    fontWeight: 700,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14, background: '#fff', borderRadius: 12, border: '1px solid #fbcfe8', padding: 14 }}>
        <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Forecast
        </p>

        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div style={{ padding: 12, borderRadius: 12, border: '1px solid #fbcfe8', background: '#fdf2f8' }}>
            <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Ovulation</p>
            <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 800, color: '#111827' }}>{fmtDate(preds.ovulation_date)}</p>
          </div>

          <div style={{ padding: 12, borderRadius: 12, border: '1px solid #fbcfe8', background: '#fdf2f8' }}>
            <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Next period</p>
            <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 800, color: '#111827' }}>{fmtDate(preds.next_period_start)}</p>
          </div>

          <div style={{ padding: 12, borderRadius: 12, border: '1px solid #fbcfe8', background: '#fdf2f8' }}>
            <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Personalization</p>
            <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 900, color: '#111827' }}>
              {stats.confidence.toUpperCase()}
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9ca3af' }}>
              {stats.variability_days !== null ? `variability ±${stats.variability_days}d` : 'add 2+ cycles'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}