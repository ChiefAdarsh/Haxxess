import {
  Home,
  Activity,
  TrendingUp,
  MessageCircle,
  Apple,
  Users as UsersIcon,
  LayoutDashboard,
  Users,
  Calendar,
  DollarSign,
  Bell,
} from 'lucide-react'
import type { Tab } from '../types'

export const patientTabs: Tab[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'vitals', label: 'Vitals', icon: Activity },
  { id: 'insights', label: 'Insights', icon: TrendingUp },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'wellness', label: 'Wellness', icon: Apple },
  { id: 'family', label: 'Family', icon: UsersIcon },
]

export const clinicianTabs: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'billing', label: 'Billing', icon: DollarSign },
  { id: 'alerts', label: 'Alerts', icon: Bell },
]
