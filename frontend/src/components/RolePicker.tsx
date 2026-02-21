import { HeartPulse, User, Stethoscope } from 'lucide-react'
import type { Role } from '../types'

function RoleCard({ label, subtitle, icon: Icon, onClick }: {
  label: string
  subtitle: string
  icon: React.ElementType
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 220,
        padding: '36px 24px',
        borderRadius: 16,
        border: '2px solid #e5e7eb',
        backgroundColor: '#fff',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#dc2626'
        e.currentTarget.style.boxShadow = '0 4px 24px rgba(220,38,38,0.12)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#e5e7eb'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: '#fef2f2',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={28} color="#dc2626" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontWeight: 600, fontSize: 16, color: '#1f2937', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '6px 0 0' }}>{subtitle}</p>
      </div>
    </button>
  )
}

export default function RolePicker({ onSelect }: { onSelect: (role: Role) => void }) {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9fafb',
      fontFamily: 'system-ui, sans-serif',
      gap: 40,
    }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <HeartPulse size={48} color="#dc2626" />
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#1f2937', margin: '12px 0 4px' }}>Vitality</h1>
        <p style={{ color: '#6b7280', fontSize: 14 }}>AI-driven preventive health partner</p>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        <RoleCard
          label="I'm a Patient"
          subtitle="track vitals, get insights"
          icon={User}
          onClick={() => onSelect('patient')}
        />
        <RoleCard
          label="I'm a Clinician"
          subtitle="monitor patients, manage care"
          icon={Stethoscope}
          onClick={() => onSelect('clinician')}
        />
      </div>
    </div>
  )
}
