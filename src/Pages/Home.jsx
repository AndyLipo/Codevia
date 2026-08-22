import Login from "./Login";
import Dashboard from "./Dashboard";
import Anatomy from "./Anatomy";
import { useState } from "react";

export default function Home() {
  const [logged, setLogged] = useState(false);
  const [role, setRole] = useState({
    id: "production",
    label: "Jefe de Producción",
    initials: "JP",
    note: "Turnos, lotes y calidad",
  });
  const [showAnatomy, setShowAnatomy] = useState(false);
  if (window.location.pathname === "/anatomy" || showAnatomy)
    return (
      <Anatomy
        onBack={() => {
          window.history.pushState({}, "", "/");
          setShowAnatomy(false);
        }}
      />
    );
  if (!logged)
    return (
      <Login
        role={role}
        setRole={setRole}
        setLogged={setLogged}
        onAnatomy={() => setShowAnatomy(true)}
      />
    );
  return <Dashboard role={role} onLogout={() => setLogged(false)} />;
}
