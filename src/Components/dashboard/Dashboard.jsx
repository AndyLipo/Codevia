import { useState } from "react";
import { toast } from "sonner";
import AppShell from "@/Components/layout/AppShell";
import Overview from "@/Components/dashboard/Overview";
import Production from "@/Components/dashboard/Production";
import Warehouse from "@/Components/dashboard/Warehouse";
import Dispatch from "@/Components/dashboard/Dispatch";
import Orders from "@/Components/dashboard/Orders";
import Reports from "@/Components/dashboard/Reports";

export default function Dashboard({ role, setRole, setLogged }) {
  const [active, setActive] = useState("overview");
  const [query, setQuery] = useState("");

  const navigate = (id) => {
    setActive(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const fakeAction = (message) =>
    toast(message, {
      description: "Esta acción es demostrativa en el prototipo.",
    });

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
      {active === "overview" && (
        <Overview navigate={navigate} fakeAction={fakeAction} />
      )}
      {active === "production" && <Production fakeAction={fakeAction} />}
      {active === "warehouse" && <Warehouse fakeAction={fakeAction} />}
      {active === "dispatch" && <Dispatch fakeAction={fakeAction} />}
      {active === "orders" && <Orders fakeAction={fakeAction} query={query} />}
      {active === "reports" && <Reports />}
    </AppShell>
  );
}
