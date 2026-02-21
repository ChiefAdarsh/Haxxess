import { patients } from '../../config/patients'
import type { Patient } from '../../config/patients'

const urgencyColor = {
  critical: '#dc2626',
  moderate: '#f59e0b',
  stable: '#10b981',
}

const urgencyLabel = {
  critical: 'Critical',
  moderate: 'Moderate',
  stable: 'Stable',
}

interface PatientListProps {
  onSelectPatient: (patient: Patient) => void
}

export default function PatientList({ onSelectPatient }: PatientListProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', margin: 0 }}>All Patients</h2>
        <span style={{ fontSize: 13, color: '#6b7280' }}>{patients.length} patients</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {patients.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelectPatient(p)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '16px 20px',
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              backgroundColor: '#fff',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#d1d5db' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb' }}
          >
            {/* avatar with urgency ring */}
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              border: `3px solid ${urgencyColor[p.urgency]}`,
              backgroundColor: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: 16,
              color: '#4b5563',
              flexShrink: 0,
              boxShadow: p.urgency === 'critical' ? `0 0 10px ${urgencyColor[p.urgency]}40` : 'none',
              animation: p.urgency === 'critical' ? 'pulse-ring 2s ease-in-out infinite' : 'none',
            }}>
              {p.name.split(' ').map(n => n[0]).join('')}
            </div>

            {/* info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>{p.name}</span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 20,
                  backgroundColor: `${urgencyColor[p.urgency]}15`,
                  color: urgencyColor[p.urgency],
                }}>
                  {urgencyLabel[p.urgency]}
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
                {p.condition} &middot; Age {p.age}
              </p>
            </div>

            {/* last visit */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>last visit</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#4b5563', margin: '2px 0 0' }}>{p.lastVisit}</p>
            </div>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 4px #dc262640; }
          50% { box-shadow: 0 0 14px #dc262660; }
        }
      `}</style>
    </div>
  )
}
