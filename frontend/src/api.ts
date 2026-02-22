export const API_BASE_URL = "http://localhost:8000";

export type CycleProfile =
  | "follicular"
  | "ovulation"
  | "luteal_mild"
  | "luteal_pms"
  | "pmdd_crisis"
  | "pcos_flare"
  | "perimenopause";

export interface VitalityResponse {
  status: string;
  vitality_index: number;
  tier: { id: string; label: string; action: string };
  flags: string[];
  summary: string;
}

export interface ForecastResponse {
  status: string;
  data: {
    risk_level: string;
    forecast: Array<{
      hour: number;
      predicted_score: number;
      risk_factor: string;
      recommended_intervention: string;
    }>;
    confidence_note: string;
  };
}

export interface HistoryResponse {
  profile: string;
  days: number;
  history: Array<{
    date: string;
    vitality_index: number;
    dominant_tier: string;
    flags_recorded: string[];
  }>;
}

export interface CoachingResponse {
  status: string;
  data: {
    summary: string;
    action_plan: string[];
  };
}

export interface ChatRequest {
  message: string;
}

type QueryValue = string | number | boolean | null | undefined;

const getCache = new Map<string, Promise<any>>();

const buildUrl = (path: string, query?: Record<string, QueryValue>) => {
  const url = new URL(path, API_BASE_URL);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
};

const safeReadBody = async (res: Response) => {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  try {
    return await res.text();
  } catch {
    return null;
  }
};

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init);
  const body = await safeReadBody(res);

  if (!res.ok) {
    const detail =
      body && typeof body === "object" && "detail" in (body as any)
        ? (body as any).detail
        : body;
    const msg =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? JSON.stringify(detail)
          : typeof body === "string"
            ? body
            : "Request failed";
    throw new Error(msg);
  }

  return body as T;
};

const cachedGetJson = <T>(
  url: string,
  forceRefresh = false,
): Promise<T | null> => {
  const key = `GET ${url}`;
  if (forceRefresh) getCache.delete(key);

  const existing = getCache.get(key);
  if (existing) return existing as Promise<T | null>;

  const p = requestJson<T>(url)
    .then((data) => data)
    .catch((err) => {
      console.error(`GET failed (${url}):`, err);
      getCache.delete(key);
      return null;
    });

  getCache.set(key, p);
  return p;
};

export const fetchLiveVitals = (
  profile?: CycleProfile | string | null,
  forceRefresh = false,
): Promise<VitalityResponse | null> => {
  const url = buildUrl("/consolidated", { profile: profile ?? undefined });
  return cachedGetJson<VitalityResponse>(url, forceRefresh);
};

export const fetchForecast = (
  profile?: CycleProfile | string | null,
  forceRefresh = false,
): Promise<ForecastResponse | null> => {
  const url = buildUrl("/intelligence/forecast", {
    profile: profile ?? undefined,
  });
  return cachedGetJson<ForecastResponse>(url, forceRefresh);
};

export const fetchCoaching = (
  profile?: CycleProfile | string | null,
  forceRefresh = false,
): Promise<CoachingResponse | null> => {
  const url = buildUrl("/intelligence/coaching", {
    profile: profile ?? undefined,
  });
  return cachedGetJson<CoachingResponse>(url, forceRefresh);
};

export const fetchHistory = (
  days = 30,
  profile?: CycleProfile | string | null,
  forceRefresh = false,
): Promise<HistoryResponse | null> => {
  const url = buildUrl("/history/vitality", {
    days,
    profile: profile ?? undefined,
  });
  return cachedGetJson<HistoryResponse>(url, forceRefresh);
};

export const fetchStatus = (forceRefresh = false): Promise<string | null> => {
  const url = buildUrl("/status");
  return cachedGetJson<string>(url, forceRefresh);
};

export const healthCheck = (forceRefresh = false): Promise<string | null> => {
  const url = buildUrl("/");
  return cachedGetJson<string>(url, forceRefresh);
};

export const fetchSmartAlert = (
  profile?: CycleProfile | string | null,
  forceRefresh = false,
): Promise<string | null> => {
  const url = buildUrl("/intelligence/alert", {
    profile: profile ?? undefined,
  });
  return cachedGetJson<string>(url, forceRefresh);
};

export const fetchHistoryHourly = (
  hours = 48,
  profile?: CycleProfile | string | null,
  forceRefresh = false,
): Promise<string | null> => {
  const url = buildUrl("/history/hourly", {
    hours,
    profile: profile ?? undefined,
  });
  return cachedGetJson<string>(url, forceRefresh);
};

export const fetchHistoryTimeline = (
  days = 30,
  profile?: CycleProfile | string | null,
  forceRefresh = false,
): Promise<string | null> => {
  const url = buildUrl("/history/timeline", {
    days,
    profile: profile ?? undefined,
  });
  return cachedGetJson<string>(url, forceRefresh);
};

export const fetchHistoryEvents = (
  profile?: CycleProfile | string | null,
  forceRefresh = false,
): Promise<string | null> => {
  const url = buildUrl("/history/events", { profile: profile ?? undefined });
  return cachedGetJson<string>(url, forceRefresh);
};

export const fetchHistoryTrends = (
  days = 30,
  profile?: CycleProfile | string | null,
  forceRefresh = false,
): Promise<string | null> => {
  const url = buildUrl("/history/trends", {
    days,
    profile: profile ?? undefined,
  });
  return cachedGetJson<string>(url, forceRefresh);
};

export const fetchWeekComparison = (
  profile?: CycleProfile | string | null,
  forceRefresh = false,
): Promise<string | null> => {
  const url = buildUrl("/history/week-comparison", {
    profile: profile ?? undefined,
  });
  return cachedGetJson<string>(url, forceRefresh);
};

export const fetchSignalHistory = (
  signalName: string,
  days = 30,
  profile?: CycleProfile | string | null,
  forceRefresh = false,
): Promise<string | null> => {
  const safeSignal = encodeURIComponent(signalName);
  const url = buildUrl(`/history/signal/${safeSignal}`, {
    days,
    profile: profile ?? undefined,
  });
  return cachedGetJson<string>(url, forceRefresh);
};

export const chatWithAssistant = async (
  message: string,
  profile?: CycleProfile | string | null,
): Promise<string> => {
  const url = buildUrl("/intelligence/chat", { profile: profile ?? undefined });
  return requestJson<string>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message } satisfies ChatRequest),
  });
};

export const setWearableProfile = async (
  profile: CycleProfile | string,
): Promise<string> => {
  const url = buildUrl("/settings/wearable-profile", { profile });
  return requestJson<string>(url, { method: "PUT" });
};

export const analyzeVoice = async (file: File): Promise<string> => {
  const url = buildUrl("/analyze");
  const form = new FormData();
  form.append("file", file);

  return requestJson<string>(url, { method: "POST", body: form });
};

export const postConsolidatedFile = async (
  file: File,
  profile?: CycleProfile | string | null,
): Promise<string> => {
  const url = buildUrl("/consolidated", { profile: profile ?? undefined });
  const form = new FormData();
  form.append("file", file);

  return requestJson<string>(url, { method: "POST", body: form });
};

export const clearApiCache = () => {
  getCache.clear();
};
