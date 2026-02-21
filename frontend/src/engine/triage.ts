import type { SymptomEntry, TriageResult, TriageLevel } from '../types'

// red-flag rules for gyn symptoms
export function triageSymptoms(symptoms: SymptomEntry[]): TriageResult {
  const reasons: string[] = []
  let level: TriageLevel = 'self_care'

  const recent = symptoms.filter(
    (s) => Date.now() - new Date(s.timestamp).getTime() < 24 * 60 * 60 * 1000
  )

  if (recent.length === 0) return { level: 'self_care', reasons: ['no recent symptoms'] }

  const has = (type: string) => recent.some((s) => s.type === type)
  const maxSev = Math.max(...recent.map((s) => s.severity))
  const hasRegion = (r: string) => recent.some((s) => s.region === r)
  const hasQuality = (q: string) => recent.some((s) => s.qualities.includes(q as any))
  const hasNoteMatch = (keyword: string) =>
    recent.some((s) => s.notes.toLowerCase().includes(keyword))

  // emergency: heavy bleeding (severity >= 8 + bleeding type)
  if (has('bleeding') && recent.some((s) => s.type === 'bleeding' && s.severity >= 8)) {
    level = 'emergency'
    reasons.push('heavy bleeding reported (severity >= 8)')
  }

  // emergency: severe one-sided pain + nausea
  const rightSidePain = recent.some(
    (s) => s.region === 'RLQ' && s.type === 'pain' && s.severity >= 7
  )
  const leftSidePain = recent.some(
    (s) => s.region === 'LLQ' && s.type === 'pain' && s.severity >= 7
  )
  if ((rightSidePain || leftSidePain) && hasNoteMatch('nausea')) {
    level = 'emergency'
    reasons.push('severe one-sided pelvic pain with nausea')
  }

  // emergency: syncope/dizziness + bleeding
  if (has('bleeding') && (hasNoteMatch('dizzy') || hasNoteMatch('faint') || hasNoteMatch('syncope'))) {
    level = 'emergency'
    reasons.push('bleeding with dizziness/syncope')
  }

  // emergency: pregnancy + bleeding/pain
  if (hasNoteMatch('pregnant') && (has('bleeding') || maxSev >= 7)) {
    level = 'emergency'
    reasons.push('possible pregnancy with bleeding or severe pain')
  }

  // same-day: fever + pelvic pain or foul discharge
  if (hasNoteMatch('fever') && (hasRegion('pelvic_midline') || has('discharge'))) {
    if (level !== 'emergency') level = 'same_day'
    reasons.push('fever with pelvic pain or discharge')
  }

  // same-day: new severe pain (>= 7) without emergency flags
  if (maxSev >= 7 && level !== 'emergency') {
    level = 'same_day'
    reasons.push(`high severity pain reported (${maxSev}/10)`)
  }

  // same-day: burning + urination trigger (possible UTI/infection)
  if (has('burning') && recent.some((s) => s.triggers.includes('urination'))) {
    if (level !== 'emergency') level = 'same_day'
    reasons.push('burning with urination (possible infection)')
  }

  // routine: moderate symptoms (4-6)
  if (maxSev >= 4 && maxSev < 7 && level === 'self_care') {
    level = 'routine'
    reasons.push('moderate symptoms requiring follow-up')
  }

  // routine: recurring pain across multiple regions
  const uniqueRegions = new Set(recent.map((s) => s.region))
  if (uniqueRegions.size >= 3 && level === 'self_care') {
    level = 'routine'
    reasons.push(`symptoms across ${uniqueRegions.size} regions`)
  }

  // self-care additions
  if (level === 'self_care') {
    if (hasQuality('radiating')) {
      reasons.push('mild radiating discomfort — monitor and log')
    } else {
      reasons.push('mild symptoms — continue monitoring')
    }
  }

  return { level, reasons }
}

export const triageLevelConfig: Record<TriageLevel, { label: string; color: string; bg: string }> = {
  emergency: { label: 'Emergency', color: '#dc2626', bg: '#fef2f2' },
  same_day: { label: 'Same-Day Urgent', color: '#f59e0b', bg: '#fffbeb' },
  routine: { label: 'Routine Follow-up', color: '#2563eb', bg: '#eff6ff' },
  self_care: { label: 'Self-Care', color: '#10b981', bg: '#f0fdf4' },
}
