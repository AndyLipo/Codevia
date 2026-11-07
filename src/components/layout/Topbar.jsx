import { useMemo, useState } from "react";
import {
  Bell,
  Menu,
  Search,
  RefreshCw,
  X,
} from "lucide-react";

import { modules } from "@/data/mockData";
import { useNotifications } from "@/context/NotificationsContext";

const formatDate = (date) => {
  if (!date) return "Sin fecha";

  return new Date(date).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export default function Topbar({
  active,
  setMobileOpen,
  setQuery,
  navigate,
}) {
  const {
    notifications,
    loading: loadingNotifications,
    error: notificationsError,
    refreshNotifications: cargarNotificaciones,
    markAsRead,
    readIds,
  } = useNotifications();

  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Comprueba si todavía hay notificaciones sin leer.
  const hayNotificacionesSinLeer = useMemo(
    () =>
      notifications.some(
        (notificacion) =>
          !readIds.includes(notificacion.id_lote_producto)
      ),
    [notifications, readIds]
  );

  // Marca la notificación como leída y navega al depósito.
  const abrirNotificacion = (notificacion) => {
    markAsRead(notificacion.id_lote_producto);
    setNotificationsOpen(false);
    navigate?.("warehouse");
  };

  const currentModule =
    active === "it-params-roles"
      ? { label: "IT / Sistemas · Parámetros · Roles" }
      : active === "it-params-permisos"
        ? { label: "IT / Sistemas · Parámetros · Permisos" }
        : active === "dispatch-params-vehiculos"
          ? { label: "Expedición · Parámetros · Vehículos" }
          : active === "productos-params-unidades"
            ? { label: "Productos · Parámetros · Unidades de Medida" }
            : active === "productos-params-materiales"
              ? { label: "Productos · Parámetros · Materiales" }
              : active === "productos-params-tipos"
                ? { label: "Productos · Parámetros · Tipo de Producto" }
                : modules.find((module) => module.id === active);

  return (
    <header className="sticky top-0 z-30 flex h-18 items-center justify-between border-b border-[#dfe7e9] bg-white px-4 lg:px-8.5">

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
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotificationsOpen((prev) => !prev)}
            aria-label="Notificaciones"
            aria-expanded={notificationsOpen}
            className="relative grid h-8 w-8 cursor-pointer place-items-center rounded-md border border-[#dce5e7] bg-white text-[#67808a] transition-colors hover:border-[#9ebbc5] hover:text-brand"
          >
            <Bell size={18} />

            {/* Punto amarillo: solo si hay alertas sin leer */}
            {hayNotificacionesSinLeer && (
              <i className="absolute right-1.5 top-1.25 h-1.25 w-1.25 rounded-full bg-[#e9b949]" />
            )}
          </button>

          {/* Desplegable */}
          {notificationsOpen && (
            <>
              {/* Cierre al hacer clic fuera */}
              <button
                type="button"
                aria-label="Cerrar notificaciones"
                onClick={() => setNotificationsOpen(false)}
                className="fixed inset-0 z-40 cursor-default bg-transparent"
              />

              <div className="absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-[#dfe7e9] bg-white shadow-[0_12px_35px_rgba(22,50,61,0.14)]">

                {/* Encabezado */}
                <div className="flex items-center justify-between border-b border-slate-soft px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#345460]">
                      Notificaciones
                    </h3>

                    <p className="mt-0.5 text-[11px] text-[#9aa8ad]">
                      Vencimientos de inventario
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cargarNotificaciones}
                      disabled={loadingNotifications}
                      aria-label="Actualizar notificaciones"
                      className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-[#81939a] transition-colors hover:bg-[#f5f7f8] hover:text-brand disabled:opacity-50"
                    >
                      <RefreshCw
                        size={14}
                        className={
                          loadingNotifications ? "animate-spin" : ""
                        }
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                      aria-label="Cerrar"
                      className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-[#81939a] transition-colors hover:bg-[#f5f7f8] hover:text-brand"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Contenido */}
                <div className="max-h-95 overflow-y-auto p-3">

                  {loadingNotifications && notifications.length === 0 && (
                    <div className="py-8 text-center text-xs text-[#81939a]">
                      Cargando notificaciones...
                    </div>
                  )}

                  {notificationsError && (
                    <div className="py-6 text-center text-xs text-[#81939a]">
                      No se pudieron cargar las notificaciones.

                      <button
                        type="button"
                        onClick={cargarNotificaciones}
                        className="mt-2 block w-full cursor-pointer text-center font-semibold text-[#b17a25] hover:underline"
                      >
                        Intentar nuevamente
                      </button>
                    </div>
                  )}

                  {!loadingNotifications &&
                    !notificationsError &&
                    notifications.length === 0 && (
                      <div className="py-8 text-center">
                        <Bell
                          size={22}
                          className="mx-auto mb-2 text-[#c1cdd1]"
                        />

                        <p className="text-xs font-medium text-[#67808a]">
                          No hay alertas de vencimiento
                        </p>

                        <p className="mt-1 text-[11px] text-[#9aa8ad]">
                          El inventario está al día.
                        </p>
                      </div>
                    )}

                  <div className="flex flex-col gap-2">
                    {notifications.map((notificacion) => {
                      const leida = readIds.includes(
                        notificacion.id_lote_producto
                      );

                      const titulo = notificacion.vencido
                        ? "Lote vencido"
                        : notificacion.dias === 0
                          ? "Vence hoy"
                          : `Vence en ${notificacion.dias} ${notificacion.dias === 1 ? "día" : "días"
                          }`;

                      return (
                        <button
                          key={notificacion.id_lote_producto}
                          type="button"
                          onClick={() => abrirNotificacion(notificacion)}
                          className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-colors ${leida
                            ? "border-[#e5e7eb] bg-white hover:bg-[#f8fafb]"
                            : "border-[#f0dfb5] bg-[#fff8e9] hover:bg-[#fff3d8]"
                            }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#345460]">
                                {titulo}
                              </p>

                              <p className="mt-1 truncate text-[12px] font-medium text-ink-soft">
                                {notificacion.producto_nombre || "Producto"}
                              </p>

                              <p className="mt-0.5 text-[11px] text-[#81939a]">
                                Lote:{" "}
                                {notificacion.codigo_lote ||
                                  notificacion.id_lote_producto}
                              </p>

                              <p className="mt-1 text-[11px] text-[#81939a]">
                                Vencimiento:{" "}
                                {formatDate(notificacion.fechaVencimiento)}
                              </p>
                            </div>

                            {!leida && (
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#e9b949]" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pie */}
                <div className="border-t border-slate-soft bg-[#fafcfc] px-4 py-2.5">
                  <p className="text-center text-[10px] text-[#9aa8ad]">
                    Alertas de lotes vencidos y próximos a vencer
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}