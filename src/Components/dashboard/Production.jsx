import { Plus, Search, FileText } from "lucide-react";
import SectionTitle from "@/components/common/SectionTitle";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import { productionRows } from "@/data/mockData";

export default function Production({ fakeAction }) {
  return (
    <>
      <SectionTitle
        eyebrow="02 · PRODUCCIÓN"
        title="Turnos y fabricación"
        description="Planificación de extrusión, lotes activos y controles de calidad."
        action={
          <button
            className="primary-cta"
            onClick={() => fakeAction("Nuevo lote en preparación")}
          >
            <Plus size={17} /> Registrar fabricación
          </button>
        }
      />

      <div className="subnav">
        <button className="subnav-active">Turnos y lotes</button>
        <button onClick={() => fakeAction("Vista de calidad en preparación")}>
          Control de calidad <span>3</span>
        </button>
        <button onClick={() => fakeAction("Calendario en preparación")}>
          Calendario
        </button>
      </div>

      <div className="shift-grid">
        <div className="shift-card active-shift">
          <div className="shift-top">
            <span className="shift-time">06:00 — 14:00</span>
            <Badge tone="green">En curso</Badge>
          </div>
          <h3>Turno mañana</h3>
          <p>Jefe: Martín Acosta · 4 líneas activas</p>
          <div className="shift-foot">
            <strong>68%</strong>
            <div className="progress">
              <i style={{ width: "68%" }} />
            </div>
            <span>12.480 kg / 18.200 kg</span>
          </div>
        </div>
        <div className="shift-card">
          <div className="shift-top">
            <span className="shift-time">14:00 — 22:00</span>
            <Badge tone="blue">Planificado</Badge>
          </div>
          <h3>Turno tarde</h3>
          <p>Jefe: Laura Giménez · 3 líneas planificadas</p>
          <div className="shift-foot">
            <strong>0%</strong>
            <div className="progress">
              <i style={{ width: "0%" }} />
            </div>
            <span>Comienza en 4 h 12 min</span>
          </div>
        </div>
        <div className="shift-card">
          <div className="shift-top">
            <span className="shift-time">22:00 — 06:00</span>
            <Badge tone="slate">Cerrado</Badge>
          </div>
          <h3>Turno noche</h3>
          <p>Jefe: Pablo Suárez · 4 líneas completadas</p>
          <div className="shift-foot">
            <strong>100%</strong>
            <div className="progress">
              <i style={{ width: "100%", background: "#3f9d77" }} />
            </div>
            <span>18.940 kg producidos</span>
          </div>
        </div>
      </div>

      <div className="panel table-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">TRAZABILIDAD DE LOTES</div>
            <h3>Fabricación reciente</h3>
          </div>
          <div className="table-tools">
            <button className="secondary-cta">
              <Search size={15} /> Filtrar
            </button>
            <button className="secondary-cta">
              <FileText size={15} /> Exportar
            </button>
          </div>
        </div>
        <Table
          headers={["Lote", "Producto", "Línea", "Turno", "Estado", "Cantidad"]}
          rows={productionRows}
          renderCell={(cell, j) =>
            j === 4 ? (
              <Badge
                tone={
                  cell === "Liberado"
                    ? "green"
                    : cell === "En proceso"
                      ? "blue"
                      : cell === "Control de calidad"
                        ? "amber"
                        : "slate"
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
