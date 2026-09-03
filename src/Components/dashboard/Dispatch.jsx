import { useState } from "react";
import { ArrowUpRight, Plus, RefreshCw, Route } from "lucide-react";
import SectionTitle from "@/components/common/SectionTitle";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import ActionButton from "@/components/common/ActionButton";
import RouteStep from "./RouteStep";
import { dispatchRows } from "@/data/mockData";
import CreateRouteSheetModal from "./modals/CreateRouteSheetModal";

export default function Dispatch({ fakeAction }) {
  const [routeModalOpen, setRouteModalOpen] = useState(false);

  const handleCreateRouteSheet = (routeSheet) => {
    console.log("Nueva hoja de ruta:", routeSheet);

    fakeAction?.(`${routeSheet.numero} creada correctamente`);
  };
  return (
    <>
      <SectionTitle
        eyebrow="04 · EXPEDICIÓN"
        title="Playa y hojas de ruta"
        description="Coordiná la carga de camiones y seguí cada despacho en tiempo real."
        action={
          <ActionButton onClick={() => setRouteModalOpen(true)}>
            <Plus size={17} />
            Armar hoja de ruta
          </ActionButton>
        }
      />

      <div className="mb-3.5 flex items-center gap-8 rounded-lg bg-brand px-[23px] py-5 text-white max-[760px]:flex-wrap max-[760px]:gap-[18px]">
        <div className="flex-1 max-[760px]:basis-full">
          <div className="text-[9px] tracking-[0.16em] text-[#b6d0d8]">OPERACIÓN DE HOY · MARTES 18 AGO</div>
          <h3 className="m-0 font-barlow text-[25px] font-semibold">7 camiones programados <span className="mx-1.5 text-[#76a4b0]">·</span> 4 en playa <span className="mx-1.5 text-[#76a4b0]">·</span> 2 despachados</h3>
        </div>
        <div className="border-l border-white/20 pl-6 max-[760px]:border-0 max-[760px]:pl-0">
          <strong className="block font-barlow text-[28px]">03:42 h</strong>
          <span className="mt-0.5 block text-[9px] text-[#b6d0d8]">tiempo medio de carga</span>
        </div>
        <div className="border-l border-white/20 pl-6 max-[760px]:border-0 max-[760px]:pl-0">
          <strong className="block font-barlow text-[28px] text-green">−18 min</strong>
          <span className="mt-0.5 block text-[9px] text-[#b6d0d8]">vs. objetivo diario</span>
        </div>
      </div>

      <div className="grid grid-cols-[1.45fr_0.7fr] gap-3.5 max-[1100px]:grid-cols-1">
        <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
          <div className="mb-[18px] flex items-start justify-between gap-3">
            <div><div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">SEGUIMIENTO DE CARGAS</div><h3 className="m-0 font-barlow text-[21px] text-[#214451]">Camiones en operación</h3></div>
            <ActionButton variant="secondary" onClick={() => fakeAction("Tablero actualizado")}><RefreshCw size={15} /> Actualizar</ActionButton>
          </div>
          <Table
            headers={["Hoja", "Cliente", "Camión", "Chofer", "Picking", "Estado"]}
            rows={dispatchRows}
            renderCell={(cell, j) => (j === 5 ? <Badge tone={cell === "Despachado" ? "green" : cell === "Cargando" ? "blue" : "amber"}>{cell}</Badge> : cell)}
          />
        </div>

        <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
          <div className="mb-[18px] flex items-start justify-between gap-3">
            <div><div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">RUTA DESTACADA</div><h3 className="m-0 font-barlow text-[21px] text-[#214451]">EXP-00841</h3></div>
            <Route size={18} className="text-brand" />
          </div>
          <div className="relative py-1 pb-3.5 pl-[3px] before:absolute before:bottom-[30px] before:left-[10px] before:top-3.5 before:border-l before:border-dashed before:border-[#cbdde1]">
            <RouteStep label="Planta Brother Plast" detail="08:10 · Carga iniciada" done />
            <RouteStep label="Plásticos del Sur" detail="Parque Industrial · 14:00" current />
            <RouteStep label="Mayorista Centro" detail="Ruta 5 · 16:30" />
          </div>
          <ActionButton full onClick={() => fakeAction("Hoja de ruta abierta")}>Ver hoja completa <ArrowUpRight size={16} /></ActionButton>
        </div>
      </div>
      <CreateRouteSheetModal
        open={routeModalOpen}
        onOpenChange={setRouteModalOpen}
        onCreate={handleCreateRouteSheet}
      />
    </>
  );
}