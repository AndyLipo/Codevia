import { useState } from "react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import Overview from "@/components/dashboard/Overview";
import Production from "@/components/dashboard/Production";
import Warehouse from "@/components/dashboard/Warehouse";
import Dispatch from "@/components/dashboard/Dispatch";
import Orders from "@/components/dashboard/Orders";
import Reports from "@/components/dashboard/Reports";

export default function Dashboard({ role, setRole, setLogged }) {
    const [active, setActive] = useState("overview");
    const [query, setQuery] = useState("");

    const navigate = (id) => {
        setActive(id);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const fakeAction = (message) => toast(message, { description: "Esta acción es demostrativa en el prototipo." });

    return (
        <AppShell active={active} navigate={navigate} role={role} setRole={setRole} setLogged={setLogged} fakeAction={fakeAction} setQuery={setQuery}>
            {active === "overview" && <Overview navigate={navigate} fakeAction={fakeAction} />}
            {active === "production" && <Production fakeAction={fakeAction} />}
            {active === "warehouse" && <Warehouse fakeAction={fakeAction} />}
            {active === "dispatch" && <Dispatch fakeAction={fakeAction} />}
            {active === "orders" && <Orders fakeAction={fakeAction} query={query} />}
            {active === "reports" && <Reports />}
        </AppShell>
    );
}