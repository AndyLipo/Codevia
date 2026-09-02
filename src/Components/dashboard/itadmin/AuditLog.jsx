import Table from "@/components/common/Table";
import { auditLogRows } from "@/data/mockData";

export default function AuditLog() {
    return (
        <div className="mt-3.5 rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
            <div className="mb-[18px] flex items-start justify-between gap-3">
                <div>
                    <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">TRAZABILIDAD</div>
                    <h3 className="m-0 font-barlow text-[21px] text-[#214451]">Registro de actividad</h3>
                </div>
            </div>
            <Table headers={["Fecha y hora", "Usuario", "Acción", "Módulo"]} rows={auditLogRows} />
        </div>
    );
}