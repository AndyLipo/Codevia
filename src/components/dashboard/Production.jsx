import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Search,
  Eye,
  Play,
  RefreshCw,
  Pencil,
  Ban,
} from "lucide-react";
import { toast } from "sonner";

import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import ActionButton from "@/components/common/ActionButton";
import { Button } from "@/components/ui/button";
import CreateOrdenProduccionModal from "./modals/CreateOrdenProduccionModal";
import DetalleOrdenProduccionModal from "./modals/DetalleOrdenProduccionModal";
import AnularOrdenProduccionModal from "./modals/AnularOrdenProduccionModal";
import ProductionCalendar from "./ProductionCalendar";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

const ESTADO_OP_META = {
  P: { label: "Pendiente", tone: "amber" },
  T: { label: "Tomada", tone: "blue" },
  D: { label: "Devuelta", tone: "amber" },
  E: { label: "En ejecución", tone: "blue" },
  I: { label: "Incompleta", tone: "slate" },
  C: { label: "Completa", tone: "green" },
  A: { label: "Anulada", tone: "red" },
};

// Orden de prioridad solicitado para el listado:
// 1° Devueltas (D), 2° Pendientes (P), 3° Tomadas (T), 4° En Ejecución (E), 5° Completas (C), 6° Anuladas (A)
const PRIORIDAD_ESTADO_OP = {
  D: 1,
  P: 2,
  T: 3,
  E: 4,
  I: 5,
  C: 6,
  A: 7,
};

const formatFechaHora = (fh) => {
  if (!fh) return "—";
  const d = new Date(fh);
  if (Number.isNaN(d.getTime())) return String(fh);
  return (
    d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) +
    " " +
    d.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    }) +
    " hs"
  );
};

export default function Production({ fakeAction }) {
  const { token, user } = useAuth();

  const [activeTab, setActiveTab] = useState("ordenes"); // "ordenes" | "calendario"
  const [ordenes, setOrdenes] = useState([]);
  const [resumen, setResumen] = useState({
    pendientes: 0,
    tomadas: 0,
    en_ejecucion: 0,
    incompletas: 0,
    completas: 0,
    anuladas: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("ALL");

  // Modales
  const [modalGenerarOpen, setModalGenerarOpen] = useState(false);
  const [ordenEditar, setOrdenEditar] = useState(null);
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [modalAnularOpen, setModalAnularOpen] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);

  // Cargar órdenes de producción y métricas
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [resOrdenes, resResumen] = await Promise.all([
        supabase
          .schema("usuarios")
          .rpc("listar_ordenes_produccion", { p_token: token ?? null }),
        supabase
          .schema("usuarios")
          .rpc("obtener_resumen_ordenes_produccion", { p_token: token ?? null }),
      ]);

      // 1. Listado de órdenes
      if (!resOrdenes.error && Array.isArray(resOrdenes.data)) {
        setOrdenes(resOrdenes.data);
      } else {
        // Fallback directo a produccion.orden_produccion
        const { data: directData, error: directError } = await supabase
          .schema("produccion")
          .from("orden_produccion")
          .select(`
            id_orden_produccion,
            nro_orden,
            fecha_orden,
            id_solicitante,
            estado_op,
            id_motivo_estado,
            estado,
            usu_alta,
            fec_alta,
            usu_mod,
            fec_mod,
            solicitante:id_solicitante (usuario_login, nombre, apellido),
            detalles:detalle_orden_produccion (
              id_detalle_orden,
              cantidad_solicitada,
              cantidad_producida,
              fecha_limite
            )
          `)
          .neq("estado", "E")
          .order("id_orden_produccion", { ascending: false });

        if (directError) {
          console.error("Error al cargar ordenes de producción:", directError);
          toast.error("No se pudieron cargar las órdenes de producción.");
          setOrdenes([]);
        } else {
          setOrdenes(
            (directData || []).map((op) => {
              const detList = op.detalles || [];
              const totSol = detList.reduce(
                (sum, d) => sum + Number(d.cantidad_solicitada || 0),
                0
              );
              const totProd = detList.reduce(
                (sum, d) => sum + Number(d.cantidad_producida || 0),
                0
              );
              const estClean = String(op.estado_op || "").trim();
              return {
                id_orden_produccion: op.id_orden_produccion,
                nro_orden: op.nro_orden,
                fecha_orden: op.fecha_orden,
                id_solicitante: op.id_solicitante,
                solicitante_login: op.solicitante?.usuario_login || "—",
                solicitante_nombre: op.solicitante
                  ? `${op.solicitante.nombre || ""} ${op.solicitante.apellido || ""}`.trim()
                  : "",
                estado_op: estClean,
                estado_op_nombre:
                  ESTADO_OP_META[estClean]?.label || estClean,
                id_motivo_estado: op.id_motivo_estado,
                estado: op.estado,
                usu_alta: op.usu_alta,
                fec_alta: op.fec_alta,
                usu_mod: op.usu_mod,
                fec_mod: op.fec_mod,
                cantidad_items: detList.length,
                total_solicitado: totSol,
                total_producido: totProd,
              };
            })
          );
        }
      }

      // 2. Resumen contadores
      if (
        !resResumen.error &&
        Array.isArray(resResumen.data) &&
        resResumen.data.length > 0
      ) {
        const r = resResumen.data[0];
        setResumen({
          pendientes: Number(r.pendientes ?? 0),
          tomadas: Number(r.tomadas ?? 0),
          en_ejecucion: Number(r.en_ejecucion ?? 0),
          incompletas: Number(r.incompletas ?? 0),
          completas: Number(r.completas ?? 0),
          anuladas: Number(r.anuladas ?? 0),
          total: Number(r.total ?? 0),
        });
      }
    } catch (err) {
      console.error("Error inesperado en producción:", err);
      toast.error("Ocurrió un error al cargar los datos de producción.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarDatos();
  }, [cargarDatos]);

  // En pendientes se contabilizan siempre las órdenes con estado "P", "T" o "D"
  const contadoresFinales = useMemo(() => {
    if (ordenes.length > 0) {
      const ptd = ordenes.filter((o) =>
        ["P", "T", "D"].includes(String(o.estado_op || "").trim())
      ).length;
      const e = ordenes.filter((o) => String(o.estado_op || "").trim() === "E").length;
      const i = ordenes.filter((o) => String(o.estado_op || "").trim() === "I").length;
      const c = ordenes.filter((o) => String(o.estado_op || "").trim() === "C").length;
      const a = ordenes.filter((o) => String(o.estado_op || "").trim() === "A").length;
      return {
        pendientes: ptd,
        en_ejecucion: e,
        incompletas: i,
        completas: c,
        anuladas: a,
        total: ordenes.length,
      };
    }
    return resumen;
  }, [resumen, ordenes]);

  // Tomar orden: pasa de 'P' a 'T'
  const handleTomarOrden = async (orden) => {
    if (!orden?.id_orden_produccion) return;
    try {
      const resRpc = await supabase.schema("usuarios").rpc("tomar_orden_produccion", {
        p_token: token,
        p_id_orden_produccion: orden.id_orden_produccion,
      });

      if (resRpc.error) {
        // Fallback directo
        const { error: directError } = await supabase
          .schema("produccion")
          .from("orden_produccion")
          .update({
            estado_op: "T",
            usu_mod: user?.usuario_login || "SISTEMA",
            fec_mod: new Date().toISOString(),
          })
          .eq("id_orden_produccion", orden.id_orden_produccion);

        if (directError) throw directError;
      }

      toast.success(`Orden ${orden.nro_orden} tomada correctamente (Estado: T).`);
      fakeAction?.(`Orden ${orden.nro_orden} tomada`);
      await cargarDatos();
    } catch (err) {
      console.error("Error al tomar orden de producción:", err);
      toast.error(err.message || "No se pudo tomar la orden de producción.");
    }
  };

  const handleAbrirNuevaOrden = () => {
    setOrdenEditar(null);
    setModalGenerarOpen(true);
  };

  const handleModificarOrden = (orden) => {
    setOrdenEditar(orden);
    setModalGenerarOpen(true);
  };

  const handleVerDetalle = (orden) => {
    setOrdenSeleccionada(orden);
    setModalDetalleOpen(true);
  };

  const handleAbrirAnular = (orden) => {
    setOrdenSeleccionada(orden);
    setModalAnularOpen(true);
  };

  // Filtrado y ordenamiento solicitado:
  // 1° Devueltas (D), 2° Pendientes (P), 3° Tomadas (T), 4° En Ejecución (E), 5° Completas (C), 6° Anuladas (A)
  const ordenesFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ordenes
      .filter((o) => {
        const est = String(o.estado_op || "").trim();
        if (estadoFilter === "PENDIENTES") {
          if (!["P", "T", "D"].includes(est)) return false;
        } else if (estadoFilter !== "ALL" && est !== estadoFilter) {
          return false;
        }
        if (!q) return true;
        const searchable = [
          o.nro_orden,
          o.solicitante_login,
          o.solicitante_nombre,
          o.usu_alta,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(q);
      })
      .sort((a, b) => {
        const estA = String(a.estado_op || "").trim();
        const estB = String(b.estado_op || "").trim();
        const prioA = PRIORIDAD_ESTADO_OP[estA] ?? 99;
        const prioB = PRIORIDAD_ESTADO_OP[estB] ?? 99;
        if (prioA !== prioB) return prioA - prioB;
        return Number(b.id_orden_produccion || 0) - Number(a.id_orden_produccion || 0);
      });
  }, [ordenes, search, estadoFilter]);

  const rows = ordenesFiltradas.map((o) => {
    const est = String(o.estado_op || "").trim();
    const meta = ESTADO_OP_META[est] || {
      label: o.estado_op_nombre || est,
      tone: "slate",
    };

    return [
      <button
        key={`nro-${o.id_orden_produccion}`}
        type="button"
        onClick={() => handleVerDetalle(o)}
        className="cursor-pointer font-mono font-bold text-[#145c73] hover:underline"
        title="Ver detalle de la orden"
      >
        {o.nro_orden}
      </button>,
      <span key={`fec-${o.id_orden_produccion}`} className="font-mono text-[#4a636c]">
        {formatFechaHora(o.fecha_orden)}
      </span>,
      <div key={`sol-${o.id_orden_produccion}`}>
        <strong className="block text-[#214451]">
          {o.solicitante_nombre || o.solicitante_login}
        </strong>
        {o.solicitante_login && o.solicitante_nombre && (
          <span className="font-mono text-[10px] text-[#71858c]">
            {o.solicitante_login}
          </span>
        )}
      </div>,
      <span key={`items-${o.id_orden_produccion}`} className="font-mono font-semibold text-[#173c4b]">
        {o.cantidad_items} ítem{Number(o.cantidad_items) === 1 ? "" : "s"}
      </span>,
      <span key={`tot-${o.id_orden_produccion}`} className="font-mono font-bold text-[#214451]">
        {Number(o.total_solicitado).toLocaleString("es-AR")}
      </span>,
      <Badge key={`est-${o.id_orden_produccion}`} tone={meta.tone}>
        {meta.label}
      </Badge>,
      <div key={`act-${o.id_orden_produccion}`} className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => handleVerDetalle(o)}
          className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#dce5e8] bg-white px-2 py-1 text-[10px] font-semibold text-[#145c73] hover:bg-[#f0f6f8]"
          title="Ver productos solicitados"
        >
          <Eye size={12} />
          Ver Detalle Orden
        </button>

        {(est === "P" || est === "D") && (
          <button
            type="button"
            onClick={() => handleModificarOrden(o)}
            className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#dce5e8] bg-white px-2 py-1 text-[10px] font-semibold text-[#214451] hover:bg-[#f4f7f8]"
            title="Modificar productos y cantidades de la orden"
          >
            <Pencil size={11} />
            Modificar
          </button>
        )}

        {(est === "P" || est === "D") && (
          <button
            type="button"
            onClick={() => handleTomarOrden(o)}
            className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#b8dfce] bg-[#eaf6f0] px-2 py-1 text-[10px] font-semibold text-[#1f6b4d] hover:bg-[#d8efe3]"
            title="Tomar orden y pasar a estado T"
          >
            <Play size={11} className="fill-current" />
            Tomar Orden
          </button>
        )}

        {["P", "D"].includes(est) && (
          <button
            type="button"
            onClick={() => handleAbrirAnular(o)}
            className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#f2c4be] bg-[#fbe9e7] px-2 py-1 text-[10px] font-semibold text-[#ba584d] hover:bg-[#f7d8d4]"
            title="Anular orden de producción"
          >
            <Ban size={11} />
            Anular
          </button>
        )}
      </div>,
    ];
  });

  const tabClass = (tab) =>
    `relative pb-3 text-[11px] font-semibold transition-colors ${
      activeTab === tab
        ? "text-brand after:absolute after:-bottom-px after:left-0 after:right-0 after:h-0.5 after:bg-brand"
        : "text-[#82949a] hover:text-brand cursor-pointer"
    }`;

  return (
    <>
      {/* Cabecera superior con título a la izquierda y 5 recuadros de estados a la derecha (tamaño igual a Seguimiento de Pedidos) */}
      <div className="mb-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5e6f77]">
            02 · PRODUCCIÓN
          </div>

          <h2 className="m-0 font-barlow text-[24px] leading-tight tracking-[0.01em] text-[#163946]">
            Órdenes de Producción
          </h2>

          <p className="mt-0.5 mb-0 text-[12px] text-[#6b7d85]">
            Generación, Control y Estados
          </p>
        </div>

        {/* 5 recuadros con el tamaño de "Seguimiento de Pedidos" */}
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-5">
          {/* Pendiente (incluye P, T y D) */}
          <div
            onClick={() =>
              setEstadoFilter((prev) => (prev === "PENDIENTES" ? "ALL" : "PENDIENTES"))
            }
            className={`min-w-31.25 cursor-pointer rounded-lg border bg-white px-3 py-2 shadow-xs transition-all hover:border-[#a76e1a] ${
              estadoFilter === "PENDIENTES" ? "ring-2 ring-[#a76e1a]" : "border-[#e1e8ea]"
            }`}
            title="Filtrar por órdenes Pendientes (P, T, D)"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Pendiente
              </span>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#a76e1a]">
                {contadoresFinales.pendientes}
              </span>
            </div>
          </div>

          {/* En ejecución */}
          <div
            onClick={() => setEstadoFilter((prev) => (prev === "E" ? "ALL" : "E"))}
            className={`min-w-31.25 cursor-pointer rounded-lg border bg-white px-3 py-2 shadow-xs transition-all hover:border-[#145c73] ${
              estadoFilter === "E" ? "ring-2 ring-[#145c73]" : "border-[#e1e8ea]"
            }`}
            title="Filtrar por órdenes En ejecución"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                En ejecución
              </span>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#145c73]">
                {contadoresFinales.en_ejecucion}
              </span>
            </div>
          </div>

          {/* Incompleta */}
          <div
            onClick={() => setEstadoFilter((prev) => (prev === "I" ? "ALL" : "I"))}
            className={`min-w-31.25 cursor-pointer rounded-lg border bg-white px-3 py-2 shadow-xs transition-all hover:border-[#6f8087] ${
              estadoFilter === "I" ? "ring-2 ring-[#6f8087]" : "border-[#e1e8ea]"
            }`}
            title="Filtrar por órdenes Incompletas"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Incompleta
              </span>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#6f8087]">
                {contadoresFinales.incompletas}
              </span>
            </div>
          </div>

          {/* Completa */}
          <div
            onClick={() => setEstadoFilter((prev) => (prev === "C" ? "ALL" : "C"))}
            className={`min-w-31.25 cursor-pointer rounded-lg border bg-white px-3 py-2 shadow-xs transition-all hover:border-[#256349] ${
              estadoFilter === "C" ? "ring-2 ring-[#256349]" : "border-[#e1e8ea]"
            }`}
            title="Filtrar por órdenes Completas"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Completa
              </span>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#256349]">
                {contadoresFinales.completas}
              </span>
            </div>
          </div>

          {/* Anulada */}
          <div
            onClick={() => setEstadoFilter((prev) => (prev === "A" ? "ALL" : "A"))}
            className={`min-w-31.25 cursor-pointer rounded-lg border bg-white px-3 py-2 shadow-xs transition-all hover:border-[#ba584d] ${
              estadoFilter === "A" ? "ring-2 ring-[#ba584d]" : "border-[#e1e8ea]"
            }`}
            title="Filtrar por órdenes Anuladas"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Anulada
              </span>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#ba584d]">
                {contadoresFinales.anuladas}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pestañas de navegación */}
      <div className="mb-4 flex items-center justify-between border-b border-[#dce5e7]">
        <div className="flex gap-5">
          <button
            type="button"
            onClick={() => setActiveTab("ordenes")}
            className={tabClass("ordenes")}
          >
            Órdenes de producción ({ordenes.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("calendario")}
            className={tabClass("calendario")}
          >
            Calendario
          </button>
        </div>

        {activeTab === "ordenes" && (
          <div className="pb-2">
            <ActionButton
              onClick={handleAbrirNuevaOrden}
              className="cursor-pointer"
            >
              <Plus size={16} /> Generar Orden
            </ActionButton>
          </div>
        )}
      </div>

      {/* CONTENIDO PRINCIPAL: ÓRDENES DE PRODUCCIÓN */}
      {activeTab === "ordenes" && (
        <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
          {/* Barra de filtros */}
          <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#82979e]"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por número de orden (OP-...), solicitante..."
                className="h-9 w-full rounded-md border border-[#dfe7e9] bg-white pl-9 pr-3 text-[12px] text-[#173d4b] outline-none transition-colors focus:border-[#214451]"
              />
            </div>

            <select
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value)}
              className="h-9 rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[11px] text-ink-soft outline-none focus:border-[#214451] sm:w-52"
            >
              <option value="ALL">Todos los estados</option>
              <option value="PENDIENTES">Pendientes (D / P / T)</option>
              <option value="D">Devuelta (D)</option>
              <option value="P">Pendiente (P)</option>
              <option value="T">Tomada (T)</option>
              <option value="E">En ejecución</option>
              <option value="I">Incompleta</option>
              <option value="C">Completa</option>
              <option value="A">Anulada</option>
            </select>

            <button
              type="button"
              onClick={cargarDatos}
              disabled={loading}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-[#dce5e8] bg-white px-3 text-[11px] font-semibold text-[#214451] hover:bg-[#f4f7f8]"
              title="Actualizar listado"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>

          {/* Tabla de órdenes de producción */}
          <Table
            headers={[
              "N° Orden",
              "Fecha Emisión",
              "Solicitante",
              "Ítems",
              "Total Solicitado",
              "Estado OP",
              "Acciones",
            ]}
            rows={rows}
          />

          {loading ? (
            <p className="py-6 text-center text-[11px] text-[#91a0a4]">
              Cargando órdenes de producción...
            </p>
          ) : (
            rows.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-[13px] font-medium text-[#657d85]">
                  {ordenes.length === 0
                    ? "No hay órdenes de producción registradas."
                    : "No se encontraron órdenes con el filtro seleccionado."}
                </p>
                {ordenes.length === 0 && (
                  <Button
                    type="button"
                    onClick={handleAbrirNuevaOrden}
                    className="mt-2 h-8.5 bg-[#145c73] px-3.5 text-[11px] text-white hover:bg-[#10485b]"
                  >
                    <Plus size={14} className="mr-1.5" /> Generar primera orden
                  </Button>
                )}
              </div>
            )
          )}
        </div>
      )}

      {/* PESTAÑA: CALENDARIO */}
      {activeTab === "calendario" && <ProductionCalendar />}

      {/* MODAL: GENERAR / MODIFICAR ORDEN */}
      <CreateOrdenProduccionModal
        open={modalGenerarOpen}
        onOpenChange={(val) => {
          setModalGenerarOpen(val);
          if (!val) setOrdenEditar(null);
        }}
        onCreated={cargarDatos}
        usuarioActual={user}
        ordenEditar={ordenEditar}
      />

      {/* MODAL: VER DETALLE ORDEN */}
      <DetalleOrdenProduccionModal
        open={modalDetalleOpen}
        onOpenChange={setModalDetalleOpen}
        orden={ordenSeleccionada}
        onTomarOrden={handleTomarOrden}
        onModificarOrden={handleModificarOrden}
        onAnularOrden={handleAbrirAnular}
      />

      {/* MODAL: ANULAR ORDEN */}
      <AnularOrdenProduccionModal
        open={modalAnularOpen}
        onOpenChange={setModalAnularOpen}
        orden={ordenSeleccionada}
        onAnulada={cargarDatos}
      />
    </>
  );
}
