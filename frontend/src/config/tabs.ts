import {
  LayoutDashboard,
  Activity,
  HeartPulse,
  MessageCircle,
  Bell,
  Apple,
  Users,
  ClipboardList,
} from 'lucide-react'
import type { Tab } from '../types'

export const patientTabs: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'vitals', label: 'My Vitals', icon: Activity },
  { id: 'risk', label: 'Risk Score', icon: HeartPulse },
  { id: 'assistant', label: 'Symptom Checker', icon: MessageCircle },
  { id: 'alerts', label: 'Reminders', icon: Bell },
  { id: 'lifestyle', label: 'Lifestyle Plan', icon: Apple },
]

export const clinicianTabs: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'vitals', label: 'Vitals Monitor', icon: Activity },
  { id: 'risk', label: 'Risk Analysis', icon: HeartPulse },
  { id: 'assistant', label: 'Diagnosis Aid', icon: MessageCircle },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'reports', label: 'Reports', icon: ClipboardList },
]
