import {
  ArrowLeft, LayoutDashboard, Factory, Warehouse, Truck, ClipboardList,
  BarChart3, AlertTriangle, Search, ArrowUpRight, Clock3,
} from "lucide-react";

const notes = [
  ["01", "Sidebar fija", "Contenedor de navegación principal. En desktop queda anclado a la izquierda; en tablet se convierte en drawer."],
  ["02", "Topbar", "Barra contextual con breadcrumbs, búsqueda, notificaciones y selector de rol."],
  ["03", "SectionTitle", "Patrón reutilizable para eyebrow técnico, título, descripción y acciones."],
  ["04", "KPI card", "Tarjeta de indicador. Usa IconBox, valor principal, tendencia y nota contextual."],
  ["05", "Panel operativo", "Contenedor blanco para gráficos, actividad de playa, formularios o información agrupada."],
  ["06", "Table", "Tabla reutilizable con headers, filas y renderCell para badges de estado."],
  ["07", "Badge", "Etiqueta semántica de estado: blue, green, amber, red o slate."],
  ["08", "Action / CTA", "Botón primario, secundario o link-button según jerarquía de la acción."],
];

export default function Anatomy({ onBack }) {
  return (
    <div className="min-h-screen bg-[#edf2f3] p-[34px_42px_48px] font-['DM_Sans',sans-serif] text-ink max-[900px]:p-[22px_16px_34px]">
      <header className="mx-auto mb-[26px] flex max-w-[1500px] items-end justify-between gap-6">
        <div>
          <div className="text-[9px] font-extrabold tracking-[0.16em] text-[#82979e]">DOCUMENTACIÓN VISUAL · UI KIT</div>
          <h1 className="m-0 font-barlow text-[42px] leading-[0.95] tracking-[-0.5px] text-[#173c4b]">Anatomía del sistema</h1>
          <p className="mt-2 text-xs text-[#71858d]">Mapa de contenedores y componentes del dashboard Brother Plast.</p>
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-[7px] rounded-md border border-[#d9e3e6] bg-white px-3 py-[9px] text-[11px] font-semibold text-[#5e747c] hover:border-[#9ebbc5] hover:text-brand"
        >
          <ArrowLeft size={15} /> Volver al prototipo
        </button>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-[minmax(0,1fr)_330px] items-start gap-[22px] max-[900px]:grid-cols-1">
        <section className="min-w-0 rounded-xl border border-[#ccdadd] bg-[#dfe7e9] p-[23px] shadow-[0_16px_45px_rgba(24,49,58,0.08)] max-[900px]:overflow-x-auto">
          <div className="mb-[13px] text-[9px] font-extrabold tracking-[0.16em] text-[#779099]">FRAME · DASHBOARD / 1440 × 900</div>
          <MockApp />
        </section>

        <aside className="rounded-[10px] border border-[#dce5e7] bg-white p-[22px_19px] shadow-[0_10px_28px_rgba(24,49,58,0.06)] max-[900px]:order-[-1]">
          <div className="text-[8px] font-extrabold tracking-[0.16em] text-[#82979e]">COMPONENT INVENTORY</div>
          <h2 className="my-1.5 font-barlow text-[29px] text-[#173c4b]">Qué estás viendo</h2>
          <p className="mb-[15px] text-[10px] leading-relaxed text-[#829298]">
            Cada número corresponde a una pieza visual del dashboard y a un componente o patrón de React.
          </p>

          {notes.map(([number, title, description]) => (
            <div key={number} className="flex gap-2.5 border-t border-[#edf1f2] py-[11px] first:border-0">
              <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-[#fff0d7] text-[8px] font-extrabold text-[#b87318]">
                {number}
              </span>
              <div>
                <strong className="block text-[10px] text-[#42616b]">{title}</strong>
                <p className="mt-[3px] text-[9px] leading-snug text-[#87989d]">{description}</p>
              </div>
            </div>
          ))}

          <div className="mt-[9px] flex flex-col gap-[7px] rounded-md border border-[#e5edef] bg-[#f5f8f8] p-3 text-[8px] text-[#74878e]">
            <strong className="mb-0.5 text-[9px] text-[#45636c]">Origen visual</strong>
            <span><i className="mr-[5px] inline-block h-1.5 w-1.5 rounded-full bg-[#61dafb]" /> React + JSX: composición y estados</span>
            <span><i className="mr-[5px] inline-block h-1.5 w-1.5 rounded-full bg-brand" /> CSS propio: layout, colores y contenedores</span>
            <span><i className="mr-[5px] inline-block h-1.5 w-1.5 rounded-full bg-amber" /> Lucide React: íconos</span>
            <span><i className="mr-[5px] inline-block h-1.5 w-1.5 rounded-full bg-[#8b7be8]" /> Radix/shadcn: componentes base disponibles</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Callout({ children, className = "" }) {
  return (
    <span className={`absolute z-[3] grid h-5 w-5 place-items-center rounded-full bg-amber text-[9px] font-extrabold text-white shadow-[0_0_0_3px_rgba(213,139,39,0.2)] ${className}`}>
      {children}
    </span>
  );
}

function MockApp() {
  return (
    <div className="relative flex min-h-[665px] overflow-hidden rounded-[7px] border border-[#cbdadd] bg-[#f4f6f7] shadow-[0_12px_26px_rgba(24,49,58,0.12)] max-[900px]:min-w-[720px]">
      <aside className="relative w-[155px] flex-none border-r border-[#d8e1e3] bg-white p-[18px_9px]">
        <div className="flex items-center gap-1.5 px-[5px] pb-4 font-barlow text-[15px] text-[#153d4c]">
          <span className="grid h-[21px] w-[21px] place-items-center rounded-[5px] bg-brand-soft text-[13px] text-brand">B</span>
          <strong className="font-normal">brother<span className="text-amber">plast</span></strong>
        </div>
        <div className="mx-1 mb-3 border-t border-[#edf1f2]" />
        <div className="mb-0.5 flex items-center gap-1.5 rounded-[5px] bg-brand-soft px-[7px] py-[9px] text-[9px] font-bold text-brand" style={{ boxShadow: "inset 2px 0 var(--color-brand)" }}>
          <LayoutDashboard size={13} /> Vista general
        </div>
        <div className="flex items-center gap-1.5 px-[7px] py-[9px] text-[9px] text-[#74878e]"><Factory size={13} /> Producción</div>
        <div className="flex items-center gap-1.5 px-[7px] py-[9px] text-[9px] text-[#74878e]">
          <Warehouse size={13} /> Depósito <b className="ml-auto rounded-full bg-[#fff0d7] px-1 py-0.5 text-[8px] font-normal text-[#b87318]">2</b>
        </div>
        <div className="flex items-center gap-1.5 px-[7px] py-[9px] text-[9px] text-[#74878e]"><Truck size={13} /> Expedición</div>
        <div className="flex items-center gap-1.5 px-[7px] py-[9px] text-[9px] text-[#74878e]"><ClipboardList size={13} /> Pedidos</div>
        <div className="flex items-center gap-1.5 px-[7px] py-[9px] text-[9px] text-[#74878e]"><BarChart3 size={13} /> Reportes</div>
        <Callout className="right-[-10px] top-[122px]">01</Callout>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="relative flex h-[53px] items-center justify-between gap-3 border-b border-[#dfe7e9] bg-white px-5 text-[9px] text-[#9aa8ad]">
          <span>Brother Plast / <strong className="text-[#345460]">Vista general</strong></span>
          <div className="flex items-center gap-[9px]">
            <span className="flex w-[115px] items-center gap-1 rounded-[4px] bg-[#f5f7f8] px-2 py-1.5 text-[#a0adb1]"><Search size={11} /> Buscar...</span>
            <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[7px] font-extrabold text-white">JP</span>
          </div>
          <Callout className="right-3.5 top-2">02</Callout>
        </div>

        <div className="p-[23px_25px]">
          <div className="relative mb-[17px] flex items-end justify-between gap-2.5">
            <div>
              <small className="text-[7px] font-extrabold tracking-[0.15em] text-[#82979e]">01 · CONTROL TOWER</small>
              <h2 className="mt-1.5 font-barlow text-[27px] leading-[0.95] text-[#173c4b]">Buen día, equipo.</h2>
              <p className="mt-1 text-[9px] text-[#829298]">Resumen operativo de la planta y la playa de expedición.</p>
            </div>
            <button className="flex items-center gap-[5px] rounded-[4px] bg-brand px-[9px] py-[7px] text-[8px] font-bold text-white">
              Ver cargas <ArrowUpRight size={11} />
            </button>
            <Callout className="right-[-8px] top-3">03</Callout>
          </div>

          <div className="mb-[11px] flex items-center gap-2 rounded-[5px] border border-[#f1dfbc] bg-[#fff8e9] p-[9px_10px] text-[#c4811f]">
            <AlertTriangle size={13} />
            <span className="flex-1">
              <strong className="block text-[9px] text-[#815714]">2 materiales requieren atención</strong>
              <small className="mt-0.5 block text-[8px] text-[#ad8951]">El lote PLA-014 vence en 25 días.</small>
            </span>
            <span className="text-[8px] font-extrabold text-[#a46e1c]">Revisar</span>
          </div>

          <div className="mb-[11px] grid grid-cols-4 gap-2">
            <div className="relative rounded-[5px] border border-[#e1e8ea] bg-white p-2.5">
              <span className="mb-2 grid h-5 w-5 place-items-center rounded-[4px] bg-brand-soft text-brand"><ClipboardList size={12} /></span>
              <small className="block truncate text-[7px] text-[#778b92]">Pedidos pendientes</small>
              <strong className="mt-1 block font-barlow text-[22px] text-[#173d4b]">24</strong>
              <em className="text-[7px] not-italic text-green">+8,2%</em>
              <Callout className="right-[-7px] top-[-7px]">04</Callout>
            </div>
            <div className="rounded-[5px] border border-[#e1e8ea] bg-white p-2.5">
              <span className="mb-2 grid h-5 w-5 place-items-center rounded-[4px] bg-green-soft text-green"><Clock3 size={12} /></span>
              <small className="block truncate text-[7px] text-[#778b92]">Tiempo de carga</small>
              <strong className="mt-1 block font-barlow text-[22px] text-[#173d4b]">03:42 h</strong>
              <em className="text-[7px] not-italic text-green">−18 min</em>
            </div>
            <div className="rounded-[5px] border border-[#e1e8ea] bg-white p-2.5">
              <span className="mb-2 grid h-5 w-5 place-items-center rounded-[4px] bg-amber-soft text-amber"><AlertTriangle size={12} /></span>
              <small className="block truncate text-[7px] text-[#778b92]">Vencimientos</small>
              <strong className="mt-1 block font-barlow text-[22px] text-[#173d4b]">02</strong>
              <em className="text-[7px] not-italic text-green">+1</em>
            </div>
            <div className="rounded-[5px] border border-[#e1e8ea] bg-white p-2.5">
              <span className="mb-2 grid h-5 w-5 place-items-center rounded-[4px] bg-slate-soft text-[#71828a]"><Truck size={12} /></span>
              <small className="block truncate text-[7px] text-[#778b92]">Camiones en playa</small>
              <strong className="mt-1 block font-barlow text-[22px] text-[#173d4b]">04</strong>
              <em className="text-[7px] not-italic text-green">02 cargando</em>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-[1.35fr_0.8fr] gap-2">
            <div className="relative min-h-[150px] rounded-[5px] border border-[#e1e8ea] bg-white p-3">
              <small className="text-[7px] font-extrabold tracking-[0.15em] text-[#82979e]">FLUJO OPERATIVO</small>
              <h3 className="my-1.5 font-barlow text-base text-[#214451]">Estado de producción</h3>
              <div className="flex items-center gap-[19px]">
                <div className="font-barlow text-[30px] text-brand">86,4%</div>
                <div className="flex h-[72px] flex-1 items-end justify-around gap-1.5 border-b border-[#e7edef]">
                  {[35, 58, 45, 82, 68, 92, 55].map((h, i) => (
                    <i key={i} className={`w-[11px] rounded-t-[3px] ${i === 3 ? "bg-brand" : "bg-[#d7e7eb]"}`} style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              <Callout className="left-[-8px] top-5">05</Callout>
            </div>

            <div className="relative min-h-[150px] rounded-[5px] border border-[#e1e8ea] bg-white p-3">
              <small className="text-[7px] font-extrabold tracking-[0.15em] text-[#82979e]">EXPEDICIÓN</small>
              <h3 className="my-1.5 font-barlow text-base text-[#214451]">Actividad en playa</h3>
              <div className="my-3.5 flex flex-col gap-3">
                <span className="block h-1 w-[74%] rounded-[4px] bg-brand" />
                <span className="block h-1 w-[43%] rounded-[4px] bg-[#d49a43]" />
                <span className="block h-1 w-full rounded-[4px] bg-green" />
              </div>
              <div className="flex items-center justify-between text-[8px] text-[#48636c]">
                <b>CAM-12</b><label className="rounded-lg bg-brand-soft px-[5px] py-[3px] text-[7px] text-brand"> Cargando </label>
              </div>
              <Callout className="right-[-8px] bottom-[31px]">07</Callout>
            </div>
          </div>

          <div className="relative min-h-[142px] rounded-[5px] border border-[#e1e8ea] bg-white p-3">
            <small className="text-[7px] font-extrabold tracking-[0.15em] text-[#82979e]">ÚLTIMOS MOVIMIENTOS</small>
            <h3 className="my-1.5 font-barlow text-base text-[#214451]">Pedidos para preparar</h3>
            <div className="mb-1.5 mt-[13px] grid grid-cols-[1.1fr_1.6fr_1fr_1.2fr] items-center gap-2 text-[6px] tracking-[0.09em] text-[#8a9ba0]">
              <span>PEDIDO</span><span>CLIENTE</span><span>ENTREGA</span><span>ESTADO</span>
            </div>
            <div className="grid grid-cols-[1.1fr_1.6fr_1fr_1.2fr] items-center gap-2 border-t border-[#edf1f2] py-[7px] text-[7px] text-[#587078]">
              <b className="text-[#48636c]">PED-10492</b><span>Plásticos del Sur</span><span>Hoy · 14:00</span>
              <label className="justify-self-start whitespace-nowrap rounded-lg bg-brand-soft px-[5px] py-[3px] text-brand">Listo para picking</label>
            </div>
            <div className="grid grid-cols-[1.1fr_1.6fr_1fr_1.2fr] items-center gap-2 border-t border-[#edf1f2] py-[7px] text-[7px] text-[#587078]">
              <b className="text-[#48636c]">PED-10488</b><span>Mayorista Centro</span><span>Hoy · 16:30</span>
              <label className="justify-self-start whitespace-nowrap rounded-lg bg-amber-soft px-[5px] py-[3px] text-[#a76e1a]">En preparación</label>
            </div>
            <Callout className="left-[-8px] top-[26px]">06</Callout>
            <Callout className="right-[-8px] bottom-[26px]">08</Callout>
          </div>
        </div>
      </div>
    </div>
  );
}