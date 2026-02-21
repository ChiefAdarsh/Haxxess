import type { LucideIcon } from 'lucide-react'

export type Role = 'patient' | 'clinician' | null

export interface Tab {
  id: string
  label: string
  icon: LucideIcon
}
