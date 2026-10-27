
import { useState } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { resolveRole, roleOptions } from "@/data/mockData";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Anatomy from "@/pages/Anatomy";
import Front from "@/components/dashboard/Front";
import ChangePassword from "@/pages/ChangePassword";

function App() {
  const [logged, setLogged] = useState(false);
  const [role, setRole] = useState(roleOptions[0]);
  const [showAnatomy, setShowAnatomy] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);
  const [tempPassword, setTempPassword] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const completeLogin = (user, password) => {
    setCurrentUser(user);
    setLoginPassword(password);
    setRole(resolveRole(user.rol_nombre));
    setLogged(true);
  };

  const handleLogin = (user, password) => {
    if (user.debe_cambiar_password) {
      setPendingUser(user);
      setTempPassword(password);
      return;
    }

    completeLogin(user, password);
  };

  const handlePasswordChanged = () => {
    completeLogin(
      {
        ...pendingUser,
        debe_cambiar_password: false,
      },
      tempPassword
    );

    setPendingUser(null);
    setTempPassword("");
  };

  const cancelPasswordChange = () => {
    setPendingUser(null);
    setTempPassword("");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginPassword("");
    setTempPassword("");
    setPendingUser(null);
    setLogged(false);
  };

  if (window.location.pathname === "/productos") {
    return <Front />;
  }

  if (
    window.location.pathname === "/anatomy" ||
    showAnatomy
  ) {
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
      {pendingUser ? (
        <ChangePassword
          user={pendingUser}
          currentPassword={tempPassword}
          onDone={handlePasswordChanged}
          onCancel={cancelPasswordChange}
        />
      ) : !logged ? (
        <Login
          onLogin={handleLogin}
          onAnatomy={() => setShowAnatomy(true)}
        />
      ) : (
        <Dashboard
          role={role}
          setRole={setRole}
          setLogged={handleLogout}
          user={currentUser}
          loginPassword={loginPassword}
        />
      )}

      <Toaster richColors position="top-right" />
    </TooltipProvider>
  );
}

export default App;
