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
  Heart,
  Thermometer,
  Droplets,
  TrendingUp,
} from "lucide-react";
import {
  getConsolidated,
  getForecast,
  getSmartAlert,
  getSymptoms,
  getStatus,
  getHistoryTrends,
  getCallHistory,
} from "../../api/client";
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
  const [statusData, setStatusData] = useState<any>(null);
  const [forecastData, setForecastData] = useState<any>(null);
  const [alertData, setAlertData] = useState<any>(null);
  const [symptoms, setSymptoms] = useState<any[]>([]);
  const [historyTrends, setHistoryTrends] = useState<any>(null);
  const [callRecords, setCallRecords] = useState<any[]>([]);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [vitRes, statusRes, foreRes, alertRes, symptomsRes, trendsRes, callRes] =
          await Promise.all([
            getConsolidated(),
            getStatus().catch(() => null),
            getForecast(),
            getSmartAlert(),
            getSymptoms(30).catch(() => ({ symptoms: [] })),
            getHistoryTrends(undefined, 14).catch(() => null),
            getCallHistory(patient.id).catch(() => ({ calls: [] })),
          ]);
        if (vitRes) setLiveData(vitRes);
        if (statusRes) setStatusData(statusRes);
        if (foreRes?.data) setForecastData(foreRes.data);
        if (alertRes?.data) setAlertData(alertRes.data);
        if (Array.isArray(symptomsRes?.symptoms)) setSymptoms(symptomsRes.symptoms);
        if (trendsRes?.trends) setHistoryTrends(trendsRes.trends);
        if (Array.isArray(callRes?.calls)) setCallRecords(callRes.calls);
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

      {/* How they're doing: cycle state + summary + trend */}
      {!loading && (liveData?.summary || statusData?.cycle_state || statusData?.trend_context) && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            How they&apos;re doing
          </h3>
          <div className="flex flex-wrap gap-4 items-start">
            {statusData?.cycle_state && (
              <span className="text-sm font-semibold text-pink-700 bg-pink-50 px-3 py-1.5 rounded-lg">
                Cycle state: {statusData.cycle_state.replace(/_/g, " ")}
              </span>
            )}
            {statusData?.trend_context?.trajectory && (
              <span className="text-sm text-slate-600 flex items-center gap-1.5">
                <TrendingUp size={14} />
                Trend: {statusData.trend_context.trajectory}
                {statusData.trend_context.delta_7d != null && (
                  <span className="text-slate-500">
                    ({statusData.trend_context.delta_7d > 0 ? "+" : ""}
                    {statusData.trend_context.delta_7d?.toFixed(1)}/day)
                  </span>
                )}
              </span>
            )}
          </div>
          {liveData?.summary && (
            <p className="text-sm text-slate-700 mt-3 leading-relaxed">
              {liveData.summary}
            </p>
          )}
        </div>
      )}

      {/* Live Vitals (same as patient Vitals tab) */}
      {!loading && statusData?.wearable && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Live vitals
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(() => {
              const aw = statusData.wearable?.apple_watch || {};
              const bp = aw.blood_pressure || {};
              const hr = aw.heart_rate_bpm ?? "—";
              const sys = bp.systolic_mmhg ?? "—";
              const dia = bp.diastolic_mmhg ?? "—";
              const dex = statusData.wearable?.dexcom_g7 || {};
              const glucose = dex.glucose_mg_dl ?? "—";
              const oura = statusData.wearable?.oura_ring || {};
              const tempDelta = oura.skin_temperature_delta_c ?? 0;
              const temp = typeof tempDelta === "number" ? (36.5 + tempDelta).toFixed(1) : "—";
              return (
                <>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                    <Heart size={20} className="text-red-600 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-red-600 uppercase">Heart rate</p>
                      <p className="text-lg font-bold text-slate-800">{hr} bpm</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <Activity size={20} className="text-amber-600 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-600 uppercase">Blood pressure</p>
                      <p className="text-lg font-bold text-slate-800">{sys}/{dia}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                    <Droplets size={20} className="text-blue-600 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-blue-600 uppercase">Glucose</p>
                      <p className="text-lg font-bold text-slate-800">{glucose} mg/dL</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-pink-50 border border-pink-100">
                    <Thermometer size={20} className="text-pink-600 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-pink-600 uppercase">Temp (est.)</p>
                      <p className="text-lg font-bold text-slate-800">{temp} °C</p>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

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

          {/* Vitality trend (last 14 days) – same as patient home */}
          {!loading && historyTrends && typeof historyTrends === "object" && Object.keys(historyTrends).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <TrendingUp size={14} /> Vitality trend (14d)
              </h3>
              <div className="flex flex-wrap gap-2">
                {historyTrends.vitality_index?.description && (
                  <span className="px-3 py-1.5 rounded-lg bg-pink-50 border border-pink-100 text-sm font-semibold text-pink-700">
                    Index: {historyTrends.vitality_index.description}
                  </span>
                )}
                {historyTrends.heart_rate?.description && (
                  <span className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
                    HR: {historyTrends.heart_rate.description}
                  </span>
                )}
                {historyTrends.hrv?.description && (
                  <span className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
                    HRV: {historyTrends.hrv.description}
                  </span>
                )}
                {historyTrends.glucose?.description && (
                  <span className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
                    Glucose: {historyTrends.glucose.description}
                  </span>
                )}
              </div>
            </div>
          )}

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

          {/* Body map symptoms – full list */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Body map symptoms (pipeline)
            </h3>
            {loading ? (
              <p className="text-sm text-slate-400 py-2">Loading...</p>
            ) : symptoms.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">No symptoms logged in the last 30 days.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {symptoms.map((s: { id?: string; timestamp?: string; region?: string; type?: string; severity?: number; qualities?: string[]; notes?: string }) => {
                  const sev = s.severity ?? 0;
                  const sevColor = sev >= 7 ? "#dc2626" : sev >= 4 ? "#f59e0b" : "#10b981";
                  return (
                    <div
                      key={s.id || s.timestamp || Math.random()}
                      className="flex flex-wrap items-start justify-between gap-2 py-3 px-4 rounded-xl border border-slate-100 hover:border-slate-200"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800 capitalize">
                            {String(s.region || "").replace(/_/g, " ")}
                          </span>
                          <span className="text-xs font-medium text-slate-500">{s.type}</span>
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded"
                            style={{ backgroundColor: `${sevColor}20`, color: sevColor }}
                          >
                            {sev}/10
                          </span>
                        </div>
                        {Array.isArray(s.qualities) && s.qualities.length > 0 && (
                          <p className="text-xs text-slate-500 mt-1">
                            {s.qualities.join(", ")}
                          </p>
                        )}
                        {s.notes && (
                          <p className="text-xs text-slate-600 mt-1 italic">&quot;{s.notes}&quot;</p>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">
                        {s.timestamp ? new Date(s.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Call History */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <Phone size={16} className="text-pink-700" />
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Call History
              </h3>
              {callRecords.length > 0 && (
                <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-50 border border-pink-200 text-pink-700">
                  {callRecords.length} call{callRecords.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {loading ? (
              <p className="text-sm text-slate-400 py-2">Loading...</p>
            ) : callRecords.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">No call history for this patient.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {callRecords.map((call: any) => {
                  const triage = call.triage || {};
                  const entities = call.entities || {};
                  const level = triage.level || "self_care";
                  const triageColor =
                    level === "emergency" ? "#dc2626" :
                    level === "urgent" ? "#f59e0b" :
                    level === "routine" ? "#2563eb" : "#10b981";
                  const triageLabel =
                    level === "emergency" ? "Emergency" :
                    level === "urgent" ? "Urgent" :
                    level === "routine" ? "Routine" : "Self-Care";
                  const isExpanded = expandedCall === call.call_sid;
                  return (
                    <div key={call.call_sid} className="rounded-xl border border-slate-100 overflow-hidden">
                      <button
                        onClick={() => setExpandedCall(isExpanded ? null : call.call_sid)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/50 transition-colors cursor-pointer"
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: triageColor }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                              style={{ color: triageColor, backgroundColor: `${triageColor}15` }}
                            >
                              {triageLabel}
                            </span>
                            <span className="text-xs text-slate-400">
                              {call.timestamp ? new Date(call.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                            </span>
                          </div>
                          {entities.summary && (
                            <p className="text-sm text-slate-700 mt-1 truncate">{entities.summary}</p>
                          )}
                        </div>
                        <span className="text-slate-400 shrink-0 text-xs">{isExpanded ? "▲" : "▼"}</span>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
                          {triage.reason && (
                            <div className="rounded-lg p-3 border" style={{ backgroundColor: `${triageColor}08`, borderColor: `${triageColor}30` }}>
                              <p className="text-xs font-semibold" style={{ color: triageColor }}>{triageLabel}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{triage.reason}</p>
                              {triage.action && <p className="text-xs text-slate-600 mt-1 font-medium">{triage.action}</p>}
                            </div>
                          )}
                          {call.transcript && (
                            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Transcript</p>
                              <p className="text-sm text-slate-700 leading-relaxed">{call.transcript}</p>
                            </div>
                          )}
                          {entities.symptoms && entities.symptoms.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {entities.symptoms.map((s: string, i: number) => (
                                <span key={i} className="rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-[11px] font-medium text-purple-700">{s}</span>
                              ))}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {entities.severity != null && (
                              <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
                                <span className="text-slate-400 font-semibold">Severity:</span> <span className="font-bold text-slate-700">{entities.severity}/10</span>
                              </div>
                            )}
                            {entities.onset && (
                              <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
                                <span className="text-slate-400 font-semibold">Onset:</span> <span className="text-slate-700">{entities.onset}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

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
