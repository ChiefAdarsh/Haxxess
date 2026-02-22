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
    age: 32,
    urgency: 'critical',
    condition: 'Endometriosis (Stage III) Flare',
    lastVisit: 'Feb 19, 2026',
    nextAppointment: 'Feb 24, 2026',
    phone: '(555) 234-5678',
  },
  {
    id: '2',
    name: 'Jessica Okafor',
    age: 29,
    urgency: 'moderate',
    condition: 'Interstitial Cystitis / Pelvic Pain',
    lastVisit: 'Feb 17, 2026',
    nextAppointment: 'Feb 28, 2026',
    phone: '(555) 345-6789',
  },
  {
    id: '3',
    name: 'Priya Sharma',
    age: 34,
    urgency: 'stable',
    condition: 'High-Risk Prenatal (Week 24)',
    lastVisit: 'Feb 14, 2026',
    nextAppointment: 'Mar 1, 2026',
    phone: '(555) 456-7890',
  },
  {
    id: '4',
    name: 'Chloe Chen',
    age: 26,
    urgency: 'critical',
    condition: 'Post-Op Ovarian Cystectomy',
    lastVisit: 'Feb 20, 2026',
    nextAppointment: 'Feb 22, 2026',
    phone: '(555) 567-8901',
  },
  {
    id: '5',
    name: 'Sarah Johnson',
    age: 28,
    urgency: 'stable',
    condition: 'PCOS Management / Routine',
    lastVisit: 'Feb 10, 2026',
    nextAppointment: 'Mar 10, 2026',
    phone: '(555) 678-9012',
  },
  {
    id: '6',
    name: 'Rachel Williams',
    age: 31,
    urgency: 'moderate',
    condition: 'Pelvic Inflammatory Disease (PID) Watch',
    lastVisit: 'Feb 18, 2026',
    nextAppointment: 'Feb 26, 2026',
    phone: '(555) 789-0123',
  },
]
