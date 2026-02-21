import { useState } from 'react'
import {
  HeartPulse,
  LayoutDashboard,
  Activity,
  MessageCircle,
  Bell,
  Apple,
} from 'lucide-react'

// sidebar tabs mapped to project features
const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'vitals', label: 'Vitals', icon: Activity },
  { id: 'risk', label: 'Risk Analysis', icon: HeartPulse },
  { id: 'assistant', label: 'Assistant', icon: MessageCircle },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'lifestyle', label: 'Lifestyle', icon: Apple },
]

function App() {
  const [active, setActive] = useState('dashboard')

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-gray-200">
          <HeartPulse className="w-6 h-6 text-red-600" />
          <span className="font-bold text-gray-800 text-lg">Haxxess</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = active === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-red-50 text-red-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-red-600' : 'text-gray-400'}`} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        {/* top bar */}
        <header className="bg-red-700 text-white px-6 py-4 shadow-md">
          <h1 className="text-lg font-semibold capitalize">{tabs.find((t) => t.id === active)?.label}</h1>
        </header>

        <main className="flex-1 p-6">
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-20 flex items-center justify-center">
            <p className="text-gray-400 text-sm">{tabs.find((t) => t.id === active)?.label} content goes here</p>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
