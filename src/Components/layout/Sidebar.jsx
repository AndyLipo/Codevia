import {
  LayoutDashboard,
  Factory,
  Package,
  Truck,
  ClipboardList,
  BarChart3,
  Settings,
  X,
  AlertTriangle,
  LogOut,
} from "lucide-react";

const navItems = [
  {
    id: "overview",
    label: "Vista general",
    icon: LayoutDashboard,
  },
  {
    id: "production",
    label: "Producción",
    icon: Factory,
  },
  {
    id: "warehouse",
    label: "Depósito",
    icon: Package,
    badge: "3",
  },
  {
    id: "dispatch",
    label: "Expedición",
    icon: Truck,
  },
  {
    id: "orders",
    label: "Pedidos",
    icon: ClipboardList,
  },
  {
    id: "reports",
    label: "Reportes",
    icon: BarChart3,
  },
];

export default function Sidebar({
  active,
  navigate,
  mobileOpen,
  setMobileOpen,
  role,
  setLogged,
  fakeAction,
}) {
  return (
    <>
      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-20 flex w-[248px] flex-col border-r border-[#dbe3e6] bg-white px-[15px] pb-4 pt-[25px] transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Brand */}
        <div className="relative flex items-center gap-2.5 px-2.5 pb-[25px]">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft">
            <img
              src="/manus-storage/brother-plast-mark_63a96de1.png"
              alt=""
              className="h-6 w-6 object-contain"
            />
          </div>

          <div>
            <strong className="block font-barlow text-[22px] leading-[18px] tracking-[-0.3px] text-[#153d4c]">
              brother<span className="text-amber">plast</span>
            </strong>

            <small className="mt-[3px] block text-[8px] uppercase tracking-[0.12em] text-[#84939a]">
              gestión industrial
            </small>
          </div>

          {/* Cerrar sidebar en mobile */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute right-0 top-0 grid h-7 w-7 place-items-center rounded-md border-0 bg-transparent text-[#71828a] lg:hidden"
            aria-label="Cerrar menú"
          >
            <X size={17} />
          </button>
        </div>

        {/* Estado de planta */}
        <div className="flex items-center border-y border-[#e4eaec] px-2.5 py-3 text-[11px] uppercase tracking-[0.08em] text-[#52717b]">
          <span className="mr-[9px] h-[7px] w-[7px] rounded-full bg-[#4fb288] shadow-[0_0_0_3px_#e6f5ee]" />

          <span>Planta activa</span>

          <span className="ml-auto text-[9px] text-[#9aabb0]">
            BP-01
          </span>
        </div>

        {/* Navegación */}
        <nav className="flex flex-col gap-1 pt-[17px]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`flex w-full items-center gap-[11px] rounded-[7px] border-0 px-3 py-[11px] text-left text-[11px] transition-all duration-150 ${isActive
                    ? "bg-brand-soft font-semibold text-brand shadow-[inset_3px_0_0_#145c73]"
                    : "bg-transparent text-[#667b83] hover:bg-[#f4f7f8] hover:text-brand"
                  }`}
              >
                <Icon size={16} strokeWidth={1.8} />

                <span className="flex-1">{item.label}</span>

                {item.badge && (
                  <em className="rounded-full bg-[#fff0d7] px-1.5 py-0.5 text-[10px] font-semibold not-italic text-[#b87318]">
                    {item.badge}
                  </em>
                )}
              </button>
            );
          })}
        </nav>

        {/* Parte inferior */}
        <div className="mt-auto">
          {/* Alerta */}
          <button
            type="button"
            onClick={() => fakeAction?.("Hay 3 excepciones que requieren atención")}
            className="flex w-full cursor-pointer items-center gap-[9px] rounded-[7px] border border-[#f6e2bc] bg-[#fff7e9] px-2.5 py-[11px] text-left"
          >
            <AlertTriangle
              size={16}
              className="shrink-0 text-[#b5741c]"
            />

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <strong className="text-[11px] text-[#8a5812]">
                3 excepciones
              </strong>

              <span className="text-[10px] text-[#b89054]">
                Requieren atención
              </span>
            </div>
          </button>

          {/* Configuración */}
          <button
            type="button"
            onClick={() => navigate("settings")}
            className="mt-2 flex w-full items-center gap-[11px] rounded-[7px] border-0 bg-transparent px-3 py-[11px] text-left text-[11px] text-[#667b83] hover:bg-[#f4f7f8] hover:text-brand"
          >
            <Settings size={16} strokeWidth={1.8} />

            <span>Configuración</span>
          </button>

          {/* Usuario */}
          <div className="mt-[15px] flex items-center gap-[9px] border-t border-[#e4eaec] px-2 pt-[15px]">
            <div className="grid h-[31px] w-[31px] shrink-0 place-items-center rounded-full bg-brand font-barlow text-[12px] font-bold text-white">
              AL
            </div>

            <div className="min-w-0 flex-1">
              <strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[#35535d]">
                Andrés Liporace
              </strong>

              <span className="mt-0.5 block overflow-hidden text-ellipsis whitespace-nowrap text-[9px] text-[#8b9ba0]">
                {role?.label || "Administrador"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setLogged?.(false)}
              className="border-0 bg-transparent p-1 text-[#91a0a5] hover:text-brand"
              aria-label="Cerrar sesión"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}