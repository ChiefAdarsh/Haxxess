import { useState, useEffect } from 'react'
import { ArrowLeft, Phone, FlaskConical, FileText, Calendar, BrainCircuit, Activity, AlertTriangle } from 'lucide-react'
import type { Patient } from '../../config/patients'

const urgencyColor = {
  critical: '#dc2626',
  moderate: '#f59e0b',
  stable: '#10b981',
}

const actionBtn = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  backgroundColor: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
  transition: 'all 0.15s',
  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
}

interface PatientDetailProps {
  patient: Patient
  onBack: () => void
}

export default function PatientDetail({ patient, onBack }: PatientDetailProps) {
  // Store live backend data
  const [liveData, setLiveData] = useState<any>(null)
  const [forecastData, setForecastData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        // Fetch both the live sensor fusion and the 72-hour LLM forecast
        const [vitRes, foreRes] = await Promise.all([
          fetch('http://localhost:8000/consolidated').then(r => r.json()),
          fetch('http://localhost:8000/intelligence/forecast').then(r => r.json())
        ])

        if (vitRes.status === 'success') setLiveData(vitRes)
        if (foreRes.status === 'success') setForecastData(foreRes.data)
      } catch (err) {
        console.error("Failed to fetch patient intelligence data", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Derive the display score (fallback to a dummy score if backend isn't running)
  const score = liveData ? Math.round(liveData.vitality_index) : 75
  const scoreColor = score >= 80 ? '#10b981' : score >= 55 ? '#f59e0b' : '#dc2626'
  const flags = liveData?.flags || []

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          border: 'none', backgroundColor: 'transparent',
          cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 500,
          marginBottom: 16, padding: 0, transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#0f172a'}
        onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
      >
        <ArrowLeft size={16} /> Back to patients
      </button>

      {/* Patient Header with Live Score */}
      <div style={{
        backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e5e7eb',
        padding: '24px', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 32,
            border: `3px solid ${urgencyColor[patient.urgency]}`,
            backgroundColor: '#f8fafc',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 20, color: '#334155',
          }}>
            {patient.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>{patient.name}</h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0', fontWeight: 500 }}>
              Age {patient.age} &middot; {patient.condition}
            </p>
          </div>
        </div>

        {/* The Live Vitality Badge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Live Fused Vitality
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {loading ? (
              <span style={{ fontSize: 14, color: '#94a3b8' }}>Analyzing...</span>
            ) : (
              <>
                <span style={{ fontSize: 32, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{score}</span>
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
                  backgroundColor: `${scoreColor}15`, color: scoreColor, textTransform: 'uppercase'
                }}>
                  {liveData?.tier?.label || patient.urgency}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        <button style={actionBtn}>
          <Phone size={16} color="#dc2626" /> Call Patient
        </button>
        <button style={actionBtn}>
          <FlaskConical size={16} color="#be185d" /> Request Lab Report
        </button>
        <button style={actionBtn}>
          <FileText size={16} color="#2563eb" /> View Clinical Notes
        </button>
        <button style={actionBtn}>
          <Calendar size={16} color="#059669" /> Schedule Visit
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* LEFT COLUMN: The AI Predictive Forecast (HACKATHON WINNER) */}
        <div style={{
          backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '24px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BrainCircuit size={18} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: 0 }}>Vitality 72-Hour Risk Forecast</h3>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Powered by Stochastic LLM Modeling</p>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Generating stochastic forecast...</div>
          ) : forecastData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {forecastData.forecast?.map((f: any, i: number) => (
                <div key={i} style={{
                  display: 'flex', gap: 14, padding: '16px', borderRadius: 12,
                  backgroundColor: '#f8fafc', borderLeft: `4px solid ${f.predicted_score < 60 ? '#dc2626' : f.predicted_score < 75 ? '#f59e0b' : '#10b981'}`
                }}>
                  <div style={{ width: 40, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block' }}>+{f.hour}h</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#334155' }}>{f.predicted_score}</span>
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', margin: '0 0 4px' }}>{f.risk_factor}</p>
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0, fontStyle: 'italic' }}>
                      <strong style={{ color: '#be185d' }}>Intervention:</strong> {f.recommended_intervention}
                    </p>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right', fontStyle: 'italic' }}>
                {forecastData.confidence_note}
              </div>
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No forecast available.</div>
          )}
        </div>

        {/* RIGHT COLUMN: Live Sensor Fusion & Active Flags */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div style={{
            backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={18} color="#2563eb" />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: 0 }}>Active Clinical Flags</h3>
            </div>

            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Scanning telemetry...</div>
            ) : flags.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {flags.map((flag: string, i: number) => {
                  const isCritical = flag.includes('⚠') || flag.toLowerCase().includes('critical')
                  return (
                    <div key={i} style={{
                      padding: '12px 16px', borderRadius: 8,
                      backgroundColor: isCritical ? '#fef2f2' : '#fffbeb',
                      border: `1px solid ${isCritical ? '#fecaca' : '#fef3c7'}`,
                      display: 'flex', alignItems: 'flex-start', gap: 10
                    }}>
                      <AlertTriangle size={16} color={isCritical ? '#dc2626' : '#f59e0b'} style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: isCritical ? '#991b1b' : '#92400e', fontWeight: 500, lineHeight: 1.4 }}>
                        {flag.replace('⚠', '').trim()}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ padding: '20px', borderRadius: 8, backgroundColor: '#f0fdf4', border: '1px solid #dcfce7', color: '#166534', fontSize: 13, fontWeight: 500, textAlign: 'center' }}>
                All telemetry within normal limits. No active flags.
              </div>
            )}
          </div>

          {/* EMR Context (Kept to show it's a real portal) */}
          <div style={{
            backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 16px', letterSpacing: '0.05em' }}>
              Recent EMR Notes
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ paddingBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', margin: '0 0 4px', textTransform: 'uppercase' }}>Feb 20 • Clinical Visit</p>
                <p style={{ fontSize: 13, color: '#334155', margin: 0, lineHeight: 1.5 }}>Patient reported increased pelvic pain and fatigue. Adjusted pain management protocol; requested continuous Vitality telemetry tracking.</p>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', margin: '0 0 4px', textTransform: 'uppercase' }}>Feb 14 • Lab Review</p>
                <p style={{ fontSize: 13, color: '#334155', margin: 0, lineHeight: 1.5 }}>Hormone panel reviewed. Progesterone levels lower than expected for luteal phase.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
