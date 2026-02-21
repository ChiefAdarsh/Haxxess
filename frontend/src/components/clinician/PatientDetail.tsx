import { ArrowLeft, Phone, FlaskConical, FileText, Calendar } from 'lucide-react'
import type { Patient } from '../../config/patients'

const urgencyColor = {
  critical: '#dc2626',
  moderate: '#f59e0b',
  stable: '#10b981',
}

const recentVisits = [
  { date: 'Feb 20', note: 'BP check — 148/92, adjusted medication' },
  { date: 'Feb 14', note: 'Lab review — A1C at 8.2, glucose elevated' },
  { date: 'Feb 5', note: 'Follow-up — reported dizziness, ordered ECG' },
]

const recentCalls = [
  { date: 'Feb 19', note: 'Patient called about medication side effects' },
  { date: 'Feb 12', note: 'Pharmacy callback — prescription clarification' },
]

const actionBtn = {
  display: 'flex' as const,
  alignItems: 'center' as const,
  gap: 8,
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  backgroundColor: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500 as const,
  color: '#374151',
  transition: 'all 0.15s',
}

interface PatientDetailProps {
  patient: Patient
  onBack: () => void
}

export default function PatientDetail({ patient, onBack }: PatientDetailProps) {
  return (
    <div>
      {/* back button */}
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          border: 'none', backgroundColor: 'transparent',
          cursor: 'pointer', fontSize: 13, color: '#6b7280',
          marginBottom: 16, padding: 0,
        }}
      >
        <ArrowLeft size={16} /> Back to patients
      </button>

      {/* patient header */}
      <div style={{
        backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
        padding: '24px', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 28,
            border: `3px solid ${urgencyColor[patient.urgency]}`,
            backgroundColor: '#f3f4f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 600, fontSize: 18, color: '#4b5563',
          }}>
            {patient.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1f2937', margin: 0 }}>{patient.name}</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              Age {patient.age} &middot; {patient.condition}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
            backgroundColor: `${urgencyColor[patient.urgency]}15`,
            color: urgencyColor[patient.urgency],
          }}>
            {patient.urgency.toUpperCase()}
          </span>
        </div>
      </div>

      {/* quick actions */}
      <div style={{
        backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
        padding: '20px', marginBottom: 20,
      }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 12px' }}>
          Quick Actions
        </h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={actionBtn}>
            <Phone size={15} color="#dc2626" /> Call Patient
          </button>
          <button style={actionBtn}>
            <FlaskConical size={15} color="#7c3aed" /> Request Lab Report
          </button>
          <button style={actionBtn}>
            <FileText size={15} color="#2563eb" /> View Updates
          </button>
          <button style={actionBtn}>
            <Calendar size={15} color="#059669" /> Schedule Visit
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* recent visits */}
        <div style={{
          backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px',
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 14px' }}>
            Recent Visits
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recentVisits.map((v, i) => (
              <div key={i} style={{
                padding: '12px', borderRadius: 8, backgroundColor: '#f9fafb',
                borderLeft: '3px solid #dc2626',
              }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', margin: 0 }}>{v.date}</p>
                <p style={{ fontSize: 13, color: '#374151', margin: '4px 0 0' }}>{v.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* recent calls */}
        <div style={{
          backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px',
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 14px' }}>
            Recent Calls
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recentCalls.map((c, i) => (
              <div key={i} style={{
                padding: '12px', borderRadius: 8, backgroundColor: '#f9fafb',
                borderLeft: '3px solid #f59e0b',
              }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', margin: 0 }}>{c.date}</p>
                <p style={{ fontSize: 13, color: '#374151', margin: '4px 0 0' }}>{c.note}</p>
              </div>
            ))}
          </div>

          {/* next appointment */}
          <div style={{
            marginTop: 16, padding: '14px', borderRadius: 8,
            backgroundColor: '#fef2f2', border: '1px solid #fecaca',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Calendar size={16} color="#dc2626" />
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', margin: 0 }}>Next Appointment</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1f2937', margin: '2px 0 0' }}>{patient.nextAppointment}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
