import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import Footer from "./Footer";

export default function AppShell({ active, navigate, role, setRole, setLogged, fakeAction, setQuery, children }) {
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleNavigate = (id) => {
        navigate(id);
        setMobileOpen(false);
    };

    return (
        <div className="app-shell">
            <Sidebar
                active={active}
                navigate={handleNavigate}
                mobileOpen={mobileOpen}
                setMobileOpen={setMobileOpen}
                role={role}
                setLogged={setLogged}
                fakeAction={fakeAction}
            />
            {mobileOpen && <div className="scrim" onClick={() => setMobileOpen(false)} />}
            <main className="main-area">
                <Topbar active={active} role={role} setRole={setRole} setMobileOpen={setMobileOpen} setQuery={setQuery} fakeAction={fakeAction} />
                <div className="content">{children}</div>
                <Footer />
            </main>
        </div>
    );
}