import { useState } from 'react'
import { UserPlus, User, ArrowLeft, ChevronRight } from 'lucide-react'
import { patients } from '../config/patients'
import type { Patient } from '../config/patients'

const LS_NAME = 'vitality_patient_name'
const LS_ID = 'vitality_patient_id'

interface PatientPickerProps {
  onSelectExisting: (patient: Patient) => void
  onSelectNew: (name: string) => void
  onBack: () => void
}

export default function PatientPicker({ onSelectExisting, onSelectNew, onBack }: PatientPickerProps) {
  const [newName, setNewName] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)

  const selectExisting = (p: Patient) => {
    try {
      localStorage.setItem(LS_NAME, p.name)
      localStorage.setItem(LS_ID, p.id)
    } catch {}
    onSelectExisting(p)
  }

  const submitNew = () => {
    const name = newName.trim() || 'New Patient'
    try {
      localStorage.setItem(LS_NAME, name)
      localStorage.setItem(LS_ID, 'new')
    } catch {}
    onSelectNew(name)
  }

  if (showNewForm) {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#f8fafc', fontFamily: '"Inter", system-ui, sans-serif', padding: 24,
      }}>
        <button
          onClick={() => setShowNewForm(false)}
          style={{
            position: 'absolute', top: 24, left: 24,
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
            border: '1px solid #e5e7eb', borderRadius: 10, backgroundColor: '#fff',
            cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 500,
          }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div style={{
          backgroundColor: '#fff', borderRadius: 20, border: '1px solid #e5e7eb',
          padding: '40px 48px', maxWidth: 400, width: '100%',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          }}>
            <UserPlus size={28} color="#fff" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>
            New patient
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px' }}>
            Enter your name to get started.
          </p>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitNew()}
            placeholder="Your name"
            autoFocus
            style={{
              width: '100%', padding: '14px 18px', borderRadius: 12, border: '1px solid #e5e7eb',
              fontSize: 16, color: '#1e293b', marginBottom: 20, outline: 'none',
            }}
          />
          <button
            onClick={submitNew}
            style={{
              width: '100%', padding: '14px 20px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)',
              color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#f8fafc', fontFamily: '"Inter", system-ui, sans-serif', padding: 24,
    }}>
      <button
        onClick={onBack}
        style={{
          position: 'absolute', top: 24, left: 24,
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
          border: '1px solid #e5e7eb', borderRadius: 10, backgroundColor: '#fff',
          cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 500,
        }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>
          Continue as patient
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
          Select your profile or create a new one.
        </p>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420, width: '100%', marginBottom: 24,
      }}>
        {patients.map((p) => (
          <button
            key={p.id}
            onClick={() => selectExisting(p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px',
              borderRadius: 14, border: '1px solid #e5e7eb', backgroundColor: '#fff',
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#fbcfe8'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(190, 24, 93, 0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb'
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 24, backgroundColor: '#fdf2f8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 16, color: '#be185d', flexShrink: 0,
            }}>
              {p.name.split(' ').map((n) => n[0]).join('')}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', margin: 0 }}>{p.name}</p>
              <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>{p.condition}</p>
            </div>
            <ChevronRight size={20} color="#94a3b8" />
          </button>
        ))}
      </div>

      <button
        onClick={() => setShowNewForm(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '16px 32px', borderRadius: 14, border: '2px dashed #e5e7eb',
          backgroundColor: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: '#64748b',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#be185d'
          e.currentTarget.style.color = '#be185d'
          e.currentTarget.style.backgroundColor = '#fdf2f8'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#e5e7eb'
          e.currentTarget.style.color = '#64748b'
          e.currentTarget.style.backgroundColor = '#fff'
        }}
      >
        <UserPlus size={20} /> I'm a new patient
      </button>
    </div>
  )
}
