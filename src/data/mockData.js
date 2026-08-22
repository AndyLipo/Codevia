import {
  LayoutDashboard,
  Factory,
  Warehouse,
  Truck,
  ClipboardList,
  BarChart3,
} from "lucide-react";

export const roleOptions = [
  {
    id: "production",
    label: "Jefe de Producción",
    initials: "JP",
    note: "Turnos, lotes y calidad",
  },
  {
    id: "warehouse",
    label: "Depósito y Expedición",
    initials: "DE",
    note: "Stock, cargas y rutas",
  },
  {
    id: "operator",
    label: "Operario de Extrusión",
    initials: "OE",
    note: "Registro de turno",
  },
  {
    id: "forklift",
    label: "Clarkista",
    initials: "CL",
    note: "Ubicaciones y carga",
  },
  {
    id: "driver",
    label: "Chofer",
    initials: "CH",
    note: "Hoja de ruta y entregas",
  },
  {
    id: "admin",
    label: "Administración y Ventas",
    initials: "AV",
    note: "Pedidos y reportes",
  },
];

export const modules = [
  { id: "overview", label: "Vista general", icon: LayoutDashboard },
  { id: "production", label: "Producción", icon: Factory },
  { id: "warehouse", label: "Depósito", icon: Warehouse },
  { id: "dispatch", label: "Expedición", icon: Truck },
  { id: "orders", label: "Pedidos", icon: ClipboardList },
  { id: "reports", label: "Reportes", icon: BarChart3 },
];

export const productionRows = [
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

export const stockRows = [
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

export const dispatchRows = [
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
