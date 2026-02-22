import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Phone,
  FlaskConical,
  FileText,
  Calendar,
  BrainCircuit,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { getConsolidated, getForecast, getSmartAlert, getSymptoms } from "../../api/client";
import type { Patient } from "../../config/patients";

const urgencyColor = {
  critical: "#dc2626",
  moderate: "#f59e0b",
  stable: "#10b981",
};

interface PatientDetailProps {
  patient: Patient;
  onBack: () => void;
}

export default function PatientDetail({ patient, onBack }: PatientDetailProps) {
  const [liveData, setLiveData] = useState<any>(null);
  const [forecastData, setForecastData] = useState<any>(null);
  const [alertData, setAlertData] = useState<any>(null);
  const [symptoms, setSymptoms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [vitRes, foreRes, alertRes, symptomsRes] = await Promise.all([
          getConsolidated(),
          getForecast(),
          getSmartAlert(),
          getSymptoms(14).catch(() => ({ symptoms: [] })),
        ]);
        if (vitRes) setLiveData(vitRes);
        if (foreRes?.data) setForecastData(foreRes.data);
        if (alertRes?.data) setAlertData(alertRes.data);
        if (Array.isArray(symptomsRes?.symptoms)) setSymptoms(symptomsRes.symptoms);
      } catch {
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [patient.id]);

  const score = liveData ? Math.round(liveData.vitality_index) : 75;
  const scoreColor =
    score >= 80 ? "#10b981" : score >= 55 ? "#f59e0b" : "#dc2626";
  const flags = (liveData?.flags || []).filter(
    (f: string) =>
      ![
        "[voice] No voice data available",
        "[nlp] NLP module not connected",
        "[behavioral] Behavioral module not connected",
      ].includes(f),
  );

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 font-medium mb-4 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft size={16} /> Back to patients
      </button>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center font-bold text-xl text-slate-700"
            style={{ border: `3px solid ${urgencyColor[patient.urgency]}` }}
          >
            {patient.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div>
            <h2 className="text-[22px] font-bold text-slate-800 tracking-[-0.02em]">
              {patient.name}
            </h2>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              Age {patient.age} &middot; {patient.condition}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Live Fused Vitality
          </span>
          <div className="flex items-center gap-2.5">
            {loading ? (
              <span className="text-sm text-slate-400">Analyzing...</span>
            ) : (
              <>
                <span
                  className="text-3xl font-extrabold leading-none"
                  style={{ color: scoreColor }}
                >
                  {score}
                </span>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-lg uppercase"
                  style={{
                    backgroundColor: `${scoreColor}15`,
                    color: scoreColor,
                  }}
                >
                  {liveData?.tier?.label || patient.urgency}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2.5 flex-wrap mb-6">
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition">
          <Phone size={16} className="text-red-600" /> Call Patient
        </button>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition">
          <FlaskConical size={16} className="text-pink-700" /> Request Lab
          Report
        </button>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition">
          <FileText size={16} className="text-blue-600" /> View Clinical Notes
        </button>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition">
          <Calendar size={16} className="text-emerald-600" /> Schedule Visit
        </button>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-700 to-pink-600 flex items-center justify-center">
              <BrainCircuit size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-800">
                Vitality 72-Hour Risk Forecast
              </h3>
              <p className="text-xs text-slate-500">
                Powered by Stochastic LLM Modeling
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              Generating stochastic forecast...
            </div>
          ) : forecastData ? (
            <div className="flex flex-col gap-4">
              {forecastData.forecast?.map((f: any, i: number) => {
                const borderColor =
                  f.predicted_score < 60
                    ? "#dc2626"
                    : f.predicted_score < 75
                      ? "#f59e0b"
                      : "#10b981";
                return (
                  <div
                    key={i}
                    className="flex gap-3.5 p-4 rounded-xl bg-slate-50"
                    style={{ borderLeft: `4px solid ${borderColor}` }}
                  >
                    <div className="w-10 shrink-0">
                      <span className="block text-xs font-bold text-slate-500">
                        +{f.hour}h
                      </span>
                      <span className="text-lg font-extrabold text-slate-700">
                        {f.predicted_score}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 mb-1">
                        {f.risk_factor}
                      </p>
                      <p className="text-xs text-slate-500 italic">
                        <strong className="text-pink-700">Intervention:</strong>{" "}
                        {f.recommended_intervention}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div className="text-[11px] text-slate-400 text-right italic">
                {forecastData.confidence_note}
              </div>
            </div>
          ) : (
            <div className="py-5 text-center text-slate-400 text-sm">
              No forecast available.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Activity size={18} className="text-blue-600" />
              </div>
              <h3 className="text-[15px] font-semibold text-slate-800">
                Active Clinical Flags
              </h3>
            </div>

            {loading ? (
              <div className="py-5 text-center text-slate-400 text-sm">
                Scanning telemetry...
              </div>
            ) : flags.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {flags.map((flag: string, i: number) => {
                  const isCritical =
                    flag.includes("⚠") ||
                    flag.toLowerCase().includes("critical");
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border ${
                        isCritical
                          ? "bg-red-50 border-red-200"
                          : "bg-amber-50 border-amber-200"
                      }`}
                    >
                      <AlertTriangle
                        size={16}
                        className={
                          isCritical
                            ? "text-red-600 mt-0.5"
                            : "text-amber-500 mt-0.5"
                        }
                      />
                      <span
                        className={`text-sm font-medium leading-relaxed ${
                          isCritical ? "text-red-800" : "text-amber-800"
                        }`}
                      >
                        {flag.replace("⚠", "").trim()}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium text-center">
                All telemetry within normal limits. No active flags.
              </div>
            )}
          </div>

          {alertData && (alertData.title || alertData.message || alertData.summary) && (
            <div
              className={`rounded-2xl border p-5 flex items-start gap-3 ${
                alertData.severity === "critical"
                  ? "bg-red-50 border-red-200"
                  : "bg-amber-50 border-amber-200"
              }`}
            >
              <AlertTriangle
                size={20}
                className={
                  alertData.severity === "critical"
                    ? "text-red-600 shrink-0 mt-0.5"
                    : "text-amber-600 shrink-0 mt-0.5"
                }
              />
              <div>
                <p className="text-sm font-semibold text-slate-900 m-0">
                  {alertData.title || "AI Alert"}
                </p>
                <p className="text-xs text-slate-600 mt-1 m-0">
                  {alertData.message || alertData.summary || ""}
                </p>
                <span className="text-[10px] font-bold text-pink-700 uppercase mt-2 inline-block">
                  Live pipeline
                </span>
              </div>
            </div>
          )}

          {symptoms.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Recent body-map symptoms (pipeline)
              </h3>
              <div className="flex flex-col gap-2">
                {symptoms.slice(0, 5).map((s: any) => (
                  <div
                    key={s.id || s.timestamp}
                    className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0"
                  >
                    <span className="text-sm text-slate-700">
                      {s.region} · {s.type} (severity {s.severity}/10)
                    </span>
                    <span className="text-xs text-slate-400">
                      {s.timestamp ? new Date(s.timestamp).toLocaleDateString() : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Recent EMR Notes
            </h3>
            <div className="flex flex-col gap-4">
              <div className="pb-4 border-b border-slate-100">
                <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Feb 20 • Clinical Visit
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  Patient reported increased pelvic pain and fatigue. Adjusted
                  pain management protocol; requested continuous Vitality
                  telemetry tracking.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Feb 14 • Lab Review
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  Hormone panel reviewed. Progesterone levels lower than
                  expected for luteal phase.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
