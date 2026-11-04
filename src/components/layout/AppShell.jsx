
import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import Footer from "./Footer";
import { NotificationsProvider } from "@/context/NotificationsContext";

export default function AppShell({
  active,
  navigate,
  role,
  setLogged,
  fakeAction,
  setQuery,
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (id) => {
    navigate(id);
    setMobileOpen(false);
  };

  return (
    <NotificationsProvider>
      <div className="min-h-screen bg-[#f4f6f7]">
        <Sidebar
          active={active}
          navigate={handleNavigate}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          role={role}
          setLogged={setLogged}
        />

        <main className="ml-62 min-h-screen min-w-0 max-lg:ml-0">
          <Topbar
            active={active}
            setMobileOpen={setMobileOpen}
            setQuery={setQuery}
            navigate={handleNavigate}
          />

          <div className="mx-auto max-w-360 px-6 pb-4 pt-8.5 max-md:px-4 max-md:pt-6">
            {children}
          </div>

          <Footer />
        </main>
      </div>
    </NotificationsProvider>
  );
}