
import { useState } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Anatomy from "@/pages/Anatomy";
import Front from "@/components/dashboard/Front";
import ChangePassword from "@/pages/ChangePassword";

// Rutas que se pueden ver sin sesión
const PUBLIC_PATHS = ["/", "/anatomy"];

function AppContent() {
  const { isAuthenticated, checking, user } = useAuth();
  const [showAnatomy, setShowAnatomy] = useState(false);

  const path = window.location.pathname;

  // Mientras se valida la sesión guardada (F5) no se muestra nada.
  if (checking) return null;

  // Sin sesión, cualquier ruta protegida redirige al login sin renderizar su contenido.
  if (!isAuthenticated && !PUBLIC_PATHS.includes(path)) {
    window.history.replaceState({}, "", "/");
  }

  if (path === "/anatomy" || showAnatomy) {
    return (
      <Anatomy
        onBack={() => {
          window.history.pushState({}, "", "/");
          setShowAnatomy(false);
        }}
      />
    );
  }

  if (isAuthenticated && path === "/productos") {
    return <Front />;
  }

  return (
    <TooltipProvider>
      {!isAuthenticated ? (
        <Login onAnatomy={() => setShowAnatomy(true)} />
      ) : user.debe_cambiar_password ? (
        <ChangePassword />
      ) : (
        <Dashboard />
      )}

      <Toaster richColors position="top-right" />
    </TooltipProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
