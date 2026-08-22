import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Anatomy from "@/pages/Anatomy";
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
                <Login role={role} setRole={setRole} setLogged={setLogged} onAnatomy={() => setShowAnatomy(true)} />
            ) : (
                <Dashboard role={role} setRole={setRole} setLogged={setLogged} />
            )}
            <Toaster />
        </TooltipProvider>
    );
}