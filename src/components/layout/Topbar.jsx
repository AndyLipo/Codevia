import { useEffect, useState } from "react";
import {
  Bell,
  Menu,
  Search,
} from "lucide-react";

import { modules } from "@/data/mockData";
import { useAuth } from "@/context/AuthContext";

const pad2 = (n) => String(n).padStart(2, "0");

const formatLiveDateTime = (date) => {
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  return `${day}-${month}-${year} ${hours}:${minutes}hs`;
};

export default function Topbar({
  active,
  role,
  setMobileOpen,
  setQuery,
  fakeAction,
}) {
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const currentModule =
    active === "it-params-roles"
      ? { label: "IT / Sistemas · Parámetros · Roles" }
      : modules.find((m) => m.id === active);

  const initials = user
    ? `${user.nombre?.trim()?.[0] ?? ""}${user.apellido?.trim()?.[0] ?? ""}`.toUpperCase()
    : role?.initials ?? "";

  const fullName = user
    ? `${user.nombre?.trim() ?? ""} ${user.apellido?.trim() ?? ""}`.trim()
    : "";

  const rolLabel = user?.rol_nombre?.trim() || role?.label || "";

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

        {/* Info del usuario en sesión + fecha y hora en vivo */}
        <div className="flex items-center gap-2.5 border-l border-[#e6ecee] pl-3.5">

          {/* 1. Iniciales Nombre + Apellido */}
          <div className="grid h-8.5 w-8.5 shrink-0 place-items-center rounded-full bg-brand font-barlow text-[12px] font-bold text-white">
            {initials}
          </div>

          <div className="hidden leading-tight sm:block">
            {/* 2. Nombre y apellido */}
            <div className="text-[11px] font-bold text-[#214451]">
              {fullName}
            </div>

            {/* 3. Rol */}
            <div className="text-[10px] font-medium capitalize text-[#49636c]">
              {rolLabel}
            </div>

            {/* 4. Fecha y hora en vivo DD-MM-AAAA HH:MMhs */}
            <div className="font-mono text-[9.5px] text-[#82979e]">
              {formatLiveDateTime(now)}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
