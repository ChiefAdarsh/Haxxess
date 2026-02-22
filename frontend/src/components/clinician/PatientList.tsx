import { patients } from '../../config/patients'
import type { Patient } from '../../config/patients'

const urgencyColor = {
  critical: '#be185d', // Deep Rose
  moderate: '#f59e0b', // Amber
  stable: '#10b981',   // Emerald
}

const urgencyBgColor = {
  critical: '#fdf2f8', // Soft pink background
  moderate: '#fffbeb', // Soft amber background
  stable: '#f0fdf4',   // Soft emerald background
}

const urgencyLabel = {
  critical: 'Alert',
  moderate: 'Elevated Risk',
  stable: 'Stable',
}

interface PatientListProps {
  onSelectPatient: (patient: Patient) => void
}

export default function PatientList({ onSelectPatient }: PatientListProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>Patient Roster</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0', fontWeight: 500 }}>
            Active monitoring across {patients.length} patients
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
        {patients.map((p) => {
          const isCritical = p.urgency === 'critical'
          return (
            <button
              key={p.id}
              onClick={() => onSelectPatient(p)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '32px 24px',
                borderRadius: 20,
                border: isCritical ? '1px solid #fbcfe8' : '1px solid #f1f5f9',
                backgroundColor: isCritical ? '#fffbfe' : '#fff',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.02)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = isCritical ? '#f9a8d4' : '#e2e8f0'
                e.currentTarget.style.boxShadow = isCritical
                  ? '0 12px 24px -4px rgba(190, 24, 93, 0.1)'
                  : '0 12px 24px -4px rgba(0,0,0,0.05)'
                e.currentTarget.style.transform = 'translateY(-4px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isCritical ? '#fbcfe8' : '#f1f5f9'
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.02)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {/* Subtle top gradient bar for critical patients */}
              {isCritical && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 4,
                  background: 'linear-gradient(90deg, #be185d 0%, #db2777 100%)'
                }} />
              )}

              {/* Avatar Ring */}
              <div style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                border: `3px solid ${urgencyColor[p.urgency]}`,
                backgroundColor: urgencyBgColor[p.urgency],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 24,
                color: urgencyColor[p.urgency],
                marginBottom: 16,
                boxShadow: isCritical ? `0 0 20px ${urgencyColor.critical}20` : 'none',
                animation: isCritical ? 'aura-pulse 2.5s ease-in-out infinite' : 'none',
              }}>
                {p.name.split(' ').map(n => n[0]).join('')}
              </div>

              {/* Info Block */}
              <span style={{ fontWeight: 700, fontSize: 18, color: '#1e293b', marginBottom: 4, letterSpacing: '-0.01em' }}>
                {p.name}
              </span>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500, marginBottom: 16 }}>
                {p.age} yrs &middot; {p.condition}
              </span>

              {/* Status Badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 20,
                backgroundColor: urgencyBgColor[p.urgency], color: urgencyColor[p.urgency],
                textTransform: 'uppercase', letterSpacing: '0.05em',
                marginBottom: 24
              }}>
                {urgencyLabel[p.urgency]}
              </div>

              {/* Footer row */}
              <div style={{
                width: '100%', borderTop: '1px solid #f1f5f9',
                paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Last Contact
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
                  {p.lastVisit}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <style>{`
        @keyframes aura-pulse {
          0% { box-shadow: 0 0 0 0 rgba(190, 24, 93, 0.2); }
          70% { box-shadow: 0 0 0 15px rgba(190, 24, 93, 0); }
          100% { box-shadow: 0 0 0 0 rgba(190, 24, 93, 0); }
        }
      `}</style>
    </div>
  )
}
