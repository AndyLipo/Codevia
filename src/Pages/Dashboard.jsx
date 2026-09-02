// import { useState } from "react";
// import {
//   AlertTriangle,
//   ArrowUpRight,
//   BarChart3,
//   Bell,
//   CalendarDays,
//   CheckCircle2,
//   ChevronDown,
//   ClipboardList,
//   Clock3,
//   Factory,
//   FileText,
//   Gauge,
//   LayoutDashboard,
//   LogOut,
//   MapPin,
//   Menu,
//   Plus,
//   RefreshCw,
//   Route,
//   Search,
//   Settings2,
//   Sparkle,
//   Truck,
//   UsersRound,
//   Warehouse,
//   X,
//   Zap,
// } from "lucide-react";
// import { toast } from "sonner";
// import Sidebar from "@/components/layout/Sidebar";

// const modules = [
//   { id: "overview", label: "Vista general", icon: LayoutDashboard },
//   { id: "production", label: "Producción", icon: Factory },
//   { id: "warehouse", label: "Depósito", icon: Warehouse },
//   { id: "dispatch", label: "Expedición", icon: Truck },
//   { id: "orders", label: "Pedidos", icon: ClipboardList },
//   { id: "reports", label: "Reportes", icon: BarChart3 },
// ];

// const productionRows = [
//   [
//     "EXT-2408-17",
//     "Bobina BOPP transparente",
//     "Extrusora 02",
//     "Turno mañana",
//     "En proceso",
//     "1.240 kg",
//   ],
//   [
//     "BOL-2408-09",
//     "Bolsa camiseta 45×50",
//     "Línea bolsas 01",
//     "Turno mañana",
//     "Control de calidad",
//     "86.000 un.",
//   ],
//   [
//     "EXT-2408-16",
//     "Film biodegradable",
//     "Extrusora 01",
//     "Turno noche",
//     "Liberado",
//     "980 kg",
//   ],
//   [
//     "BOL-2408-08",
//     "Bolsa consorcio 90 L",
//     "Línea bolsas 02",
//     "Turno noche",
//     "Pendiente",
//     "42.000 un.",
//   ],
// ];

// const stockRows = [
//   [
//     "MP-PLA-014",
//     "Resina biodegradable PLA",
//     "Sector B · Rack 04 · P02",
//     "1.280 kg",
//     "12 sep 2026",
//     "Crítico",
//   ],
//   [
//     "PP-HOMO-231",
//     "Polipropileno homopolímero",
//     "Sector A · Rack 02 · P07",
//     "4.620 kg",
//     "—",
//     "Normal",
//   ],
//   [
//     "PEBD-088",
//     "Polietileno baja densidad",
//     "Sector A · Rack 01 · P03",
//     "2.940 kg",
//     "—",
//     "Normal",
//   ],
//   [
//     "TINT-NEG-041",
//     "Masterbatch negro",
//     "Sector C · Armario 02",
//     "180 kg",
//     "30 nov 2026",
//     "Atención",
//   ],
// ];

// const dispatchRows = [
//   [
//     "EXP-00841",
//     "Plásticos del Sur",
//     "Camión 12",
//     "C. Núñez",
//     "3 / 5",
//     "Cargando",
//   ],
//   [
//     "EXP-00842",
//     "Mayorista Centro",
//     "Camión 07",
//     "M. Rojas",
//     "0 / 4",
//     "En playa",
//   ],
//   [
//     "EXP-00839",
//     "Distribuidora Norte",
//     "Camión 03",
//     "L. Sosa",
//     "4 / 4",
//     "Despachado",
//   ],
// ];

// function Badge({ children, tone = "slate" }) {
//   const tones = {
//     blue: "text-[#145c73] bg-[#e9f2f5]",
//     green: "text-[#328160] bg-[#e7f4ed]",
//     amber: "text-[#a76e1a] bg-[#fff2d8]",
//     red: "text-[#ba584d] bg-[#fbe9e7]",
//     slate: "text-[#6f8087] bg-[#edf1f2]",
//   };

//   return (
//     <span
//       className={`inline-flex items-center gap-1.25 whitespace-nowrap rounded-[99px] px-1.75 py-1.25 text-[9px] font-bold ${tones[tone]}`}
//     >
//       <span className="h-1.25 w-[5px] rounded-full bg-current" />
//       {children}
//     </span>
//   );
// }

// function IconBox({ icon: Icon, tone = "blue" }) {
//   const tones = {
//     blue: "bg-brand-soft text-brand",
//     green: "bg-green-soft text-green",
//     amber: "bg-amber-soft text-amber",
//     red: "bg-red-soft text-red",
//     slate: "bg-slate-soft text-muted-ink",
//   };

//   return (
//     <span
//       className={`mb-[15px] grid h-[33px] w-[33px] place-items-center rounded-[7px] ${tones[tone]}`}
//     >
//       <Icon size={17} strokeWidth={2.1} />
//     </span>
//   );
// }

// function SectionTitle({ eyebrow, title, description, action }) {
//   return (
//     <div className="mb-6 flex flex-col items-start justify-between gap-[18px] lg:flex-row lg:items-end">
//       <div>
//         <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
//           {eyebrow}
//         </div>

//         <h1 className="m-0 font-barlow text-[38px] leading-[0.95] tracking-[-0.6px] text-[#173c4b]">
//           {title}
//         </h1>

//         {description && (
//           <p className="mt-[9px] text-[13px] text-[#829298]">
//             {description}
//           </p>
//         )}
//       </div>

//       {action}
//     </div>
//   );
// }

// function Table({ headers, rows, renderCell }) {
//   return (
//     <div className="overflow-x-auto">
//       <table className="w-full min-w-[620px] border-collapse">
//         <thead>
//           <tr>
//             {headers.map((header) => (
//               <th
//                 key={header}
//                 className="border-b border-[#e7edef] px-3 pb-[11px] text-left text-[9px] font-bold uppercase tracking-[0.09em] text-[#8a9ba0]"
//               >
//                 {header}
//               </th>
//             ))}
//           </tr>
//         </thead>

//         <tbody>
//           {rows.map((row, rowIndex) => (
//             <tr key={rowIndex} className="hover:bg-[#fbfcfc]">
//               {row.map((cell, cellIndex) => (
//                 <td
//                   key={cellIndex}
//                   className={`whitespace-nowrap border-b border-[#edf1f2] px-3 py-[13px] text-[11px] text-[#587078] ${rowIndex === rows.length - 1 ? "border-b-0" : ""
//                     }`}
//                 >
//                   {renderCell
//                     ? renderCell(cell, cellIndex, row)
//                     : cell}
//                 </td>
//               ))}
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// }
// export default function Dashboard({ role, setRole, setLogged }) {
//   const [activeSection, setActiveSection] = useState("overview");
//   const [mobileOpen, setMobileOpen] = useState(false);

//   // etc...

//   return (
//     <div className="app-shell">

//       <Sidebar
//         activeSection={activeSection}
//         setActiveSection={setActiveSection}
//         mobileOpen={mobileOpen}
//         setMobileOpen={setMobileOpen}
//         role={role}
//       />

//       {/* resto del Dashboard */}

//     </div>
//   );
// }

// function Overview({ navigate, fakeAction }) {
//   return (
//     <>
//       <SectionTitle
//         eyebrow="01 · CONTROL TOWER"
//         title="Buen día, equipo."
//         description="Martes 18 de agosto · Resumen operativo de la planta y la playa de expedición."
//         action={
//           <div className="flex gap-2">
//             <button
//               className="inline-flex items-center justify-center gap-[7px] rounded-md border border-[#d9e3e6] bg-white px-3 py-[9px] text-[11px] font-semibold text-[#5e747c] transition-all hover:border-[#9ebbc5] hover:text-brand"
//               onClick={() => fakeAction("Vista actualizada")}
//             >
//               <RefreshCw size={16} />
//               Actualizar
//             </button>

//             <button
//               className="inline-flex items-center justify-center gap-[7px] rounded-md bg-brand px-[14px] py-[10px] text-[11px] font-bold text-white shadow-[0_4px_10px_rgba(20,92,115,0.16)] transition-all hover:-translate-y-px hover:bg-brand-dark"
//               onClick={() => navigate("dispatch")}
//             >
//               <Truck size={16} />
//               Ver cargas en playa
//             </button>
//           </div>
//         }
//       />

//       {/* ALERT */}
//       <div className="mb-[19px] flex items-center gap-3 rounded-[7px] border border-[#f1dfbc] bg-[#fff8e9] px-[15px] py-3">
//         <div className="text-[#c4811f]">
//           <AlertTriangle size={18} />
//         </div>

//         <div className="flex-1">
//           <strong className="block text-[12px] text-[#815714]">
//             2 materiales biodegradables requieren atención
//           </strong>

//           <span className="mt-[3px] block text-[11px] text-[#ad8951]">
//             El lote PLA-014 vence en 25 días y el stock está por debajo del
//             mínimo operativo.
//           </span>
//         </div>

//         <button
//           className="flex items-center gap-[5px] border-0 bg-transparent text-[10px] font-bold text-[#a46e1c]"
//           onClick={() => navigate("warehouse")}
//         >
//           Revisar alertas
//           <ArrowUpRight size={15} />
//         </button>
//       </div>

//       {/* KPIS */}
//       <div className="mb-[18px] grid grid-cols-1 gap-[14px] sm:grid-cols-2 xl:grid-cols-4">
//         <Kpi
//           icon={ClipboardList}
//           label="Pedidos pendientes"
//           value="24"
//           trend="+8,2%"
//           note="vs. semana anterior"
//           tone="blue"
//         />

//         <Kpi
//           icon={Clock3}
//           label="Tiempo promedio de carga"
//           value="03:42 h"
//           trend="−18 min"
//           note="mejor que el objetivo"
//           tone="green"
//         />

//         <Kpi
//           icon={AlertTriangle}
//           label="Alertas de vencimiento"
//           value="02"
//           trend="+1"
//           note="requieren atención"
//           tone="amber"
//         />

//         <Kpi
//           icon={Truck}
//           label="Camiones en playa"
//           value="04"
//           trend="02 cargando"
//           note="de 07 programados"
//           tone="slate"
//         />
//       </div>

//       {/* DASHBOARD GRID */}
//       <div className="grid grid-cols-1 gap-[14px] xl:grid-cols-[1.4fr_0.85fr]">
//         {/* PRODUCTION */}
//         <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
//           <div className="mb-[18px] flex items-start justify-between gap-3">
//             <div>
//               <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
//                 FLUJO OPERATIVO
//               </div>

//               <h3 className="m-0 font-barlow text-[21px] tracking-[-0.2px] text-[#214451]">
//                 Estado de producción
//               </h3>
//             </div>

//             <button
//               className="inline-flex items-center justify-center gap-[7px] border-0 bg-transparent text-[11px] font-bold text-brand"
//               onClick={() => navigate("production")}
//             >
//               Ver módulo
//               <ArrowUpRight size={15} />
//             </button>
//           </div>

//           <div className="flex min-h-[192px] flex-col items-center gap-[30px] lg:flex-row">
//             <div className="w-full lg:w-[42%]">
//               <strong className="block font-barlow text-[44px] leading-none text-brand">
//                 86,4%
//               </strong>

//               <span className="flex text-[10px] text-[#87979d]">
//                 avance de la planificación semanal
//               </span>

//               <div className="mt-4 h-[6px] overflow-hidden rounded-[5px] bg-[#edf1f2]">
//                 <i
//                   className="block h-full rounded-[inherit] bg-brand"
//                   style={{ width: "86%" }}
//                 />
//               </div>

//               <small className="mt-2 flex justify-between text-[9px] text-[#87979d]">
//                 <span>104.240 kg producidos</span>
//                 <span>120.600 kg planificados</span>
//               </small>
//             </div>

//             <div className="flex flex-1 items-end justify-between gap-2 self-stretch px-0 pb-0 pt-[14px]">
//               {[62, 75, 48, 86, 72, 94, 66].map((height, i) => (
//                 <div
//                   className="flex h-full flex-1 flex-col items-center justify-end gap-[6px] text-[9px] text-[#a1afb2]"
//                   key={i}
//                 >
//                   <div
//                     className={`relative w-[22px] min-h-[18px] rounded-[4px_4px_2px_2px] ${i === 3 ? "bg-brand" : "bg-[#d7e7eb]"
//                       }`}
//                     style={{ height: `${height}%` }}
//                   >
//                     <span className="absolute left-1/2 top-[-18px] -translate-x-1/2 text-[9px] text-[#748a91]">
//                       {["L", "M", "M", "J", "V", "S", "D"][i]}
//                     </span>
//                   </div>

//                   <small className="text-[9px]">
//                     {
//                       ["12,4", "15,1", "9,8", "17,2", "14,6", "18,9", "16,2"][
//                       i
//                       ]
//                     }
//                     t
//                   </small>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>

//         {/* YARD */}
//         <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
//           <div className="mb-[18px] flex items-start justify-between gap-3">
//             <div>
//               <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
//                 EXPEDICIÓN
//               </div>

//               <h3 className="m-0 font-barlow text-[21px] tracking-[-0.2px] text-[#214451]">
//                 Actividad en playa
//               </h3>
//             </div>

//             <button
//               className="grid h-8 w-8 place-items-center rounded-md border border-[#dce5e7] bg-white text-[#67808a]"
//               onClick={() => navigate("dispatch")}
//             >
//               <ArrowUpRight size={16} />
//             </button>
//           </div>

//           <div className="flex flex-col gap-4 px-0 py-[3px] pb-[18px]">
//             <YardRow
//               code="CAM-12"
//               client="Plásticos del Sur"
//               status="Cargando"
//               tone="blue"
//               progress="60%"
//             />

//             <YardRow
//               code="CAM-07"
//               client="Mayorista Centro"
//               status="En playa"
//               tone="amber"
//               progress="18%"
//             />

//             <YardRow
//               code="CAM-03"
//               client="Distribuidora Norte"
//               status="Listo"
//               tone="green"
//               progress="100%"
//             />
//           </div>

//           <button
//             className="inline-flex w-full items-center justify-center gap-[7px] rounded-md border border-[#d9e3e6] bg-white px-3 py-[9px] text-[11px] font-semibold text-[#5e747c] hover:border-[#9ebbc5] hover:text-brand"
//             onClick={() => navigate("dispatch")}
//           >
//             Abrir tablero de cargas
//           </button>
//         </div>
//       </div>

//       {/* ORDERS TABLE */}
//       <div className="mt-[14px] rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
//         <div className="mb-[18px] flex items-start justify-between gap-3">
//           <div>
//             <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
//               ÚLTIMOS MOVIMIENTOS
//             </div>

//             <h3 className="m-0 font-barlow text-[21px] tracking-[-0.2px] text-[#214451]">
//               Pedidos para preparar
//             </h3>
//           </div>

//           <button
//             className="inline-flex items-center justify-center gap-[7px] border-0 bg-transparent text-[11px] font-bold text-brand"
//             onClick={() => navigate("orders")}
//           >
//             Ver todos
//             <ArrowUpRight size={15} />
//           </button>
//         </div>

//         <Table
//           headers={["Pedido", "Cliente", "Entrega", "Bultos", "Estado"]}
//           rows={[
//             [
//               "PED-10492",
//               "Plásticos del Sur",
//               "Hoy · 14:00",
//               "18",
//               "Listo para picking",
//             ],
//             [
//               "PED-10488",
//               "Mayorista Centro",
//               "Hoy · 16:30",
//               "42",
//               "En preparación",
//             ],
//             [
//               "PED-10476",
//               "Distribuidora Norte",
//               "Mañana · 08:00",
//               "26",
//               "Confirmado",
//             ],
//           ]}
//           renderCell={(cell, j) =>
//             j === 4 ? (
//               <Badge
//                 tone={
//                   cell === "Listo para picking"
//                     ? "green"
//                     : cell === "En preparación"
//                       ? "amber"
//                       : "blue"
//                 }
//               >
//                 {cell}
//               </Badge>
//             ) : (
//               cell
//             )
//           }
//         />
//       </div>
//     </>
//   );
// }

// function Kpi({ icon, label, value, trend, note, tone }) {
//   const trendColors = {
//     blue: "text-brand",
//     green: "text-green",
//     amber: "text-amber",
//     slate: "text-[#788b92]",
//   };

//   return (
//     <div className="relative min-h-[143px] rounded-lg border border-[#e1e8ea] bg-white p-[17px] shadow-card">
//       <IconBox icon={icon} tone={tone} />

//       <div className="text-[11px] text-[#778b92]">
//         {label}
//       </div>

//       <strong className="mt-[7px] block font-barlow text-[33px] leading-none tracking-[-0.5px] text-[#173d4b]">
//         {value}
//       </strong>

//       <div className="mt-[7px] flex items-center gap-[6px] text-[9px] text-[#98a6aa]">
//         <span className={`font-extrabold ${trendColors[tone]}`}>
//           {trend}
//         </span>

//         <span>{note}</span>
//       </div>
//     </div>
//   );
// }

// function YardRow({ code, client, status, tone, progress }) {
//   return (
//     <div className="flex items-center gap-[9px]">
//       <div className="grid h-[29px] w-[29px] shrink-0 place-items-center rounded-md bg-brand-soft text-brand">
//         <Truck size={16} />
//       </div>

//       <div className="min-w-0 flex-1">
//         <strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-[#35535d]">
//           {code} · {client}
//         </strong>

//         <div className="mt-[7px] h-1 overflow-hidden rounded bg-[#edf1f2]">
//           <i
//             className="block h-full rounded-[inherit] bg-brand"
//             style={{ width: progress }}
//           />
//         </div>
//       </div>

//       <Badge tone={tone}>{status}</Badge>
//     </div>
//   );
// }

// function Production({ fakeAction }) {
//   return (
//     <>
//       <SectionTitle
//         eyebrow="02 · PRODUCCIÓN"
//         title="Turnos y fabricación"
//         description="Planificación de extrusión, lotes activos y controles de calidad."
//         action={
//           <button
//             className="inline-flex items-center justify-center gap-[7px] rounded-md bg-brand px-[14px] py-[10px] text-[11px] font-bold text-white shadow-[0_4px_10px_rgba(20,92,115,0.16)] hover:-translate-y-px hover:bg-brand-dark"
//             onClick={() => fakeAction("Nuevo lote en preparación")}
//           >
//             <Plus size={17} />
//             Registrar fabricación
//           </button>
//         }
//       />

//       <div className="mb-[18px] flex gap-5 border-b border-[#dce5e7]">
//         <button className="relative border-0 bg-transparent pb-3 text-[11px] font-semibold text-brand after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-0.5 after:bg-brand">
//           Turnos y lotes
//         </button>

//         <button
//           className="border-0 bg-transparent pb-3 text-[11px] font-semibold text-[#82949a]"
//           onClick={() =>
//             fakeAction("Vista de calidad en preparación")
//           }
//         >
//           Control de calidad
//           <span className="ml-1 rounded-[99px] bg-[#fff0d7] px-[5px] py-[2px] text-[9px] text-[#b87318]">
//             3
//           </span>
//         </button>

//         <button
//           className="border-0 bg-transparent pb-3 text-[11px] font-semibold text-[#82949a]"
//           onClick={() =>
//             fakeAction("Calendario en preparación")
//           }
//         >
//           Calendario
//         </button>
//       </div>

//       <div className="grid grid-cols-1 gap-[14px] xl:grid-cols-3">
//         <ShiftCard
//           active
//           time="06:00 — 14:00"
//           badge="En curso"
//           badgeTone="green"
//           title="Turno mañana"
//           description="Jefe: Martín Acosta · 4 líneas activas"
//           percentage="68%"
//           progress="68%"
//           footer="12.480 kg / 18.200 kg"
//         />

//         <ShiftCard
//           time="14:00 — 22:00"
//           badge="Planificado"
//           badgeTone="blue"
//           title="Turno tarde"
//           description="Jefe: Laura Giménez · 3 líneas planificadas"
//           percentage="0%"
//           progress="0%"
//           footer="Comienza en 4 h 12 min"
//         />

//         <ShiftCard
//           time="22:00 — 06:00"
//           badge="Cerrado"
//           badgeTone="slate"
//           title="Turno noche"
//           description="Jefe: Pablo Suárez · 4 líneas completadas"
//           percentage="100%"
//           progress="100%"
//           progressColor="#3f9d77"
//           footer="18.940 kg producidos"
//         />
//       </div>

//       <div className="mt-[14px] rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
//         <div className="mb-[18px] flex items-start justify-between gap-3">
//           <div>
//             <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
//               TRAZABILIDAD DE LOTES
//             </div>

//             <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
//               Fabricación reciente
//             </h3>
//           </div>

//           <div className="flex gap-2">
//             <button className="inline-flex items-center gap-[7px] rounded-md border border-[#d9e3e6] bg-white px-3 py-[9px] text-[11px] font-semibold text-[#5e747c]">
//               <Search size={15} />
//               Filtrar
//             </button>

//             <button className="inline-flex items-center gap-[7px] rounded-md border border-[#d9e3e6] bg-white px-3 py-[9px] text-[11px] font-semibold text-[#5e747c]">
//               <FileText size={15} />
//               Exportar
//             </button>
//           </div>
//         </div>

//         <Table
//           headers={[
//             "Lote",
//             "Producto",
//             "Línea",
//             "Turno",
//             "Estado",
//             "Cantidad",
//           ]}
//           rows={productionRows}
//           renderCell={(cell, j) =>
//             j === 4 ? (
//               <Badge
//                 tone={
//                   cell === "Liberado"
//                     ? "green"
//                     : cell === "En proceso"
//                       ? "blue"
//                       : cell === "Control de calidad"
//                         ? "amber"
//                         : "slate"
//                 }
//               >
//                 {cell}
//               </Badge>
//             ) : (
//               cell
//             )
//           }
//         />
//       </div>
//     </>
//   );
// }

// function ShiftCard({
//   active,
//   time,
//   badge,
//   badgeTone,
//   title,
//   description,
//   percentage,
//   progress,
//   progressColor,
//   footer,
// }) {
//   return (
//     <div
//       className={`rounded-lg border border-[#e1e8ea] bg-white p-[17px] shadow-card ${active ? "border-t-[3px] border-t-brand" : ""
//         }`}
//     >
//       <div className="flex items-center justify-between">
//         <span className="text-[10px] font-bold text-[#7a8d93]">
//           {time}
//         </span>

//         <Badge tone={badgeTone}>{badge}</Badge>
//       </div>

//       <h3 className="mb-1 mt-[17px] font-barlow text-[22px] text-[#214451]">
//         {title}
//       </h3>

//       <p className="mb-[21px] text-[10px] text-[#84959a]">
//         {description}
//       </p>

//       <div className="grid grid-cols-[35px_1fr] items-center gap-x-[9px] gap-y-[7px]">
//         <strong className="font-barlow text-[22px] text-brand">
//           {percentage}
//         </strong>

//         <div className="col-start-2 row-start-1 h-[6px] overflow-hidden rounded-[5px] bg-[#edf1f2]">
//           <i
//             className="block h-full rounded-[inherit]"
//             style={{
//               width: progress,
//               background: progressColor || "#145c73",
//             }}
//           />
//         </div>

//         <span className="col-span-2 text-[9px] text-[#9aa7aa]">
//           {footer}
//         </span>
//       </div>
//     </div>
//   );
// }

// function WarehousePage({ fakeAction }) {
//   return (
//     <>
//       <SectionTitle
//         eyebrow="03 · DEPÓSITO"
//         title="Stock por sector"
//         description="Ubicaciones físicas, mínimos operativos y vencimientos próximos."
//         action={
//           <button
//             className="inline-flex items-center justify-center gap-[7px] rounded-md bg-brand px-[14px] py-[10px] text-[11px] font-bold text-white hover:bg-brand-dark"
//             onClick={() =>
//               fakeAction("Movimiento de stock en preparación")
//             }
//           >
//             <Plus size={17} />
//             Registrar movimiento
//           </button>
//         }
//       />

//       <div className="mb-[14px] grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_repeat(3,1fr)]">
//         <div className="rounded-lg border border-[#e1e8ea] bg-white p-4 shadow-card">
//           <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
//             OCUPACIÓN TOTAL
//           </div>

//           <strong className="font-barlow text-[42px] leading-none text-brand">
//             74<span className="text-[20px]">%</span>
//           </strong>

//           <div className="mt-[13px] h-[6px] overflow-hidden rounded-[5px] bg-[#edf1f2]">
//             <i
//               className="block h-full rounded-[inherit] bg-brand"
//               style={{ width: "74%" }}
//             />
//           </div>

//           <small className="mt-2 block text-[9px] text-[#8b9a9f]">
//             3 de 4 sectores en operación normal
//           </small>
//         </div>

//         <SectorChip
//           sector="SECTOR A"
//           value="82%"
//           description="Materia prima"
//         />

//         <SectorChip
//           sector="SECTOR B"
//           value="91%"
//           valueClass="text-amber"
//           description="Biodegradables"
//         />

//         <SectorChip
//           sector="SECTOR C"
//           value="48%"
//           description="Insumos"
//         />
//       </div>

//       <div className="mt-[14px] rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
//         <div className="mb-[18px] flex items-start justify-between gap-3">
//           <div>
//             <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
//               UBICACIONES Y ALERTAS
//             </div>

//             <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
//               Inventario crítico
//             </h3>
//           </div>

//           <button className="inline-flex items-center gap-[7px] rounded-md border border-[#d9e3e6] bg-white px-3 py-[9px] text-[11px] font-semibold text-[#5e747c]">
//             <MapPin size={15} />
//             Mapa de sectores
//           </button>
//         </div>

//         <Table
//           headers={[
//             "Código",
//             "Material",
//             "Ubicación física",
//             "Stock",
//             "Vencimiento",
//             "Nivel",
//           ]}
//           rows={stockRows}
//           renderCell={(cell, j) =>
//             j === 5 ? (
//               <Badge
//                 tone={
//                   cell === "Crítico"
//                     ? "red"
//                     : cell === "Atención"
//                       ? "amber"
//                       : "green"
//                 }
//               >
//                 {cell}
//               </Badge>
//             ) : j === 4 && cell !== "—" ? (
//               <span
//                 className={
//                   cell === "12 sep 2026"
//                     ? "font-bold text-[#bd584c]"
//                     : ""
//                 }
//               >
//                 {cell}
//               </span>
//             ) : (
//               cell
//             )
//           }
//         />
//       </div>

//       <div className="mt-[14px] grid grid-cols-1 gap-[14px] xl:grid-cols-[1.25fr_0.75fr]">
//         <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
//           <div className="mb-[18px] flex items-start justify-between gap-3">
//             <div>
//               <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
//                 ALERTAS DE VENCIMIENTO
//               </div>

//               <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
//                 Acciones sugeridas
//               </h3>
//             </div>

//             <AlertTriangle size={18} className="text-amber" />
//           </div>

//           <AlertItem
//             icon={AlertTriangle}
//             tone="amber"
//             title="PLA-014 · vence en 25 días"
//             description="1.280 kg · sugerido priorizar en producción"
//             button="Priorizar"
//             onClick={() =>
//               fakeAction("Prioridad aplicada al lote PLA-014")
//             }
//           />

//           <AlertItem
//             icon={Clock3}
//             tone="slate"
//             title="TINT-NEG-041 · vence en 104 días"
//             description="180 kg · revisar rotación FEFO"
//             button="Revisar"
//             onClick={() =>
//               fakeAction("Rotación FEFO marcada")
//             }
//           />
//         </div>

//         <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
//           <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
//             REFERENCIA DE UBICACIÓN
//           </div>

//           <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
//             Mapa operativo
//           </h3>

//           <div className="mt-[14px] grid grid-cols-2 gap-[7px]">
//             <MapSector color="#4d8190" label="A" value="82%" />
//             <MapSector color="#d49a43" label="B" value="91%" />
//             <MapSector color="#8ba8ad" label="C" value="48%" />
//             <MapSector color="#426876" label="D" value="Exp." />
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }

// function SectorChip({
//   sector,
//   value,
//   valueClass = "text-[#214451]",
//   description,
// }) {
//   return (
//     <div className="rounded-lg border border-[#e1e8ea] bg-white p-4 shadow-card">
//       <span className="text-[9px] tracking-[0.1em] text-[#8c9ca0]">
//         {sector}
//       </span>

//       <strong
//         className={`mt-[10px] block font-barlow text-[32px] ${valueClass}`}
//       >
//         {value}
//       </strong>

//       <small className="mt-2 block text-[9px] text-[#8b9a9f]">
//         {description}
//       </small>
//     </div>
//   );
// }

// function AlertItem({
//   icon,
//   tone,
//   title,
//   description,
//   button,
//   onClick,
// }) {
//   return (
//     <div className="flex items-center gap-[10px] border-t border-[#edf1f2] py-[11px] first:border-t-0">
//       <IconBox icon={icon} tone={tone} />

//       <div className="min-w-0 flex-1">
//         <strong className="block text-[11px] text-[#49656e]">
//           {title}
//         </strong>

//         <span className="mt-1 block text-[9px] text-[#91a0a4]">
//           {description}
//         </span>
//       </div>

//       <button
//         className="rounded border border-[#e1e8ea] bg-transparent px-[7px] py-[5px] text-[9px] font-bold text-brand"
//         onClick={onClick}
//       >
//         {button}
//       </button>
//     </div>
//   );
// }

// function MapSector({ color, label, value }) {
//   return (
//     <span
//       className="min-h-[56px] rounded-[5px] p-[10px] font-barlow text-[23px] text-white"
//       style={{ background: color }}
//     >
//       {label}

//       <small className="block font-sans text-[8px] text-white/80">
//         {value}
//       </small>
//     </span>
//   );
// }

// function Dispatch({ fakeAction }) {
//   return (
//     <>
//       <SectionTitle
//         eyebrow="04 · EXPEDICIÓN"
//         title="Playa y hojas de ruta"
//         description="Coordiná la carga de camiones y seguí cada despacho en tiempo real."
//         action={
//           <button
//             className="inline-flex items-center justify-center gap-[7px] rounded-md bg-brand px-[14px] py-[10px] text-[11px] font-bold text-white hover:bg-brand-dark"
//             onClick={() =>
//               fakeAction("Nueva hoja de ruta en preparación")
//             }
//           >
//             <Plus size={17} />
//             Armar hoja de ruta
//           </button>
//         }
//       />

//       <div className="mb-[14px] flex flex-col gap-6 rounded-lg bg-brand px-[23px] py-5 text-white lg:flex-row lg:items-center">
//         <div className="flex-1">
//           <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#b6d0d8]">
//             OPERACIÓN DE HOY · MARTES 18 AGO
//           </div>

//           <h3 className="m-0 font-barlow text-[25px] font-semibold">
//             7 camiones programados{" "}
//             <span className="mx-[6px] text-[#76a4b0]">·</span>
//             4 en playa{" "}
//             <span className="mx-[6px] text-[#76a4b0]">·</span>
//             2 despachados
//           </h3>
//         </div>

//         <BannerMetric
//           value="03:42 h"
//           label="tiempo medio de carga"
//         />

//         <BannerMetric
//           value="−18 min"
//           label="vs. objetivo diario"
//           valueClass="text-green"
//         />
//       </div>

//       <div className="grid grid-cols-1 gap-[14px] xl:grid-cols-[1.45fr_0.7fr]">
//         <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
//           <div className="mb-[18px] flex items-start justify-between gap-3">
//             <div>
//               <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
//                 SEGUIMIENTO DE CARGAS
//               </div>

//               <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
//                 Camiones en operación
//               </h3>
//             </div>

//             <button
//               className="inline-flex items-center gap-[7px] rounded-md border border-[#d9e3e6] bg-white px-3 py-[9px] text-[11px] font-semibold text-[#5e747c]"
//               onClick={() => fakeAction("Tablero actualizado")}
//             >
//               <RefreshCw size={15} />
//               Actualizar
//             </button>
//           </div>

//           <Table
//             headers={[
//               "Hoja",
//               "Cliente",
//               "Camión",
//               "Chofer",
//               "Picking",
//               "Estado",
//             ]}
//             rows={dispatchRows}
//             renderCell={(cell, j) =>
//               j === 5 ? (
//                 <Badge
//                   tone={
//                     cell === "Despachado"
//                       ? "green"
//                       : cell === "Cargando"
//                         ? "blue"
//                         : "amber"
//                   }
//                 >
//                   {cell}
//                 </Badge>
//               ) : (
//                 cell
//               )
//             }
//           />
//         </div>

//         <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
//           <div className="mb-[18px] flex items-start justify-between gap-3">
//             <div>
//               <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
//                 RUTA DESTACADA
//               </div>

//               <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
//                 EXP-00841
//               </h3>
//             </div>

//             <Route size={18} className="text-brand" />
//           </div>

//           <div className="relative py-1 pl-[3px] pb-[14px]">
//             <div className="absolute bottom-[30px] left-[10px] top-[14px] border-l border-dashed border-[#cbdde1]" />

//             <RouteStep
//               label="Planta Brother Plast"
//               detail="08:10 · Carga iniciada"
//               done
//             />

//             <RouteStep
//               label="Plásticos del Sur"
//               detail="Parque Industrial · 14:00"
//               current
//             />

//             <RouteStep
//               label="Mayorista Centro"
//               detail="Ruta 5 · 16:30"
//             />
//           </div>

//           <button
//             className="inline-flex w-full items-center justify-center gap-[7px] rounded-md bg-brand px-[14px] py-[10px] text-[11px] font-bold text-white hover:bg-brand-dark"
//             onClick={() => fakeAction("Hoja de ruta abierta")}
//           >
//             Ver hoja completa
//             <ArrowUpRight size={16} />
//           </button>
//         </div>
//       </div>
//     </>
//   );
// }

// function BannerMetric({ value, label, valueClass = "" }) {
//   return (
//     <div className="border-l border-white/20 pl-6">
//       <strong
//         className={`block font-barlow text-[28px] ${valueClass}`}
//       >
//         {value}
//       </strong>

//       <span className="mt-[2px] block text-[9px] text-[#b6d0d8]">
//         {label}
//       </span>
//     </div>
//   );
// }

// function RouteStep({ label, detail, done, current }) {
//   return (
//     <div
//       className={`relative flex gap-[13px] pb-[22px] ${done || current ? "" : ""
//         } last:pb-0`}
//     >
//       <div
//         className={`relative z-[1] grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full ${done
//           ? "bg-green-soft text-green"
//           : current
//             ? "bg-brand-soft text-brand shadow-[0_0_0_4px_#f1f7f8]"
//             : "bg-[#edf1f2] text-[#9aabb0]"
//           }`}
//       >
//         {done ? (
//           <CheckCircle2 size={15} />
//         ) : current ? (
//           <Truck size={14} />
//         ) : (
//           <span />
//         )}
//       </div>

//       <div>
//         <strong className="block text-[11px] text-[#48636c]">
//           {label}
//         </strong>

//         <span className="mt-1 block text-[9px] text-[#96a4a8]">
//           {detail}
//         </span>
//       </div>
//     </div>
//   );
// }

// function Orders({ fakeAction, query }) {
//   const rows = [
//     [
//       "PED-10492",
//       "Plásticos del Sur",
//       "18 bultos",
//       "Hoy · 14:00",
//       "Listo para picking",
//     ],
//     [
//       "PED-10488",
//       "Mayorista Centro",
//       "42 bultos",
//       "Hoy · 16:30",
//       "En preparación",
//     ],
//     [
//       "PED-10476",
//       "Distribuidora Norte",
//       "26 bultos",
//       "Mañana · 08:00",
//       "Confirmado",
//     ],
//     [
//       "PED-10471",
//       "Envases del Litoral",
//       "12 bultos",
//       "Mañana · 10:30",
//       "Pendiente de crédito",
//     ],
//   ].filter(
//     (r) =>
//       !query ||
//       r.join(" ").toLowerCase().includes(query.toLowerCase()),
//   );

//   return (
//     <>
//       <SectionTitle
//         eyebrow="05 · PEDIDOS"
//         title="Pedidos y clientes"
//         description="Seguimiento de punta a punta para cada pedido comercial."
//         action={
//           <button
//             className="inline-flex items-center justify-center gap-[7px] rounded-md bg-brand px-[14px] py-[10px] text-[11px] font-bold text-white hover:bg-brand-dark"
//             onClick={() =>
//               fakeAction("Alta de pedido en preparación")
//             }
//           >
//             <Plus size={17} />
//             Nuevo pedido
//           </button>
//         }
//       />

//       <div className="mb-[14px] grid grid-cols-1 gap-[14px] sm:grid-cols-3">
//         <OrderKpi
//           label="Pedidos del mes"
//           value="184"
//           note="+12,6% vs. mes anterior"
//         />

//         <OrderKpi
//           label="Tiempo medio de confirmación"
//           value="02:18 h"
//           note="Objetivo: 04:00 h"
//         />

//         <OrderKpi
//           label="Clientes activos"
//           value="42"
//           note="6 con entrega esta semana"
//         />
//       </div>

//       <div className="mt-[14px] rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
//         <div className="mb-[18px] flex items-start justify-between gap-3">
//           <div>
//             <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
//               CARTERA ACTIVA
//             </div>

//             <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
//               Pedidos recientes
//             </h3>
//           </div>

//           <div className="flex gap-2">
//             <button className="inline-flex items-center gap-[7px] rounded-md border border-[#d9e3e6] bg-white px-3 py-[9px] text-[11px] font-semibold text-[#5e747c]">
//               <Search size={15} />
//               Buscar
//             </button>

//             <button className="inline-flex items-center gap-[7px] rounded-md border border-[#d9e3e6] bg-white px-3 py-[9px] text-[11px] font-semibold text-[#5e747c]">
//               <UsersRound size={15} />
//               Clientes
//             </button>
//           </div>
//         </div>

//         <Table
//           headers={["Pedido", "Cliente", "Volumen", "Entrega", "Estado"]}
//           rows={rows}
//           renderCell={(cell, j) =>
//             j === 4 ? (
//               <Badge
//                 tone={
//                   cell.includes("Listo")
//                     ? "green"
//                     : cell.includes("Pendiente")
//                       ? "red"
//                       : cell.includes("preparación")
//                         ? "amber"
//                         : "blue"
//                 }
//               >
//                 {cell}
//               </Badge>
//             ) : (
//               cell
//             )
//           }
//         />
//       </div>
//     </>
//   );
// }

// function OrderKpi({ label, value, note }) {
//   return (
//     <div className="rounded-lg border border-[#e1e8ea] bg-white p-[17px] shadow-card">
//       <span className="block text-[10px] text-[#819298]">
//         {label}
//       </span>

//       <strong className="my-2 block font-barlow text-[33px] text-[#174354]">
//         {value}
//       </strong>

//       <small className="block text-[9px] text-green">
//         {note}
//       </small>
//     </div>
//   );
// }

// function Reports() {
//   const reportCards = [
//     {
//       icon: Gauge,
//       label: "Producción por turno",
//       detail: "kg, eficiencia y cumplimiento",
//       tone: "blue",
//     },
//     {
//       icon: Warehouse,
//       label: "Stock por sector",
//       detail: "ocupación, rotación y mínimos",
//       tone: "amber",
//     },
//     {
//       icon: Truck,
//       label: "Entregas por cliente",
//       detail: "OTIF y tiempo en ruta",
//       tone: "green",
//     },
//   ];

//   return (
//     <>
//       <SectionTitle
//         eyebrow="06 · REPORTES"
//         title="Lecturas para decidir"
//         description="Indicadores básicos para el seguimiento diario y semanal."
//         action={
//           <button className="inline-flex items-center justify-center gap-[7px] rounded-md border border-[#d9e3e6] bg-white px-3 py-[9px] text-[11px] font-semibold text-[#5e747c]">
//             <CalendarDays size={16} />
//             Esta semana
//             <ChevronDown size={14} />
//           </button>
//         }
//       />

//       <div className="mb-[14px] grid grid-cols-1 gap-[14px] md:grid-cols-3">
//         {reportCards.map((card, i) => (
//           <div
//             className="relative rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card"
//             key={card.label}
//           >
//             <IconBox icon={card.icon} tone={card.tone} />

//             <div className="absolute right-[19px] top-5 font-barlow text-[20px] text-[#cbd7da]">
//               0{i + 1}
//             </div>

//             <h3 className="m-0 font-barlow text-[22px] text-[#214451]">
//               {card.label}
//             </h3>

//             <p className="mb-5 mt-[5px] text-[10px] text-[#8a9aa0]">
//               {card.detail}
//             </p>

//             <button className="inline-flex items-center justify-center gap-[7px] border-0 bg-transparent text-[11px] font-bold text-brand">
//               Abrir reporte
//               <ArrowUpRight size={15} />
//             </button>
//           </div>
//         ))}
//       </div>

//       <div className="min-h-[310px] rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
//         <div className="mb-[18px] flex items-start justify-between gap-3">
//           <div>
//             <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
//               CUMPLIMIENTO OPERATIVO
//             </div>

//             <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
//               Producción vs. plan semanal
//             </h3>
//           </div>

//           <div className="flex gap-3 text-[9px] text-[#819298]">
//             <span className="flex items-center gap-[5px]">
//               <i className="inline-block h-[7px] w-[7px] rounded-full bg-brand" />
//               Producido
//             </span>

//             <span className="flex items-center gap-[5px]">
//               <i className="inline-block h-[7px] w-[7px] rounded-full bg-[#cedadd]" />
//               Planificado
//             </span>
//           </div>
//         </div>

//         <div className="flex h-[215px] items-end justify-around gap-6 px-[8%] py-[10px]">
//           {[
//             ["Lun", 74, 82],
//             ["Mar", 88, 90],
//             ["Mié", 68, 78],
//             ["Jue", 94, 92],
//             ["Vie", 81, 88],
//             ["Sáb", 96, 92],
//           ].map(([day, value, plan]) => (
//             <div
//               className="flex h-full flex-1 flex-col items-center justify-end gap-[5px]"
//               key={day}
//             >
//               <div className="relative h-[180px] w-[35px] overflow-hidden rounded-[5px] bg-[#f2f5f5]">
//                 <i
//                   className="absolute bottom-0 left-0 w-full rounded-[4px_4px_0_0] bg-[#d3e1e4]"
//                   style={{ height: `${plan}%` }}
//                 />

//                 <i
//                   className="absolute bottom-0 left-0 z-[1] w-1/2 rounded-[4px_4px_0_0] bg-brand"
//                   style={{ height: `${value}%` }}
//                 />
//               </div>

//               <strong className="font-barlow text-[17px] text-[#41606a]">
//                 {value}%
//               </strong>

//               <span className="text-[9px] text-[#89999e]">
//                 {day}
//               </span>
//             </div>
//           ))}
//         </div>
//       </div>

//       <div className="mt-[14px] flex items-start gap-[11px] rounded-[7px] bg-brand-soft px-[15px] py-[13px] text-brand">
//         <Zap size={18} />

//         <div>
//           <strong className="block text-[11px]">
//             Lectura rápida
//           </strong>

//           <span className="mt-1 block text-[10px] text-[#59747d]">
//             El jueves se superó el plan de producción en 2 puntos. La principal
//             oportunidad está en reducir la espera entre cambio de bobina y
//             control de calidad.
//           </span>
//         </div>
//       </div>
//     </>
//   );
// }
import { useState } from "react";
import { toast } from "sonner";

import AppShell from "@/components/layout/AppShell";

import Overview from "@/components/dashboard/Overview";
import Production from "@/components/dashboard/Production";
import Warehouse from "@/components/dashboard/Warehouse";
import Dispatch from "@/components/dashboard/Dispatch";
import Orders from "@/components/dashboard/Orders";
import Reports from "@/components/dashboard/Reports";
import ITAdmin from "@/components/dashboard/itadmin/ITAdmin";

export default function Dashboard({ role, setRole, setLogged }) {
  const [active, setActive] = useState("overview");
  const [query, setQuery] = useState("");

  const navigate = (id) => {
    setActive(id);
  };

  const fakeAction = (message) => {
    toast.success(message);
  };

  const renderContent = () => {
    switch (active) {
      case "overview":
        return (
          <Overview
            navigate={navigate}
            fakeAction={fakeAction}
          />
        );

      case "production":
        return <Production fakeAction={fakeAction} />;

      case "warehouse":
        return <Warehouse fakeAction={fakeAction} />;

      case "dispatch":
        return <Dispatch fakeAction={fakeAction} />;

      case "orders":
        return (
          <Orders
            fakeAction={fakeAction}
            query={query}
          />
        );

      case "reports":
        return <Reports />;

      case "itadmin":
        return <ITAdmin />;

      default:
        return (
          <Overview
            navigate={navigate}
            fakeAction={fakeAction}
          />
        );
    }
  };

  return (
    <AppShell
      active={active}
      navigate={navigate}
      role={role}
      setRole={setRole}
      setLogged={setLogged}
      fakeAction={fakeAction}
      setQuery={setQuery}
    >
      {renderContent()}
    </AppShell>
  );
}