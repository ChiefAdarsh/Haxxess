import { useEffect, useRef, useState } from "react";
import {
  Phone,
  PhoneOff,
  Wifi,
  WifiOff,
  Loader2,
  AlertTriangle,
  Activity,
  ChevronRight,
} from "lucide-react";

interface TranscriptLine {
  id: number;
  text: string;
  timestamp: Date;
}

type CallStatus = "idle" | "active" | "ended" | "processing" | "error";

interface TriageData {
  level: "emergency" | "urgent" | "routine" | "self_care";
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

interface CaseData {
  call_sid: string;
  transcript: string;
  triage: TriageData;
  entities: EntitiesData;
}

const BASE = "http://localhost:8000";

const triageStyles: Record<string, { label: string; color: string; bg: string; border: string }> = {
  emergency: { label: "Emergency", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  urgent: { label: "Same-Day Urgent", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  routine: { label: "Routine Follow-Up", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  self_care: { label: "Self-Care & Monitor", color: "#10b981", bg: "#f0fdf4", border: "#bbf7d0" },
};

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

export default function LiveIntake() {
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callSid, setCallSid] = useState<string | null>(null);
  const [finalLines, setFinalLines] = useState<TranscriptLine[]>([]);
  const [interimText, setInterimText] = useState("");
  const [connected, setConnected] = useState(false);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lineId = useRef(0);

  useEffect(() => {
    const source = new EventSource(`${BASE}/transcript-stream`);

    source.onopen = () => setConnected(true);

    source.onmessage = (e) => {
      const data = JSON.parse(e.data);

      switch (data.type) {
        case "call_started":
          setCallStatus("active");
          setCallSid(data.call_sid);
          setFinalLines([]);
          setInterimText("");
          setCaseData(null);
          break;

        case "call_ended":
          setCallStatus("ended");
          setInterimText("");
          break;

        case "processing":
          setCallStatus("processing");
          break;

        case "case_ready":
          setCaseData(data as CaseData);
          setCallStatus("ended");
          break;

        case "call_status":
          if (
            ["completed", "failed", "busy", "no-answer"].includes(data.status)
          ) {
            setCallStatus((prev) =>
              prev === "processing" ? "processing" : "ended",
            );
            setInterimText("");
          }
          break;

        case "transcript":
          if (data.is_final) {
            setFinalLines((prev) => [
              ...prev,
              {
                id: lineId.current++,
                text: data.text,
                timestamp: new Date(),
              },
            ]);
            setInterimText("");
          } else {
            setInterimText(data.text);
          }
          break;

        case "error":
          console.error("Server error:", data.message);
          break;
      }
    };

    source.onerror = () => setConnected(false);
    return () => source.close();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [finalLines, interimText]);

  const statusConfig: Record<
    CallStatus,
    { label: string; color: string; bg: string; pulse: boolean }
  > = {
    idle: {
      label: "Waiting for call",
      color: "#6b7280",
      bg: "#f3f4f6",
      pulse: false,
    },
    active: {
      label: "Live",
      color: "#16a34a",
      bg: "#f0fdf4",
      pulse: true,
    },
    ended: {
      label: "Call ended",
      color: "#6b7280",
      bg: "#f3f4f6",
      pulse: false,
    },
    processing: {
      label: "Analyzing...",
      color: "#7c3aed",
      bg: "#f5f3ff",
      pulse: true,
    },
    error: { label: "Error", color: "#dc2626", bg: "#fef2f2", pulse: false },
  };

  const status = statusConfig[callStatus];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-bold text-slate-900 leading-tight">
            Live Intake
          </h2>
          <p className="text-sm font-medium text-slate-400 mt-1">
            Twilio call intake with real-time transcription and AI triage
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-2"
            style={{
              backgroundColor: connected ? "#f0fdf4" : "#f3f4f6",
              borderColor: connected ? "#bbf7d0" : "#e5e7eb",
            }}
          >
            {connected ? (
              <Wifi size={14} className="text-green-600" />
            ) : (
              <WifiOff size={14} className="text-slate-400" />
            )}
            <span
              className="text-xs font-semibold"
              style={{ color: connected ? "#16a34a" : "#9ca3af" }}
            >
              {connected ? "Stream Connected" : "Disconnected"}
            </span>
          </div>

          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-2"
            style={{
              backgroundColor: status.bg,
              borderColor: status.color + "40",
            }}
          >
            {status.pulse && (
              <span
                className="h-2 w-2 rounded-full animate-pulse"
                style={{ backgroundColor: status.color }}
              />
            )}
            {callStatus === "active" ? (
              <Phone size={14} style={{ color: status.color }} />
            ) : callStatus === "processing" ? (
              <Loader2
                size={14}
                style={{ color: status.color }}
                className="animate-spin"
              />
            ) : (
              <PhoneOff size={14} style={{ color: status.color }} />
            )}
            <span
              className="text-xs font-semibold"
              style={{ color: status.color }}
            >
              {status.label}
            </span>
          </div>
        </div>
      </div>

      {/* Call SID */}
      {callSid && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
            Call SID
          </span>
          <code className="text-xs font-mono text-purple-600">{callSid}</code>
        </div>
      )}

      {/* Main layout */}
      <div
        className={`grid gap-5 ${caseData || callStatus === "processing" ? "grid-cols-1 lg:grid-cols-[1fr_380px]" : "grid-cols-1"}`}
      >
        {/* Transcript panel */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
            <Activity size={14} className="text-pink-700" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Live Transcript
            </span>
            {callStatus === "active" && (
              <span className="ml-auto h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {finalLines.length === 0 && !interimText ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                  <Phone size={22} className="text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-700">
                  {callStatus === "processing"
                    ? "Analyzing symptoms..."
                    : "Transcript will appear here"}
                </p>
                <p className="mt-1 text-xs text-slate-400 max-w-xs leading-relaxed">
                  When a patient calls the Twilio intake line, their speech is
                  transcribed here in real-time with PII automatically{" "}
                  <span className="inline-flex items-center rounded bg-red-50 border border-red-200 px-1 text-[9px] font-mono text-red-400">
                    [redacted]
                  </span>
                  .
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {finalLines.map((line) => (
                  <div
                    key={line.id}
                    className="flex gap-3 items-start animate-in fade-in slide-in-from-bottom-1"
                  >
                    <span className="mt-1 shrink-0 text-[10px] font-mono text-slate-400 min-w-[60px]">
                      {line.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <p className="text-sm leading-relaxed text-slate-700 border-l-2 border-purple-200 pl-3">
                      {highlightPII(line.text)}
                    </p>
                  </div>
                ))}

                {interimText && (
                  <div className="flex gap-3 items-start opacity-50">
                    <span className="mt-1 shrink-0 text-[10px] font-mono text-slate-400 min-w-[60px]">
                      ...
                    </span>
                    <p className="text-sm leading-relaxed text-slate-400 italic border-l-2 border-slate-200 pl-3">
                      {highlightPII(interimText)}
                    </p>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>

        {/* Triage / Case panel */}
        {caseData ? (
          <CasePanel data={caseData} />
        ) : (
          callStatus === "processing" && <ProcessingPanel />
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-3 text-[11px] text-slate-400">
        <span className="inline-flex items-center rounded bg-red-50 border border-red-200 px-1.5 text-[9px] font-mono text-red-400">
          [redacted]
        </span>
        <span>= PII removed by Deepgram</span>
        <span className="flex items-center gap-1.5">
          <AlertTriangle size={11} className="text-amber-500" />
          Not for emergencies — call 911. Triage is informational only.
        </span>
      </div>
    </div>
  );
}

function CasePanel({ data }: { data: CaseData }) {
  const { triage, entities } = data;
  const ts = triageStyles[triage.level] || triageStyles.self_care;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-y-auto max-h-[600px]">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
        <span className="text-sm">&#127973;</span>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Case Summary
        </span>
      </div>

      {/* Triage card */}
      <div
        className="mx-4 mt-4 rounded-xl p-4 border"
        style={{
          backgroundColor: ts.bg,
          borderColor: ts.border,
        }}
      >
        <p className="text-lg font-bold" style={{ color: ts.color }}>
          {ts.label}
        </p>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          {triage.reason}
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/60 p-3">
          <ChevronRight
            size={14}
            className="mt-0.5 shrink-0"
            style={{ color: ts.color }}
          />
          <span className="text-xs font-medium text-slate-700 leading-relaxed">
            {triage.action}
          </span>
        </div>
      </div>

      {/* Entities */}
      {entities && !entities.error && (
        <div className="space-y-2 p-4">
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
                    className="h-full rounded-full transition-all duration-500"
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

          <div className="grid grid-cols-2 gap-2">
            {entities.onset && (
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Onset
                </p>
                <span className="text-xs text-slate-700">{entities.onset}</span>
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

      {entities?.error === "no_key" && (
        <div className="mx-4 mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 leading-relaxed">
          Add{" "}
          <code className="rounded bg-white px-1 py-0.5 text-[10px]">
            OPENROUTER_API_KEY
          </code>{" "}
          to your{" "}
          <code className="rounded bg-white px-1 py-0.5 text-[10px]">
            .env
          </code>{" "}
          to enable AI entity extraction.
        </div>
      )}
    </div>
  );
}

function ProcessingPanel() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col items-center justify-center py-16">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 w-full">
        <span className="text-sm">&#128300;</span>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Analysis
        </span>
      </div>
      <div className="flex flex-col items-center gap-3 py-12">
        <Loader2 size={32} className="text-purple-600 animate-spin" />
        <p className="text-sm font-medium text-slate-700">
          Extracting symptoms & computing triage...
        </p>
        <p className="text-xs text-slate-400">This takes a few seconds.</p>
      </div>
    </div>
  );
}
