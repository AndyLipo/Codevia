import { useState } from "react";
import {
  X,
  ChevronDown,
  LogOut,
  SlidersHorizontal,
} from "lucide-react";

import { getModulesForRole } from "@/data/mockData";
import logo from "/logo-final.jpg";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationsContext";

export default function Sidebar({
  active,
  navigate,
  mobileOpen,
  setMobileOpen,
  role,
  setLogged,
}) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  const fullName = user
    ? `${user.nombre} ${user.apellido}`.trim()
    : "";

  const initials = user
    ? `${user.nombre?.[0] ?? ""}${user.apellido?.[0] ?? ""}`.toUpperCase()
    : "";

  const navItems = getModulesForRole(
    role?.id,
    user?.id_rol,
    user?.rol_modulos
  );

  const [paramsOpen, setParamsOpen] = useState(false);
  const [dispatchParamsOpen, setDispatchParamsOpen] = useState(false);
  const [productosParamsOpen, setProductosParamsOpen] = useState(false);

  const isItSectionActive =
    active === "it-admin" ||
    active === "it-params-roles" ||
    active === "it-params-permisos";

  const isDispatchSectionActive =
    active === "dispatch" || active === "dispatch-params-vehiculos";

  const isProductosSectionActive =
    active === "productos" ||
    active === "productos-params-unidades" ||
    active === "productos-params-materiales" ||
    active === "productos-params-tipos";

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
        className={`fixed inset-y-0 left-0 z-20 flex h-dvh w-62 flex-col overflow-hidden border-r border-[#dbe3e6] bg-white px-3.75 pb-3 pt-4 transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Brand */}
        <div className="relative flex shrink-0 items-center gap-2.5 px-2.5 pb-3">
          <div>
            <img
              src="/logo_brotherplast.svg"
              alt="Brother Plast - Gestión Industrial"
              className="block h-auto w-37.5 object-contain"
            />
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute right-0 top-0 grid h-7 w-7 place-items-center rounded-md border-0 bg-transparent text-muted-ink lg:hidden"
            aria-label="Cerrar menú"
          >
            <X size={17} />
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pt-2 scrollbar-none [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isItItem = item.id === "it-admin";
            const isDispatchItem = item.id === "dispatch";
            const isProductosItem = item.id === "productos";

            const isActive = isItItem
              ? active === "it-admin"
              : isDispatchItem
                ? active === "dispatch"
                : isProductosItem
                  ? active === "productos"
                  : active === item.id;

            return (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => navigate(item.id)}
                  className={`flex w-full cursor-pointer items-center gap-2.75 rounded-[7px] border-0 px-3 py-2.75 text-left text-[15px] transition-all duration-150 ${isActive
                    ? "bg-brand-soft font-semibold text-brand shadow-[inset_3px_0_0_#145c73]"
                    : "bg-transparent text-[#667b83] hover:bg-[#f4f7f8] hover:text-brand"
                    }`}
                >
                  <Icon size={16} strokeWidth={1.8} />

                  <span className="flex-1">{item.label}</span>

                  {/* Alertas pendientes de vencimiento */}
                  {item.id === "warehouse" && unreadCount > 0 && (
                    <em className="rounded-full bg-[#fff0d7] px-1.5 py-0.5 text-[10px] font-semibold not-italic text-[#b87318]">
                      {unreadCount}
                    </em>
                  )}
                </button>

                {/* Submenú de Expedición */}
                {isDispatchItem && (
                  <div className="mt-1 ml-4 border-l border-[#dfe7e9] pl-2.5">
                    <button
                      type="button"
                      onClick={() => setDispatchParamsOpen((p) => !p)}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-md border-0 px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors ${isDispatchSectionActive
                        ? "text-[#214451]"
                        : "text-[#667b83] hover:bg-[#f4f7f8] hover:text-brand"
                        }`}
                    >
                      <span className="flex items-center gap-2">
                        <SlidersHorizontal size={13} />
                        <span>Parámetros</span>
                      </span>

                      <ChevronDown
                        size={13}
                        className={`transition-transform ${dispatchParamsOpen ? "rotate-180" : ""
                          }`}
                      />
                    </button>

                    {dispatchParamsOpen && (
                      <div className="mt-0.5 ml-3 flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => navigate("dispatch-params-vehiculos")}
                          className={`flex w-full cursor-pointer items-center rounded-md border-0 px-2.5 py-1.5 text-left text-[12px] transition-colors ${active === "dispatch-params-vehiculos"
                            ? "bg-brand-soft font-semibold text-brand shadow-[inset_2px_0_0_#145c73]"
                            : "bg-transparent text-[#667b83] hover:bg-[#f4f7f8] hover:text-brand"
                            }`}
                        >
                          Vehículos
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Submenú de Productos */}
                {isProductosItem && (
                  <div className="mt-1 ml-4 border-l border-[#dfe7e9] pl-2.5">
                    <button
                      type="button"
                      onClick={() => setProductosParamsOpen((p) => !p)}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-md border-0 px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors ${isProductosSectionActive
                        ? "text-[#214451]"
                        : "text-[#667b83] hover:bg-[#f4f7f8] hover:text-brand"
                        }`}
                    >
                      <span className="flex items-center gap-2">
                        <SlidersHorizontal size={13} />
                        <span>Parámetros</span>
                      </span>

                      <ChevronDown
                        size={13}
                        className={`transition-transform ${productosParamsOpen ? "rotate-180" : ""
                          }`}
                      />
                    </button>

                    {productosParamsOpen && (
                      <div className="mt-0.5 ml-3 flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => navigate("productos-params-unidades")}
                          className={`flex w-full cursor-pointer items-center rounded-md border-0 px-2.5 py-1.5 text-left text-[12px] transition-colors ${active === "productos-params-unidades"
                            ? "bg-brand-soft font-semibold text-brand shadow-[inset_2px_0_0_#145c73]"
                            : "bg-transparent text-[#667b83] hover:bg-[#f4f7f8] hover:text-brand"
                            }`}
                        >
                          Unidades de Medida
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate("productos-params-materiales")}
                          className={`flex w-full cursor-pointer items-center rounded-md border-0 px-2.5 py-1.5 text-left text-[12px] transition-colors ${active === "productos-params-materiales"
                            ? "bg-brand-soft font-semibold text-brand shadow-[inset_2px_0_0_#145c73]"
                            : "bg-transparent text-[#667b83] hover:bg-[#f4f7f8] hover:text-brand"
                            }`}
                        >
                          Materiales
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate("productos-params-tipos")}
                          className={`flex w-full cursor-pointer items-center rounded-md border-0 px-2.5 py-1.5 text-left text-[12px] transition-colors ${active === "productos-params-tipos"
                            ? "bg-brand-soft font-semibold text-brand shadow-[inset_2px_0_0_#145c73]"
                            : "bg-transparent text-[#667b83] hover:bg-[#f4f7f8] hover:text-brand"
                            }`}
                        >
                          Tipo de Producto
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Submenú de IT / Sistemas */}
                {isItItem && (
                  <div className="mt-1 ml-4 border-l border-[#dfe7e9] pl-2.5">
                    <button
                      type="button"
                      onClick={() => setParamsOpen((p) => !p)}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-md border-0 px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors ${isItSectionActive
                        ? "text-[#214451]"
                        : "text-[#667b83] hover:bg-[#f4f7f8] hover:text-brand"
                        }`}
                    >
                      <span className="flex items-center gap-2">
                        <SlidersHorizontal size={13} />
                        <span>Parámetros</span>
                      </span>

                      <ChevronDown
                        size={13}
                        className={`transition-transform ${paramsOpen ? "rotate-180" : ""
                          }`}
                      />
                    </button>

                    {paramsOpen && (
                      <div className="mt-0.5 ml-3 flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => navigate("it-params-roles")}
                          className={`flex w-full cursor-pointer items-center rounded-md border-0 px-2.5 py-1.5 text-left text-[12px] transition-colors ${active === "it-params-roles"
                            ? "bg-brand-soft font-semibold text-brand shadow-[inset_2px_0_0_#145c73]"
                            : "bg-transparent text-[#667b83] hover:bg-[#f4f7f8] hover:text-brand"
                            }`}
                        >
                          Roles
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate("it-params-permisos")}
                          className={`flex w-full cursor-pointer items-center rounded-md border-0 px-2.5 py-1.5 text-left text-[12px] transition-colors ${active === "it-params-permisos"
                            ? "bg-brand-soft font-semibold text-brand shadow-[inset_2px_0_0_#145c73]"
                            : "bg-transparent text-[#667b83] hover:bg-[#f4f7f8] hover:text-brand"
                            }`}
                        >
                          Permisos
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Parte inferior */}
        <div className="mt-auto">
          {/* Usuario */}
          <div className="mt-2 flex shrink-0 items-center gap-2.25 border-t border-[#e4eaec] px-2 pt-2">
            <div className="grid h-7.75 w-7.75 shrink-0 place-items-center rounded-full bg-brand font-barlow text-[12px] font-bold text-white">
              {initials}
            </div>

            <div className="min-w-0 flex-1 cursor-pointer">
              <strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[#35535d]">
                {fullName}
              </strong>

              <span className="mt-0.5 block overflow-hidden text-ellipsis whitespace-nowrap text-[9px] text-[#8b9ba0]">
                {user?.rol_nombre || role?.label || "Administrador"}
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
