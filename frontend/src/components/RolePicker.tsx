import { Sparkles, User, Stethoscope } from 'lucide-react'
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
        width: 240,
        padding: '40px 24px',
        borderRadius: 20, // Softer corners
        border: '2px solid transparent',
        backgroundColor: 'rgba(255, 255, 255, 0.6)', // Increased transparency to let SVG show through
        backdropFilter: 'blur(16px)', // Stronger glass effect
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255,255,255,0.6)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(219, 39, 119, 0.5)' // Soft pink border on hover
        e.currentTarget.style.boxShadow = '0 10px 40px rgba(219, 39, 119, 0.15), inset 0 1px 0 rgba(255,255,255,0.8)'
        e.currentTarget.style.transform = 'translateY(-4px)' // Slight lift
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)' // Less transparent on hover
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'transparent'
        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255,255,255,0.6)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.6)'
      }}
    >
      <div style={{
        width: 72, height: 72, borderRadius: 36,
        background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)', // Pink gradient circle
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.8)' // Inner highlight
      }}>
        <Icon size={32} color="#be185d" /> {/* Deep rose icon */}
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontWeight: 600, fontSize: 17, color: '#1f2937', margin: 0, letterSpacing: '-0.01em' }}>{label}</p>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '6px 0 0' }}>{subtitle}</p>
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

      // THIS IS THE NEW PART:
      backgroundColor: '#f8fafc',
      backgroundImage: 'url(/vitalitybg.svg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',

      fontFamily: '"Inter", system-ui, sans-serif',
      gap: 48,
      position: 'relative',
      overflow: 'hidden'
    }}>

      <div style={{
        textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center',
        zIndex: 10
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 16px rgba(190, 24, 93, 0.2), inset 0 2px 4px rgba(255,255,255,0.3)',
          marginBottom: 16
        }}>
          <Sparkles size={28} color="#fff" />
        </div>
        <h1 style={{
          fontSize: 36, fontWeight: 700, color: '#1f2937', margin: 0,
          letterSpacing: '-0.03em'
        }}>
          Vitality Health
        </h1>
        <p style={{
          color: '#6b7280', fontSize: 15, margin: '8px 0 0', fontWeight: 500,
          letterSpacing: '0.01em'
        }}>
          Multimodal predictive care for women
        </p>
      </div>

      <div style={{ display: 'flex', gap: 24, zIndex: 10 }}>
        <RoleCard
          label="I'm a Patient"
          subtitle="Track symptoms & voice journals"
          icon={User}
          onClick={() => onSelect('patient')}
        />
        <RoleCard
          label="I'm a Clinician"
          subtitle="Monitor risks & manage care"
          icon={Stethoscope}
          onClick={() => onSelect('clinician')}
        />
      </div>

      <div style={{
        position: 'absolute', bottom: 32, fontSize: 12, color: '#94a3b8',
        fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase',
        zIndex: 10
      }}>
        Built for Axxess Hackathon 2026
      </div>
    </div>
  )
}
