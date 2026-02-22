import type { LucideIcon } from "lucide-react";

export type Role = "patient" | "clinician" | null;

export interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
}

export type BodyRegion =
  | "LLQ"
  | "RLQ"
  | "pelvic_midline"
  | "suprapubic"
  | "vulva"
  | "low_back"
  | "left_thigh"
  | "right_thigh";

export type SymptomType =
  | "pain"
  | "cramp"
  | "burning"
  | "pressure"
  | "itch"
  | "bleeding"
  | "discharge"
  | "gi";

export type QualityTag = "stabbing" | "dull" | "throbbing" | "radiating";
export type Timing = "sudden" | "gradual" | "constant" | "intermittent";
export type Trigger = "sex" | "urination" | "bowel_movement" | "exercise";

export type TriageLevel = "emergency" | "same_day" | "routine" | "self_care";

export interface SymptomEntry {
  id: string;
  region: BodyRegion;
  type: SymptomType;
  severity: number;
  qualities: QualityTag[];
  timing: Timing;
  triggers: Trigger[];
  notes: string;
  timestamp: string;
}

export interface TriageResult {
  level: TriageLevel;
  reasons: string[];
}
