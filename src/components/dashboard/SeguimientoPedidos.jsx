import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  History,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  Layers,
  ShieldAlert,
  Box,
} from "lucide-react";
import { toast } from "sonner";

import Badge from "@/components/common/Badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

function Panel({ eyebrow, title, right, children }) {
  return (
    <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
        <div>
          {eyebrow && (
            <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
              {eyebrow}
            </div>
          )}
          {title && (
            <h3 className="m-0 font-barlow text-[22px] text-[#173d4b]">
              {title}
            </h3>
          )}
        </div>
        {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
      </div>
      {children}
    </div>
  );
}

const ESTADO_PEDIDO_META = {
  P: { label: "Pendiente", tone: "amber", step: 1 },
  C: { label: "Confirmado", tone: "blue", step: 2 },
  M: { label: "Modificado", tone: "amber", step: 2 },
  E: { label: "En preparación", tone: "blue", step: 3 },
  L: { label: "Listo para despacho", tone: "green", step: 4 },
  D: { label: "Despachado", tone: "green", step: 5 },
  A: { label: "Anulado", tone: "red", step: 0 },
};

const ESTADO_PICKING_LINEA_META = {
  SIN_RESERVA: { label: "Sin reserva", tone: "slate" },
  PENDIENTE: { label: "Pendiente", tone: "amber" },
  PARCIAL: { label: "En proceso", tone: "blue" },
  COMPLETO: { label: "Completado", tone: "green" },
};

const ESTADO_PICKING_LOTE_META = {
  P: { label: "Pendiente", tone: "amber" },
  E: { label: "En proceso", tone: "blue" },
  L: { label: "Recogido / Listo", tone: "green" },
  C: { label: "Completado", tone: "green" },
  X: { label: "Con excepción", tone: "red" },
};

const MODALIDAD_META = {
  P: "Transporte propio (Brother Plast)",
  T: "Transporte / Expreso",
  R: "Retira cliente en planta",
};

const PAGE_SIZE = 10;

const formatNroPedido = (idPedido, numeroPedido) => {
  if (numeroPedido) return numeroPedido;
  if (!idPedido) return "—";
  return `#${String(idPedido).padStart(5, "0")}`;
};

const formatCurrency = (val) => {
  const num = Number(val ?? 0);
  return num.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatQty = (val) => {
  const num = Number(val ?? 0);
  return num.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateOnly = (value) => {
  if (!value) return "—";
  const str = String(value).slice(0, 10);
  const parts = str.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return str;
};

export default function SeguimientoPedidos() {
  const { token, user } = useAuth();

  const idRol = Number(user?.id_rol ?? 0);
  const canAccessModule = [1, 9, 16].includes(idRol);

  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [clienteFilter, setClienteFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("ALL");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal Detalle de Seguimiento
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedTracking, setSelectedTracking] = useState(null);
  const [detailTab, setDetailTab] = useState("productos"); // "productos" | "movimientos"

  const fetchPedidos = useCallback(async () => {
    if (!token || !canAccessModule) {
      setPedidos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .schema("usuarios")
        .rpc("listar_pedidos_gestion", { p_token: token });

      if (error) {
        console.error("Error al listar seguimiento de pedidos:", error);
        toast.error(
          error.message || "No se pudo cargar el seguimiento de pedidos"
        );
        setPedidos([]);
        return;
      }

      setPedidos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error inesperado al listar seguimiento:", err);
      toast.error("Error al conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }, [token, canAccessModule]);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  // KPIs
  const metrics = useMemo(() => {
    const total = pedidos.length;
    const pendientesConfirmar = pedidos.filter((p) => {
      const est = String(p.estado ?? p.estado_pedido ?? "").trim();
      return est === "P" || est === "M";
    }).length;
    const enCurso = pedidos.filter((p) => {
      const est = String(p.estado ?? p.estado_pedido ?? "").trim();
      return est === "C" || est === "E" || est === "L";
    }).length;
    const despachados = pedidos.filter((p) => {
      const est = String(p.estado ?? p.estado_pedido ?? "").trim();
      return est === "D";
    }).length;

    return { total, pendientesConfirmar, enCurso, despachados };
  }, [pedidos]);

  // Filtrado
  const filteredPedidos = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const cli = clienteFilter.trim().toLowerCase();

    return pedidos.filter((p) => {
      const est = String(p.estado ?? p.estado_pedido ?? "").trim();

      if (estadoFilter !== "ALL" && est !== estadoFilter) {
        return false;
      }

      if (cli) {
        const clientText = [p.cliente_nombre, p.cliente_cuit]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!clientText.includes(cli)) return false;
      }

      if (fechaDesde && p.fecha_pedido) {
        const fPedido = String(p.fecha_pedido).slice(0, 10);
        if (fPedido < fechaDesde) return false;
      }

      if (fechaHasta && p.fecha_pedido) {
        const fPedido = String(p.fecha_pedido).slice(0, 10);
        if (fPedido > fechaHasta) return false;
      }

      if (!q) return true;

      return [
        formatNroPedido(p.id_pedido, p.numero_pedido),
        p.id_pedido,
        p.cliente_nombre,
        p.usu_alta,
        p.observaciones,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [
    pedidos,
    searchTerm,
    clienteFilter,
    estadoFilter,
    fechaDesde,
    fechaHasta,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, clienteFilter, estadoFilter, fechaDesde, fechaHasta]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPedidos.length / PAGE_SIZE)
  );
  const paginatedPedidos = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPedidos.slice(start, start + PAGE_SIZE);
  }, [filteredPedidos, currentPage]);

  const handleOpenTracking = async (idPedido) => {
    setDetailOpen(true);
    setLoadingDetail(true);
    setDetailTab("productos");
    try {
      const [ { data, error }, _ ] = await Promise.all([
        supabase.schema("usuarios").rpc("obtener_detalle_seguimiento_pedido", {
          p_token: token,
          p_id_pedido: idPedido,
        }),
        fetchPedidos(),
      ]);

      if (error) {
        toast.error(
          error.message || "No se pudo obtener el seguimiento del pedido"
        );
        setDetailOpen(false);
        return;
      }

      setSelectedTracking(data);
    } catch (err) {
      console.error("Error al obtener seguimiento:", err);
      toast.error("Ocurrió un error al consultar el seguimiento");
      setDetailOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setClienteFilter("");
    setEstadoFilter("ALL");
    setFechaDesde("");
    setFechaHasta("");
  };

  // Estado actual e importe del pedido abierto en el modal
  const currentPedido = selectedTracking?.pedido ?? null;
  const currentEstado = currentPedido
    ? String(currentPedido.estado ?? currentPedido.estado_pedido ?? "P").trim()
    : "P";
  const currentTotalImporte = useMemo(() => {
    if (!selectedTracking) return 0;
    if (selectedTracking.pedido?.importe_total != null) {
      return Number(selectedTracking.pedido.importe_total);
    }
    if (selectedTracking.pedido?.total_importe != null) {
      return Number(selectedTracking.pedido.total_importe);
    }
    return (selectedTracking.lineas ?? []).reduce(
      (acc, l) => acc + Number(l.importe_total ?? 0),
      0
    );
  }, [selectedTracking]);

  if (!canAccessModule) {
    return (
      <div className="rounded-lg border border-[#f1d2ce] bg-[#fdecea] p-6 text-center text-[#9e3128]">
        <ShieldAlert className="mx-auto mb-2 h-8 w-8" />
        <h3 className="font-barlow text-lg font-bold">Acceso restringido</h3>
        <p className="text-xs">
          Este módulo está habilitado exclusivamente para los roles 1, 9 y 16.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* CABECERA COMPACTA + 4 CUADROS PEQUEÑOS A LA DERECHA */}
      <div className="mb-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5e6f77]">
            05 · TRAZABILIDAD OPERATIVA Y LOGÍSTICA
          </div>
          <h2 className="m-0 font-barlow text-[24px] leading-tight tracking-[0.01em] text-[#163946]">
            Seguimiento de Pedidos
          </h2>
          <p className="mt-0.5 text-[12px] text-[#6b7d85]">
            Monitoreo en tiempo real de reservas por lote, picking en depósito,
            verificación y despacho.
          </p>
        </div>

        {/* 4 Recuadros pequeños a la derecha */}
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="min-w-[125px] rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Total pedidos
              </span>
              <Badge tone="blue">Trazados</Badge>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metrics.total}
              </span>
            </div>
          </div>

          <div className="min-w-[125px] rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Por confirmar
              </span>
              <Badge tone="amber">P / M</Badge>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metrics.pendientesConfirmar}
              </span>
            </div>
          </div>

          <div className="min-w-[125px] rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                En operatoria
              </span>
              <Badge tone="blue">C / E / L</Badge>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metrics.enCurso}
              </span>
            </div>
          </div>

          <div className="min-w-[125px] rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Despachados
              </span>
              <Badge tone="green">Entregados</Badge>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metrics.despachados}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL PRINCIPAL DE SEGUIMIENTO */}
      <Panel
        eyebrow="CONTROL DE ESTADO · RESERVAS · PICKING · VERIFICACIÓN"
        title="Tablero de seguimiento de pedidos"
        right={
          <Button
            type="button"
            variant="outline"
            onClick={fetchPedidos}
            className="h-9 border-[#d5e1e5] px-3 text-[11px] text-[#214451]"
          >
            <RefreshCcw size={13} className="mr-1.5" />
            Actualizar estado
          </Button>
        }
      >
        {/* Barra de filtros */}
        <div className="mb-3.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_150px_150px_180px_auto]">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#82979e]"
            />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nº de pedido, usuario u observación..."
              className="h-9 w-full rounded-md border border-[#d8e2e5] bg-[#f8fafb] pl-8 pr-3 text-[12px] text-[#173d4b] outline-none transition-colors focus:border-[#145c73] focus:bg-white"
            />
          </div>

          <input
            type="search"
            value={clienteFilter}
            onChange={(e) => setClienteFilter(e.target.value)}
            placeholder="Filtrar por cliente o CUIT..."
            className="h-9 rounded-md border border-[#d8e2e5] bg-white px-3 text-[12px] text-[#173d4b] outline-none focus:border-[#145c73]"
          />

          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            title="Fecha desde"
            className="h-9 rounded-md border border-[#d8e2e5] bg-white px-2.5 text-[11.5px] text-[#173d4b] outline-none focus:border-[#145c73]"
          />

          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            title="Fecha hasta"
            className="h-9 rounded-md border border-[#d8e2e5] bg-white px-2.5 text-[11.5px] text-[#173d4b] outline-none focus:border-[#145c73]"
          />

          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="h-9 rounded-md border border-[#d8e2e5] bg-white px-2.5 text-[12px] text-[#173d4b] outline-none focus:border-[#145c73]"
          >
            <option value="ALL">Estado: Todos</option>
            <option value="P">P · Pendiente</option>
            <option value="C">C · Confirmado</option>
            <option value="M">M · Modificado</option>
            <option value="E">E · En preparación</option>
            <option value="L">L · Listo para despacho</option>
            <option value="D">D · Despachado</option>
            <option value="A">A · Anulado</option>
          </select>

          <Button
            type="button"
            variant="outline"
            onClick={clearFilters}
            className="h-9 border-[#d8e2e5] px-3 text-[11px] text-[#5e6f77]"
          >
            Limpiar
          </Button>
        </div>

        {/* Tabla principal de seguimiento */}
        <div className="overflow-x-auto rounded-lg border border-[#e3eaec]">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#e3eaec] bg-[#f4f8f9] text-[10px] font-bold uppercase tracking-[0.1em] text-[#697e86]">
                <th className="px-3 py-2.5">Nº Pedido / Fecha</th>
                <th className="px-3 py-2.5">Cliente</th>
                <th className="px-3 py-2.5">Estado General</th>
                <th className="px-3 py-2.5">Reserva de Stock</th>
                <th className="px-3 py-2.5">Avance Picking</th>
                <th className="px-3 py-2.5">Verificación</th>
                <th className="px-3 py-2.5 text-right">Seguimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2f4]">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-[12px] text-[#758990]"
                  >
                    Cargando tablero de seguimiento...
                  </td>
                </tr>
              ) : paginatedPedidos.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-[12px] text-[#758990]"
                  >
                    No se encontraron pedidos con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedPedidos.map((row) => {
                  const rowEstado = String(
                    row.estado ?? row.estado_pedido ?? "P"
                  ).trim();
                  const estadoInfo = ESTADO_PEDIDO_META[rowEstado] ?? {
                    label: rowEstado,
                    tone: "slate",
                  };

                  const cantSolicitada = Number(row.cantidad_productos ?? 0);
                  const cantReservada = Number(row.total_reservado ?? 0);
                  const cantRecogida = Number(row.total_recogido ?? 0);
                  const cantLineas = Number(row.cantidad_lineas ?? 0);
                  const lineasVerif = Number(row.lineas_verificadas ?? 0);

                  const pctReserva =
                    cantSolicitada > 0
                      ? Math.min(
                          100,
                          Math.round((cantReservada / cantSolicitada) * 100)
                        )
                      : 0;
                  const pctPicking =
                    cantSolicitada > 0
                      ? Math.min(
                          100,
                          Math.round((cantRecogida / cantSolicitada) * 100)
                        )
                      : 0;

                  return (
                    <tr
                      key={row.id_pedido}
                      className="transition-colors hover:bg-[#f8fbfc]"
                    >
                      <td className="px-3 py-2.5 align-middle">
                        <div className="font-mono text-[12px] font-bold text-[#145c73]">
                          {formatNroPedido(row.id_pedido, row.numero_pedido)}
                        </div>
                        <div className="text-[10.5px] text-[#6d8088]">
                          {formatDateTime(row.fecha_pedido)} ·{" "}
                          <span className="font-medium">{row.usu_alta}</span>
                        </div>
                      </td>

                      <td className="px-3 py-2.5 align-middle">
                        <div className="font-semibold text-[#173d4b]">
                          {row.cliente_nombre}
                        </div>
                        {row.cliente_cuit && (
                          <div className="text-[10.5px] text-[#73878f]">
                            CUIT {row.cliente_cuit}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2.5 align-middle">
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={estadoInfo.tone}>
                            {rowEstado} · {estadoInfo.label}
                          </Badge>
                          {row.finalizada_con_excepcion && (
                            <span className="inline-flex items-center gap-1 rounded bg-[#fdecea] px-1.5 py-0.5 text-[9.5px] font-semibold text-[#9e3128]">
                              <AlertTriangle size={10} /> Con excepción
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2.5 align-middle">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono font-semibold text-[#173d4b]">
                            {formatQty(cantReservada)} /{" "}
                            {formatQty(cantSolicitada)}
                          </span>
                          <span className="text-[10px] text-[#6d8088]">
                            {pctReserva}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-[#e6eef0]">
                          <div
                            className="h-full rounded-full bg-[#145c73] transition-all"
                            style={{ width: `${pctReserva}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-3 py-2.5 align-middle">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono font-semibold text-[#173d4b]">
                            {formatQty(cantRecogida)} /{" "}
                            {formatQty(cantSolicitada)}
                          </span>
                          <span className="text-[10px] text-[#6d8088]">
                            {pctPicking}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-[#e6eef0]">
                          <div
                            className="h-full rounded-full bg-[#2e8b62] transition-all"
                            style={{ width: `${pctPicking}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-3 py-2.5 align-middle">
                        {lineasVerif === cantLineas && cantLineas > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f4ed] px-2 py-0.5 text-[10.5px] font-semibold text-[#256349]">
                            <CheckCircle2 size={12} /> {lineasVerif} /{" "}
                            {cantLineas} verif.
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#eef3f5] px-2 py-0.5 text-[10.5px] font-medium text-[#5f737b]">
                            <Clock size={12} /> {lineasVerif} / {cantLineas}{" "}
                            verif.
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-right align-middle">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleOpenTracking(row.id_pedido)}
                          className="h-7 border-[#cfe0e6] bg-[#f4f9fb] px-2.5 text-[11px] font-semibold text-[#145c73] hover:bg-[#e6f2f6]"
                        >
                          <Eye size={13} className="mr-1" />
                          Ver trazabilidad
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="mt-3 flex flex-col items-center justify-between gap-2 text-[11px] text-[#6d8088] sm:flex-row">
          <div>
            Mostrando <strong>{paginatedPedidos.length}</strong> de{" "}
            <strong>{filteredPedidos.length}</strong> pedido(s)
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-[#d8e2e5] bg-white text-[#214451] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-medium text-[#173d4b]">
              Página {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-[#d8e2e5] bg-white text-[#214451] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </Panel>

      {/* MODAL DETALLE COMPLETO DEL SEGUIMIENTO */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border border-[#e1e8ea] bg-white shadow-card sm:max-w-[1040px]">
          <DialogHeader>
            <DialogTitle className="font-barlow text-[22px] text-[#163946]">
              Seguimiento detallado del pedido{" "}
              {currentPedido
                ? formatNroPedido(
                    currentPedido.id_pedido,
                    currentPedido.numero_pedido
                  )
                : ""}
            </DialogTitle>
            <DialogDescription className="text-[12px] text-[#6b7d85]">
              Estado general, desglose individual por producto, lotes asignados
              (FIFO), picking, verificación y movimientos de stock.
            </DialogDescription>
          </DialogHeader>

          {loadingDetail || !currentPedido ? (
            <div className="py-12 text-center text-[12px] text-[#6d8088]">
              Consultando trazabilidad del pedido...
            </div>
          ) : (
            <div className="space-y-4">
              {/* 1. Línea de progreso de estados */}
              {currentEstado === "A" ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-[#f1d2ce] bg-[#fdecea] p-3 text-[12px] text-[#9e3128]">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <div>
                    <div className="font-bold">Pedido Anulado (Estado A)</div>
                    <div>
                      Anulado por{" "}
                      <strong>{currentPedido.usu_anulacion || "—"}</strong> el{" "}
                      {formatDateTime(currentPedido.fec_anulacion)}.
                      {currentPedido.motivo_anulacion && (
                        <> Motivo: {currentPedido.motivo_anulacion}</>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#dbe6e9] bg-[#f7fafb] p-3 sm:grid-cols-5">
                  {[
                    { code: "P", title: "1. Pendiente", desc: "Registrado" },
                    {
                      code: currentEstado === "M" ? "M" : "C",
                      title:
                        currentEstado === "M"
                          ? "2. Modificado"
                          : "2. Confirmado",
                      desc: "Stock reservado",
                    },
                    {
                      code: "E",
                      title: "3. En preparación",
                      desc: "Picking activo",
                    },
                    {
                      code: "L",
                      title: "4. Listo despacho",
                      desc: "Verificado",
                    },
                    {
                      code: "D",
                      title: "5. Despachado",
                      desc: "Stock consumido",
                    },
                  ].map((st, idx) => {
                    const currentStep =
                      ESTADO_PEDIDO_META[currentEstado]?.step ?? 1;
                    const stepNum = idx + 1;
                    const isCompleted = currentStep > stepNum;
                    const isCurrent = currentStep === stepNum;

                    return (
                      <div
                        key={st.code}
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-2 ${
                          isCurrent
                            ? "border-[#145c73] bg-[#eaf3f6] text-[#145c73]"
                            : isCompleted
                              ? "border-[#cce8da] bg-[#f2faf5] text-[#256349]"
                              : "border-[#e3eaec] bg-white text-[#82979e]"
                        }`}
                      >
                        <div
                          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                            isCurrent
                              ? "bg-[#145c73] text-white"
                              : isCompleted
                                ? "bg-[#2e8b62] text-white"
                                : "bg-[#e6eef0] text-[#6d8088]"
                          }`}
                        >
                          {isCompleted ? "✓" : st.code}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[11px] font-bold">
                            {st.title}
                          </div>
                          <div className="truncate text-[10px] opacity-80">
                            {st.desc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 2. Tarjetas de Cabecera del Pedido y Preparación */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-[#e1e8ea] bg-[#f8fbfc] p-3">
                  <div className="text-[10px] font-bold uppercase text-[#697e86]">
                    Cliente
                  </div>
                  <div className="mt-0.5 text-[13px] font-bold text-[#173d4b]">
                    {currentPedido.cliente_nombre}
                  </div>
                  <div className="text-[11px] text-[#6d8088]">
                    CUIT: {currentPedido.cliente_cuit || "—"}
                  </div>
                </div>

                <div className="rounded-lg border border-[#e1e8ea] bg-[#f8fbfc] p-3">
                  <div className="text-[10px] font-bold uppercase text-[#697e86]">
                    Registro y Entrega
                  </div>
                  <div className="mt-0.5 text-[12px] font-semibold text-[#173d4b]">
                    Generó: {currentPedido.usu_alta}
                  </div>
                  <div className="text-[11px] text-[#6d8088]">
                    {MODALIDAD_META[currentPedido.modalidad_entrega] ||
                      currentPedido.modalidad_entrega}
                  </div>
                </div>

                <div className="rounded-lg border border-[#e1e8ea] bg-[#f8fbfc] p-3">
                  <div className="text-[10px] font-bold uppercase text-[#697e86]">
                    Preparación Depósito
                  </div>
                  {currentPedido.id_preparacion ? (
                    <>
                      <div className="mt-0.5 text-[12px] font-semibold text-[#173d4b]">
                        Prep. #{currentPedido.id_preparacion} · Estado{" "}
                        {currentPedido.estado_preparacion}
                      </div>
                      <div className="text-[11px] text-[#6d8088]">
                        {currentPedido.fec_finalizacion
                          ? `Fin: ${formatDateTime(
                              currentPedido.fec_finalizacion
                            )} (${currentPedido.usu_finalizacion})`
                          : `Iniciada: ${formatDateTime(
                              currentPedido.prep_fec_alta
                            )}`}
                      </div>
                    </>
                  ) : (
                    <div className="mt-1 text-[11px] text-[#758990]">
                      Sin orden de preparación emitida aún.
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-[#e1e8ea] bg-[#f8fbfc] p-3">
                  <div className="text-[10px] font-bold uppercase text-[#697e86]">
                    Despacho / Importe
                  </div>
                  <div className="mt-0.5 font-mono text-[14px] font-bold text-[#145c73]">
                    $ {formatCurrency(currentTotalImporte)}
                  </div>
                  <div className="text-[11px] text-[#6d8088]">
                    {currentPedido.fec_despacho
                      ? `Despachado: ${formatDateTime(
                          currentPedido.fec_despacho
                        )} (${currentPedido.usu_despacho})`
                      : "Pendiente de despacho"}
                  </div>
                </div>
              </div>

              {currentPedido.finalizada_con_excepcion && (
                <div className="flex items-start gap-2 rounded-md border border-[#f5d491] bg-[#fff8e6] px-3.5 py-2.5 text-[11.5px] text-[#8a5a0f]">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <div>
                    <strong>Preparación finalizada con excepción:</strong>{" "}
                    {currentPedido.observacion_excepcion ||
                      "Sin detalle adicional."}
                  </div>
                </div>
              )}

              {/* Selector de vista interna */}
              <div className="flex items-center gap-2 border-b border-[#e3eaec] pb-2">
                <button
                  type="button"
                  onClick={() => setDetailTab("productos")}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
                    detailTab === "productos"
                      ? "bg-[#145c73] text-white"
                      : "bg-[#f2f6f8] text-[#4f646c] hover:bg-[#e5eef1]"
                  }`}
                >
                  <Layers size={13} />
                  Seguimiento por Producto y Lote (
                  {(selectedTracking.lineas ?? []).length})
                </button>

                <button
                  type="button"
                  onClick={() => setDetailTab("movimientos")}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
                    detailTab === "movimientos"
                      ? "bg-[#145c73] text-white"
                      : "bg-[#f2f6f8] text-[#4f646c] hover:bg-[#e5eef1]"
                  }`}
                >
                  <History size={13} />
                  Movimientos de Stock (
                  {(selectedTracking.movimientos ?? []).length})
                </button>
              </div>

              {/* TAB 1: SEGUIMIENTO INDIVIDUAL POR PRODUCTO Y LOTES ASIGNADOS */}
              {detailTab === "productos" && (
                <div className="space-y-3">
                  {(selectedTracking.lineas ?? []).map((linea) => {
                    const estadoPickingKey =
                      linea.estado_picking_linea ||
                      linea.estado_picking ||
                      "PENDIENTE";
                    const pickingMeta = ESTADO_PICKING_LINEA_META[
                      estadoPickingKey
                    ] ??
                      ESTADO_PICKING_LOTE_META[estadoPickingKey] ?? {
                        label: estadoPickingKey,
                        tone: "amber",
                      };

                    const lotes = Array.isArray(linea.lotes)
                      ? linea.lotes
                      : Array.isArray(linea.lotes_asignados)
                        ? linea.lotes_asignados
                        : [];

                    const prodNombre =
                      linea.producto_nombre || linea.nombre_producto || "—";
                    const prodCodigo =
                      linea.producto_codigo || linea.codigo_sku || "—";
                    const unidadCod =
                      linea.unidad_codigo || linea.unidad_medida || "un.";

                    return (
                      <div
                        key={linea.id_detalle_pedido}
                        className="overflow-hidden rounded-lg border border-[#dce6e9] bg-white shadow-2xs"
                      >
                        {/* Encabezado del producto */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8eff1] bg-[#f6fafb] px-3.5 py-2.5">
                          <div className="flex items-center gap-2">
                            <Box size={16} className="text-[#145c73]" />
                            <div>
                              <span className="font-semibold text-[#173d4b]">
                                {prodNombre}
                              </span>
                              <span className="ml-2 rounded bg-[#e5eff3] px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-[#145c73]">
                                {prodCodigo}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[11.5px]">
                            <div>
                              Solicitado:{" "}
                              <strong className="font-mono text-[#173d4b]">
                                {formatQty(linea.cantidad_solicitada)}{" "}
                                {unidadCod}
                              </strong>
                            </div>
                            <div>
                              Reservado:{" "}
                              <strong className="font-mono text-[#145c73]">
                                {formatQty(linea.cantidad_reservada)}
                              </strong>
                            </div>
                            <div>
                              Recogido:{" "}
                              <strong className="font-mono text-[#256349]">
                                {formatQty(linea.cantidad_recogida)}
                              </strong>
                            </div>

                            <Badge tone={pickingMeta.tone}>
                              Picking: {pickingMeta.label}
                            </Badge>

                            {linea.verificado ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-[#e7f4ed] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#256349]"
                                title={`Verificado por ${
                                  linea.usu_verificacion || "—"
                                } el ${formatDateTime(
                                  linea.fec_verificacion
                                )}`}
                              >
                                <CheckCircle2 size={12} /> Verificado: Sí (
                                {linea.usu_verificacion})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f5f6] px-2.5 py-0.5 text-[10.5px] font-medium text-[#697e86]">
                                <Clock size={12} /> Verificado: No
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Subtabla de lotes asignados a este producto */}
                        <div className="p-3">
                          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6d8088]">
                            Detalle por cada lote asignado (FIFO)
                          </div>

                          {lotes.length === 0 ? (
                            <div className="rounded border border-dashed border-[#dce6e9] bg-[#fafcfd] py-3 text-center text-[11.5px] text-[#758990]">
                              Este producto aún no posee lotes asignados en
                              preparación.
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded border border-[#e6eef0]">
                              <table className="w-full border-collapse text-left text-[11.5px]">
                                <thead>
                                  <tr className="border-b border-[#e6eef0] bg-[#f9fbfc] text-[9.5px] font-bold uppercase text-[#6d8088]">
                                    <th className="px-2.5 py-1.5">Nº Lote</th>
                                    <th className="px-2.5 py-1.5">
                                      Posición Depósito
                                    </th>
                                    <th className="px-2.5 py-1.5">
                                      Fabricación / Venc.
                                    </th>
                                    <th className="px-2.5 py-1.5 text-right">
                                      Cant. Reservada
                                    </th>
                                    <th className="px-2.5 py-1.5 text-right">
                                      Cant. Recogida
                                    </th>
                                    <th className="px-2.5 py-1.5">
                                      Estado Picking Lote
                                    </th>
                                    <th className="px-2.5 py-1.5">
                                      Operador / Fecha Picking
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#eef3f5]">
                                  {lotes.map((lt) => {
                                    const ltMeta = ESTADO_PICKING_LOTE_META[
                                      lt.estado_picking
                                    ] ?? {
                                      label: lt.estado_picking,
                                      tone: "slate",
                                    };
                                    return (
                                      <tr key={lt.id_detalle_preparacion}>
                                        <td className="px-2.5 py-1.5 font-mono font-bold text-[#145c73]">
                                          {lt.nro_lote}
                                        </td>
                                        <td className="px-2.5 py-1.5 font-mono text-[#173d4b]">
                                          {lt.posicion_codigo || "—"}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-[#5f737b]">
                                          Fab:{" "}
                                          {formatDateOnly(lt.fecha_fabricacion)}{" "}
                                          · Vto:{" "}
                                          {formatDateOnly(lt.fecha_vencimiento)}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-right font-mono font-semibold text-[#173d4b]">
                                          {formatQty(lt.cantidad_reservada)}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-right font-mono font-semibold text-[#256349]">
                                          {formatQty(lt.cantidad_recogida)}
                                        </td>
                                        <td className="px-2.5 py-1.5">
                                          <Badge tone={ltMeta.tone}>
                                            {lt.estado_picking} · {ltMeta.label}
                                          </Badge>
                                        </td>
                                        <td className="px-2.5 py-1.5 text-[10.5px] text-[#6d8088]">
                                          {lt.usu_picking
                                            ? `${lt.usu_picking} (${formatDateTime(
                                                lt.fec_picking
                                              )})`
                                            : "Sin registrar"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 2: HISTORIAL DE MOVIMIENTOS DE STOCK DEL PEDIDO */}
              {detailTab === "movimientos" && (
                <div className="overflow-x-auto rounded-lg border border-[#e3eaec]">
                  <table className="w-full border-collapse text-left text-[11.5px]">
                    <thead>
                      <tr className="border-b border-[#e3eaec] bg-[#f4f8f9] text-[10px] font-bold uppercase text-[#697e86]">
                        <th className="px-3 py-2">Fecha / Hora</th>
                        <th className="px-3 py-2">Tipo Movimiento</th>
                        <th className="px-3 py-2">Producto</th>
                        <th className="px-3 py-2">Nº Lote</th>
                        <th className="px-3 py-2 text-right">Cantidad</th>
                        <th className="px-3 py-2">Usuario</th>
                        <th className="px-3 py-2">Observación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf2f4]">
                      {(selectedTracking.movimientos ?? []).length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-8 text-center text-[#758990]"
                          >
                            No se registran movimientos de stock para este
                            pedido.
                          </td>
                        </tr>
                      ) : (
                        (selectedTracking.movimientos ?? []).map((mov) => {
                          const toneMap = {
                            RESERVA: "blue",
                            LIBERACION: "amber",
                            PICKING: "blue",
                            DEVOLUCION_PICKING: "amber",
                            DESPACHO: "green",
                            CONSUMO: "green",
                          };
                          const prodNom =
                            mov.producto_nombre || mov.nombre_producto || "—";
                          const prodCod =
                            mov.producto_codigo || mov.codigo_sku || "—";

                          return (
                            <tr
                              key={
                                mov.id_movimiento_stock ?? mov.id_movimiento
                              }
                            >
                              <td className="px-3 py-2 text-[11px] text-[#5f737b]">
                                {formatDateTime(mov.fec_alta)}
                              </td>
                              <td className="px-3 py-2">
                                <Badge
                                  tone={toneMap[mov.tipo_movimiento] || "slate"}
                                >
                                  {mov.tipo_movimiento}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 font-medium text-[#173d4b]">
                                {prodNom}{" "}
                                <span className="font-mono text-[10px] text-[#6d8088]">
                                  ({prodCod})
                                </span>
                              </td>
                              <td className="px-3 py-2 font-mono font-semibold text-[#145c73]">
                                {mov.nro_lote}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-[#173d4b]">
                                {formatQty(mov.cantidad)}
                              </td>
                              <td className="px-3 py-2 text-[#173d4b]">
                                {mov.usu_alta}
                              </td>
                              <td className="px-3 py-2 text-[#6d8088]">
                                {mov.observacion || "—"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
