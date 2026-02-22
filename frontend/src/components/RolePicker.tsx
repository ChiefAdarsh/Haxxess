import { Sparkles, User, Stethoscope } from "lucide-react";
import type { Role } from "../types";

function RoleCard({
  label,
  subtitle,
  icon: Icon,
  onClick,
}: {
  label: string;
  subtitle: string;
  icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-60 px-6 py-10 rounded-[20px] border-2 border-transparent bg-white/60 backdrop-blur-xl cursor-pointer flex flex-col items-center gap-4 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-1px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,0.6)] hover:border-pink-500/50 hover:shadow-[0_10px_40px_rgba(219,39,119,0.15),inset_0_1px_0_rgba(255,255,255,0.8)] hover:-translate-y-1 hover:bg-white/90"
    >
      <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-pink-50 to-pink-100 flex items-center justify-center shadow-[inset_0_2px_4px_rgba(255,255,255,0.8)]">
        <Icon size={32} className="text-pink-700" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-[17px] text-slate-800 tracking-tight m-0">
          {label}
        </p>
        <p className="text-sm text-slate-500 mt-1.5">{subtitle}</p>
      </div>
    </button>
  );
}

export default function RolePicker({
  onSelect,
}: {
  onSelect: (role: Role) => void;
}) {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 bg-[url('/vitalitybg.svg')] bg-cover bg-center bg-no-repeat font-sans gap-12 relative overflow-hidden">
      <div className="text-center flex flex-col items-center z-10">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-700 to-pink-600 flex items-center justify-center shadow-[0_8px_16px_rgba(190,24,93,0.2),inset_0_2px_4px_rgba(255,255,255,0.3)] mb-4">
          <Sparkles size={28} className="text-white" />
        </div>
        <h1 className="text-4xl font-bold text-slate-800 tracking-[-0.03em] m-0">
          Vitality Health
        </h1>
        <p className="text-slate-500 text-[15px] mt-2 font-medium tracking-wide">
          A preventive partner that treats symptoms like vital signs
        </p>
      </div>

      <div className="flex gap-6 z-10">
        <RoleCard
          label="I'm a Patient"
          subtitle="Track symptoms & voice journals"
          icon={User}
          onClick={() => onSelect("patient")}
        />
        <RoleCard
          label="I'm a Clinician"
          subtitle="Monitor risks & manage care"
          icon={Stethoscope}
          onClick={() => onSelect("clinician")}
        />
      </div>

      <div className="absolute bottom-8 text-xs text-slate-400 font-medium tracking-widest uppercase z-10">
        Built for Axxess Hackathon 2026
      </div>
    </div>
  );
}
