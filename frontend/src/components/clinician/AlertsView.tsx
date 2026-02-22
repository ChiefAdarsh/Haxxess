import { useState, useEffect } from "react";
import {
  Phone,
  Check,
  Activity,
  Droplets,
  Thermometer,
  BrainCircuit,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import { patients } from "../../config/patients";
import { triageLevelConfig } from "../../engine/triage";
import { getSmartAlert } from "../../api/client";
import type { TriageLevel } from "../../types";

interface Alert {
  id: string;
  patient: (typeof patients)[0];
  message: string;
  level: TriageLevel;
  icon: "vitals" | "bleeding" | "temp" | "voice";
  time: string;
  acknowledged: boolean;
}

const currentPatientForAlerts =
  typeof window !== "undefined" &&
  localStorage.getItem("vitality_patient_name")
    ? { ...patients[0], name: localStorage.getItem("vitality_patient_name")! }
    : patients[0];

const iconMap = {
  vitals: Activity,
  bleeding: Droplets,
  temp: Thermometer,
  voice: BrainCircuit,
};

export default function AlertsView() {
  const [liveAlertData, setLiveAlertData] = useState<{
    title?: string;
    message?: string;
    summary?: string;
    severity?: string;
  } | null>(null);
  const [backendConnected, setBackendConnected] = useState(false);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function fetchLiveAlert() {
      try {
        const res = await getSmartAlert();
        if (cancelled) return;
        setBackendConnected(true);
        if (res?.data && (res.data.title || res.data.message || res.data.summary)) {
          setLiveAlertData({
            title: res.data.title,
            message: res.data.message,
            summary: res.data.summary,
            severity: res.data.severity,
          });
        } else {
          setLiveAlertData(null);
        }
      } catch {
        if (!cancelled) setBackendConnected(false);
      }
    }
    fetchLiveAlert();
    const interval = setInterval(fetchLiveAlert, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const liveAlertAsAlert: Alert | null = liveAlertData
    ? {
        id: "live-backend",
        patient: currentPatientForAlerts,
        message: [liveAlertData.title, liveAlertData.message || liveAlertData.summary]
          .filter(Boolean)
          .join(": "),
        level: liveAlertData.severity === "critical" ? "emergency" : "same_day",
        icon: "vitals",
        time: "Live",
        acknowledged: acknowledgedIds.has("live-backend"),
      }
    : null;

  const active = liveAlertAsAlert && !acknowledgedIds.has("live-backend")
    ? [liveAlertAsAlert]
    : [];

  const acknowledge = (id: string) =>
    setAcknowledgedIds((prev) => new Set(prev).add(id));

  const resolved: Alert[] = liveAlertAsAlert && acknowledgedIds.has("live-backend")
    ? [liveAlertAsAlert]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-[22px] font-bold text-slate-900 -tracking-[0.02em]">
              Vitality Live Alerts
            </h2>
            {active.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full uppercase bg-pink-50 text-pink-700 border border-pink-200">
                <Sparkles size={12} /> {active.length} Active Flags
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Continuous telemetry and AI triage notifications
          </p>
        </div>
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border ${backendConnected ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"}`}
        >
          {backendConnected ? (
            <Wifi size={12} className="text-green-500" />
          ) : (
            <WifiOff size={12} className="text-slate-400" />
          )}
          <span
            className={`text-[11px] font-semibold ${backendConnected ? "text-green-800" : "text-slate-400"}`}
          >
            {backendConnected ? "Live Feed" : "Mock Data"}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {active.length === 0 && !liveAlertData && backendConnected && (
          <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 text-center text-slate-500 text-sm font-medium">
            No active alerts — pipeline clear.
          </div>
        )}
        {active.map((alert) => {
          const Icon = iconMap[alert.icon];
          const cfg = triageLevelConfig[alert.level];
          const isCritical = alert.level === "emergency";

          return (
            <div
              key={alert.id}
              className={`flex items-center gap-4 p-5 rounded-xl border-l-4 transition-transform duration-300 hover:translate-x-1 ${
                isCritical
                  ? "border-pink-200 bg-pink-50 shadow-lg border-l-pink-600"
                  : `border-slate-200 bg-white border-l-[${cfg.color}] shadow-sm`
              }`}
            >
              <div
                className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${isCritical ? "bg-pink-50 border border-pink-200" : `bg-[${cfg.bg}] border-transparent`}`}
              >
                <Icon size={24} color={isCritical ? "#be185d" : cfg.color} />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-slate-900">
                    {alert.patient.name}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded ${isCritical ? "bg-pink-600 text-white" : `bg-[${cfg.bg}] text-[${cfg.color}]`} uppercase`}
                  >
                    {cfg.label}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    {alert.time}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600 font-medium leading-snug">
                  {alert.message}
                </p>
              </div>

              <div className="flex gap-3 flex-shrink-0">
                <button
                  onClick={() => acknowledge(alert.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-semibold shadow-sm transition hover:bg-slate-50 hover:border-slate-300"
                >
                  <Check size={16} /> Ack
                </button>
                <button
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-sm transition transform hover:-translate-y-0.5 ${
                    isCritical
                      ? "bg-gradient-to-br from-pink-600 to-pink-500 shadow-pink-400/50 hover:shadow-pink-500/50"
                      : "bg-blue-500 shadow-blue-400/50 hover:shadow-blue-500/50"
                  }`}
                >
                  <Phone size={16} /> Urgent Call
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {resolved.length > 0 && (
        <div className="mt-10">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-wide">
            Acknowledged Flags
          </h3>
          <div className="flex flex-col gap-3">
            {resolved.map((alert) => {
              const Icon = iconMap[alert.icon];
              return (
                <div
                  key={alert.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200 opacity-70 hover:opacity-100 transition"
                >
                  <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-slate-100">
                    <Icon size={18} className="text-slate-400" />
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-500 w-36">
                      {alert.patient.name}
                    </span>
                    <span className="text-xs text-slate-400 truncate">
                      {alert.message}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-300">
                    {alert.time}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
