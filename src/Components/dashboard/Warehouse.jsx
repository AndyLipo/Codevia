import { AlertTriangle, Clock3, MapPin, Plus } from "lucide-react";
import SectionTitle from "@/components/common/SectionTitle";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import IconBox from "@/components/common/IconBox";
import { stockRows } from "@/data/mockData";

export default function Warehouse({ fakeAction }) {
  return (
    <>
      <SectionTitle
        eyebrow="03 · DEPÓSITO"
        title="Stock por sector"
        description="Ubicaciones físicas, mínimos operativos y vencimientos próximos."
        action={
          <button
            className="primary-cta"
            onClick={() => fakeAction("Movimiento de stock en preparación")}
          >
            <Plus size={17} /> Registrar movimiento
          </button>
        }
      />

      <div className="warehouse-summary">
        <div className="warehouse-big">
          <div className="eyebrow">OCUPACIÓN TOTAL</div>
          <strong>
            74<span>%</span>
          </strong>
          <div className="progress">
            <i style={{ width: "74%" }} />
          </div>
          <small>3 de 4 sectores en operación normal</small>
        </div>
        <div className="sector-chip">
          <span>SECTOR A</span>
          <strong>82%</strong>
          <small>Materia prima</small>
        </div>
        <div className="sector-chip">
          <span>SECTOR B</span>
          <strong className="amber-text">91%</strong>
          <small>Biodegradables</small>
        </div>
        <div className="sector-chip">
          <span>SECTOR C</span>
          <strong>48%</strong>
          <small>Insumos</small>
        </div>
      </div>

      <div className="panel table-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">UBICACIONES Y ALERTAS</div>
            <h3>Inventario crítico</h3>
          </div>
          <div className="table-tools">
            <button className="secondary-cta">
              <MapPin size={15} /> Mapa de sectores
            </button>
          </div>
        </div>
        <Table
          headers={[
            "Código",
            "Material",
            "Ubicación física",
            "Stock",
            "Vencimiento",
            "Nivel",
          ]}
          rows={stockRows}
          renderCell={(cell, j) =>
            j === 5 ? (
              <Badge
                tone={
                  cell === "Crítico"
                    ? "red"
                    : cell === "Atención"
                      ? "amber"
                      : "green"
                }
              >
                {cell}
              </Badge>
            ) : j === 4 && cell !== "—" ? (
              <span className={cell === "12 sep 2026" ? "danger-text" : ""}>
                {cell}
              </span>
            ) : (
              cell
            )
          }
        />
      </div>

      <div className="split-panels">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">ALERTAS DE VENCIMIENTO</div>
              <h3>Acciones sugeridas</h3>
            </div>
            <AlertTriangle size={18} className="amber-text" />
          </div>
          <div className="alert-item">
            <IconBox icon={AlertTriangle} tone="amber" />
            <div>
              <strong>PLA-014 · vence en 25 días</strong>
              <span>1.280 kg · sugerido priorizar en producción</span>
            </div>
            <button
              onClick={() => fakeAction("Prioridad aplicada al lote PLA-014")}
            >
              Priorizar
            </button>
          </div>
          <div className="alert-item">
            <IconBox icon={Clock3} tone="slate" />
            <div>
              <strong>TINT-NEG-041 · vence en 104 días</strong>
              <span>180 kg · revisar rotación FEFO</span>
            </div>
            <button onClick={() => fakeAction("Rotación FEFO marcada")}>
              Revisar
            </button>
          </div>
        </div>

        <div className="panel location-panel">
          <div className="eyebrow">REFERENCIA DE UBICACIÓN</div>
          <h3>Mapa operativo</h3>
          <div className="warehouse-map">
            <span className="map-sector a">
              A <small>82%</small>
            </span>
            <span className="map-sector b">
              B <small>91%</small>
            </span>
            <span className="map-sector c">
              C <small>48%</small>
            </span>
            <span className="map-sector d">
              D <small>Exp.</small>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
