import { useState } from 'react'
import type { Role } from './types'
import RolePicker from './components/RolePicker'
import Dashboard from './components/Dashboard'

function App() {
  const [role, setRole] = useState<Role>(null)

  if (!role) return <RolePicker onSelect={setRole} />
  return <Dashboard role={role} onLogout={() => setRole(null)} />
}

export default App
