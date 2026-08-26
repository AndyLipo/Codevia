import { useState } from "react";
import { Toaster } from "@/Components/ui/sonner";
import { TooltipProvider } from "@/Components/ui/tooltip";
import Login from "@/Pages/Login";
import Dashboard from "@/Pages/Dashboard";
import Anatomy from "@/Pages/Anatomy";
import { roleOptions } from "@/data/mockData";

export default function App() {
  const [logged, setLogged] = useState(false);
  const [role, setRole] = useState(roleOptions[0]);
  const [showAnatomy, setShowAnatomy] = useState(false);

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
        <Dashboard role={role} setRole={setRole} setLogged={setLogged} />
      )}
      <Toaster />
    </TooltipProvider>
  );
}
