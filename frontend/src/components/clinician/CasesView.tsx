import { useState, useEffect } from "react";
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

const mockCases = [
  {
    id: "c1",
    patient: patients[0],
    level: "emergency" as TriageLevel,
    summary: "Heavy bleeding + vocal distress",
    source: "multimodal",
    time: "12 min ago",
  },
  {
    id: "c2",
    patient: patients[3],
    level: "emergency" as TriageLevel,
    summary: "Temp spike + severe pelvic pain, nausea",
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
    summary: "Fever + pelvic midline pain",
    source: "call-in",
    time: "2 hrs ago",
  },
  {
    id: "c5",
    patient: patients[2],
    level: "routine" as TriageLevel,
    summary: "Recurring cramps, cycle day 14",
    source: "symptom log",
    time: "3 hrs ago",
  },
];

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
  const flags = vitality?.flags || [];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#1e293b",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Cases
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "#64748b",
              margin: "4px 0 0",
              fontWeight: 500,
            }}
          >
            Pipeline status and patient case list
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            borderRadius: 10,
            backgroundColor: online ? "#f0fdf4" : "#f8fafc",
            border: `1px solid ${online ? "#bbf7d0" : "#e2e8f0"}`,
          }}
        >
          {online ? (
            <Wifi size={14} color="#10b981" />
          ) : (
            <WifiOff size={14} color="#94a3b8" />
          )}
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: online ? "#15803d" : "#64748b",
            }}
          >
            {online ? "Pipeline Live" : "Pipeline Offline"}
          </span>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            padding: 48,
            textAlign: "center",
            backgroundColor: "#fff",
            borderRadius: 16,
            border: "1px solid #f1f5f9",
          }}
        >
          <p style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>
            Loading pipeline status...
          </p>
        </div>
      ) : online && (vitality || alert) ? (
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            border: "1px solid #f1f5f9",
            padding: 24,
            marginBottom: 24,
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, #be185d 0%, #db2777 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Activity size={18} color="#fff" />
            </div>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#1e293b",
                margin: 0,
              }}
            >
              Live pipeline snapshot
            </h3>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}
          >
            <div>
              <p
                style={{
                  fontSize: 12,
                  color: "#94a3b8",
                  margin: "0 0 4px",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Vitality
              </p>
              <p
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#1e293b",
                  margin: 0,
                }}
              >
                {vitality?.index ?? "—"}
              </p>
              <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
                {vitality?.tier_label ?? "—"} · {status?.cycle_state ?? "—"}
              </p>
            </div>
            <div>
              <p
                style={{
                  fontSize: 12,
                  color: "#94a3b8",
                  margin: "0 0 4px",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Summary
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: "#475569",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {vitality?.summary || "No summary"}
              </p>
            </div>
          </div>
          {flags.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p
                style={{
                  fontSize: 12,
                  color: "#94a3b8",
                  margin: "0 0 8px",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Active flags
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {flags.slice(0, 5).map((f: string, i: number) => (
                  <span
                    key={i}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      backgroundColor: "#fef2f2",
                      border: "1px solid #fecaca",
                      fontSize: 12,
                      color: "#991b1b",
                      fontWeight: 500,
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
          {alert && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 12,
                backgroundColor:
                  alert.severity === "critical" ? "#fef2f2" : "#fffbeb",
                border: `1px solid ${alert.severity === "critical" ? "#fecaca" : "#fde68a"}`,
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <AlertTriangle
                size={18}
                color={alert.severity === "critical" ? "#dc2626" : "#f59e0b"}
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1e293b",
                    margin: 0,
                  }}
                >
                  {alert.title || "Alert"}
                </p>
                <p
                  style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}
                >
                  {alert.message || alert.summary || ""}
                </p>
              </div>
            </div>
          )}
          {forecast?.forecast?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p
                style={{
                  fontSize: 12,
                  color: "#94a3b8",
                  margin: "0 0 8px",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                72h forecast (next interval)
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {forecast.forecast.slice(0, 3).map((f: any, i: number) => (
                  <span
                    key={i}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                      color: "#475569",
                    }}
                  >
                    +{f.hour}h: {f.predicted_score} — {f.risk_factor}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 16,
          border: "1px solid #f1f5f9",
          padding: 24,
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <FileText size={20} color="#be185d" />
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#1e293b",
              margin: 0,
            }}
          >
            Patient cases
          </h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mockCases.map((c) => {
            const cfg = triageLevelConfig[c.level];
            const isCritical = c.level === "emergency";
            return (
              <button
                key={c.id}
                onClick={() => onSelectPatient(c.patient)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 20px",
                  borderRadius: 12,
                  border: isCritical
                    ? "1px solid #fbcfe8"
                    : "1px solid #f1f5f9",
                  backgroundColor: isCritical ? "#fffbfe" : "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                  borderLeft: `4px solid ${isCritical ? "#be185d" : cfg.color}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f8fafc";
                  e.currentTarget.style.borderColor = "#e2e8f0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isCritical
                    ? "#fffbfe"
                    : "#fff";
                  e.currentTarget.style.borderColor = isCritical
                    ? "#fbcfe8"
                    : "#f1f5f9";
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 14,
                    color: "#475569",
                    flexShrink: 0,
                  }}
                >
                  {c.patient.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: 15,
                        color: "#1e293b",
                      }}
                    >
                      {c.patient.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: 6,
                        backgroundColor: isCritical ? "#be185d" : cfg.bg,
                        color: isCritical ? "#fff" : cfg.color,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#64748b",
                      margin: "4px 0 0",
                    }}
                  >
                    {c.summary}
                  </p>
                </div>
                <ChevronRight size={18} color="#94a3b8" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
