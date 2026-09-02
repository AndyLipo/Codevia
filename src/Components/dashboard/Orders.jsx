import { Plus, Search, UsersRound } from "lucide-react";
import SectionTitle from "@/components/common/SectionTitle";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import ActionButton from "@/components/common/ActionButton";

const allOrders = [
  ["PED-10492", "Plásticos del Sur", "18 bultos", "Hoy · 14:00", "Listo para picking"],
  ["PED-10488", "Mayorista Centro", "42 bultos", "Hoy · 16:30", "En preparación"],
  ["PED-10476", "Distribuidora Norte", "26 bultos", "Mañana · 08:00", "Confirmado"],
  ["PED-10471", "Envases del Litoral", "12 bultos", "Mañana · 10:30", "Pendiente de crédito"],
];

export default function Orders({ fakeAction, query }) {
  const rows = allOrders.filter((r) => !query || r.join(" ").toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <SectionTitle
        eyebrow="05 · PEDIDOS"
        title="Pedidos y clientes"
        description="Seguimiento de punta a punta para cada pedido comercial."
        action={<ActionButton onClick={() => fakeAction("Alta de pedido en preparación")}><Plus size={17} /> Nuevo pedido</ActionButton>}
      />

      <div className="mb-3.5 grid grid-cols-3 gap-3.5 max-[760px]:grid-cols-1">
        <div className="rounded-lg border border-[#e1e8ea] bg-white p-[17px] shadow-card">
          <span className="block text-[10px] text-[#819298]">Pedidos del mes</span>
          <strong className="my-1 block font-barlow text-[33px] text-[#174354]">184</strong>
          <small className="block text-[9px] text-green">+12,6% vs. mes anterior</small>
        </div>
        <div className="rounded-lg border border-[#e1e8ea] bg-white p-[17px] shadow-card">
          <span className="block text-[10px] text-[#819298]">Tiempo medio de confirmación</span>
          <strong className="my-1 block font-barlow text-[33px] text-[#174354]">02:18 h</strong>
          <small className="block text-[9px] text-[#819298]">Objetivo: 04:00 h</small>
        </div>
        <div className="rounded-lg border border-[#e1e8ea] bg-white p-[17px] shadow-card">
          <span className="block text-[10px] text-[#819298]">Clientes activos</span>
          <strong className="my-1 block font-barlow text-[33px] text-[#174354]">42</strong>
          <small className="block text-[9px] text-green">6 con entrega esta semana</small>
        </div>
      </div>

      <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
        <div className="mb-[18px] flex items-start justify-between gap-3">
          <div><div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">CARTERA ACTIVA</div><h3 className="m-0 font-barlow text-[21px] text-[#214451]">Pedidos recientes</h3></div>
          <div className="flex gap-2">
            <ActionButton variant="secondary"><Search size={15} /> Buscar</ActionButton>
            <ActionButton variant="secondary"><UsersRound size={15} /> Clientes</ActionButton>
          </div>
        </div>
        <Table
          headers={["Pedido", "Cliente", "Volumen", "Entrega", "Estado"]}
          rows={rows}
          renderCell={(cell, j) =>
            j === 4 ? <Badge tone={cell.includes("Listo") ? "green" : cell.includes("Pendiente") ? "red" : cell.includes("preparación") ? "amber" : "blue"}>{cell}</Badge> : cell
          }
        />
      </div>
    </>
  );
}