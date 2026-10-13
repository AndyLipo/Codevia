import { useState } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Anatomy from "@/pages/Anatomy";

import Front from "@/components/dashboard/Front";

import { roleOptions } from "@/data/mockData";

function App() {
  const [logged, setLogged] = useState(false);
  const [role, setRole] = useState(roleOptions[0]);
  const [showAnatomy, setShowAnatomy] = useState(false);

  // =====================================================
  // FORMULARIO DE PRODUCTOS
  // http://localhost:5173/productos
  // =====================================================
  if (window.location.pathname === "/productos") {
    return <Front />;
  }

  // =====================================================
  // ANATOMY
  // =====================================================
  if (window.location.pathname === "/anatomy" || showAnatomy) {
    return (
      <Anatomy
        onBack={() => {
          window.history.pushState({}, "", "/");
          setShowAnatomy(false);
        }}
      />
    );
  }

  // =====================================================
  // APLICACIÓN PRINCIPAL
  // =====================================================
  return (
    <TooltipProvider>
      {!logged ? (
        <Login
          role={role}
          setRole={setRole}
          setLogged={setLogged}
          onAnatomy={() => setShowAnatomy(true)}
        />
      ) : (
        <Dashboard
          role={role}
          setRole={setRole}
          setLogged={setLogged}
        />
      )}

      <Toaster />
    </TooltipProvider>
  );
}

export default App;