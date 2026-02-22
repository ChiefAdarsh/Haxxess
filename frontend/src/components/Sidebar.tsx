import { Sparkles, LogOut } from "lucide-react";
import type { Tab } from "../types";
import ProfileSelector from "./ProfileSelector";

interface SidebarProps {
  role: string;
  tabs: Tab[];
  active: string;
  onTabChange: (id: string) => void;
  onLogout: () => void;
}

export default function Sidebar({
  role,
  tabs,
  active,
  onTabChange,
  onLogout,
}: SidebarProps) {
  const isClinician = role === "clinician";

  return (
    <aside className="w-60 h-screen bg-white border-r border-slate-100 flex flex-col overflow-hidden shadow-[4px_0_24px_rgba(0,0,0,0.01)] z-20">
      {/* Logo Area */}
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-700 to-pink-600 flex items-center justify-center shadow-[0_4px_8px_rgba(190,24,93,0.2),inset_0_2px_4px_rgba(255,255,255,0.3)]">
          <Sparkles size={18} className="text-white" />
        </div>
        <div>
          <span className="block font-bold text-lg text-slate-800 tracking-tight">
            Vitality
          </span>
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
            Health Engine
          </span>
        </div>
      </div>

      {/* Role Badge */}
      <div
        className={`mx-4 mt-5 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider text-center border
        ${
          isClinician
            ? "bg-blue-50 border-blue-200 text-blue-800"
            : "bg-pink-50 border-pink-200 text-pink-700"
        }`}
      >
        {role} Portal
      </div>

      {role === "patient" && <ProfileSelector />}

      {/* Nav Tabs */}
      <nav className="flex-1 p-4 flex flex-col gap-1 min-h-0 overflow-y-auto">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2 ml-2">
          Menu
        </p>

        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm
                transition-all duration-150
                ${
                  isActive
                    ? "bg-pink-50 text-pink-700 font-semibold"
                    : "text-slate-500 font-medium hover:bg-slate-50 hover:text-slate-700"
                }
              `}
            >
              <Icon
                size={18}
                className={`transition-all duration-150 ${
                  isActive ? "text-pink-700" : "text-slate-400"
                }`}
              />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Switch Role / Logout */}
      <div className="p-4 border-t border-slate-100">
        <button
          onClick={onLogout}
          className="group flex items-center gap-2.5 w-full px-3.5 py-3 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all duration-150"
        >
          <LogOut
            size={16}
            className="text-slate-400 group-hover:text-red-500 transition-all duration-150"
          />
          Switch Role
        </button>
      </div>
    </aside>
  );
}
