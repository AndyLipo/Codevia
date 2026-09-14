import { useState } from "react";
import { toast } from "sonner";

import AppShell from "@/components/layout/AppShell";

import Overview from "@/components/dashboard/Overview";
import Production from "@/components/dashboard/Production";
import Warehouse from "@/components/dashboard/Warehouse";
import Dispatch from "@/components/dashboard/Dispatch";
import Orders from "@/components/dashboard/Orders";
import Reports from "@/components/dashboard/Reports";
import ITAdmin from "@/components/dashboard/itadmin/ITAdmin";

export default function Dashboard({ role, setRole, setLogged }) {
  const [active, setActive] = useState("overview");
  const [query, setQuery] = useState("");

  const navigate = (id) => {
    setActive(id);
  };

  const fakeAction = (message) => {
    toast.success(message);
  };

  const renderContent = () => {
    switch (active) {
      case "overview":
        return (
          <Overview
            navigate={navigate}
            fakeAction={fakeAction}
          />
        );

      case "production":
        return <Production fakeAction={fakeAction} />;

      case "warehouse":
        return <Warehouse fakeAction={fakeAction} />;

      case "dispatch":
        return <Dispatch fakeAction={fakeAction} />;

      case "orders":
        return (
          <Orders
            fakeAction={fakeAction}
            query={query}
          />
        );

      case "reports":
        return <Reports />;

      case "itadmin":
        return <ITAdmin />;

      default:
        return (
          <Overview
            navigate={navigate}
            fakeAction={fakeAction}
          />
        );
    }
  };

  return (
    <AppShell
      active={active}
      navigate={navigate}
      role={role}
      setRole={setRole}
      setLogged={setLogged}
      fakeAction={fakeAction}
      setQuery={setQuery}
    >
      {renderContent()}
    </AppShell>
  );
}