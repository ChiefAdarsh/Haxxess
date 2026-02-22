export const API_BASE_URL = 'http://localhost:8000'

export interface VitalityResponse {
  status: string
  vitality_index: number
  tier: { id: string; label: string; action: string }
  flags: string[]
  summary: string
}

export interface ForecastResponse {
  status: string
  data: {
    risk_level: string
    forecast: Array<{
      hour: number
      predicted_score: number
      risk_factor: string
      recommended_intervention: string
    }>
    confidence_note: string
  }
}

export interface HistoryResponse {
  profile: string
  days: number
  history: Array<{
    date: string
    vitality_index: number
    dominant_tier: string
    flags_recorded: string[]
  }>
}

export interface CoachingResponse {
  status: string
  data: {
    summary: string
    action_plan: string[]
  }
}

let vitalsCache: Promise<VitalityResponse | null> | null = null;
let forecastCache: Promise<ForecastResponse | null> | null = null;
let historyCache: Promise<HistoryResponse | null> | null = null;
let coachingCache: Promise<CoachingResponse | null> | null = null;

export const fetchLiveVitals = (forceRefresh = false): Promise<VitalityResponse | null> => {
  if (vitalsCache && !forceRefresh) return vitalsCache;
  vitalsCache = fetch(`${API_BASE_URL}/consolidated`)
    .then(async (res) => {
      const data = await res.json()
      if (!res.ok) {
        console.error("❌ Python Backend Vitals Error:", data)
        throw new Error(data.detail || 'Failed to fetch vitals')
      }
      console.log("✅ Vitals loaded:", data)
      return data
    })
    .catch((err) => {
      console.error("Vitals fetch failed:", err); vitalsCache = null; return null
    });
  return vitalsCache;
}

export const fetchForecast = (forceRefresh = false): Promise<ForecastResponse | null> => {
  if (forecastCache && !forceRefresh) return forecastCache;
  forecastCache = fetch(`${API_BASE_URL}/intelligence/forecast`)
    .then(async (res) => {
      const data = await res.json()
      if (!res.ok) {
        console.error("❌ Python Backend Forecast Error:", data)
        throw new Error(data.detail || 'Failed to fetch forecast')
      }
      return data
    })
    .catch((err) => {
      console.error("Forecast fetch failed:", err); forecastCache = null; return null
    });
  return forecastCache;
}

export const fetchHistory = (forceRefresh = false): Promise<HistoryResponse | null> => {
  if (historyCache && !forceRefresh) return historyCache;
  historyCache = fetch(`${API_BASE_URL}/history/vitality?days=4`)
    .then(async (res) => {
      const data = await res.json()
      if (!res.ok) {
        console.error("❌ Python Backend History Error:", data)
        throw new Error(data.detail || 'Failed to fetch history')
      }
      return data
    })
    .catch((err) => {
      console.error("History fetch failed:", err); historyCache = null; return null
    });
  return historyCache;
}

export const fetchCoaching = (forceRefresh = false): Promise<CoachingResponse | null> => {
  if (coachingCache && !forceRefresh) return coachingCache;
  coachingCache = fetch(`${API_BASE_URL}/intelligence/coaching`)
    .then(async (res) => {
      const data = await res.json()
      if (!res.ok) {
         console.error("❌ Python Backend Coaching Error:", data)
         throw new Error(data.detail || 'Failed to fetch coaching')
      }
      return data
    })
    .catch((err) => {
      console.error("Coaching fetch failed:", err); coachingCache = null; return null
    });
  return coachingCache;
}

export const clearApiCache = () => {
  vitalsCache = null; forecastCache = null; historyCache = null; coachingCache = null;
}
