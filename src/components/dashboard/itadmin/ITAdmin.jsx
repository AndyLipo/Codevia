import { useState } from "react";
import SectionTitle from "@/components/common/SectionTitle";

import UserRoles from "./UserRoles";
import SystemConfig from "./SystemConfig";
import AuditLog from "./AuditLog";
// import Integrations from "./Integrations";

const tabs = [
    { id: "users", label: "Usuarios y roles" },
    { id: "config", label: "Configuración" },
    { id: "audit", label: "Auditoría" },
];

export default function ITAdmin({ fakeAction }) {
    const [tab, setTab] = useState("users");

    return (
        <>
            <SectionTitle
                eyebrow="07 · IT / SISTEMAS"
                title="Administración del sistema"
                description="Usuarios, permisos, parámetros y trazabilidad de la plataforma."
            />

            <div className="mb-4.5 -mt-1 flex gap-5 border-b border-[#dce5e7]">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`relative pb-3 text-[11px] font-semibold cursor-pointer ${tab === t.id
                            ? "text-brand after:absolute after:-bottom-px after:left-0 after:right-0 after:h-0.5 after:bg-brand"
                            : "text-[#82949a]"
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === "users" && <UserRoles fakeAction={fakeAction} />}
            {tab === "config" && <SystemConfig fakeAction={fakeAction} />}
            {tab === "audit" && <AuditLog />}
            {/* {tab === "integrations" && <Integrations fakeAction={fakeAction} />} */}
        </>
    );
}