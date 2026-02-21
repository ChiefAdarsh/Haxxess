import { MessageCircle, Calendar, ClipboardList, Stethoscope } from 'lucide-react'

const healthScore = 74

function ScoreRing({ score }: { score: number }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#dc2626'

  return (
    <svg width="130" height="130" viewBox="0 0 130 130">
      <circle cx="65" cy="65" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="10" />
      <circle
        cx="65" cy="65" r={radius} fill="none" stroke={color} strokeWidth="10"
        strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
        transform="rotate(-90 65 65)"
      />
      <text x="65" y="60" textAnchor="middle" fontSize="28" fontWeight="700" fill="#1f2937">{score}</text>
      <text x="65" y="78" textAnchor="middle" fontSize="11" fill="#9ca3af">health score</text>
    </svg>
  )
}

export default function PatientHome() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{
          backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
          padding: '24px', display: 'flex', alignItems: 'center', gap: 20,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef2f2',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Stethoscope size={28} color="#dc2626" />
          </div>
          <div>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 2px' }}>Your Concierge Doctor</p>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', margin: '0 0 4px' }}>Dr. Sarah Mitchell</p>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Internal Medicine</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
              <span style={{ fontSize: 12, color: '#10b981', fontWeight: 500 }}>Available now</span>
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
          padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ScoreRing score={healthScore} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Message Doctor', icon: MessageCircle, color: '#dc2626' },
          { label: 'Schedule Visit', icon: Calendar, color: '#2563eb' },
          { label: 'Log Symptoms', icon: ClipboardList, color: '#7c3aed' },
        ].map((action) => {
          const Icon = action.icon
          return (
            <button key={action.label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '16px', borderRadius: 12, border: '1px solid #e5e7eb',
              backgroundColor: '#fff', cursor: 'pointer', fontSize: 14,
              fontWeight: 500, color: '#374151', transition: 'all 0.15s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#d1d5db' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb' }}
            >
              <Icon size={18} color={action.color} />
              {action.label}
            </button>
          )
        })}
      </div>

      <div style={{
        backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', margin: '0 0 14px' }}>Upcoming</h3>
        <div style={{
          padding: '16px', borderRadius: 10, backgroundColor: '#fef2f2',
          border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <Calendar size={20} color="#dc2626" />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', margin: 0 }}>Check-up with Dr. Mitchell</p>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '3px 0 0' }}>Tuesday, Feb 24 at 10:30 AM</p>
          </div>
        </div>
      </div>
    </div>
  )
}
