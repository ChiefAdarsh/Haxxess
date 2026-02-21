import { patients } from '../../config/patients'

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const dates = ['Feb 23', 'Feb 24', 'Feb 25', 'Feb 26', 'Feb 27']

const appointments = [
  { day: 0, time: '9:00 AM', patient: patients[3], type: 'Follow-up' },
  { day: 1, time: '10:30 AM', patient: patients[0], type: 'Check-up' },
  { day: 1, time: '2:00 PM', patient: patients[2], type: 'Prenatal' },
  { day: 2, time: '11:00 AM', patient: patients[4], type: 'Annual Physical' },
  { day: 3, time: '9:30 AM', patient: patients[5], type: 'BP Follow-up' },
  { day: 4, time: '1:00 PM', patient: patients[1], type: 'Post-op Review' },
]

const urgencyColor = {
  critical: '#dc2626',
  moderate: '#f59e0b',
  stable: '#10b981',
}

export default function CalendarView() {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', margin: '0 0 20px' }}>
        This Week
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {days.map((day, i) => (
          <div key={day}>
            {/* day header */}
            <div style={{
              textAlign: 'center', padding: '10px', marginBottom: 8,
              borderRadius: 8, backgroundColor: '#fff', border: '1px solid #e5e7eb',
            }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', margin: 0 }}>{day}</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1f2937', margin: '2px 0 0' }}>{dates[i]}</p>
            </div>

            {/* appointments for this day */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {appointments
                .filter((a) => a.day === i)
                .map((a, j) => (
                  <div key={j} style={{
                    padding: '12px', borderRadius: 8, backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderLeft: `3px solid ${urgencyColor[a.patient.urgency]}`,
                  }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', margin: 0 }}>{a.time}</p>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#1f2937', margin: '4px 0 2px' }}>{a.patient.name}</p>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{a.type}</p>
                  </div>
                ))}
              {appointments.filter((a) => a.day === i).length === 0 && (
                <div style={{
                  padding: '20px 12px', borderRadius: 8,
                  border: '1px dashed #e5e7eb', textAlign: 'center',
                }}>
                  <p style={{ fontSize: 12, color: '#d1d5db', margin: 0 }}>no appointments</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
