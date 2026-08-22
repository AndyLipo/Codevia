import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardList,
  Clock3,
  RefreshCw,
  Truck,
} from "lucide-react";
import SectionTitle from "@/components/common/SectionTitle";
import Kpi from "@/components/common/Kpi";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import YardRow from "./YardRow";

export default function Overview({ navigate, fakeAction }) {
  return (
    <>
      <SectionTitle
        eyebrow="01 · CONTROL TOWER"
        title="Buen día, equipo."
        description="Martes 18 de agosto · Resumen operativo de la planta y la playa de expedición."
        action={
          <div className="title-actions">
            <button
              className="secondary-cta"
              onClick={() => fakeAction("Vista actualizada")}
            >
              <RefreshCw size={16} /> Actualizar
            </button>
            <button
              className="primary-cta"
              onClick={() => navigate("dispatch")}
            >
              <Truck size={16} /> Ver cargas en playa
            </button>
          </div>
        }
      />

      <div className="alert-strip">
        <div className="alert-symbol">
          <AlertTriangle size={18} />
        </div>
        <div>
          <strong>2 materiales biodegradables requieren atención</strong>
          <span>
            El lote PLA-014 vence en 25 días y el stock está por debajo del
            mínimo operativo.
          </span>
        </div>
        <button onClick={() => navigate("warehouse")}>
          Revisar alertas <ArrowUpRight size={15} />
        </button>
      </div>

      <div className="kpi-grid">
        <Kpi
          icon={ClipboardList}
          label="Pedidos pendientes"
          value="24"
          trend="+8,2%"
          note="vs. semana anterior"
          tone="blue"
        />
        <Kpi
          icon={Clock3}
          label="Tiempo promedio de carga"
          value="03:42 h"
          trend="−18 min"
          note="mejor que el objetivo"
          tone="green"
        />
        <Kpi
          icon={AlertTriangle}
          label="Alertas de vencimiento"
          value="02"
          trend="+1"
          note="requieren atención"
          tone="amber"
        />
        <Kpi
          icon={Truck}
          label="Camiones en playa"
          value="04"
          trend="02 cargando"
          note="de 07 programados"
          tone="slate"
        />
      </div>

      <div className="dashboard-grid">
        <div className="panel wide">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">FLUJO OPERATIVO</div>
              <h3>Estado de producción</h3>
            </div>
            <button
              className="link-button"
              onClick={() => navigate("production")}
            >
              Ver módulo <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="flow-chart">
            <div className="flow-summary">
              <strong>86,4%</strong>
              <span>avance de la planificación semanal</span>
              <div className="progress">
                <i style={{ width: "86%" }} />
              </div>
              <small>
                <span>104.240 kg producidos</span>
                <span>120.600 kg planificados</span>
              </small>
            </div>
            <div className="bar-chart">
              {[62, 75, 48, 86, 72, 94, 66].map((height, i) => (
                <div className="bar-col" key={i}>
                  <div
                    className={`bar ${i === 3 ? "today" : ""}`}
                    style={{ height: `${height}%` }}
                  >
                    <span>{["L", "M", "M", "J", "V", "S", "D"][i]}</span>
                  </div>
                  <small>
                    {["12,4", "15,1", "9,8", "17,2", "14,6", "18,9", "16,2"][i]}
                    t
                  </small>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">EXPEDICIÓN</div>
              <h3>Actividad en playa</h3>
            </div>
            <button
              className="icon-button"
              onClick={() => navigate("dispatch")}
            >
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="yard-list">
            <YardRow
              code="CAM-12"
              client="Plásticos del Sur"
              status="Cargando"
              tone="blue"
              progress="60%"
            />
            <YardRow
              code="CAM-07"
              client="Mayorista Centro"
              status="En playa"
              tone="amber"
              progress="18%"
            />
            <YardRow
              code="CAM-03"
              client="Distribuidora Norte"
              status="Listo"
              tone="green"
              progress="100%"
            />
          </div>
          <button
            className="secondary-cta full"
            onClick={() => navigate("dispatch")}
          >
            Abrir tablero de cargas
          </button>
        </div>
      </div>

      <div className="panel table-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">ÚLTIMOS MOVIMIENTOS</div>
            <h3>Pedidos para preparar</h3>
          </div>
          <button className="link-button" onClick={() => navigate("orders")}>
            Ver todos <ArrowUpRight size={15} />
          </button>
        </div>
        <Table
          headers={["Pedido", "Cliente", "Entrega", "Bultos", "Estado"]}
          rows={[
            [
              "PED-10492",
              "Plásticos del Sur",
              "Hoy · 14:00",
              "18",
              "Listo para picking",
            ],
            [
              "PED-10488",
              "Mayorista Centro",
              "Hoy · 16:30",
              "42",
              "En preparación",
            ],
            [
              "PED-10476",
              "Distribuidora Norte",
              "Mañana · 08:00",
              "26",
              "Confirmado",
            ],
          ]}
          renderCell={(cell, j) =>
            j === 4 ? (
              <Badge
                tone={
                  cell === "Listo para picking"
                    ? "green"
                    : cell === "En preparación"
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
