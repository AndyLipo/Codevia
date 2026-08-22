import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  Box,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Factory,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  PackageCheck,
  Plus,
  RefreshCw,
  Route,
  Search,
  Settings2,
  Sparkle,
  Truck,
  UserRound,
  UsersRound,
  Warehouse,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

const modules = [
  { id: "overview", label: "Vista general", icon: LayoutDashboard },
  { id: "production", label: "Producción", icon: Factory },
  { id: "warehouse", label: "Depósito", icon: Warehouse },
  { id: "dispatch", label: "Expedición", icon: Truck },
  { id: "orders", label: "Pedidos", icon: ClipboardList },
  { id: "reports", label: "Reportes", icon: BarChart3 },
];

const productionRows = [
  [
    "EXT-2408-17",
    "Bobina BOPP transparente",
    "Extrusora 02",
    "Turno mañana",
    "En proceso",
    "1.240 kg",
  ],
  [
    "BOL-2408-09",
    "Bolsa camiseta 45×50",
    "Línea bolsas 01",
    "Turno mañana",
    "Control de calidad",
    "86.000 un.",
  ],
  [
    "EXT-2408-16",
    "Film biodegradable",
    "Extrusora 01",
    "Turno noche",
    "Liberado",
    "980 kg",
  ],
  [
    "BOL-2408-08",
    "Bolsa consorcio 90 L",
    "Línea bolsas 02",
    "Turno noche",
    "Pendiente",
    "42.000 un.",
  ],
];
const stockRows = [
  [
    "MP-PLA-014",
    "Resina biodegradable PLA",
    "Sector B · Rack 04 · P02",
    "1.280 kg",
    "12 sep 2026",
    "Crítico",
  ],
  [
    "PP-HOMO-231",
    "Polipropileno homopolímero",
    "Sector A · Rack 02 · P07",
    "4.620 kg",
    "—",
    "Normal",
  ],
  [
    "PEBD-088",
    "Polietileno baja densidad",
    "Sector A · Rack 01 · P03",
    "2.940 kg",
    "—",
    "Normal",
  ],
  [
    "TINT-NEG-041",
    "Masterbatch negro",
    "Sector C · Armario 02",
    "180 kg",
    "30 nov 2026",
    "Atención",
  ],
];
const dispatchRows = [
  [
    "EXP-00841",
    "Plásticos del Sur",
    "Camión 12",
    "C. Núñez",
    "3 / 5",
    "Cargando",
  ],
  [
    "EXP-00842",
    "Mayorista Centro",
    "Camión 07",
    "M. Rojas",
    "0 / 4",
    "En playa",
  ],
  [
    "EXP-00839",
    "Distribuidora Norte",
    "Camión 03",
    "L. Sosa",
    "4 / 4",
    "Despachado",
  ],
];

function Badge({ children, tone = "slate" }) {
  return (
    <span className={`badge badge-${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
function IconBox({ icon: Icon, tone = "blue" }) {
  return (
    <span className={`icon-box icon-${tone}`}>
      <Icon size={17} strokeWidth={2.1} />
    </span>
  );
}
function SectionTitle({ eyebrow, title, description, action }) {
  return (
    <div className="section-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
function Table({ headers, rows, renderCell }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>
                  {renderCell ? renderCell(cell, cellIndex, row) : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard({ role, onLogout }) {
  const [active, setActive] = useState("overview");
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentModule = modules.find((m) => m.id === active) || modules[0];
  const fakeAction = (message) =>
    toast(message, {
      description: "Esta acción es demostrativa en el prototipo.",
    });
  const navigate = (id) => {
    setActive(id);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            {/* <img src="" alt="" /> */}
            <Sparkle />
          </div>
          <div>
            <strong>
              brother<span>plast</span>
            </strong>
            <small>gestión industrial</small>
          </div>
          <button className="close-menu" onClick={() => setMobileOpen(false)}>
            <X size={17} />
          </button>
        </div>
        <div className="plant-status">
          <span className="status-pulse" /> Planta activa{" "}
          <span className="plant-code">BP · 01</span>
        </div>
        <nav className="nav-list">
          {modules.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${active === item.id ? "active" : ""}`}
                onClick={() => navigate(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.id === "warehouse" && <em>2</em>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-alert" onClick={() => navigate("warehouse")}>
            <AlertTriangle size={16} />
            <div>
              <strong>2 alertas críticas</strong>
              <span>Requieren atención hoy</span>
            </div>
            <ArrowUpRight size={15} />
          </div>
          <button
            className="nav-item muted"
            onClick={() => fakeAction("Configuración en preparación")}
          >
            <Settings2 size={18} />
            <span>Configuración</span>
          </button>
        </div>
        <div className="user-card">
          <div className="avatar">{role.initials}</div>
          <div>
            <strong>{role.label}</strong>
            <span>Sesión de demostración</span>
          </div>
          <button onClick={onLogout} title="Cerrar sesión">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <div className="scrim" onClick={() => setMobileOpen(false)} />
      )}
      <main className="main-area">
        <header className="topbar">
          <button className="menu-trigger" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <span>Brother Plast</span>
            <span>/</span>
            <strong>{currentModule.label}</strong>
          </div>
          <div className="top-actions">
            <div className="search">
              <Search size={17} />
              <input
                placeholder="Buscar orden, lote o cliente"
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              className="icon-button notification"
              onClick={() => fakeAction("No hay nuevas notificaciones")}
            >
              <Bell size={18} />
              <i />
            </button>
            <div className="role-switcher">
              <div className="avatar small">{role.initials}</div>
              <select value={role.id} onChange={() => { }}>
                <option>{role.label}</option>
              </select>
              <ChevronDown size={14} />
            </div>
          </div>
        </header>
        <div className="content">
          {active === "overview" && (
            <Overview navigate={navigate} fakeAction={fakeAction} />
          )}
          {active === "production" && <Production fakeAction={fakeAction} />}
          {active === "warehouse" && <WarehousePage fakeAction={fakeAction} />}
          {active === "dispatch" && <Dispatch fakeAction={fakeAction} />}
          {active === "orders" && (
            <Orders fakeAction={fakeAction} query={query} />
          )}
          {active === "reports" && <Reports />}
        </div>
        <footer className="footer">
          <span>Brother Plast SRL · Prototipo exploratorio</span>
          <span>
            Última sincronización <strong>hace 2 min</strong> ·{" "}
            <span className="online">
              <span className="status-pulse" /> Sistema operativo
            </span>
          </span>
        </footer>
      </main>
    </div>
  );
}

function Overview({ navigate, fakeAction }) {
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
function Kpi({ icon, label, value, trend, note, tone }) {
  return (
    <div className="kpi">
      <IconBox icon={icon} tone={tone} />
      <div className="kpi-label">{label}</div>
      <strong>{value}</strong>
      <div className="kpi-meta">
        <span className={`trend ${tone}`}>{trend}</span>
        <span>{note}</span>
      </div>
    </div>
  );
}
function YardRow({ code, client, status, tone, progress }) {
  return (
    <div className="yard-row">
      <div className="yard-icon">
        <Truck size={16} />
      </div>
      <div className="yard-text">
        <strong>
          {code} · {client}
        </strong>
        <div className="yard-progress">
          <i style={{ width: progress }} />
        </div>
      </div>
      <Badge tone={tone}>{status}</Badge>
    </div>
  );
}

function Production({ fakeAction }) {
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

function WarehousePage({ fakeAction }) {
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

function Dispatch({ fakeAction }) {
  return (
    <>
      <SectionTitle
        eyebrow="04 · EXPEDICIÓN"
        title="Playa y hojas de ruta"
        description="Coordiná la carga de camiones y seguí cada despacho en tiempo real."
        action={
          <button
            className="primary-cta"
            onClick={() => fakeAction("Nueva hoja de ruta en preparación")}
          >
            <Plus size={17} /> Armar hoja de ruta
          </button>
        }
      />
      <div className="dispatch-banner">
        <div>
          <div className="eyebrow">OPERACIÓN DE HOY · MARTES 18 AGO</div>
          <h3>
            7 camiones programados <span>·</span> 4 en playa <span>·</span> 2
            despachados
          </h3>
        </div>
        <div className="banner-metric">
          <strong>03:42 h</strong>
          <span>tiempo medio de carga</span>
        </div>
        <div className="banner-metric">
          <strong className="green-text">−18 min</strong>
          <span>vs. objetivo diario</span>
        </div>
      </div>
      <div className="dispatch-layout">
        <div className="panel table-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">SEGUIMIENTO DE CARGAS</div>
              <h3>Camiones en operación</h3>
            </div>
            <button
              className="secondary-cta"
              onClick={() => fakeAction("Tablero actualizado")}
            >
              <RefreshCw size={15} /> Actualizar
            </button>
          </div>
          <Table
            headers={[
              "Hoja",
              "Cliente",
              "Camión",
              "Chofer",
              "Picking",
              "Estado",
            ]}
            rows={dispatchRows}
            renderCell={(cell, j) =>
              j === 5 ? (
                <Badge
                  tone={
                    cell === "Despachado"
                      ? "green"
                      : cell === "Cargando"
                        ? "blue"
                        : "amber"
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
        <div className="panel route-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">RUTA DESTACADA</div>
              <h3>EXP-00841</h3>
            </div>
            <Route size={18} className="blue-text" />
          </div>
          <div className="route-line">
            <RouteStep
              label="Planta Brother Plast"
              detail="08:10 · Carga iniciada"
              done
            />
            <RouteStep
              label="Plásticos del Sur"
              detail="Parque Industrial · 14:00"
              current
            />
            <RouteStep label="Mayorista Centro" detail="Ruta 5 · 16:30" />
          </div>
          <button
            className="primary-cta full"
            onClick={() => fakeAction("Hoja de ruta abierta")}
          >
            Ver hoja completa <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    </>
  );
}
function RouteStep({ label, detail, done, current }) {
  return (
    <div
      className={`route-step ${done ? "done" : ""} ${current ? "current" : ""}`}
    >
      <div className="route-dot">
        {done ? (
          <CheckCircle2 size={15} />
        ) : current ? (
          <Truck size={14} />
        ) : (
          <span />
        )}
      </div>
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}

function Orders({ fakeAction, query }) {
  const rows = [
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
  ].filter(
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

function Reports() {
  const reportCards = [
    {
      icon: Gauge,
      label: "Producción por turno",
      detail: "kg, eficiencia y cumplimiento",
      tone: "blue",
    },
    {
      icon: Warehouse,
      label: "Stock por sector",
      detail: "ocupación, rotación y mínimos",
      tone: "amber",
    },
    {
      icon: Truck,
      label: "Entregas por cliente",
      detail: "OTIF y tiempo en ruta",
      tone: "green",
    },
  ];
  return (
    <>
      <SectionTitle
        eyebrow="06 · REPORTES"
        title="Lecturas para decidir"
        description="Indicadores básicos para el seguimiento diario y semanal."
        action={
          <button className="secondary-cta">
            <CalendarDays size={16} /> Esta semana <ChevronDown size={14} />
          </button>
        }
      />
      <div className="report-grid">
        {reportCards.map((card, i) => (
          <div className="report-card" key={card.label}>
            <IconBox icon={card.icon} tone={card.tone} />
            <div className="report-index">0{i + 1}</div>
            <h3>{card.label}</h3>
            <p>{card.detail}</p>
            <button className="link-button">
              Abrir reporte <ArrowUpRight size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="panel report-main">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">CUMPLIMIENTO OPERATIVO</div>
            <h3>Producción vs. plan semanal</h3>
          </div>
          <div className="legend">
            <span>
              <i className="legend-dot blue" />
              Producido
            </span>
            <span>
              <i className="legend-dot gray" />
              Planificado
            </span>
          </div>
        </div>
        <div className="report-bars">
          {[
            ["Lun", 74, 82],
            ["Mar", 88, 90],
            ["Mié", 68, 78],
            ["Jue", 94, 92],
            ["Vie", 81, 88],
            ["Sáb", 96, 92],
          ].map(([day, value, plan]) => (
            <div className="report-bar-day" key={day}>
              <div className="report-bar-track">
                <i style={{ height: `${plan}%` }} className="plan" />
                <i style={{ height: `${value}%` }} className="actual" />
              </div>
              <strong>{value}%</strong>
              <span>{day}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="insight">
        <Zap size={18} />
        <div>
          <strong>Lectura rápida</strong>
          <span>
            El jueves se superó el plan de producción en 2 puntos. La principal
            oportunidad está en reducir la espera entre cambio de bobina y
            control de calidad.
          </span>
        </div>
      </div>
    </>
  );
}
