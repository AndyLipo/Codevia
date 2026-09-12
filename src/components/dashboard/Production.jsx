import { Plus, Search, FileText } from "lucide-react";
import SectionTitle from "@/components/common/SectionTitle";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import ActionButton from "@/components/common/ActionButton";
import { productionRows } from "@/data/mockData";

export default function Production({ fakeAction }) {
  return (
    <>
      <SectionTitle
        eyebrow="02 · PRODUCCIÓN"
        title="Turnos y fabricación"
        description="Planificación de extrusión, lotes activos y controles de calidad."
        action={
          <ActionButton onClick={() => fakeAction("Nuevo lote en preparación")}>
            <Plus size={17} /> Registrar fabricación
          </ActionButton>
        }
      />

      <div className="mb-[18px] mt-[-4px] flex gap-5 border-b border-[#dce5e7]">
        <button className="relative pb-3 text-[11px] font-semibold text-brand after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-0.5 after:bg-brand">
          Turnos y lotes
        </button>
        <button className="pb-3 text-[11px] font-semibold text-[#82949a]" onClick={() => fakeAction("Vista de calidad en preparación")}>
          Control de calidad <span className="ml-1 rounded-full bg-[#fff0d7] px-1.5 py-0.5 text-[9px] text-[#b87318]">3</span>
        </button>
        <button className="pb-3 text-[11px] font-semibold text-[#82949a]" onClick={() => fakeAction("Calendario en preparación")}>
          Calendario
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3.5 max-[760px]:grid-cols-1">
        <div className="rounded-lg border border-[#e1e8ea] border-t-[3px] border-t-brand bg-white p-[17px] shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#7a8d93]">06:00 — 14:00</span>
            <Badge tone="green">En curso</Badge>
          </div>
          <h3 className="my-[17px] mb-1 font-barlow text-[22px] text-[#214451]">Turno mañana</h3>
          <p className="mb-[21px] text-[10px] text-[#84959a]">Jefe: Martín Acosta · 4 líneas activas</p>
          <div className="grid grid-cols-[35px_1fr] items-center gap-x-2 gap-y-1.5">
            <strong className="font-barlow text-[22px] text-brand">68%</strong>
            <div className="col-start-2 row-start-1 h-1.5 overflow-hidden rounded-full bg-slate-soft"><i className="block h-full rounded-full bg-brand" style={{ width: "68%" }} /></div>
            <span className="col-span-2 text-[9px] text-[#9aa7aa]">12.480 kg / 18.200 kg</span>
          </div>
        </div>

        <div className="rounded-lg border border-[#e1e8ea] bg-white p-[17px] shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#7a8d93]">14:00 — 22:00</span>
            <Badge tone="blue">Planificado</Badge>
          </div>
          <h3 className="my-[17px] mb-1 font-barlow text-[22px] text-[#214451]">Turno tarde</h3>
          <p className="mb-[21px] text-[10px] text-[#84959a]">Jefe: Laura Giménez · 3 líneas planificadas</p>
          <div className="grid grid-cols-[35px_1fr] items-center gap-x-2 gap-y-1.5">
            <strong className="font-barlow text-[22px] text-brand">0%</strong>
            <div className="col-start-2 row-start-1 h-1.5 overflow-hidden rounded-full bg-slate-soft"><i className="block h-full rounded-full bg-brand" style={{ width: "0%" }} /></div>
            <span className="col-span-2 text-[9px] text-[#9aa7aa]">Comienza en 4 h 12 min</span>
          </div>
        </div>

        <div className="rounded-lg border border-[#e1e8ea] bg-white p-[17px] shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#7a8d93]">22:00 — 06:00</span>
            <Badge tone="slate">Cerrado</Badge>
          </div>
          <h3 className="my-[17px] mb-1 font-barlow text-[22px] text-[#214451]">Turno noche</h3>
          <p className="mb-[21px] text-[10px] text-[#84959a]">Jefe: Pablo Suárez · 4 líneas completadas</p>
          <div className="grid grid-cols-[35px_1fr] items-center gap-x-2 gap-y-1.5">
            <strong className="font-barlow text-[22px] text-brand">100%</strong>
            <div className="col-start-2 row-start-1 h-1.5 overflow-hidden rounded-full bg-slate-soft"><i className="block h-full rounded-full bg-green" style={{ width: "100%" }} /></div>
            <span className="col-span-2 text-[9px] text-[#9aa7aa]">18.940 kg producidos</span>
          </div>
        </div>
      </div>

      <div className="mt-3.5 rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
        <div className="mb-[18px] flex items-start justify-between gap-3">
          <div><div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">TRAZABILIDAD DE LOTES</div><h3 className="m-0 font-barlow text-[21px] text-[#214451]">Fabricación reciente</h3></div>
          <div className="flex gap-2">
            <ActionButton variant="secondary"><Search size={15} /> Filtrar</ActionButton>
            <ActionButton variant="secondary"><FileText size={15} /> Exportar</ActionButton>
          </div>
        </div>
        <Table
          headers={["Lote", "Producto", "Línea", "Turno", "Estado", "Cantidad"]}
          rows={productionRows}
          renderCell={(cell, j) =>
            j === 4 ? <Badge tone={cell === "Liberado" ? "green" : cell === "En proceso" ? "blue" : cell === "Control de calidad" ? "amber" : "slate"}>{cell}</Badge> : cell
          }
        />
      </div>
    </>
  );
}