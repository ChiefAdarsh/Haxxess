import { useState, useEffect } from "react";
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

  // Connect to the Python FastAPI WebSocket for live Wearable/FemTech data
  useEffect(() => {
    const ws = new WebSocket(WEARABLE_WS_URL);

    ws.onopen = () => setLiveData((prev) => ({ ...prev, status: "connected" }));

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Extract the live values from Apple Watch, Dexcom, and Oura Ring
      const hr = data.apple_watch?.heart_rate_bpm ?? liveData.hr;
      const sys =
        data.apple_watch?.blood_pressure?.systolic_mmhg ?? liveData.sys;
      const dia =
        data.apple_watch?.blood_pressure?.diastolic_mmhg ?? liveData.dia;
      const glucose = data.dexcom_g7?.glucose_mg_dl ?? liveData.glucose;
      const glucoseTrend = data.dexcom_g7?.trend_key ?? "stable";

      // Calculate absolute temp from Oura's delta (assuming 36.5C baseline)
      const tempDelta = data.oura_ring?.skin_temperature_delta_c ?? 0;
      const currentTemp = Number((36.5 + tempDelta).toFixed(1));

      setLiveData({
        hr,
        sys,
        dia,
        glucose,
        temp: currentTemp,
        glucoseTrend,
        status: "connected",
        lastSynced: new Date().toLocaleTimeString(),
      });

      // Push the new live values into the chart history arrays (keep last 7 points)
      setHistory((prev) => ({
        hr: [...prev.hr.slice(1), hr],
        bpSys: [...prev.bpSys.slice(1), sys],
        glucose: [...prev.glucose.slice(1), glucose],
        temp: [...prev.temp.slice(1), currentTemp],
      }));
    };

    ws.onclose = () =>
      setLiveData((prev) => ({ ...prev, status: "disconnected" }));

    return () => ws.close();
  }, []);

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
            : "🔴 Disconnected"}
        </span>
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
