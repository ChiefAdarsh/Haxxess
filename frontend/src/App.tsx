import { useState } from "react";
import type { Role } from "./types";
import { SymptomProvider } from "./context/SymptomContext";
import RolePicker from "./components/RolePicker";
import PatientPicker from "./components/PatientPicker";
import Dashboard from "./components/Dashboard";

function App() {
  const [role, setRole] = useState<Role>(null);
  const [patientChosen, setPatientChosen] = useState(false);

  const handleRoleSelect = (r: Role) => {
    setRole(r);
    if (r !== "patient") setPatientChosen(true);
    else setPatientChosen(false);
  };

  const handleLogout = () => {
    setRole(null);
    setPatientChosen(false);
  };

  return (
    <SymptomProvider>
      {!role && <RolePicker onSelect={handleRoleSelect} />}
      {role === "patient" && !patientChosen && (
        <PatientPicker
          onSelectExisting={() => setPatientChosen(true)}
          onSelectNew={() => setPatientChosen(true)}
          onBack={() => setRole(null)}
        />
      )}
      {role && (role !== "patient" || patientChosen) && (
        <Dashboard role={role} onLogout={handleLogout} />
      )}
    </SymptomProvider>
  );
}

export default App;
