import { useState } from 'react'
import { Pill, Dumbbell, UtensilsCrossed, Check } from 'lucide-react'

interface Task {
  id: string
  label: string
  time?: string
  category: 'medication' | 'exercise' | 'diet'
  done: boolean
}

const initialTasks: Task[] = [
  { id: '1', label: 'Metformin 500mg', time: '8:00 AM', category: 'medication', done: true },
  { id: '2', label: 'Lisinopril 10mg', time: '8:00 AM', category: 'medication', done: true },
  { id: '3', label: '30 min walk', time: 'Morning', category: 'exercise', done: false },
  { id: '4', label: 'High-protein breakfast', category: 'diet', done: true },
  { id: '5', label: 'Metformin 500mg', time: '6:00 PM', category: 'medication', done: false },
  { id: '6', label: 'Stretching / yoga', time: 'Evening', category: 'exercise', done: false },
  { id: '7', label: 'Low-sodium dinner', category: 'diet', done: false },
  { id: '8', label: 'Drink 8 glasses of water', category: 'diet', done: false },
]

const categoryConfig = {
  medication: { icon: Pill, color: '#dc2626', label: 'Medications' },
  exercise: { icon: Dumbbell, color: '#2563eb', label: 'Exercise' },
  diet: { icon: UtensilsCrossed, color: '#10b981', label: 'Diet' },
}

export default function WellnessView() {
  const [tasks, setTasks] = useState(initialTasks)

  const toggle = (id: string) => {
    setTasks(tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t))
  }

  const completed = tasks.filter((t) => t.done).length
  const total = tasks.length
  const pct = Math.round((completed / total) * 100)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', margin: 0 }}>Today's Wellness Plan</h2>
        <span style={{ fontSize: 13, color: '#9ca3af' }}>{completed}/{total} completed</span>
      </div>

      <div style={{
        backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
        padding: '16px 20px', marginBottom: 20,
      }}>
        <div style={{
          height: 8, borderRadius: 4, backgroundColor: '#f3f4f6', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 4, backgroundColor: '#dc2626',
            width: `${pct}%`, transition: 'width 0.3s',
          }} />
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '8px 0 0' }}>{pct}% of today's goals complete</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {(['medication', 'exercise', 'diet'] as const).map((cat) => {
          const config = categoryConfig[cat]
          const Icon = config.icon
          const catTasks = tasks.filter((t) => t.category === cat)

          return (
            <div key={cat}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Icon size={16} color={config.color} />
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', margin: 0 }}>{config.label}</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {catTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => toggle(task.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px', borderRadius: 10,
                      border: '1px solid #e5e7eb', backgroundColor: '#fff',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                      opacity: task.done ? 0.5 : 1,
                    }}
                  >
                    <div style={{
                      width: 24, height: 24, borderRadius: 6,
                      border: task.done ? 'none' : `2px solid ${config.color}`,
                      backgroundColor: task.done ? config.color : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'all 0.15s',
                    }}>
                      {task.done && <Check size={14} color="#fff" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{
                        fontSize: 14, fontWeight: 500, color: '#1f2937',
                        textDecoration: task.done ? 'line-through' : 'none',
                      }}>{task.label}</span>
                    </div>
                    {task.time && (
                      <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>{task.time}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
