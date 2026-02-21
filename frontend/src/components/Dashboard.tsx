import { useState } from 'react'
import Sidebar from './Sidebar'
import { patientTabs, clinicianTabs } from '../config/tabs'

interface DashboardProps {
  role: 'patient' | 'clinician'
  onLogout: () => void
}

export default function Dashboard({ role, onLogout }: DashboardProps) {
  const tabs = role === 'patient' ? patientTabs : clinicianTabs
  const [active, setActive] = useState('dashboard')
  const current = tabs.find((t) => t.id === active)

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <Sidebar
        role={role}
        tabs={tabs}
        active={active}
        onTabChange={setActive}
        onLogout={onLogout}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb' }}>
        <header style={{
          backgroundColor: '#dc2626',
          color: '#fff',
          padding: '16px 24px',
          fontSize: 16,
          fontWeight: 600,
        }}>
          {current?.label}
        </header>

        <main style={{ flex: 1, padding: 24 }}>
          <div style={{
            border: '2px dashed #e5e7eb',
            borderRadius: 12,
            backgroundColor: '#fff',
            padding: '80px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <p style={{ color: '#9ca3af', fontSize: 14 }}>{current?.label} content goes here</p>
          </div>
        </main>
      </div>
    </div>
  )
}
