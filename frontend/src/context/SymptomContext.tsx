import { createContext, useContext, useState, type ReactNode } from 'react'
import type { SymptomEntry, BodyRegion } from '../types'

// seed data so the demo isn't empty
const seedData: SymptomEntry[] = [
  {
    id: 's1', region: 'pelvic_midline', type: 'pain', severity: 7,
    qualities: ['stabbing'], timing: 'constant', triggers: ['exercise'],
    notes: 'sharp pain during morning jog', timestamp: '2026-02-20T09:15:00Z',
  },
  {
    id: 's2', region: 'LLQ', type: 'cramp', severity: 5,
    qualities: ['dull', 'throbbing'], timing: 'intermittent', triggers: [],
    notes: '', timestamp: '2026-02-20T14:30:00Z',
  },
  {
    id: 's3', region: 'low_back', type: 'pain', severity: 4,
    qualities: ['dull'], timing: 'gradual', triggers: ['bowel_movement'],
    notes: 'radiates down left side', timestamp: '2026-02-19T18:00:00Z',
  },
  {
    id: 's4', region: 'suprapubic', type: 'pressure', severity: 6,
    qualities: ['throbbing'], timing: 'constant', triggers: ['urination'],
    notes: 'worse after holding bladder', timestamp: '2026-02-19T11:00:00Z',
  },
  {
    id: 's5', region: 'pelvic_midline', type: 'bleeding', severity: 8,
    qualities: [], timing: 'sudden', triggers: [],
    notes: 'heavy flow, soaking pad in 2 hours', timestamp: '2026-02-18T07:00:00Z',
  },
  {
    id: 's6', region: 'RLQ', type: 'pain', severity: 9,
    qualities: ['stabbing', 'radiating'], timing: 'sudden', triggers: [],
    notes: 'sharp right-sided pain with nausea', timestamp: '2026-02-21T06:00:00Z',
  },
]

interface SymptomContextValue {
  symptoms: SymptomEntry[]
  addSymptom: (entry: Omit<SymptomEntry, 'id' | 'timestamp'>) => void
  getByRegion: (region: BodyRegion) => SymptomEntry[]
  getRecent: (days: number) => SymptomEntry[]
  maxSeverityByRegion: () => Partial<Record<BodyRegion, number>>
}

const SymptomContext = createContext<SymptomContextValue | null>(null)

export function SymptomProvider({ children }: { children: ReactNode }) {
  const [symptoms, setSymptoms] = useState<SymptomEntry[]>(seedData)

  const addSymptom = (entry: Omit<SymptomEntry, 'id' | 'timestamp'>) => {
    const newEntry: SymptomEntry = {
      ...entry,
      id: `s${Date.now()}`,
      timestamp: new Date().toISOString(),
    }
    setSymptoms((prev) => [newEntry, ...prev])
  }

  const getByRegion = (region: BodyRegion) =>
    symptoms.filter((s) => s.region === region)

  const getRecent = (days: number) => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    return symptoms.filter((s) => new Date(s.timestamp).getTime() > cutoff)
  }

  // highest severity per region in last 7 days
  const maxSeverityByRegion = () => {
    const recent = getRecent(7)
    const map: Partial<Record<BodyRegion, number>> = {}
    for (const s of recent) {
      if (!map[s.region] || s.severity > map[s.region]!) {
        map[s.region] = s.severity
      }
    }
    return map
  }

  return (
    <SymptomContext.Provider value={{ symptoms, addSymptom, getByRegion, getRecent, maxSeverityByRegion }}>
      {children}
    </SymptomContext.Provider>
  )
}

export function useSymptoms() {
  const ctx = useContext(SymptomContext)
  if (!ctx) throw new Error('useSymptoms must be inside SymptomProvider')
  return ctx
}
