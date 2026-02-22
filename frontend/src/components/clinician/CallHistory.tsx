import { useEffect, useState } from "react";
import {
  Phone,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  Activity,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { getCallHistory } from "../../api/client";

interface TriageData {
  level: string;
  label: string;
  color: string;
  bg: string;
  reason: string;
  action: string;
}

interface EntitiesData {
  summary?: string;
  symptoms?: string[];
  body_regions?: string[];
  severity?: number | null;
  onset?: string | null;
  duration?: string | null;
  bleeding?: boolean | null;
  bleeding_amount?: string | null;
  pregnancy_status?: string;
  fever?: boolean | null;
  triggers?: string[];
  other_notes?: string | null;
  error?: string;
}

interface CallRecord {
  call_sid: string;
  patient_id: string;
  patient_name: string;
  timestamp: string;
  transcript: string;
  triage: TriageData;
  entities: EntitiesData;
}

const triageStyles: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: string }
> = {
  emergency: {
    label: "Emergency",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    icon: "🔴",
  },
  urgent: {
    label: "Same-Day Urgent",
    color: "#f59e0b",
    bg: "#fffbeb",
    border: "#fde68a",
    icon: "🟠",
  },
  routine: {
    label: "Routine Follow-Up",
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
    icon: "🔵",
  },
  self_care: {
    label: "Self-Care & Monitor",
    color: "#10b981",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    icon: "🟢",
  },
};

function BoolBadge({ val }: { val: boolean | null | undefined }) {
  if (val === null || val === undefined)
    return (
      <span className="inline-block rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs text-slate-400 italic">
        Unknown
      </span>
    );
  return val ? (
    <span className="inline-block rounded bg-green-50 border border-green-200 px-2 py-0.5 text-xs font-semibold text-green-700">
      Yes
    </span>
  ) : (
    <span className="inline-block rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs text-slate-400">
      No
    </span>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function highlightPII(text: string) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((part, i) =>
    part.startsWith("[") && part.endsWith("]") ? (
      <span
        key={i}
        className="inline-flex items-center rounded bg-red-50 border border-red-200 px-1.5 text-[10px] font-mono font-medium text-red-500 mx-0.5"
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function CallCard({
  call,
  isExpanded,
  onToggle,
}: {
  call: CallRecord;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const ts =
    triageStyles[call.triage?.level] || triageStyles.self_care;
  const entities = call.entities || {};

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50/50 transition-colors cursor-pointer"
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2"
          style={{ borderColor: ts.color, backgroundColor: ts.bg }}
        >
          <Phone size={16} style={{ color: ts.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900">
              {call.patient_name}
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{
                color: ts.color,
                backgroundColor: ts.bg,
                border: `1px solid ${ts.border}`,
              }}
            >
              {ts.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={11} />
              {formatTimestamp(call.timestamp)}
            </span>
            {entities.summary && (
              <span className="text-xs text-slate-500 truncate max-w-[300px]">
                {entities.summary}
              </span>
            )}
          </div>
        </div>

        {isExpanded ? (
          <ChevronUp size={16} className="text-slate-400 shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-slate-400 shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4 animate-in fade-in slide-in-from-top-1">
          {/* Triage card */}
          <div
            className="rounded-xl p-4 border"
            style={{ backgroundColor: ts.bg, borderColor: ts.border }}
          >
            <p className="text-sm font-bold" style={{ color: ts.color }}>
              {ts.label}
            </p>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              {call.triage?.reason}
            </p>
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-white/60 p-2.5">
              <AlertTriangle
                size={12}
                className="mt-0.5 shrink-0"
                style={{ color: ts.color }}
              />
              <span className="text-xs font-medium text-slate-700 leading-relaxed">
                {call.triage?.action}
              </span>
            </div>
          </div>

          {/* Transcript */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={13} className="text-pink-700" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Transcript
              </span>
            </div>
            <p className="text-sm leading-relaxed text-slate-700">
              {call.transcript
                ? highlightPII(call.transcript)
                : "No transcript available."}
            </p>
          </div>

          {/* Entities */}
          {entities && !entities.error && (
            <div className="space-y-3">
              {entities.summary && (
                <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Chief Complaint
                  </p>
                  <p className="text-sm text-slate-700 italic leading-relaxed">
                    {entities.summary}
                  </p>
                </div>
              )}

              {entities.severity != null && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Severity
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(entities.severity / 10) * 100}%`,
                          backgroundColor:
                            entities.severity >= 7
                              ? "#dc2626"
                              : entities.severity >= 4
                                ? "#f59e0b"
                                : "#10b981",
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-900">
                      {entities.severity}
                      <span className="text-xs text-slate-400">/10</span>
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {entities.symptoms && entities.symptoms.length > 0 && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Symptoms
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {entities.symptoms.map((s, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-[11px] font-medium text-purple-700"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {entities.body_regions && entities.body_regions.length > 0 && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Regions
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {entities.body_regions.map((r, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-[11px] font-medium text-green-700"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {entities.onset && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Onset
                    </p>
                    <span className="text-xs text-slate-700">
                      {entities.onset}
                    </span>
                  </div>
                )}
                {entities.duration && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Duration
                    </p>
                    <span className="text-xs text-slate-700">
                      {entities.duration}
                    </span>
                  </div>
                )}
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Bleeding
                  </p>
                  <BoolBadge val={entities.bleeding} />
                  {entities.bleeding_amount && (
                    <span className="text-[11px] text-slate-400 ml-1">
                      {entities.bleeding_amount}
                    </span>
                  )}
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Fever
                  </p>
                  <BoolBadge val={entities.fever} />
                </div>
              </div>

              {entities.triggers && entities.triggers.length > 0 && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Triggers
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {entities.triggers.map((t, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-orange-50 border border-orange-200 px-2.5 py-0.5 text-[11px] font-medium text-orange-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {entities.other_notes && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Notes
                  </p>
                  <span className="text-xs text-slate-700">
                    {entities.other_notes}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Call SID */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">
              Call SID
            </span>
            <code className="text-[10px] font-mono text-slate-400">
              {call.call_sid}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CallHistory() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchCalls = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCallHistory();
      setCalls(res.calls || []);
    } catch {
      setError("Could not load call history. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  const triageCounts = calls.reduce(
    (acc, c) => {
      const level = c.triage?.level || "self_care";
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-bold text-slate-900 leading-tight">
            Call History
          </h2>
          <p className="text-sm font-medium text-slate-400 mt-1">
            Past Twilio intake calls with transcripts and triage results
          </p>
        </div>

        <button
          onClick={fetchCalls}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {calls.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <p className="text-2xl font-extrabold text-slate-900">
              {calls.length}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
              Total Calls
            </p>
          </div>
          {(["emergency", "urgent", "routine", "self_care"] as const).map(
            (level) => {
              const ts = triageStyles[level];
              const count = triageCounts[level] || 0;
              if (!count) return null;
              return (
                <div
                  key={level}
                  className="rounded-xl border p-4 text-center"
                  style={{
                    backgroundColor: ts.bg,
                    borderColor: ts.border,
                  }}
                >
                  <p
                    className="text-2xl font-extrabold"
                    style={{ color: ts.color }}
                  >
                    {count}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                    {ts.label}
                  </p>
                </div>
              );
            },
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 size={28} className="text-pink-600 animate-spin" />
          <p className="text-sm text-slate-400 mt-3">Loading call history...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle size={24} className="text-red-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      ) : calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <Phone size={22} className="text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">
            No call history yet
          </p>
          <p className="mt-1 text-xs text-slate-400 max-w-xs leading-relaxed">
            When patients call the Twilio intake line, their calls will appear
            here with transcripts, triage levels, and extracted symptoms.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => (
            <CallCard
              key={call.call_sid}
              call={call}
              isExpanded={expandedId === call.call_sid}
              onToggle={() =>
                setExpandedId(
                  expandedId === call.call_sid ? null : call.call_sid,
                )
              }
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-3 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center rounded bg-red-50 border border-red-200 px-1.5 text-[9px] font-mono text-red-400">
            [redacted]
          </span>
          = PII removed by Deepgram
        </span>
        <span className="flex items-center gap-1.5">
          <AlertTriangle size={11} className="text-amber-500" />
          Triage is informational only — clinician review required.
        </span>
      </div>
    </div>
  );
}
