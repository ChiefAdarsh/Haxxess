import { useState, useEffect, useRef } from "react";
import {
  Heart,
  Droplets,
  TrendingUp,
  TrendingDown,
  Minus,
  Thermometer,
} from "lucide-react";
import { WEARABLE_WS_URL } from "../../api/client";

// Keep the initial history arrays so the charts have a baseline to start from
const initialHistory = {
  hr: [68, 71, 74, 70, 72, 69, 72],
  bpSys: [122, 124, 126, 125, 128, 127, 128],
  glucose: [118, 115, 112, 110, 108, 106, 105],
  temp: [36.2, 36.3, 36.5, 36.7, 36.8, 36.8, 36.9],
};

function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 180;
  const h = 50;

  // Map the data points to SVG coordinates
  const points = data
    .map(
      (v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`,
    )
    .join(" ");

  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: "all 0.5s ease" }}
      />
    </svg>
  );
}

export default function VitalsView() {
  const [liveData, setLiveData] = useState({
    hr: 72,
    sys: 128,
    dia: 84,
    glucose: 105,
    temp: 36.9,
    glucoseTrend: "stable",
    status: "connecting...",
    lastSynced: "Just now",
  });

  const [history, setHistory] = useState(initialHistory);

  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connectKey, setConnectKey] = useState(0);

  // Connect to the Python FastAPI WebSocket for live Wearable/FemTech data; auto-reconnect on close/error
  useEffect(() => {
    const url = WEARABLE_WS_URL;
    const ws = new WebSocket(url);

    ws.onopen = () => setLiveData((prev) => ({ ...prev, status: "connected" }));

    ws.onmessage = (event) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data as string) as Record<string, unknown>;
      } catch {
        return;
      }
      if (!data || typeof data !== "object") return;

      const aw = data.apple_watch as Record<string, unknown> | undefined;
      const bp = aw?.blood_pressure as { systolic_mmhg?: number; diastolic_mmhg?: number } | undefined;
      const dexcom = data.dexcom_g7 as Record<string, unknown> | undefined;
      const oura = data.oura_ring as Record<string, unknown> | undefined;

      const hr = (aw?.heart_rate_bpm as number | undefined) ?? 72;
      const sys = bp?.systolic_mmhg ?? 128;
      const dia = bp?.diastolic_mmhg ?? 84;
      const glucose = (dexcom?.glucose_mg_dl as number | undefined) ?? 105;
      const glucoseTrend = (dexcom?.trend_key as string | undefined) ?? "stable";
      const tempDelta = (oura?.skin_temperature_delta_c as number | undefined) ?? 0;
      const currentTemp = Number((36.5 + tempDelta).toFixed(1));

      setLiveData((prev) => ({
        ...prev,
        hr,
        sys,
        dia,
        glucose,
        temp: currentTemp,
        glucoseTrend,
        status: "connected",
        lastSynced: new Date().toLocaleTimeString(),
      }));

      setHistory((prev) => ({
        hr: [...prev.hr.slice(1), hr],
        bpSys: [...prev.bpSys.slice(1), sys],
        glucose: [...prev.glucose.slice(1), glucose],
        temp: [...prev.temp.slice(1), currentTemp],
      }));
    };

    const scheduleReconnect = () => {
      setLiveData((prev) => ({ ...prev, status: "disconnected" }));
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        setConnectKey((k) => k + 1);
      }, 3000);
    };

    ws.onerror = scheduleReconnect;
    ws.onclose = scheduleReconnect;

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      ws.close();
    };
  }, [connectKey]);

  // Map the live data into the UI structure
  const vitals = [
    {
      label: "Heart Rate",
      value: liveData.hr.toString(),
      unit: "bpm",
      trend: liveData.hr > 80 ? "up" : "stable",
      trendText: "Live (Apple Watch)",
      icon: Heart,
      color: "#dc2626",
      history: history.hr,
    },
    {
      label: "Blood Pressure",
      value: `${liveData.sys}/${liveData.dia}`,
      unit: "mmHg",
      trend: liveData.sys > 130 ? "up" : "stable",
      trendText: "Live (Apple Watch)",
      icon: TrendingUp,
      color: "#f59e0b",
      history: history.bpSys,
    },
    {
      label: "Blood Glucose",
      value: liveData.glucose.toString(),
      unit: "mg/dL",
      trend: liveData.glucoseTrend.includes("rising")
        ? "up"
        : liveData.glucoseTrend.includes("falling")
          ? "down"
          : "stable",
      trendText: "Live (Dexcom G7)",
      icon: Droplets,
      color: "#2563eb",
      history: history.glucose,
    },
    {
      label: "Basal Body Temp",
      value: liveData.temp.toString(),
      unit: "°C",
      trend: liveData.temp > 36.7 ? "up" : "stable",
      trendText: "Live (Oura Ring)",
      icon: Thermometer,
      color: "#ec4899", // Pink theme for FemTech
      history: history.temp,
    },
  ];

  const trendIcon = { up: TrendingUp, down: TrendingDown, stable: Minus };
  const trendColor = { up: "#dc2626", down: "#10b981", stable: "#9ca3af" };
  const days = ["-6m", "-5m", "-4m", "-3m", "-2m", "-1m", "Now"];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2
          style={{ fontSize: 18, fontWeight: 600, color: "#1f2937", margin: 0 }}
        >
          My Live Vitals
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: 12,
              backgroundColor:
                liveData.status === "connected" ? "#d1fae5" : "#fee2e2",
              color: liveData.status === "connected" ? "#065f46" : "#991b1b",
            }}
          >
            {liveData.status === "connected"
              ? `🟢 Live — Last synced: ${liveData.lastSynced}`
              : "🔴 Disconnected — reconnecting in a few seconds…"}
          </span>
          {liveData.status !== "connected" && (
            <button
              type="button"
              onClick={() => setConnectKey((k) => k + 1)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: 8,
                border: "1px solid #dc2626",
                backgroundColor: "#fff",
                color: "#991b1b",
                cursor: "pointer",
              }}
            >
              Reconnect now
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 16,
        }}
      >
        {vitals.map((v) => {
          const Icon = v.icon;
          const TIcon = trendIcon[v.trend as keyof typeof trendIcon];
          return (
            <div
              key={v.label}
              style={{
                backgroundColor: "#fff",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: "22px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                transition: "transform 0.2s ease",
                cursor: "default",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: `${v.color}15`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={20} color={v.color} />
                  </div>
                  <div>
                    <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
                      {v.label}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 28,
                          fontWeight: 700,
                          color: "#1f2937",
                          fontVariantNumeric: "tabular-nums", // Keeps numbers from jittering left/right
                        }}
                      >
                        {v.value}
                      </span>
                      <span style={{ fontSize: 13, color: "#9ca3af" }}>
                        {v.unit}
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    marginTop: 4,
                  }}
                >
                  <TIcon
                    size={14}
                    color={trendColor[v.trend as keyof typeof trendColor]}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: trendColor[v.trend as keyof typeof trendColor],
                      fontWeight: 500,
                    }}
                  >
                    {v.trendText}
                  </span>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-end",
                }}
              >
                <MiniChart data={v.history} color={v.color} />
                <div style={{ display: "flex", gap: 8 }}>
                  {days.map((d, idx) => (
                    <span key={idx} style={{ fontSize: 10, color: "#d1d5db" }}>
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
