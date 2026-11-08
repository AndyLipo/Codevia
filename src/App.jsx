import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Front from "@/components/dashboard/Front";
import ChangePassword from "@/pages/ChangePassword";

function AppContent() {
  const { isAuthenticated, checking, user } = useAuth();

  const path = window.location.pathname;

  // Mientras se valida la sesión guardada (F5) no se muestra nada.
  if (checking) return null;

  if (isAuthenticated && path === "/productos") {
    return <Front />;
  }

  return (
    <TooltipProvider>
      {!isAuthenticated ? (
        <Login />
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
