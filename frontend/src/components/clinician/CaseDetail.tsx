import {
  ArrowLeft,
  Phone,
  AlertTriangle,
  FileText,
  TrendingUp,
  Sparkles,
  Activity,
} from "lucide-react";
import { triageLevelConfig } from "../../engine/triage";
import type { Patient } from "../../config/patients";
import type { TriageLevel, BodyRegion } from "../../types";

const mockCase = {
  level: "emergency" as TriageLevel,
  reasons: [
    "Acoustic anomaly detected: High vocal jitter indicative of acute distress",
    "Oura Ring flagged sudden +1.4°C core temp spike over last 4 hours",
    "NLP extracted severe 9/10 pelvic pain radiating to lower back",
    "High risk of ectopic rupture or ovarian torsion based on multi-sensor context",
  ],
  transcript: [
    "[Vitality Voice Journal - 2:14 PM]",
    "\"I don't know what's wrong, it suddenly hurts so bad on my right side...\"",
    '"It started a couple hours ago but now I can barely stand up..."',
    '"I feel super nauseous and dizzy too..."',
    "[Audio flags: elevated pitch variance, trembling detected]",
  ],
  entities: {
    onset: "Acute (2 hrs ago)",
    severity: "9/10 (Critical)",
    location: "Right lower quadrant",
    vitals: "Temp +1.4°C, HRV down 40%",
    nausea: "Present / Dizzy",
    vocal_stress: "High Variance",
  },
  regions: ["RLQ"] as BodyRegion[],
  trend: {
    baseline: 2,
    current: 9,
    change: "+7 from baseline",
  },
  nextSteps: [
    "Initiate immediate telehealth triage call",
    "Order urgent transvaginal ultrasound to rule out ovarian torsion/ectopic",
    "Direct patient to nearest ER if hemodynamic instability occurs",
    "Push Vitality notification for active continuous vitals monitoring",
  ],
};

interface CaseDetailProps {
  patient: Patient;
  onBack: () => void;
}

export default function CaseDetail({ patient, onBack }: CaseDetailProps) {
  const cfg = triageLevelConfig[mockCase.level];
  const isCritical = mockCase.level === "emergency";

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-400 mb-5 p-0 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to Triage Queue
      </button>

      <div
        className={`flex justify-between items-start p-6 mb-6 rounded-2xl border ${
          isCritical
            ? "bg-pink-50 border-pink-200 shadow-[0_8px_24px_-4px_rgba(190,24,93,0.1)]"
            : `bg-[${cfg.bg}] border-[${cfg.color}30] shadow-sm`
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg border-4 ${
              isCritical
                ? "border-pink-700 text-pink-700 shadow-[0_0_16px_rgba(190,24,93,0.2)]"
                : `border-[${cfg.color}] text-slate-700`
            } bg-white`}
          >
            {patient.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight m-0">
                {patient.name}
              </h2>
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 uppercase tracking-wide ${
                  isCritical
                    ? "bg-pink-700 text-white"
                    : `bg-white text-[${cfg.color}] border border-[${cfg.color}]`
                }`}
              >
                {isCritical && <Sparkles size={12} />}
                {cfg.label} Level Alert
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1 font-medium">
              Age {patient.age} &middot; Multimodal Anomaly Detected
            </p>
          </div>
        </div>

        <button className="flex items-center gap-2.5 px-4 py-2 rounded-lg text-white font-semibold text-sm bg-gradient-to-tr from-pink-700 to-pink-600 shadow-md transition-transform hover:-translate-y-0.5 hover:shadow-lg">
          <Phone size={16} /> Urgent Telehealth Call
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-5 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
            <AlertTriangle size={18} color="#e11d48" />
          </div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight m-0">
            Vitality AI Triage Reasoning
          </h3>
        </div>
        <div className="flex flex-col gap-2.5">
          {mockCase.reasons.map((r, i) => (
            <div key={i} className="flex gap-2.5 items-start">
              <div className="w-1.5 h-1.5 rounded-full bg-red-600 mt-2 flex-shrink-0" />
              <p className="text-sm text-slate-800 font-medium leading-relaxed m-0">
                {r}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <FileText size={18} color="#3b82f6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight m-0">
              Voice Journal Transcript
            </h3>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            {mockCase.transcript.map((line, i) => {
              const isMeta = line.startsWith("[");
              return (
                <p
                  key={i}
                  className={`text-sm leading-6 my-1.5 ${
                    isMeta
                      ? "text-slate-400 italic font-semibold"
                      : "text-slate-800 font-normal"
                  }`}
                >
                  {line}
                </p>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <Activity size={18} color="#10b981" />
            </div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight m-0">
              Fused Telemetry Data
            </h3>
          </div>

          <div className="flex flex-col gap-3">
            {Object.entries(mockCase.entities).map(([key, val]) => (
              <div
                key={key}
                className="flex justify-between border-b border-slate-100 pb-2.5"
              >
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                  {key.replace("_", " ")}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    val.includes("Critical") ||
                    val.includes("+1.4") ||
                    val.includes("High")
                      ? "text-pink-700"
                      : "text-slate-900"
                  }`}
                >
                  {val}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3.5 mt-5 p-4 bg-pink-50 border border-pink-200 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
              <TrendingUp size={20} color="#be185d" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-pink-700 uppercase tracking-wide m-0">
                Severity Trend
              </p>
              <p className="text-sm font-semibold text-slate-900 mt-1">
                Baseline {mockCase.trend.baseline}/10 → Current{" "}
                <span className="text-pink-700 font-extrabold">
                  {mockCase.trend.current}/10
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">
          Suggested Protocols (Non-Diagnostic)
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {mockCase.nextSteps.map((step, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <span className="w-6 h-6 rounded-md bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 flex-shrink-0">
                {i + 1}
              </span>
              <p className="text-sm text-slate-800 font-medium leading-snug m-0">
                {step}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
