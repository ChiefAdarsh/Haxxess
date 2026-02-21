export interface Patient {
  id: string
  name: string
  age: number
  urgency: 'critical' | 'moderate' | 'stable'
  condition: string
  lastVisit: string
  nextAppointment: string
  phone: string
}

export const patients: Patient[] = [
  {
    id: '1',
    name: 'Maria Santos',
    age: 62,
    urgency: 'critical',
    condition: 'Uncontrolled diabetes, BP spike',
    lastVisit: 'Feb 19, 2026',
    nextAppointment: 'Feb 24, 2026',
    phone: '(555) 234-5678',
  },
  {
    id: '2',
    name: 'James Okafor',
    age: 45,
    urgency: 'moderate',
    condition: 'Post-op knee recovery',
    lastVisit: 'Feb 17, 2026',
    nextAppointment: 'Feb 28, 2026',
    phone: '(555) 345-6789',
  },
  {
    id: '3',
    name: 'Priya Sharma',
    age: 34,
    urgency: 'stable',
    condition: 'Routine prenatal checkup',
    lastVisit: 'Feb 14, 2026',
    nextAppointment: 'Mar 1, 2026',
    phone: '(555) 456-7890',
  },
  {
    id: '4',
    name: 'David Chen',
    age: 71,
    urgency: 'critical',
    condition: 'Chest pain, irregular heartbeat',
    lastVisit: 'Feb 20, 2026',
    nextAppointment: 'Feb 22, 2026',
    phone: '(555) 567-8901',
  },
  {
    id: '5',
    name: 'Sarah Johnson',
    age: 28,
    urgency: 'stable',
    condition: 'Annual physical',
    lastVisit: 'Feb 10, 2026',
    nextAppointment: 'Mar 10, 2026',
    phone: '(555) 678-9012',
  },
  {
    id: '6',
    name: 'Robert Williams',
    age: 55,
    urgency: 'moderate',
    condition: 'Hypertension follow-up',
    lastVisit: 'Feb 18, 2026',
    nextAppointment: 'Feb 26, 2026',
    phone: '(555) 789-0123',
  },
]
