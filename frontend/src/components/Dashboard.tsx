import { useState } from 'react'
import Sidebar from './Sidebar'
import DashboardHome from './clinician/DashboardHome'
import PatientList from './clinician/PatientList'
import PatientDetail from './clinician/PatientDetail'
import CalendarView from './clinician/CalendarView'
import BillingView from './clinician/BillingView'
import AlertsView from './clinician/AlertsView'
import PatientHome from './patient/PatientHome'
import MessagesView from './patient/MessagesView'
import VitalsView from './patient/VitalsView'
import WellnessView from './patient/WellnessView'
import { patientTabs, clinicianTabs } from '../config/tabs'
import type { Patient } from '../config/patients'

interface DashboardProps {
  role: 'patient' | 'clinician'
  onLogout: () => void
}

function Placeholder({ label }: { label: string }) {
  return (
    <div style={{
      border: '2px dashed #e5e7eb', borderRadius: 12, backgroundColor: '#fff',
      padding: '80px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <p style={{ color: '#9ca3af', fontSize: 14 }}>{label} content goes here</p>
    </div>
  )
}

export default function Dashboard({ role, onLogout }: DashboardProps) {
  const tabs = role === 'patient' ? patientTabs : clinicianTabs
  const [active, setActive] = useState(role === 'patient' ? 'home' : 'dashboard')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const current = tabs.find((t) => t.id === active)

  // when switching tabs, clear selected patient
  const handleTabChange = (id: string) => {
    setActive(id)
    setSelectedPatient(null)
  }

  const renderContent = () => {
    if (role === 'clinician') {
      if (active === 'dashboard') return <DashboardHome onSelectPatient={handleSelectPatient} />
      if (active === 'patients' && selectedPatient) {
        return <PatientDetail patient={selectedPatient} onBack={() => setSelectedPatient(null)} />
      }
      if (active === 'patients') return <PatientList onSelectPatient={setSelectedPatient} />
      if (active === 'calendar') return <CalendarView />
      if (active === 'billing') return <BillingView />
      if (active === 'alerts') return <AlertsView />
    }
    if (role === 'patient') {
      if (active === 'home') return <PatientHome />
      if (active === 'vitals') return <VitalsView />
      if (active === 'messages') return <MessagesView />
      if (active === 'wellness') return <WellnessView />
    }
    return <Placeholder label={current?.label || ''} />
  }

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient)
    setActive('patients')
  }

  // header title adjusts when viewing a patient
  const headerLabel = (active === 'patients' && selectedPatient)
    ? `Patients / ${selectedPatient.name}`
    : current?.label

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <Sidebar
        role={role}
        tabs={tabs}
        active={active}
        onTabChange={handleTabChange}
        onLogout={onLogout}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb' }}>
        <header style={{
          backgroundColor: '#dc2626', color: '#fff',
          padding: '16px 24px', fontSize: 16, fontWeight: 600,
        }}>
          {headerLabel}
        </header>

        <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          {renderContent()}
        </main>
      </div>
    </div>
  )
}
