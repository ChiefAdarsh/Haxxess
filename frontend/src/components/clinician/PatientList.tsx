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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
        {patients.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelectPatient(p)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '44px 28px 32px',
              borderRadius: 16,
              border: '1px solid #e5e7eb',
              backgroundColor: '#fff',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s',
              minHeight: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb'
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.transform = 'none'
            }}
          >
            {/* avatar */}
            <div style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              border: `4px solid ${urgencyColor[p.urgency]}`,
              backgroundColor: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 30,
              color: '#4b5563',
              marginBottom: 20,
              boxShadow: p.urgency === 'critical' ? `0 0 12px ${urgencyColor[p.urgency]}40` : 'none',
              animation: p.urgency === 'critical' ? 'pulse-ring 2s ease-in-out infinite' : 'none',
            }}>
              {p.name.split(' ').map(n => n[0]).join('')}
            </div>

            {/* name centered */}
            <span style={{ fontWeight: 600, fontSize: 18, color: '#1f2937', marginBottom: 10 }}>{p.name}</span>

            {/* details left aligned */}
            <div style={{ width: '100%', textAlign: 'left' }}>
              <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 6px' }}>{p.condition}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#9ca3af' }}>Age {p.age}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                  backgroundColor: `${urgencyColor[p.urgency]}15`, color: urgencyColor[p.urgency],
                }}>
                  {urgencyLabel[p.urgency]}
                </span>
              </div>
            </div>

            {/* footer */}
            <div style={{
              width: '100%', borderTop: '1px solid #f3f4f6',
              marginTop: 16, paddingTop: 14,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>last visit</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#4b5563' }}>{p.lastVisit}</span>
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
