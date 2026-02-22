const BASE = 'http://localhost:8000'

// generic fetch wrapper
async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

// get consolidated vitality data
export function getConsolidated(profile?: string) {
  const q = profile ? `?profile=${profile}` : ''
  return request<any>(`/consolidated${q}`)
}

// get current status snapshot
export function getStatus() {
  return request<any>('/status')
}

// get smart alert
export function getSmartAlert(profile?: string) {
  const q = profile ? `?profile=${profile}` : ''
  return request<any>(`/intelligence/alert${q}`)
}

// get risk forecast
export function getForecast(profile?: string) {
  const q = profile ? `?profile=${profile}` : ''
  return request<any>(`/intelligence/forecast${q}`)
}

// get lifestyle coaching
export function getCoaching(profile?: string) {
  const q = profile ? `?profile=${profile}` : ''
  return request<any>(`/intelligence/coaching${q}`)
}

// chat with ai assistant (history = last N messages as { role, content } for context)
export function chatWithAssistant(message: string, profile?: string, history?: { role: string; content: string }[]) {
  const q = profile ? `?profile=${profile}` : ''
  return request<any>(`/intelligence/chat${q}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history: history || [] }),
  })
}

// upload audio for analysis
export async function analyzeVoice(file: File) {
  const form = new FormData()
  form.append('file', file)
  return request<any>('/analyze', { method: 'POST', body: form })
}

// call triage (upload audio, get transcript + extraction)
export async function callTriage(file: File) {
  const form = new FormData()
  form.append('file', file)
  return request<any>('/call-triage', { method: 'POST', body: form })
}

// get cycle periods
export function getCyclePeriods() {
  return request<any>('/cycle/periods')
}

// add cycle period
export function addCyclePeriod(data: { startDate: string; endDate?: string; flow?: string; notes?: string }) {
  return request<any>('/cycle/periods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

// set wearable profile
export function setWearableProfile(profile: string) {
  return request<any>(`/settings/wearable-profile?profile=${profile}`, { method: 'PUT' })
}

// get history
export function getVitalityHistory(profile?: string, days = 30) {
  const params = new URLSearchParams({ days: days.toString() })
  if (profile) params.set('profile', profile)
  return request<any>(`/history/vitality?${params}`)
}

export function getHistoryTrends(profile?: string, days = 30) {
  const params = new URLSearchParams({ days: days.toString() })
  if (profile) params.set('profile', profile)
  return request<any>(`/history/trends?${params}`)
}

// wearable websocket url
export const WEARABLE_WS_URL = `ws://localhost:8000/ws/wearable`
