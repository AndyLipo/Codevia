import { Plus, Search, UsersRound } from "lucide-react";
import SectionTitle from "@/components/common/SectionTitle";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";

const allOrders = [
  [
    "PED-10492",
    "Plásticos del Sur",
    "18 bultos",
    "Hoy · 14:00",
    "Listo para picking",
  ],
  [
    "PED-10488",
    "Mayorista Centro",
    "42 bultos",
    "Hoy · 16:30",
    "En preparación",
  ],
  [
    "PED-10476",
    "Distribuidora Norte",
    "26 bultos",
    "Mañana · 08:00",
    "Confirmado",
  ],
  [
    "PED-10471",
    "Envases del Litoral",
    "12 bultos",
    "Mañana · 10:30",
    "Pendiente de crédito",
  ],
];

export default function Orders({ fakeAction, query }) {
  const rows = allOrders.filter(
    (r) => !query || r.join(" ").toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      <SectionTitle
        eyebrow="05 · PEDIDOS"
        title="Pedidos y clientes"
        description="Seguimiento de punta a punta para cada pedido comercial."
        action={
          <button
            className="primary-cta"
            onClick={() => fakeAction("Alta de pedido en preparación")}
          >
            <Plus size={17} /> Nuevo pedido
          </button>
        }
      />

      <div className="order-kpis">
        <div>
          <span>Pedidos del mes</span>
          <strong>184</strong>
          <small>+12,6% vs. mes anterior</small>
        </div>
        <div>
          <span>Tiempo medio de confirmación</span>
          <strong>02:18 h</strong>
          <small>Objetivo: 04:00 h</small>
        </div>
        <div>
          <span>Clientes activos</span>
          <strong>42</strong>
          <small>6 con entrega esta semana</small>
        </div>
      </div>

      <div className="panel table-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">CARTERA ACTIVA</div>
            <h3>Pedidos recientes</h3>
          </div>
          <div className="table-tools">
            <button className="secondary-cta">
              <Search size={15} /> Buscar
            </button>
            <button className="secondary-cta">
              <UsersRound size={15} /> Clientes
            </button>
          </div>
        </div>
        <Table
          headers={["Pedido", "Cliente", "Volumen", "Entrega", "Estado"]}
          rows={rows}
          renderCell={(cell, j) =>
            j === 4 ? (
              <Badge
                tone={
                  cell.includes("Listo")
                    ? "green"
                    : cell.includes("Pendiente")
                      ? "red"
                      : cell.includes("preparación")
                        ? "amber"
                        : "blue"
                }
              >
                {cell}
              </Badge>
            ) : (
              cell
            )
          }
        />
      </div>
    </>
  );
}
