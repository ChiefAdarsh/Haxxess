import {
  Home,
  PersonStanding,
  Clock,
  Phone,
  LayoutDashboard,
  Users,
  AlertTriangle,
  FileText,
} from 'lucide-react'
import type { Tab } from '../types'

export const patientTabs: Tab[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'bodymap', label: 'Body Map', icon: PersonStanding },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'callin', label: 'Call In', icon: Phone },
]

export const clinicianTabs: Tab[] = [
  { id: 'dashboard', label: 'Triage Queue', icon: LayoutDashboard },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'cases', label: 'Cases', icon: FileText },
  { id: 'alerts', label: 'Red Flags', icon: AlertTriangle },
]
