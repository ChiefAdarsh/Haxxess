import { HeartPulse, LogOut } from 'lucide-react'
import type { Tab } from '../types'

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
      width: 220,
      backgroundColor: '#fff',
      borderRight: '1px solid #e5e7eb',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* logo */}
      <button
        onClick={onLogout}
        style={{
          padding: '20px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          border: 'none',
          borderBlockEnd: '1px solid #e5e7eb',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        <HeartPulse size={24} color="#dc2626" />
        <span style={{ fontWeight: 700, fontSize: 18, color: '#1f2937' }}>Vitality</span>
      </button>

      {/* role badge */}
      <div style={{
        margin: '12px 10px 0',
        padding: '8px 12px',
        borderRadius: 8,
        backgroundColor: '#fef2f2',
        fontSize: 12,
        fontWeight: 600,
        color: '#dc2626',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        textAlign: 'center',
      }}>
        {role}
      </div>

      {/* nav tabs */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                backgroundColor: isActive ? '#fef2f2' : 'transparent',
                color: isActive ? '#dc2626' : '#6b7280',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={18} color={isActive ? '#dc2626' : '#9ca3af'} />
              {tab.label}
            </button>
          )
        })}
      </nav>

      {/* switch role */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid #e5e7eb' }}>
        <button
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '10px 14px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            color: '#6b7280',
            backgroundColor: 'transparent',
          }}
        >
          <LogOut size={16} color="#9ca3af" />
          Switch Role
        </button>
      </div>
    </aside>
  )
}
