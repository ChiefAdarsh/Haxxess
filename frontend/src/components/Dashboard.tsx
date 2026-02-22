import { useState } from "react";
import Sidebar from "./Sidebar";
import DashboardHome from "./clinician/DashboardHome";
import PatientList from "./clinician/PatientList";
import PatientDetail from "./clinician/PatientDetail";
import AlertsView from "./clinician/AlertsView";
import PatientHome from "./patient/PatientHome";
import PatientTracker from "./patient/PatientTracker";
import PatientCycle from "./patient/PatientCycle";
import BodyMap from "./patient/BodyMap";
import SymptomHistory from "./patient/SymptomHistory";
import CallIn from "./patient/CallIn";
import MessagesView from "./patient/MessagesView";
import VitalsView from "./patient/VitalsView";
import WellnessView from "./patient/WellnessView";
import CasesView from "./clinician/CasesView";
import CalendarView from "./clinician/CalendarView";
import PatientCalendarView from "./patient/PatientCalendarView";
import { patientTabs, clinicianTabs } from "../config/tabs";
import type { Patient } from "../config/patients";
import { Sparkles } from "lucide-react";

interface DashboardProps {
  role: "patient" | "clinician";
  onLogout: () => void;
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-pink-200 bg-pink-50 py-20">
      <Sparkles className="mb-3 opacity-50" size={24} color="#ec4899" />
      <p className="text-sm font-medium text-pink-800">
        {label} is under development
      </p>
    </div>
  );
}

export default function Dashboard({ role, onLogout }: DashboardProps) {
  const tabs = role === "patient" ? patientTabs : clinicianTabs;

  const [active, setActive] = useState(
    role === "patient" ? "home" : "dashboard",
  );
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const current = tabs.find((t) => t.id === active);

  const patientName =
    typeof window !== "undefined"
      ? (localStorage.getItem("vitality_patient_name") ?? "Patient")
      : "Patient";

  const patientInitials = patientName
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleTabChange = (id: string) => {
    setActive(id);
    setSelectedPatient(null);
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setActive("patients");
  };

  const renderContent = () => {
    if (role === "patient") {
      switch (active) {
        case "home":
          return <PatientHome />;
        case "messages":
          return <MessagesView />;
        case "vitals":
          return <VitalsView />;
        case "wellness":
          return <WellnessView />;
        case "bodymap":
          return <BodyMap />;
        case "history":
          return <SymptomHistory />;
        case "tracker":
          return <PatientTracker />;
        case "cycle":
          return <PatientCycle />;
        case "calendar":
          return <PatientCalendarView />;
        case "callin":
          return <CallIn />;
        default:
          return <Placeholder label={current?.label ?? ""} />;
      }
    }

    if (role === "clinician") {
      switch (active) {
        case "dashboard":
          return <DashboardHome onSelectPatient={handleSelectPatient} />;
        case "patients":
          return selectedPatient ? (
            <PatientDetail
              patient={selectedPatient}
              onBack={() => setSelectedPatient(null)}
            />
          ) : (
            <PatientList onSelectPatient={handleSelectPatient} />
          );
        case "cases":
          return <CasesView onSelectPatient={handleSelectPatient} />;
        case "alerts":
          return <AlertsView />;
        case "calendar":
          return <CalendarView onSelectPatient={handleSelectPatient} />;
        default:
          return <Placeholder label={current?.label ?? ""} />;
      }
    }
  };

  const headerLabel =
    role === "clinician" && active === "patients" && selectedPatient
      ? `Patients › ${selectedPatient.name}`
      : role === "patient"
        ? patientName
        : (current?.label ?? "");

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-rose-50 font-sans">
      <Sidebar
        role={role}
        tabs={tabs}
        active={active}
        onTabChange={handleTabChange}
        onLogout={onLogout}
      />

      <div className="relative flex flex-1 flex-col bg-slate-50">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.1)_0%,rgba(248,250,252,0)_70%)]" />

        <header className="relative z-10 flex items-center justify-between bg-gradient-to-br from-pink-800 to-pink-600 px-7 py-5 text-white shadow-md">
          <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            {role === "patient" && (
              <Sparkles size={18} className="text-pink-200" />
            )}
            {headerLabel}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-pink-200">
              {role === "clinician" ? "Dr. See" : "See Your Vitality Portal"}
            </span>

            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-50 text-sm font-bold text-pink-800">
              {role === "clinician" ? "PS" : patientInitials}
            </div>
          </div>
        </header>

        <main className="relative z-10 flex-1 overflow-y-auto p-6 md:p-8">
          <div className="mx-auto max-w-6xl">{renderContent()}</div>
        </main>

        <footer className="relative z-10 flex flex-wrap items-center justify-center gap-6 border-t bg-white px-6 py-3 text-[11px] tracking-wide text-slate-400">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
            Not for emergencies — call 911 for severe symptoms
          </span>

          <span>
            AI triage suggestions are informational — clinician review required
          </span>
        </footer>
      </div>
    </div>
  );
}
