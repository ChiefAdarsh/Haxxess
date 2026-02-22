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
    <div className="w-full max-w-full box-border px-4 py-3 border-t border-slate-100 overflow-x-hidden">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
        Cycle state
      </p>

      <select
        value={profile}
        onChange={(e) => handleChange(e.target.value)}
        disabled={updating}
        className={`w-full max-w-full box-border px-3 py-2.5 rounded-lg border text-sm bg-white transition
          ${
            updating
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer hover:border-slate-300"
          }
          border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400
        `}
      >
        {PROFILES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      {updating && (
        <p className="text-[10px] text-slate-400 mt-1">Updating pipeline...</p>
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
