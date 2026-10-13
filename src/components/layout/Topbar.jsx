import {
  Bell,
  ChevronDown,
  Menu,
  Search,
} from "lucide-react";

import { modules, roleOptions } from "@/data/mockData";

export default function Topbar({
  active,
  role,
  setRole,
  setMobileOpen,
  setQuery,
  fakeAction,
}) {
  const currentModule = modules.find((m) => m.id === active);

  return (
    <header className="sticky top-0 z-10 flex h-18 items-center justify-between border-b border-[#dfe7e9] bg-white px-4 lg:px-8.5">

      {/* Menú mobile */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
        className="grid h-8 w-8 place-items-center border-0 bg-transparent text-brand lg:hidden"
      >
        <Menu size={21} />
      </button>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2.5 text-[12px] text-[#9aa8ad]">
        <span className="hidden sm:inline">Brother Plast</span>
        <span className="hidden sm:inline">/</span>

        <strong className="font-semibold text-[#345460]">
          {currentModule?.label ?? "Vista general"}
        </strong>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2.5 lg:gap-3.5">

        {/* Buscador */}
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#f5f7f8] text-[#9aa9af] lg:h-auto lg:w-57.5 lg:justify-start lg:gap-2.25 lg:px-2.75 lg:py-2">
          <Search size={17} />

          <input
            type="text"
            placeholder="Buscar orden, lote o cliente"
            onChange={(e) => setQuery(e.target.value)}
            className="hidden w-full border-0 bg-transparent text-[11px] text-ink outline-none placeholder:text-[#9aa9af] lg:block"
          />
        </div>

        {/* Notificaciones */}
        <button
          type="button"
          onClick={() =>
            fakeAction?.("No hay nuevas notificaciones")
          }
          aria-label="Notificaciones"
          className="relative grid h-8 w-8 place-items-center rounded-md border border-[#dce5e7] bg-white text-[#67808a] transition-colors hover:border-[#9ebbc5] hover:text-brand"
        >
          <Bell size={18} />

          <i className="absolute right-1.5 top-1.25 h-1.25 w-1.25 rounded-full bg-amber" />
        </button>

        {/* Selector de rol */}
        <div className="flex items-center gap-1.75 border-l border-[#e6ecee] pl-3.5">

          {/* Avatar */}
          <div className="grid h-7 w-7 place-items-center rounded-full bg-brand font-barlow text-[11px] font-bold text-white">
            {role?.initials ?? "AL"}
          </div>

          {/* Selector — solo desktop */}
          <div className="relative hidden items-center lg:flex">
            <select
              value={role?.id ?? ""}
              onChange={(e) => {
                const selectedRole = roleOptions.find(
                  (r) => r.id === e.target.value
                );

                if (selectedRole) {
                  setRole(selectedRole);
                }
              }}
              className="max-w-37.5 appearance-none border-0 bg-transparent pr-5 text-[11px] font-semibold text-[#49636c] outline-none cursor-pointer"
            >
              {roleOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>

            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-0 text-[#67808a]"
            />
          </div>
        </div>
      </div>
    </header>
  );
}