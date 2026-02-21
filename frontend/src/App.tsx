import { useState } from 'react'
import type { Role } from './types'
import { SymptomProvider } from './context/SymptomContext'
import RolePicker from './components/RolePicker'
import Dashboard from './components/Dashboard'

function App() {
  const [role, setRole] = useState<Role>(null)

  return (
    <SymptomProvider>
      {!role
        ? <RolePicker onSelect={setRole} />
        : <Dashboard role={role} onLogout={() => setRole(null)} />
      }
    </SymptomProvider>
  )
}

export default App
