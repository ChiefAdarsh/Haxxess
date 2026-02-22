import { useState } from 'react'
import Sidebar from './Sidebar'
import DashboardHome from './clinician/DashboardHome'
import PatientList from './clinician/PatientList'
import PatientDetail from './clinician/PatientDetail'
import AlertsView from './clinician/AlertsView'
import PatientHome from './patient/PatientHome'
import PatientTracker from './patient/PatientTracker'
import PatientCycle from './patient/PatientCycle'
import BodyMap from './patient/BodyMap'
import SymptomHistory from './patient/SymptomHistory'
import CallIn from './patient/CallIn'
import { patientTabs, clinicianTabs } from '../config/tabs'
import type { Patient } from '../config/patients'
import { Sparkles } from 'lucide-react'

interface DashboardProps {
  role: 'patient' | 'clinician'
  onLogout: () => void
}

function Placeholder({ label }: { label: string }) {
  return (
    <div style={{
      border: '2px dashed #fbcfe8', borderRadius: 16, backgroundColor: '#fdf2f8',
      padding: '80px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <Sparkles color="#ec4899" size={24} style={{ marginBottom: 12, opacity: 0.5 }} />
      <p style={{ color: '#be185d', fontSize: 14, fontWeight: 500 }}>{label} is under development</p>
    </div>
  )
}

export default function Dashboard({ role, onLogout }: DashboardProps) {
  const tabs = role === 'patient' ? patientTabs : clinicianTabs
  const [active, setActive] = useState(role === 'patient' ? 'home' : 'dashboard')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const current = tabs.find((t) => t.id === active)

  const patientName = (() => {
    try {
      return localStorage.getItem('vitality_patient_name') || 'Patient'
    } catch {
      return 'Patient'
    }
  })()

  const patientInitials = (() => {
    const parts = patientName.trim().split(/\s+/).filter(Boolean)
    const first = parts[0]?.[0] ?? 'P'
    const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
    return (first + last).toUpperCase()
  })()

  const handleTabChange = (id: string) => {
    setActive(id)
    setSelectedPatient(null)
  }

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient)
    setActive('patients')
  }

  const renderContent = () => {
    if (role === 'patient') {
      if (active === 'home') return <PatientHome />
      if (active === 'bodymap') return <BodyMap />
      if (active === 'history') return <SymptomHistory />
      if (active === 'tracker') return <PatientTracker />
      if (active === 'cycle') return <PatientCycle />
      if (active === 'callin') return <CallIn />
      return <Placeholder label={current?.label || ''} />
    }
    if (role === 'clinician') {
      if (active === 'dashboard') return <DashboardHome onSelectPatient={handleSelectPatient} />
      if (active === 'patients' && selectedPatient) {
        return <PatientDetail patient={selectedPatient} onBack={() => setSelectedPatient(null)} />
      }
      if (active === 'patients') return <PatientList onSelectPatient={setSelectedPatient} />
      if (active === 'alerts') return <AlertsView />
    }
    return <Placeholder label={current?.label || ''} />
  }

  const headerLabel = (role === 'clinician' && active === 'patients' && selectedPatient)
    ? `Patients / ${selectedPatient.name}`
    : (role === 'patient'
        ? `${patientName} • ${current?.label || ''}`
        : current?.label)

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      fontFamily: '"Inter", system-ui, sans-serif',
      backgroundColor: '#fdfafa',
    }}>
      <Sidebar
        role={role}
        tabs={tabs}
        active={active}
        onTabChange={handleTabChange}
        onLogout={onLogout}
      />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8fafc',
        position: 'relative',
        overflow: 'hidden'
      }}>

        <div style={{
          position: 'absolute', top: -150, right: -150, width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, rgba(248,250,252,0) 70%)',
          borderRadius: '50%', pointerEvents: 'none', zIndex: 0
        }} />

        <header style={{
          background: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)',
          color: '#fff',
          padding: '20px 28px',
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          boxShadow: '0 4px 6px -1px rgba(190, 24, 93, 0.1), 0 2px 4px -1px rgba(190, 24, 93, 0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {role === 'patient' && <Sparkles size={20} color="#fbcfe8" />}
            {headerLabel}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#fbcfe8', fontWeight: 500 }}>
              {role === 'clinician' ? 'Dr. Priti See' : 'Your Vitality Portal'}
            </span>
            <div style={{
              width: 32, height: 32, borderRadius: 16, backgroundColor: '#fdf2f8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#be185d', fontSize: 14, fontWeight: 700
            }}>
              {role === 'clinician' ? 'SM' : patientInitials}
            </div>
          </div>
        </header>

        <main style={{
          flex: 1,
          padding: '28px 32px',
          overflow: 'auto',
          zIndex: 10
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {renderContent()}
          </div>
        </main>

        <footer style={{
          padding: '12px 24px',
          borderTop: '1px solid #f1f5f9',
          backgroundColor: '#fff',
          display: 'flex',
          justifyContent: 'center',
          gap: 20,
          fontSize: 11,
          color: '#94a3b8',
          letterSpacing: '0.02em',
          zIndex: 10
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#dc2626' }} />
            Not for emergencies — call 911 for severe symptoms
          </span>
          <span>•</span>
          <span>AI triage suggestions are informational; clinician review required</span>
        </footer>
      </div>
    </div>
  )
}
