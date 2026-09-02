import { AlertTriangle, ArrowUpRight, ClipboardList, Clock3, RefreshCw, Truck } from "lucide-react";
import SectionTitle from "@/components/common/SectionTitle";
import Kpi from "@/components/common/Kpi";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import ActionButton from "@/components/common/ActionButton";
import YardRow from "./YardRow";

export default function Overview({ navigate, fakeAction }) {
  return (
    <>
      <SectionTitle
        eyebrow="01 · CONTROL TOWER"
        title="Buen día, equipo."
        description="Martes 18 de agosto · Resumen operativo de la planta y la playa de expedición."
        action={
          <div className="flex gap-2">
            <ActionButton variant="secondary" onClick={() => fakeAction("Vista actualizada")}>
              <RefreshCw size={16} /> Actualizar
            </ActionButton>
            <ActionButton onClick={() => navigate("dispatch")}>
              <Truck size={16} /> Ver cargas en playa
            </ActionButton>
          </div>
        }
      />

      <div className="mb-[19px] flex items-center gap-3 rounded-[7px] border border-[#f1dfbc] bg-[#fff8e9] px-[15px] py-3">
        <div className="text-[#c4811f]"><AlertTriangle size={18} /></div>
        <div className="flex-1">
          <strong className="block text-xs text-[#815714]">2 materiales biodegradables requieren atención</strong>
          <span className="mt-[3px] block text-[11px] text-[#ad8951]">El lote PLA-014 vence en 25 días y el stock está por debajo del mínimo operativo.</span>
        </div>
        <button onClick={() => navigate("warehouse")} className="flex items-center gap-1.5 text-[10px] font-bold text-[#a46e1c]">
          Revisar alertas <ArrowUpRight size={15} />
        </button>
      </div>

      <div className="mb-[18px] grid grid-cols-4 gap-3.5 max-[1100px]:grid-cols-2 max-[760px]:grid-cols-1">
        <Kpi icon={ClipboardList} label="Pedidos pendientes" value="24" trend="+8,2%" note="vs. semana anterior" tone="blue" />
        <Kpi icon={Clock3} label="Tiempo promedio de carga" value="03:42 h" trend="−18 min" note="mejor que el objetivo" tone="green" />
        <Kpi icon={AlertTriangle} label="Alertas de vencimiento" value="02" trend="+1" note="requieren atención" tone="amber" />
        <Kpi icon={Truck} label="Camiones en playa" value="04" trend="02 cargando" note="de 07 programados" tone="slate" />
      </div>

      <div className="grid grid-cols-[1.4fr_0.85fr] gap-3.5 max-[1100px]:grid-cols-1">
        <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
          <div className="mb-[18px] flex items-start justify-between gap-3">
            <div><div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">FLUJO OPERATIVO</div><h3 className="m-0 font-barlow text-[21px] text-[#214451]">Estado de producción</h3></div>
            <button className="flex items-center gap-1.5 text-[11px] font-bold text-brand" onClick={() => navigate("production")}>Ver módulo <ArrowUpRight size={15} /></button>
          </div>
          <div className="flex min-h-[192px] items-center gap-[30px] max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-2.5">
            <div className="w-[42%] max-[1100px]:w-[35%] max-[760px]:w-full">
              <strong className="font-barlow text-[44px] leading-none text-brand">86,4%</strong>
              <span className="flex text-[10px] text-[#87979d]">avance de la planificación semanal</span>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-soft"><i className="block h-full rounded-full bg-brand" style={{ width: "86%" }} /></div>
              <small className="mt-2 flex justify-between text-[9px] text-[#87979d]"><span>104.240 kg producidos</span><span>120.600 kg planificados</span></small>
            </div>
            <div className="flex flex-1 items-end justify-between gap-2 self-stretch py-3.5 max-[760px]:min-h-[130px]">
              {[62, 75, 48, 86, 72, 94, 66].map((height, i) => (
                <div key={i} className="flex h-full flex-col items-center justify-end gap-1.5 text-[9px] text-[#a1afb2]">
                  <div className={`relative w-[22px] rounded-t-[4px] ${i === 3 ? "bg-brand" : "bg-[#d7e7eb]"}`} style={{ height: `${height}%`, minHeight: 18 }}>
                    <span className="absolute -top-[18px] left-1/2 -translate-x-1/2 text-[9px] text-[#748a91]">{["L", "M", "M", "J", "V", "S", "D"][i]}</span>
                  </div>
                  <small>{["12,4", "15,1", "9,8", "17,2", "14,6", "18,9", "16,2"][i]}t</small>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
          <div className="mb-[18px] flex items-start justify-between gap-3">
            <div><div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">EXPEDICIÓN</div><h3 className="m-0 font-barlow text-[21px] text-[#214451]">Actividad en playa</h3></div>
            <button className="grid h-8 w-8 place-items-center rounded-md border border-[#dce5e7] text-[#67808a]" onClick={() => navigate("dispatch")}><ArrowUpRight size={16} /></button>
          </div>
          <div className="flex flex-col gap-4 py-[3px] pb-[18px]">
            <YardRow code="CAM-12" client="Plásticos del Sur" status="Cargando" tone="blue" progress="60%" />
            <YardRow code="CAM-07" client="Mayorista Centro" status="En playa" tone="amber" progress="18%" />
            <YardRow code="CAM-03" client="Distribuidora Norte" status="Listo" tone="green" progress="100%" />
          </div>
          <ActionButton variant="secondary" full onClick={() => navigate("dispatch")}>Abrir tablero de cargas</ActionButton>
        </div>
      </div>

      <div className="mt-3.5 rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
        <div className="mb-[18px] flex items-start justify-between gap-3">
          <div><div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">ÚLTIMOS MOVIMIENTOS</div><h3 className="m-0 font-barlow text-[21px] text-[#214451]">Pedidos para preparar</h3></div>
          <button className="flex items-center gap-1.5 text-[11px] font-bold text-brand" onClick={() => navigate("orders")}>Ver todos <ArrowUpRight size={15} /></button>
        </div>
        <Table
          headers={["Pedido", "Cliente", "Entrega", "Bultos", "Estado"]}
          rows={[
            ["PED-10492", "Plásticos del Sur", "Hoy · 14:00", "18", "Listo para picking"],
            ["PED-10488", "Mayorista Centro", "Hoy · 16:30", "42", "En preparación"],
            ["PED-10476", "Distribuidora Norte", "Mañana · 08:00", "26", "Confirmado"],
          ]}
          renderCell={(cell, j) => (j === 4 ? <Badge tone={cell === "Listo para picking" ? "green" : cell === "En preparación" ? "amber" : "blue"}>{cell}</Badge> : cell)}
        />
      </div>
    </>
  );
}