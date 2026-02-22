import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Activity,
  Wifi,
  WifiOff,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { getStatus, getSmartAlert, getForecast } from "../../api/client";
import { patients } from "../../config/patients";
import { triageLevelConfig } from "../../engine/triage";
import type { Patient } from "../../config/patients";
import type { TriageLevel } from "../../types";

function tierToTriageLevel(tierId: string): TriageLevel {
  if (tierId === "CRITICAL") return "emergency";
  if (tierId === "ELEVATED") return "same_day";
  if (tierId === "WATCH") return "routine";
  return "self_care";
}

const currentPatientName =
  typeof window !== "undefined"
    ? localStorage.getItem("vitality_patient_name") || patients[0]?.name
    : patients[0]?.name;
const currentPatientForCases = { ...patients[0], name: currentPatientName || "Current Patient" };

interface CasesViewProps {
  onSelectPatient: (patient: Patient) => void;
}

export default function CasesView({ onSelectPatient }: CasesViewProps) {
  const [status, setStatus] = useState<any>(null);
  const [alert, setAlert] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [s, a, f] = await Promise.all([
          getStatus(),
          getSmartAlert(),
          getForecast(),
        ]);
        if (cancelled) return;
        setStatus(s);
        setAlert(a?.data || null);
        setForecast(f?.data || null);
      } catch {
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const online = !!status;
  const vitality = status?.vitality;
  const flags = (vitality?.flags || []).filter(
    (f: string) =>
      ![
        "[voice] No voice data available",
        "[nlp] NLP module not connected",
        "[behavioral] Behavioral module not connected",
      ].includes(f),
  );

  const casesList = useMemo(() => {
    const tierId = vitality?.tier_id ?? "STABLE";
    const level = tierToTriageLevel(tierId);
    const summary =
      vitality?.summary ||
      alert?.message ||
      alert?.title ||
      "No summary";
    const liveCase = {
      id: "c-live",
      patient: currentPatientForCases,
      level,
      summary,
      source: "pipeline",
    };
    const demos = [
      {
        id: "c-demo-2",
        patient: patients[3],
        level: "same_day" as TriageLevel,
        summary: "Temp spike + pelvic pain (demo)",
        source: "demo",
      },
      {
        id: "c-demo-3",
        patient: patients[1],
        level: "routine" as TriageLevel,
        summary: "Recurring cramps (demo)",
        source: "demo",
      },
    ];
    return online ? [liveCase, ...demos] : [liveCase, ...demos];
  }, [status, alert, vitality, online]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-[22px] font-bold text-slate-900 leading-tight">
            Cases
          </h2>
          <p className="text-sm font-medium text-slate-400 mt-1">
            Pipeline status and patient case list
          </p>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
            online
              ? "bg-green-50 border-green-200"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          {online ? (
            <Wifi size={14} className="text-green-600" />
          ) : (
            <WifiOff size={14} className="text-slate-400" />
          )}
          <span
            className={`text-xs font-semibold ${online ? "text-green-700" : "text-slate-400"}`}
          >
            {online ? "Pipeline Live" : "Pipeline Offline"}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-100">
          <p className="text-sm text-slate-400 m-0">
            Loading pipeline status...
          </p>
        </div>
      ) : online && (vitality || alert) ? (
        <div className="bg-white rounded-xl border border-slate-100 p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-pink-700 to-pink-600 flex items-center justify-center">
              <Activity size={18} className="text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 m-0">
              Live pipeline snapshot
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 m-0">
                Vitality
              </p>
              <p className="text-2xl font-extrabold text-slate-900 m-0">
                {vitality?.index ?? "—"}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {vitality?.tier_label ?? "—"} · {status?.cycle_state ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 m-0">
                Summary
              </p>
              <p className="text-sm text-slate-700 mt-0">
                {vitality?.summary || "No summary"}
              </p>
            </div>
          </div>
          {flags.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase text-slate-400 mb-2">
                Active flags
              </p>
              <div className="flex flex-wrap gap-2">
                {flags.slice(0, 5).map((f: string, i: number) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs font-medium"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
          {alert && (
            <div
              className={`mt-4 p-3.5 rounded-xl flex items-start gap-2 border ${
                alert.severity === "critical"
                  ? "bg-red-50 border-red-200"
                  : "bg-yellow-50 border-yellow-200"
              }`}
            >
              <AlertTriangle
                size={18}
                className={
                  alert.severity === "critical"
                    ? "text-red-600"
                    : "text-yellow-600"
                }
              />
              <div>
                <p className="text-sm font-semibold text-slate-900 m-0">
                  {alert.title || "Alert"}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {alert.message || alert.summary || ""}
                </p>
              </div>
            </div>
          )}
          {forecast?.forecast?.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase text-slate-400 mb-2">
                72h forecast (next interval)
              </p>
              <div className="flex flex-wrap gap-2">
                {forecast.forecast.slice(0, 3).map((f: any, i: number) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700"
                  >
                    +{f.hour}h: {f.predicted_score} — {f.risk_factor}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <FileText size={20} className="text-pink-700" />
          <h3 className="text-sm font-bold text-slate-900 m-0">
            Patient cases
          </h3>
        </div>
        <div className="flex flex-col gap-3">
          {casesList.map((c) => {
            const cfg = triageLevelConfig[c.level];
            const isCritical = c.level === "emergency";
            const isLive = c.source === "pipeline";
            return (
              <button
                key={c.id}
                onClick={() => onSelectPatient(c.patient)}
                className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer text-left transition-all border-l-4 ${
                  isCritical
                    ? "border-pink-700 bg-pink-50 hover:bg-slate-50 hover:border-slate-200"
                    : `border-l-[${cfg.color}] bg-white hover:bg-slate-50 hover:border-slate-200`
                }`}
              >
                <div className="w-11 h-11 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm flex-shrink-0">
                  {c.patient.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">
                      {c.patient.name}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded ${
                        isCritical
                          ? "bg-pink-700 text-white"
                          : `${cfg.bg} ${cfg.color}`
                      } uppercase tracking-wide`}
                    >
                      {cfg.label}
                    </span>
                    {isLive && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded bg-pink-700 text-white uppercase">
                        live
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mt-1">{c.summary}</p>
                </div>
                <ChevronRight size={18} className="text-slate-400" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
