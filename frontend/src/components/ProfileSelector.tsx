import { useState, useEffect } from "react";
import { setWearableProfile } from "../api/client";

const LS_KEY = "vitality_wearable_profile";

const PROFILES: { id: string; label: string }[] = [
  { id: "follicular", label: "Follicular" },
  { id: "ovulation", label: "Ovulation" },
  { id: "luteal_mild", label: "Early Luteal" },
  { id: "luteal_pms", label: "Late Luteal / PMS" },
  { id: "pmdd_crisis", label: "PMDD Crisis" },
  { id: "pcos_flare", label: "PCOS Flare" },
  { id: "perimenopause", label: "Perimenopause" },
  { id: "baseline", label: "Baseline" },
];

export default function ProfileSelector() {
  const [profile, setProfile] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY) || "follicular";
    } catch {
      return "follicular";
    }
  });
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, profile);
    } catch {}
  }, [profile]);

  const handleChange = (value: string) => {
    setProfile(value);
    setUpdating(true);
    setWearableProfile(value)
      .catch(() => {})
      .finally(() => setUpdating(false));
  };

  return (
    <div style={{ padding: "12px 16px", borderTop: "1px solid #f1f5f9" }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#94a3b8",
          textTransform: "uppercase",
          margin: "0 0 8px",
          letterSpacing: "0.02em",
        }}
      >
        Cycle state
      </p>
      <select
        value={profile}
        onChange={(e) => handleChange(e.target.value)}
        disabled={updating}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          fontSize: 13,
          color: "#1f2937",
          backgroundColor: "#fff",
          cursor: updating ? "not-allowed" : "pointer",
          opacity: updating ? 0.6 : 1,
        }}
      >
        {PROFILES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      {updating && (
        <p style={{ fontSize: 10, color: "#94a3b8", margin: "4px 0 0" }}>
          Updating pipeline...
        </p>
      )}
    </div>
  );
}

export function getStoredProfile(): string {
  try {
    return localStorage.getItem(LS_KEY) || "follicular";
  } catch {
    return "follicular";
  }
}
