const BASE = "http://localhost:8000";

// generic fetch wrapper
async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// get consolidated vitality data
export function getConsolidated(profile?: string) {
  const q = profile ? `?profile=${profile}` : "";
  return request<any>(`/consolidated${q}`);
}

// get current status snapshot
export function getStatus(profile?: string) {
  const q = profile ? `?profile=${profile}` : "";
  return request<any>(`/status${q}`);
}

// get smart alert
export function getSmartAlert(profile?: string) {
  const q = profile ? `?profile=${profile}` : "";
  return request<any>(`/intelligence/alert${q}`);
}

// get risk forecast
export function getForecast(profile?: string) {
  const q = profile ? `?profile=${profile}` : "";
  return request<any>(`/intelligence/forecast${q}`);
}

// get lifestyle coaching
export function getCoaching(profile?: string) {
  const q = profile ? `?profile=${profile}` : "";
  return request<any>(`/intelligence/coaching${q}`);
}

// chat with ai assistant (history = last N messages as { role, content } for context)
export function chatWithAssistant(
  message: string,
  profile?: string,
  history?: { role: string; content: string }[],
) {
  const q = profile ? `?profile=${profile}` : "";
  return request<any>(`/intelligence/chat${q}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history: history || [] }),
  });
}

// upload audio for analysis
export async function analyzeVoice(file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<any>("/analyze", { method: "POST", body: form });
}

// call triage (upload audio, get transcript + extraction)
export async function callTriage(file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<any>("/call-triage", { method: "POST", body: form });
}

// get cycle periods
export function getCyclePeriods() {
  return request<any>("/cycle/periods");
}

// add cycle period
export function addCyclePeriod(data: {
  startDate: string;
  endDate?: string;
  flow?: string;
  notes?: string;
}) {
  return request<any>("/cycle/periods", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// list of cycle/profile options (from DB when backend uses MongoDB)
export function getProfiles() {
  return request<{ profiles: { id: string; label: string }[] }>("/settings/profiles");
}

// set wearable profile
export function setWearableProfile(profile: string) {
  return request<any>(`/settings/wearable-profile?profile=${profile}`, {
    method: "PUT",
  });
}

// get history
export function getVitalityHistory(profile?: string, days = 30) {
  const params = new URLSearchParams({ days: days.toString() });
  if (profile) params.set("profile", profile);
  return request<any>(`/history/vitality?${params}`);
}

export function getHistoryTrends(profile?: string, days = 30) {
  const params = new URLSearchParams({ days: days.toString() });
  if (profile) params.set("profile", profile);
  return request<any>(`/history/trends?${params}`);
}

// Body map / symptom logs (feed into pipeline)
export function addSymptomLog(entry: {
  region: string;
  type: string;
  severity: number;
  qualities?: string[];
  timing?: string;
  triggers?: string[];
  notes?: string;
}) {
  return request<any>("/symptoms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      region: entry.region,
      type: entry.type,
      severity: entry.severity,
      qualities: entry.qualities ?? [],
      timing: entry.timing ?? "",
      triggers: entry.triggers ?? [],
      notes: entry.notes ?? "",
    }),
  });
}

export function getSymptoms(days = 30) {
  return request<any>(`/symptoms?days=${days}`);
}

// Calendar / appointments (patient schedules → shows on clinician calendar)
export function getAppointments(fromDate?: string, toDate?: string) {
  const params = new URLSearchParams();
  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);
  const q = params.toString() ? `?${params}` : "";
  return request<{ status: string; appointments: Array<{ id: string; date: string; time: string; type: string; patient_name: string }> }>(`/calendar/appointments${q}`);
}

export function createAppointment(entry: {
  date: string;
  time: string;
  type?: string;
  patient_name?: string;
}) {
  return request<any>("/calendar/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: entry.date,
      time: entry.time,
      type: entry.type ?? "Visit",
      patient_name: entry.patient_name ?? undefined,
    }),
  });
}

export function getCallHistory(patientId?: string) {
  const q = patientId ? `?patient_id=${patientId}` : "";
  return request<{
    status: string;
    calls: Array<{
      call_sid: string;
      patient_id: string;
      patient_name: string;
      timestamp: string;
      transcript: string;
      triage: {
        level: string;
        label: string;
        color: string;
        bg: string;
        reason: string;
        action: string;
      };
      entities: Record<string, any>;
    }>;
  }>(`/call-history${q}`);
}

// Wearable live stream WebSocket (same host as API)
export const WEARABLE_WS_URL =
  (BASE.replace(/^http/, "ws") as string) + "/ws/wearable";
