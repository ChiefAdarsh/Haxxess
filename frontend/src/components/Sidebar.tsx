import { Sparkles, LogOut } from 'lucide-react'
import type { Tab } from '../types'
import ProfileSelector from './ProfileSelector'

interface SidebarProps {
  role: string
  tabs: Tab[]
  active: string
  onTabChange: (id: string) => void
  onLogout: () => void
}

export default function Sidebar({ role, tabs, active, onTabChange, onLogout }: SidebarProps) {
  return (
    <aside style={{
      width: 240, // Slightly wider for a more modern feel
      height: '100vh',
      backgroundColor: '#fff',
      borderRight: '1px solid #f1f5f9', // Softer border
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: '4px 0 24px rgba(0,0,0,0.01)', // Very subtle shadow
      zIndex: 20
    }}>
      {/* Logo Area */}
      <div style={{
        padding: '24px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 8px rgba(190, 24, 93, 0.2), inset 0 2px 4px rgba(255,255,255,0.3)',
          flexShrink: 0
        }}>
          <Sparkles size={18} color="#fff" />
        </div>
        <div>
          <span style={{ fontWeight: 700, fontSize: 18, color: '#1f2937', letterSpacing: '-0.02em', display: 'block' }}>Vitality</span>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            Health Engine
          </span>
        </div>
      </div>

      {/* Role Badge */}
      <div style={{
        margin: '20px 16px 0',
        padding: '8px 12px',
        borderRadius: 8,
        backgroundColor: role === 'clinician' ? '#eff6ff' : '#fdf2f8', // Blue for doc, Pink for patient
        border: `1px solid ${role === 'clinician' ? '#bfdbfe' : '#fbcfe8'}`,
        fontSize: 11,
        fontWeight: 700,
        color: role === 'clinician' ? '#1e40af' : '#be185d',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        textAlign: 'center',
      }}>
        {role} Portal
      </div>

      {role === 'patient' && <ProfileSelector />}

      {/* Nav Tabs */}
      <nav style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0, overflowY: 'auto' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 8px 8px', letterSpacing: '0.02em' }}>
          Menu
        </p>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = active === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                backgroundColor: isActive ? '#fdf2f8' : 'transparent',
                color: isActive ? '#be185d' : '#64748b',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#f8fafc'
                  e.currentTarget.style.color = '#334155'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#64748b'
                }
              }}
            >
              <Icon size={18} color={isActive ? '#be185d' : '#94a3b8'} style={{ transition: 'all 0.15s ease' }} />
              {tab.label}
            </button>
          )
        })}
      </nav>

      {/* Switch Role / Logout */}
      <div style={{ padding: '16px', borderTop: '1px solid #f1f5f9' }}>
        <button
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '12px 14px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            color: '#64748b',
            backgroundColor: 'transparent',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#fee2e2'
            e.currentTarget.style.color = '#ef4444'
            const svg = e.currentTarget.querySelector('svg')
            if (svg) svg.style.color = '#ef4444'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = '#64748b'
            const svg = e.currentTarget.querySelector('svg')
            if (svg) svg.style.color = '#94a3b8'
          }}
        >
          <LogOut size={16} color="#94a3b8" style={{ transition: 'all 0.15s ease' }} />
          Switch Role
        </button>
      </div>
    </aside>
  )
}
