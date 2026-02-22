import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Users,
  Clock,
  Activity,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import { triageLevelConfig } from "../../engine/triage";
import { patients } from "../../config/patients";
import { getStatus, getSmartAlert } from "../../api/client";
import type { Patient } from "../../config/patients";
import type { TriageLevel } from "../../types";

const triageCases = [
  {
    id: "c1",
    patient: patients[0],
    level: "emergency" as TriageLevel,
    summary: "Acoustic vocal tremor + Heavy bleeding, soaking pad in 2 hours",
    source: "multimodal  lag",
    time: "12 min ago",
  },
  {
    id: "c2",
    patient: patients[3],
    level: "emergency" as TriageLevel,
    summary: "Oura Temp spike + Severe right-sided pelvic pain with nausea",
    source: "sensor fusion",
    time: "34 min ago",
  },
  {
    id: "c3",
    patient: patients[5],
    level: "same_day" as TriageLevel,
    summary: "Burning with urination, pelvic pressure 7/10",
    source: "symptom log",
    time: "1 hr ago",
  },
  {
    id: "c4",
    patient: patients[1],
    level: "same_day" as TriageLevel,
    summary: "Fever reported with pelvic midline pain",
    source: "call-in",
    time: "2 hrs ago",
  },
  {
    id: "c5",
    patient: patients[2],
    level: "routine" as TriageLevel,
    summary: "Recurring dull cramps, cycle day 14",
    source: "symptom log",
    time: "3 hrs ago",
  },
  {
    id: "c6",
    patient: patients[4],
    level: "self_care" as TriageLevel,
    summary: "Mild low back discomfort after exercise",
    source: "symptom log",
    time: "5 hrs ago",
  },
];

const stats = [
  {
    label: "Active Cases",
    value: triageCases.length.toString(),
    icon: Activity,
  },
  {
    label: "Critical / ER",
    value: triageCases.filter((c) => c.level === "emergency").length.toString(),
    icon: AlertTriangle,
  },
  {
    label: "Same-Day Risk",
    value: triageCases.filter((c) => c.level === "same_day").length.toString(),
    icon: Clock,
  },
  {
    label: "Total Patients",
    value: patients.length.toString(),
    icon: Users,
  },
];

interface DashboardHomeProps {
  onSelectPatient: (patient: Patient) => void;
}

export default function DashboardHome({ onSelectPatient }: DashboardHomeProps) {
  const [backendStatus, setBackendStatus] = useState<
    "connecting" | "online" | "offline"
  >("connecting");
  const [liveAlert, setLiveAlert] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const [alert] = await Promise.all([getStatus(), getSmartAlert()]);
        if (cancelled) return;
        setBackendStatus("online");
        setLiveAlert(alert?.data || null);
      } catch {
        if (!cancelled) setBackendStatus("offline");
      }
    }
    check();
    const interval = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const backendStyles =
    backendStatus === "online"
      ? "bg-green-50 border-green-200 text-green-700"
      : backendStatus === "offline"
        ? "bg-red-50 border-red-200 text-red-800"
        : "bg-slate-50 border-slate-200 text-slate-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[22px] font-bold text-slate-800 tracking-[-0.02em] m-0">
            Welcome Dr. See
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Vitality has flagged{" "}
            {triageCases.filter((c) => c.level === "emergency").length} critical
            cases requiring your attention.
          </p>
        </div>
        <div
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border ${backendStyles}`}
        >
          {backendStatus === "online" ? (
            <Wifi size={14} className="text-emerald-500" />
          ) : (
            <WifiOff
              size={14}
              className={
                backendStatus === "offline" ? "text-red-500" : "text-slate-400"
              }
            />
          )}
          <span className="text-xs font-semibold">
            {backendStatus === "online"
              ? "Backend Live"
              : backendStatus === "offline"
                ? "Backend Offline"
                : "Connecting..."}
          </span>
        </div>
      </div>

      {liveAlert && (
        <div
          className={`flex items-center gap-3 px-5 py-3.5 rounded-xl mb-5 border ${
            liveAlert.severity === "critical"
              ? "bg-red-50 border-red-200"
              : "bg-amber-50 border-amber-200"
          }`}
        >
          <AlertTriangle
            size={18}
            className={
              liveAlert.severity === "critical"
                ? "text-red-600"
                : "text-amber-500"
            }
          />
          <div className="flex-1">
            <span className="text-[13px] font-semibold text-slate-800">
              {liveAlert.title || "AI Alert"}
            </span>
            <span className="text-xs text-slate-500 ml-2.5">
              {liveAlert.message || liveAlert.summary || ""}
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-1 rounded bg-pink-700 text-white uppercase">
            live
          </span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-5 mb-8">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center shadow-inner">
                <Icon size={24} className="text-pink-700" />
              </div>
              <div>
                <p className="text-[13px] text-slate-500 font-semibold m-0">
                  {s.label}
                </p>
                <p className="text-[26px] font-extrabold text-slate-800 mt-0.5 tracking-[-0.03em]">
                  {s.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-700 to-pink-600 flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <h3 className="text-base font-bold text-slate-800 tracking-[-0.01em] m-0">
            Vitality Triage Queue
          </h3>
        </div>

        <div className="flex flex-col gap-3">
          {triageCases.map((c) => {
            const cfg = triageLevelConfig[c.level];
            const isCritical = c.level === "emergency";

            return (
              <button
                key={c.id}
                onClick={() => onSelectPatient(c.patient)}
                className={`flex items-center gap-4 px-5 py-4 rounded-xl text-left transition-all duration-200 border ${
                  isCritical
                    ? "border-pink-200 bg-pink-50/40 shadow-sm"
                    : "border-slate-100 bg-white"
                } hover:translate-x-1`}
                style={{
                  borderLeft: `4px solid ${isCritical ? "#be185d" : cfg.color}`,
                }}
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-[15px] shrink-0 ${
                    isCritical
                      ? "bg-pink-50 border-2 border-pink-200 text-pink-700"
                      : "bg-slate-50 border-2 border-slate-200 text-slate-600"
                  }`}
                >
                  {c.patient.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-[15px] text-slate-800">
                      {c.patient.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
                        isCritical ? "bg-pink-700 text-white" : ""
                      }`}
                      style={
                        !isCritical
                          ? {
                              backgroundColor: cfg.bg,
                              color: cfg.color,
                            }
                          : undefined
                      }
                    >
                      {cfg.label}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded bg-slate-100 text-slate-500 uppercase tracking-wide">
                      {c.source}
                    </span>
                  </div>
                  <p className="text-[13px] text-slate-600 mt-1.5 font-medium">
                    {c.summary}
                  </p>
                </div>

                <span className="text-xs font-semibold text-slate-400 shrink-0">
                  {c.time}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
