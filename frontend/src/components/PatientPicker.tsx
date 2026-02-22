import { useState } from "react";
import { UserPlus, ArrowLeft, ChevronRight } from "lucide-react";
import { patients } from "../config/patients";
import type { Patient } from "../config/patients";

const LS_NAME = "vitality_patient_name";
const LS_ID = "vitality_patient_id";

interface PatientPickerProps {
  onSelectExisting: (patient: Patient) => void;
  onSelectNew: (name: string) => void;
  onBack: () => void;
}

export default function PatientPicker({
  onSelectExisting,
  onSelectNew,
  onBack,
}: PatientPickerProps) {
  const [newName, setNewName] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  const selectExisting = (p: Patient) => {
    try {
      localStorage.setItem(LS_NAME, p.name);
      localStorage.setItem(LS_ID, p.id);
    } catch {}
    onSelectExisting(p);
  };

  const submitNew = () => {
    const name = newName.trim() || "New Patient";
    try {
      localStorage.setItem(LS_NAME, name);
      localStorage.setItem(LS_ID, "new");
    } catch {}
    onSelectNew(name);
  };

  if (showNewForm) {
    return (
      <div
        className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 overflow-y-auto px-4 py-10 sm:px-6 sm:py-16"
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      >
        <button
          onClick={() => setShowNewForm(false)}
          className="absolute left-6 top-6 flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-500"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="w-full max-w-sm rounded-[20px] border border-gray-200 bg-white px-12 py-10 shadow-sm">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-700 to-pink-600">
            <UserPlus size={28} color="#fff" />
          </div>

          <h2 className="mb-2 text-[22px] font-bold text-slate-900">
            New patient
          </h2>
          <p className="mb-6 text-sm text-slate-500">
            Enter your name to get started.
          </p>

          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNew()}
            placeholder="Your name"
            autoFocus
            className="mb-5 w-full rounded-xl border border-gray-200 px-[18px] py-[14px] text-base text-slate-900 outline-none transition-[border-color,box-shadow] focus:border-pink-700 focus:ring-[3px] focus:ring-pink-700/10"
          />

          <button
            onClick={submitNew}
            className="w-full cursor-pointer rounded-xl border-none bg-gradient-to-br from-pink-700 to-pink-600 py-[14px] text-[15px] font-semibold text-white"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-screen flex-col items-center justify-center bg-slate-50 p-6"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <button
        onClick={onBack}
        className="absolute left-6 top-6 flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-500"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="mb-8 text-center">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">
          Continue as patient
        </h1>
        <p className="text-sm text-slate-500">
          Select your profile or create a new one.
        </p>
      </div>

      <div className="mb-6 flex w-full max-w-[420px] flex-col gap-3">
        {patients.map((p) => (
          <button
            key={p.id}
            onClick={() => selectExisting(p)}
            className="flex cursor-pointer items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-[18px] text-left shadow-sm transition-all duration-200 hover:border-pink-200 hover:shadow-[0_4px_12px_rgba(190,24,93,0.08)]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pink-50 text-base font-bold text-pink-700">
              {p.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <div className="flex-1">
              <p className="m-0 text-base font-semibold text-slate-900">
                {p.name}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{p.condition}</p>
            </div>
            <ChevronRight size={20} color="#94a3b8" />
          </button>
        ))}

        <button
          onClick={() => setShowNewForm(true)}
          className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-gray-200 bg-white px-8 py-4 text-[15px] font-semibold text-slate-500 transition-all duration-200 hover:border-pink-700 hover:bg-pink-50 hover:text-pink-700"
        >
          <UserPlus size={20} />
          I'm a new patient
        </button>
      </div>
    </div>
  );
}
