import { useState, useEffect } from "react";
import { useSymptoms } from "../../context/SymptomContext";
import {
  getConsolidated,
  getSmartAlert,
  getHistoryTrends,
} from "../../api/client";
import { getStoredProfile } from "../ProfileSelector";
import {
  Activity,
  MapPin,
  Calendar,
  Shield,
  AlertTriangle,
  Loader2,
  TrendingUp,
} from "lucide-react";
import type { BodyRegion } from "../../types";

const spinStyle = document.createElement("style");
spinStyle.textContent = "@keyframes spin { to { transform: rotate(360deg) } }";
if (!document.head.querySelector("[data-spin]")) {
  spinStyle.setAttribute("data-spin", "1");
  document.head.appendChild(spinStyle);
}

const regionLabels: Record<BodyRegion, string> = {
  LLQ: "Left Lower Quadrant",
  RLQ: "Right Lower Quadrant",
  pelvic_midline: "Pelvic Midline",
  suprapubic: "Suprapubic",
  vulva: "Vulva",
  low_back: "Lower Back",
  left_thigh: "Left Thigh",
  right_thigh: "Right Thigh",
};

function sevColor(sev: number) {
  if (sev <= 3) return "#d97706";
  if (sev <= 6) return "#ea580c";
  return "#dc2626";
}

function donutGradient(value: number, activeColor: string) {
  const pct = Math.min(100, Math.max(0, value));
  return `conic-gradient(${activeColor} ${pct}%, #f3f4f6 ${pct}%)`;
}

export default function PatientHome() {
  const { getRecent, maxSeverityByRegion } = useSymptoms();
  const recent7 = getRecent(7);
  const severityMap = maxSeverityByRegion();

  const [vitality, setVitality] = useState<any>(null);
  const [alert, setAlert] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const profile = getStoredProfile();
    async function load() {
      try {
        const [vRes, aRes, tRes] = await Promise.all([
          getConsolidated(profile),
          getSmartAlert(profile),
          getHistoryTrends(profile, 14).catch(() => null),
        ]);
        if (cancelled) return;
        setVitality(vRes);
        setAlert(aRes);
        setTrends(tRes?.trends ?? null);
      } catch {
        // backend may not be running
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const regionCounts: Partial<Record<BodyRegion, number>> = {};
  for (const s of recent7) {
    regionCounts[s.region] = (regionCounts[s.region] || 0) + 1;
  }
  const topRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0];

  const cycleInfo = (() => {
    try {
      const raw = localStorage.getItem("vitality_cycle_profile_v1");
      if (!raw) return { day: null as number | null, length: 28 };
      const p = JSON.parse(raw);
      const last = p.lastPeriodStart as string | undefined;
      const length = Math.min(45, Math.max(20, Number(p.cycleLength || 28)));
      if (!last) return { day: null as number | null, length };
      const start = new Date(last + "T00:00:00");
      const diffDays = Math.floor((Date.now() - start.getTime()) / 86_400_000);
      const day = (((diffDays % length) + length) % length) + 1;
      return { day, length };
    } catch {
      return { day: null as number | null, length: 28 };
    }
  })();

  const vitalityColor =
    vitality?.vitality_index >= 60
      ? "#10b981"
      : vitality?.vitality_index >= 35
        ? "#f59e0b"
        : "#dc2626";

  return (
    <div style={{ fontFamily: "inherit" }}>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "#1f2937",
          margin: "0 0 20px",
        }}
      >
        Patient Dashboard
      </h2>

      {loading ? (
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            padding: "24px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <Loader2
            size={18}
            color="#9ca3af"
            style={{ animation: "spin 1s linear infinite" }}
          />
          <span style={{ fontSize: 13, color: "#9ca3af" }}>
            Connecting to vitality backend…
          </span>
        </div>
      ) : !vitality ? (
        <div
          style={{
            backgroundColor: "#f8fafc",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            padding: "24px",
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
            Vitality pipeline offline. Start the backend to see your index and
            alerts.
          </p>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "8px 0 0" }}>
            Symptom and cycle data below are still available.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: "20px",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: donutGradient(
                  vitality.vitality_index,
                  vitalityColor,
                ),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  backgroundColor: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 16,
                  color: "#1f2937",
                }}
              >
                {vitality.vitality_index}
              </div>
            </div>

            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  fontSize: 11,
                  color: "#9ca3af",
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Vitality Index
              </p>
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#1f2937",
                  margin: "3px 0 0",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {vitality.tier?.label || "Unknown"}
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  margin: "2px 0 0",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {vitality.tier?.action || ""}
              </p>
            </div>
          </div>

          {alert?.data ? (
            <div
              style={{
                backgroundColor:
                  alert.data.severity === "critical" ? "#fef2f2" : "#fffbeb",
                borderRadius: 12,
                border: `1px solid ${alert.data.severity === "critical" ? "#fecaca" : "#fde68a"}`,
                padding: "20px",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <AlertTriangle
                size={20}
                color={
                  alert.data.severity === "critical" ? "#dc2626" : "#f59e0b"
                }
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1f2937",
                    margin: "0 0 4px",
                  }}
                >
                  {alert.data.title || "Alert"}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: "#4b5563",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {alert.data.message ||
                    alert.data.summary ||
                    "Check your vitals."}
                </p>
              </div>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: "#f0fdf4",
                borderRadius: 12,
                border: "1px solid #bbf7d0",
                padding: "20px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Shield size={20} color="#10b981" style={{ flexShrink: 0 }} />
              <div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#15803d",
                    margin: 0,
                  }}
                >
                  All Clear
                </p>
                <p
                  style={{ fontSize: 12, color: "#4b5563", margin: "2px 0 0" }}
                >
                  No active alerts
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            padding: "18px",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <Activity
            size={20}
            color="#dc2626"
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <div>
            <p
              style={{
                fontSize: 11,
                color: "#9ca3af",
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Last 7 Days
            </p>
            <p
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#1f2937",
                margin: "2px 0 0",
                lineHeight: 1,
              }}
            >
              {recent7.length}
            </p>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "4px 0 0" }}>
              symptoms logged
            </p>
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            padding: "18px",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <MapPin
            size={20}
            color="#7c3aed"
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: 11,
                color: "#9ca3af",
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Most Affected
            </p>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#1f2937",
                margin: "4px 0 0",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {topRegion ? regionLabels[topRegion[0] as BodyRegion] : "—"}
            </p>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "3px 0 0" }}>
              {topRegion
                ? `${topRegion[1]} entr${topRegion[1] === 1 ? "y" : "ies"}`
                : "no data this week"}
            </p>
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            padding: "18px",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <Calendar
            size={20}
            color="#2563eb"
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <div>
            <p
              style={{
                fontSize: 11,
                color: "#9ca3af",
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Cycle Day
            </p>
            <p
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#1f2937",
                margin: "2px 0 0",
                lineHeight: 1,
              }}
            >
              {cycleInfo.day ?? "—"}
            </p>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "4px 0 0" }}>
              {cycleInfo.day
                ? `of ${cycleInfo.length}-day cycle`
                : "Set in Cycle tab"}
            </p>
          </div>
        </div>
      </div>

      {trends &&
        typeof trends === "object" &&
        Object.keys(trends).length > 0 && (
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: "20px",
              marginBottom: 20,
            }}
          >
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#1f2937",
                margin: "0 0 14px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <TrendingUp size={16} color="#be185d" />
              Vitality Trend (14d)
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {trends.vitality_index?.description && (
                <span
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    backgroundColor: "#fdf2f8",
                    border: "1px solid #fbcfe8",
                    fontSize: 12,
                    color: "#be185d",
                    fontWeight: 600,
                  }}
                >
                  Index: {trends.vitality_index.description}
                </span>
              )}
              {(["sleep_score", "hrv", "stress"] as const)
                .filter((k) => trends[k]?.description)
                .map((k) => (
                  <span
                    key={k}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                      color: "#475569",
                    }}
                  >
                    {k.replace(/_/g, " ")}: {trends[k].description}
                  </span>
                ))}
            </div>
          </div>
        )}

      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          padding: "20px",
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#1f2937",
            margin: "0 0 14px",
          }}
        >
          7-Day Region Summary
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(Object.entries(severityMap) as [BodyRegion, number][]).map(
            ([region, sev]) => {
              const color = sevColor(sev);
              return (
                <div
                  key={region}
                  style={{
                    padding: "7px 13px",
                    borderRadius: 8,
                    backgroundColor: `${color}1a`,
                    border: `1px solid ${color}33`,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}
                  >
                    {regionLabels[region]}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color }}>
                    {sev}/10
                  </span>
                </div>
              );
            },
          )}
          {Object.keys(severityMap).length === 0 && (
            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
              No symptoms logged this week.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
