import Badge from "@/components/common/Badge";
import Table from "@/components/common/Table";
import ActionButton from "@/components/common/ActionButton";
import { integrationsRows } from "@/data/mockData";

export default function Integrations({ fakeAction }) {
    return (
        <div className="mt-3.5 rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
            <div className="mb-[18px] flex items-start justify-between gap-3">
                <div>
                    <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">CONEXIONES EXTERNAS</div>
                    <h3 className="m-0 font-barlow text-[21px] text-[#214451]">Integraciones</h3>
                </div>
                <ActionButton variant="secondary" onClick={() => fakeAction("Alta de integración en preparación")}>
                    Agregar integración
                </ActionButton>
            </div>
            <Table
                headers={["Integración", "Descripción", "Estado"]}
                rows={integrationsRows}
                renderCell={(cell, j) => (j === 2 ? <Badge tone={cell === "Conectado" ? "green" : "amber"}>{cell}</Badge> : cell)}
            />
        </div>
    );
}