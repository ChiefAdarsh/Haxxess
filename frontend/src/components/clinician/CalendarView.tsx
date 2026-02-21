import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { patients } from '../../config/patients'

const urgencyColor = {
  critical: '#dc2626',
  moderate: '#f59e0b',
  stable: '#10b981',
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const appointments: Record<string, { time: string; patient: typeof patients[0]; type: string }[]> = {
  '2026-02-22': [{ time: '9:00 AM', patient: patients[3], type: 'Follow-up' }],
  '2026-02-24': [
    { time: '10:30 AM', patient: patients[0], type: 'Check-up' },
    { time: '2:00 PM', patient: patients[2], type: 'Prenatal' },
  ],
  '2026-02-25': [{ time: '11:00 AM', patient: patients[4], type: 'Annual Physical' }],
  '2026-02-26': [{ time: '9:30 AM', patient: patients[5], type: 'BP Follow-up' }],
  '2026-02-28': [{ time: '1:00 PM', patient: patients[1], type: 'Post-op Review' }],
  '2026-03-01': [{ time: '10:00 AM', patient: patients[2], type: 'Prenatal' }],
  '2026-03-03': [{ time: '2:00 PM', patient: patients[0], type: 'Lab Review' }],
  '2026-03-05': [{ time: '9:00 AM', patient: patients[3], type: 'Cardiology' }],
  '2026-03-10': [{ time: '11:00 AM', patient: patients[4], type: 'Physical' }],
  '2026-03-12': [{ time: '3:00 PM', patient: patients[5], type: 'BP Check' }],
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function CalendarView() {
  const [year, setYear] = useState(2026)
  const [month, setMonth] = useState(1) // feb = 1

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = new Date()
  const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
  }
  const next = () => {
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      {/* month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', margin: 0 }}>
          {monthNames[month]} {year}
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={prev} style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb',
            backgroundColor: '#fff', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}><ChevronLeft size={16} color="#6b7280" /></button>
          <button onClick={next} style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb',
            backgroundColor: '#fff', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}><ChevronRight size={16} color="#6b7280" /></button>
        </div>
      </div>

      {/* calendar grid */}
      <div style={{
        backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden',
      }}>
        {/* day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e5e7eb' }}>
          {dayNames.map((d) => (
            <div key={d} style={{
              padding: '10px', textAlign: 'center',
              fontSize: 12, fontWeight: 600, color: '#9ca3af',
            }}>{d}</div>
          ))}
        </div>

        {/* date cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((day, i) => {
            const key = day ? formatDateKey(year, month, day) : ''
            const appts = day ? (appointments[key] || []) : []
            return (
              <div key={i} style={{
                minHeight: 100,
                padding: '6px 8px',
                borderRight: (i + 1) % 7 === 0 ? 'none' : '1px solid #f3f4f6',
                borderBottom: '1px solid #f3f4f6',
                backgroundColor: day && isToday(day) ? '#fef2f2' : 'transparent',
              }}>
                {day && (
                  <>
                    <span style={{
                      fontSize: 13, fontWeight: isToday(day) ? 700 : 500,
                      color: isToday(day) ? '#dc2626' : '#374151',
                    }}>{day}</span>
                    {appts.map((a, j) => (
                      <div key={j} style={{
                        marginTop: 4, padding: '4px 6px', borderRadius: 6,
                        backgroundColor: `${urgencyColor[a.patient.urgency]}10`,
                        borderLeft: `2px solid ${urgencyColor[a.patient.urgency]}`,
                      }}>
                        <p style={{ fontSize: 10, fontWeight: 600, color: urgencyColor[a.patient.urgency], margin: 0 }}>{a.time}</p>
                        <p style={{ fontSize: 11, color: '#374151', margin: '1px 0 0', fontWeight: 500 }}>{a.patient.name}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
