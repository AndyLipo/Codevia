import {
  LayoutDashboard,
  Factory,
  Warehouse,
  Truck,
  ClipboardList,
  PackageSearch,
  BarChart3,
  ShieldCheck,
  UsersRound,
  Building2,
  Package,
  Tags,
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
  // {
  //   id: "driver",
  //   label: "Chofer",
  //   initials: "CH",
  //   note: "Hoja de ruta y entregas",
  // },
  {
    id: "admin",
    label: "Administración y Ventas",
    initials: "AV",
    note: "Pedidos y reportes",
  },
  {
    id: "it",
    label: "IT / Sistemas",
    initials: "IT",
    note: "Usuarios, config y auditoría"
  },
];

export const modules = [
  { id: "overview", label: "Vista general", icon: LayoutDashboard },
  { id: "production", label: "Producción", icon: Factory },
  { id: "warehouse", label: "Depósito", icon: Warehouse },
  { id: "dispatch", label: "Expedición", icon: Truck },
  { id: "pedidos-gestion", label: "Gestión de Pedidos", icon: ClipboardList },
  { id: "pedidos-seguimiento", label: "Seguimiento de Pedidos", icon: PackageSearch },
  { id: "productos", label: "Productos", icon: Package },
  { id: "lista-precios", label: "Lista de precios", icon: Tags },
  { id: "clients", label: "Gestión de Clientes", icon: Building2 },
  { id: "reports", label: "Reportes", icon: BarChart3 },
  { id: "it-admin", label: "IT / Sistemas", icon: ShieldCheck },
  { id: "rrhh", label: "Recursos Humanos", icon: UsersRound },
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


// ── Datos mock del panel de IT ──────────────────────────────

export const itUsersRows = [
  ["Martín Acosta", "martin.acosta@brotherplast.com", "Jefe de Producción", "Activo"],
  ["Laura Giménez", "laura.gimenez@brotherplast.com", "Jefe de Producción", "Activo"],
  ["Carlos Núñez", "carlos.nunez@brotherplast.com", "Chofer", "Activo"],
  ["Sofía Ramos", "sofia.ramos@brotherplast.com", "Administración y Ventas", "Inactivo"],
];

export const itRolesRows = [
  ["Jefe de Producción", "Turnos, lotes y calidad", "2 usuarios"],
  ["Depósito y Expedición", "Stock, cargas y rutas", "3 usuarios"],
  ["Operario de Extrusión", "Registro de turno", "8 usuarios"],
  ["Clarkista", "Ubicaciones y carga", "4 usuarios"],
  ["Chofer", "Hoja de ruta y entregas", "5 usuarios"],
  ["Administración y Ventas", "Pedidos y reportes", "3 usuarios"],
  ["IT / Sistemas", "Usuarios, config y auditoría", "1 usuario"],
];

export const auditLogRows = [
  ["18 ago · 14:02", "L. Giménez", "Actualizó stock Sector B", "Depósito"],
  ["18 ago · 11:40", "Sistema", "Alerta de vencimiento generada (PLA-014)", "Depósito"],
  ["18 ago · 09:15", "C. Núñez", "Cerró hoja de ruta EXP-00839", "Expedición"],
  ["17 ago · 22:03", "P. Suárez", "Cerró turno noche", "Producción"],
];

export const integrationsRows = [
  ["ERP Contable", "Sincronización de facturación", "Conectado"],
  ["Google Maps", "Cálculo de rutas de entrega", "Conectado"],
  ["Servicio de alertas SMS", "Notificaciones a choferes", "Pendiente"],
];
export const clients = [
  {
    id: "CLI-001",
    name: "Plásticos del Sur",
  },
  {
    id: "CLI-002",
    name: "Mayorista Centro",
  },
  {
    id: "CLI-003",
    name: "Distribuidora Norte",
  },
];

const normalize = (s = "") =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const ROLE_MODULES = {
  admin: ["overview", "pedidos-gestion", "pedidos-seguimiento", "clients", "it-admin", "rrhh"],
  it: ["overview", "it-admin"],
  rrhh: ["overview", "rrhh"],
};

// Roles de base de datos con acceso al modulo IT / Sistemas (usuarios.roles.id_rol)
//   1 = administrador (acceso total), 7 = sistemas (administracion y mantenimiento)
export const IT_ADMIN_ROLE_IDS = [1, 7];

// Roles de base de datos con acceso a Recursos Humanos (usuarios.roles.id_rol)
//   1 = administrador, 11 y 15 = roles habilitados para RRHH
export const RRHH_ROLE_IDS = [1, 11, 15];

// Roles de base de datos con acceso exclusivo a Gestión y Seguimiento de Pedidos
//   1 = administrador, 9 = vendedor/generador de pedidos, 16 = supervisor/administración comercial
export const PEDIDOS_ROLE_IDS = [1, 9, 16];

export const canAccessITAdmin = (idRol, rolModulos) => {
  if (Number(idRol) === 1) return true;
  if (Array.isArray(rolModulos) && rolModulos.length > 0) {
    return rolModulos.includes("it-admin");
  }
  return IT_ADMIN_ROLE_IDS.includes(Number(idRol));
};

export const canAccessRRHH = (idRol, rolModulos) => {
  if (Number(idRol) === 1) return true;
  if (Array.isArray(rolModulos) && rolModulos.length > 0) {
    return rolModulos.includes("rrhh");
  }
  return RRHH_ROLE_IDS.includes(Number(idRol));
};

export const canAccessPedidos = (idRol) => {
  return PEDIDOS_ROLE_IDS.includes(Number(idRol));
};

export const canAccessClientes = (idRol, rolModulos) => {
  if (Number(idRol) === 1) return true;
  if (Array.isArray(rolModulos) && rolModulos.length > 0) {
    return rolModulos.includes("clients");
  }
  return true;
};


// Productos ("productos") y Lista de precios ("lista-precios"):
// acceso para el administrador (rol 1) o roles con el módulo asignado en Permisos.
export const canAccessCatalogo = (idRol, rolModulos, moduloId) => {
  if (Number(idRol) === 1) return true;
  return Array.isArray(rolModulos) && rolModulos.includes(moduloId);
};

export function getModulesForRole(roleId, idRol, rolModulos) {
  const numericRoleId = Number(idRol);

  // Administrador: acceso a todos los módulos del Sidebar.
  if (numericRoleId === 1) {
    return [...modules];
  }

  // Si el rol tiene módulos configurados en base de datos (usuarios.roles.modulos),
  // se respeta esa lista, garantizando que Gestión y Seguimiento de Pedidos
  // sean visibles exclusivamente para los roles 1, 9 y 16.
  if (Array.isArray(rolModulos) && rolModulos.length > 0) {
    const normalizedRolModulos = new Set(rolModulos);
    if (normalizedRolModulos.has("orders") && canAccessPedidos(numericRoleId)) {
      normalizedRolModulos.add("pedidos-gestion");
      normalizedRolModulos.add("pedidos-seguimiento");
    }
    if (canAccessPedidos(numericRoleId)) {
      normalizedRolModulos.add("pedidos-gestion");
      normalizedRolModulos.add("pedidos-seguimiento");
    }

    return modules.filter((m) => {
      if (m.id === "pedidos-gestion" || m.id === "pedidos-seguimiento") {
        return canAccessPedidos(numericRoleId) && normalizedRolModulos.has(m.id);
      }
      return normalizedRolModulos.has(m.id);
    });
  }

  const allowed = ROLE_MODULES[roleId];

  const base = allowed
    ? modules.filter((m) => allowed.includes(m.id))
    : modules.filter(
        (m) =>
          m.id !== "it-admin" &&
          m.id !== "rrhh" &&
          m.id !== "pedidos-gestion" &&
          m.id !== "pedidos-seguimiento" &&
          m.id !== "productos" &&
          m.id !== "lista-precios"
      );

  const withRoleModules = [...base];

  if (
    canAccessITAdmin(numericRoleId) &&
    !withRoleModules.some((m) => m.id === "it-admin")
  ) {
    const itMod = modules.find((m) => m.id === "it-admin");
    if (itMod) withRoleModules.push(itMod);
  }

  if (
    canAccessRRHH(numericRoleId) &&
    !withRoleModules.some((m) => m.id === "rrhh")
  ) {
    const rrhhMod = modules.find((m) => m.id === "rrhh");
    if (rrhhMod) withRoleModules.push(rrhhMod);
  }

  if (canAccessPedidos(numericRoleId)) {
    const gestMod = modules.find((m) => m.id === "pedidos-gestion");
    const segMod = modules.find((m) => m.id === "pedidos-seguimiento");
    if (gestMod && !withRoleModules.some((m) => m.id === "pedidos-gestion")) {
      withRoleModules.push(gestMod);
    }
    if (segMod && !withRoleModules.some((m) => m.id === "pedidos-seguimiento")) {
      withRoleModules.push(segMod);
    }
  }

  // Filtrado estricto por permisos de rol:
  return withRoleModules.filter((m) => {
    if (m.id === "it-admin") return canAccessITAdmin(numericRoleId);
    if (m.id === "rrhh") return canAccessRRHH(numericRoleId);
    if (m.id === "pedidos-gestion" || m.id === "pedidos-seguimiento") {
      return canAccessPedidos(numericRoleId);
    }
    return true;
  });
}


export function resolveRole(rolNombre, idRol) {
  const n = normalize(rolNombre);
  let id = "admin";

  if (Number(idRol) === 7) {
    id = "it";
  } else if (Number(idRol) === 1) {
    id = "admin";
  } else if (Number(idRol) === 11 || Number(idRol) === 15 || /recursos|rrhh|humanos/.test(n)) {
    id = "rrhh";
  } else if (/\bit\b|sistemas/.test(n)) {
    id = "it";
  } else if (/produccion/.test(n)) {
    id = "production";
  } else if (/deposito|expedicion/.test(n)) {
    id = "warehouse";
  } else if (/extrusion|operario/.test(n)) {
    id = "operator";
  } else if (/clark/.test(n)) {
    id = "forklift";
  }

  return roleOptions.find((r) => r.id === id) ?? roleOptions[0];
}
