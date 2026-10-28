import { useState } from "react";
import {
  X,
  ChevronDown,
  LogOut,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import { getModulesForRole } from "@/data/mockData";
import logo from "/logo-final.jpg";
import { useAuth } from "@/context/AuthContext";

export default function Sidebar({
  active,
  navigate,
  mobileOpen,
  setMobileOpen,
  role,
  setLogged,
  fakeAction,
}) {
  const { user } = useAuth();
  const fullName = user ? `${user.nombre} ${user.apellido}`.trim() : "";
  const initials = user
    ? `${user.nombre?.[0] ?? ""}${user.apellido?.[0] ?? ""}`.toUpperCase()
    : "";
  const navItems = getModulesForRole(
    role?.id,
    user?.id_rol,
    user?.rol_modulos
  );

  const [paramsOpen, setParamsOpen] = useState(true);

  const isItSectionActive =
    active === "it-admin" ||
    active === "it-params-roles" ||
    active === "it-params-permisos";

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
        className={`fixed inset-y-0 left-0 z-20 flex w-62 flex-col border-r border-[#dbe3e6] bg-white px-3.75 pb-4 pt-6.25 transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="relative flex items-center gap-2.5 px-2.5 pb-6.25">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft">
            <img
              src={logo}
              className="h-6 w-6 object-contain"
              alt="logo de la empresa"
            />
          </div>

          <div>
            <strong className="block font-barlow text-[22px] leading-4.5 tracking-[-0.3px] text-[#153d4c]">
              brother<span className="text-amber">plast</span>
            </strong>

            <small className="mt-0.75 block text-[8px] uppercase tracking-[0.12em] text-[#84939a]">
              gestión industrial
            </small>
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
        <nav className="flex flex-col gap-1 pt-4.25">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isItItem = item.id === "it-admin";
            const isActive = isItItem
              ? active === "it-admin"
              : active === item.id;

            return (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => navigate(item.id)}
                  className={`flex w-full items-center gap-2.75 rounded-[7px] border-0 px-3 py-2.75 text-left text-[15px] transition-all duration-150 cursor-pointer ${
                    isActive
                      ? "bg-brand-soft font-semibold text-brand shadow-[inset_3px_0_0_#145c73]"
                      : "bg-transparent text-[#667b83] hover:bg-[#f4f7f8] hover:text-brand"
                  }`}
                >
                  <Icon size={16} strokeWidth={1.8} />
                  <span className="flex-1">{item.label}</span>

                  {item.id === "warehouse" && (
                    <em className="rounded-full bg-[#fff0d7] px-1.5 py-0.5 text-[10px] font-semibold not-italic text-[#b87318]">
                      2
                    </em>
                  )}
                </button>

                {/* Submenú de IT / Sistemas: Parámetros -> Roles / Permisos */}
                {isItItem && (
                  <div className="mt-1 ml-4 border-l border-[#dfe7e9] pl-2.5">
                    <button
                      type="button"
                      onClick={() => setParamsOpen((p) => !p)}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-[6px] border-0 px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors ${
                        isItSectionActive
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
                        className={`transition-transform ${
                          paramsOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {paramsOpen && (
                      <div className="mt-0.5 ml-3 flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => navigate("it-params-roles")}
                          className={`flex w-full cursor-pointer items-center rounded-[6px] border-0 px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                            active === "it-params-roles"
                              ? "bg-brand-soft font-semibold text-brand shadow-[inset_2px_0_0_#145c73]"
                              : "bg-transparent text-[#667b83] hover:bg-[#f4f7f8] hover:text-brand"
                          }`}
                        >
                          Roles
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate("it-params-permisos")}
                          className={`flex w-full cursor-pointer items-center rounded-[6px] border-0 px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                            active === "it-params-permisos"
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
          <button
            type="button"
            onClick={() => navigate("settings")}
            className="mt-2 flex w-full items-center gap-2.75 rounded-[7px] border-0 bg-transparent px-3 py-2.75 text-left text-[11px] text-[#667b83] hover:bg-[#f4f7f8] hover:text-brand"
          >
            <Settings size={16} strokeWidth={1.8} />
            <span>Configuración</span>
          </button>

          <div className="mt-3.75 flex items-center gap-2.25 border-t border-[#e4eaec] px-2 pt-3.75">
            <div className="grid h-7.75 w-7.75 shrink-0 place-items-center rounded-full bg-brand font-barlow text-[12px] font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
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
