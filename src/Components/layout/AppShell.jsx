import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import Footer from "./Footer";

export default function AppShell({
  active,
  navigate,
  role,
  setRole,
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
    <div className="min-h-screen bg-[#f4f6f7]">
      <Sidebar
        active={active}
        navigate={handleNavigate}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        role={role}
        setLogged={setLogged}
        fakeAction={fakeAction}
      />

      <main className="ml-[248px] min-h-screen min-w-0 max-lg:ml-0">
        <Topbar
          active={active}
          role={role}
          setRole={setRole}
          setMobileOpen={setMobileOpen}
          setQuery={setQuery}
          fakeAction={fakeAction}
        />

        <div className="mx-auto max-w-[1440px] px-[38px] pb-4 pt-[34px]">
          {children}
        </div>

        <Footer />
      </main>
    </div>
  );
}