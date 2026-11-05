import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  RefreshCw,
  Eye,
  RotateCcw,
  Package,
} from "lucide-react";
import { toast } from "sonner";

import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import DetalleProduccionOrdenModal from "./modals/DetalleProduccionOrdenModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

const ESTADO_OP_META = {
  T: { label: "Tomada", tone: "blue" },
  E: { label: "En ejecución", tone: "blue" },
  P: { label: "Pendiente", tone: "amber" },
  D: { label: "Devuelta", tone: "amber" },
  I: { label: "Incompleta", tone: "slate" },
  C: { label: "Completa", tone: "green" },
  A: { label: "Anulada", tone: "red" },
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

export default function MisOrdenes({ fakeAction }) {
  const { token, user } = useAuth();

  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("ALL");

  // Modal detalle de producción
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);

  // Modal confirmación devolución
  const [modalDevolverOpen, setModalDevolverOpen] = useState(false);
  const [ordenADevolver, setOrdenADevolver] = useState(null);
  const [devolviendo, setDevolviendo] = useState(false);

  const userLogin = user?.usuario_login;

  // Cargar órdenes tomadas por el usuario autenticado
  const cargarMisOrdenes = useCallback(async () => {
    setLoading(true);
    try {
      const resRpc = await supabase
        .schema("usuarios")
        .rpc("listar_mis_ordenes_produccion", { p_token: token ?? null });

      if (!resRpc.error && Array.isArray(resRpc.data)) {
        setOrdenes(resRpc.data);
      } else {
        // Fallback directo a produccion.orden_produccion
        const { data: directData, error: directErr } = await supabase
          .schema("produccion")
          .from("orden_produccion")
          .select(`
            id_orden_produccion,
            nro_orden,
            fecha_orden,
            id_solicitante,
            estado_op,
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
          .in("estado_op", ["T", "E"])
          .ilike("usu_mod", userLogin || "")
          .neq("estado", "E")
          .order("id_orden_produccion", { ascending: false });

        if (directErr) {
          console.error("Error al cargar mis órdenes:", directErr);
          toast.error("No se pudieron cargar tus órdenes tomadas.");
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
                usu_mod: op.usu_mod,
                fec_mod: op.fec_mod,
                cantidad_items: detList.length,
                total_solicitado: totSol,
                total_producido: totProd,
                total_faltante: Math.max(0, totSol - totProd),
              };
            })
          );
        }
      }
    } catch (err) {
      console.error("Error inesperado al cargar mis órdenes:", err);
      toast.error("Ocurrió un error al cargar tus órdenes de producción.");
    } finally {
      setLoading(false);
    }
  }, [token, userLogin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarMisOrdenes();
  }, [cargarMisOrdenes]);

  // Manejar devolución de orden
  const handleConfirmarDevolver = async () => {
    if (!ordenADevolver?.id_orden_produccion || devolviendo) return;
    setDevolviendo(true);
    try {
      const resRpc = await supabase.schema("usuarios").rpc("devolver_orden_produccion", {
        p_token: token,
        p_id_orden_produccion: ordenADevolver.id_orden_produccion,
      });

      if (resRpc.error) {
        console.warn("RPC devolver_orden_produccion falló, intentando directo:", resRpc.error);

        const { error: directErr } = await supabase
          .schema("produccion")
          .from("orden_produccion")
          .update({
            estado_op: "D",
            usu_mod: userLogin || "SISTEMA",
            fec_mod: new Date().toISOString(),
          })
          .eq("id_orden_produccion", ordenADevolver.id_orden_produccion);

        if (directErr) throw directErr;
      }

      toast.success(
        `Orden ${ordenADevolver.nro_orden} devuelta correctamente. Dejó de figurar en Mis Órdenes.`
      );
      fakeAction?.(`Orden ${ordenADevolver.nro_orden} devuelta (Estado: D)`);
      setModalDevolverOpen(false);
      setOrdenADevolver(null);
      await cargarMisOrdenes();
    } catch (err) {
      console.error("Error al devolver orden:", err);
      toast.error(err.message || "No se pudo devolver la orden de producción.");
    } finally {
      setDevolviendo(false);
    }
  };

  const handleAbrirDevolver = (orden) => {
    setOrdenADevolver(orden);
    setModalDevolverOpen(true);
  };

  const handleVerDetalle = (orden) => {
    setOrdenSeleccionada(orden);
    setModalDetalleOpen(true);
  };

  // Filtrado
  const ordenesFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ordenes.filter((o) => {
      const est = String(o.estado_op || "").trim();
      if (estadoFilter !== "ALL" && est !== estadoFilter) {
        return false;
      }
      if (!q) return true;
      const searchable = [
        o.nro_orden,
        o.solicitante_login,
        o.solicitante_nombre,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(q);
    });
  }, [ordenes, search, estadoFilter]);

  // Métricas superiores
  const metricas = useMemo(() => {
    const total = ordenes.length;
    const enEjecucion = ordenes.filter((o) => o.estado_op === "E").length;
    const tomadas = ordenes.filter((o) => o.estado_op === "T").length;
    const faltanteTotal = ordenes.reduce(
      (sum, o) => sum + Number(o.total_faltante || 0),
      0
    );
    return { total, enEjecucion, tomadas, faltanteTotal };
  }, [ordenes]);

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
        title="Ver detalle de fabricación"
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
      <span key={`sol-${o.id_orden_produccion}`} className="font-mono font-medium text-[#214451]">
        {Number(o.total_solicitado).toLocaleString("es-AR")}
      </span>,
      <span key={`prod-${o.id_orden_produccion}`} className="font-mono font-medium text-[#256349]">
        {Number(o.total_producido).toLocaleString("es-AR")}
      </span>,
      <span key={`fal-${o.id_orden_produccion}`} className="font-mono font-bold text-[#a76e1a]">
        {Number(o.total_faltante).toLocaleString("es-AR")}
      </span>,
      <Badge key={`est-${o.id_orden_produccion}`} tone={meta.tone}>
        {meta.label}
      </Badge>,
      <div key={`act-${o.id_orden_produccion}`} className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => handleVerDetalle(o)}
          className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#145c73] bg-[#145c73] px-2.5 py-1 text-[10.5px] font-semibold text-white hover:bg-[#10485b]"
          title="Ver detalle de productos, fabricaciones y faltantes"
        >
          <Eye size={12} />
          Ver Detalle Producción
        </button>

        <button
          type="button"
          onClick={() => handleAbrirDevolver(o)}
          className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#edd29f] bg-[#fff9ec] px-2 py-1 text-[10.5px] font-semibold text-[#8f5d13] hover:bg-[#fceccf]"
          title="Devolver orden al depósito / estado general (D)"
        >
          <RotateCcw size={11} />
          Devolver
        </button>
      </div>,
    ];
  });

  return (
    <>
      {/* Cabecera superior idéntica en estructura a Seguimiento de Pedidos y Producción */}
      <div className="mb-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5e6f77]">
            02 · PRODUCCIÓN · TRABAJO ASIGNADO
          </div>

          <h2 className="m-0 font-barlow text-[24px] leading-tight tracking-[0.01em] text-[#163946]">
            Mis Órdenes de Producción
          </h2>

          <p className="mt-0.5 mb-0 text-[12px] text-[#6b7d85]">
            Órdenes Tomadas para el trabajo
          </p>
        </div>

        {/* 4 recuadros de métricas con el estilo y tamaño de Seguimiento de Pedidos */}
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
          {/* Total Mis Órdenes */}
          <div className="min-w-31.25 rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Mis Órdenes
              </span>
              <Badge tone="blue">Tomadas</Badge>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metricas.total}
              </span>
            </div>
          </div>

          {/* En Ejecución */}
          <div className="min-w-31.25 rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                En Ejecución
              </span>
              <Badge tone="blue">Activas</Badge>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#145c73]">
                {metricas.enEjecucion}
              </span>
            </div>
          </div>

          {/* Por Iniciar */}
          <div className="min-w-31.25 rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Por Iniciar
              </span>
              <Badge tone="amber">T</Badge>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#a76e1a]">
                {metricas.tomadas}
              </span>
            </div>
          </div>

          {/* Faltante Total */}
          <div className="min-w-31.25 rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Faltante Total
              </span>
              <Badge tone="amber">Unidades</Badge>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#a76e1a]">
                {metricas.faltanteTotal.toLocaleString("es-AR")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal: listado de órdenes asignadas */}
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
              placeholder="Buscar en mis órdenes por número (OP-...), solicitante..."
              className="h-9 w-full rounded-md border border-[#dfe7e9] bg-white pl-9 pr-3 text-[12px] text-[#173d4b] outline-none transition-colors focus:border-[#214451]"
            />
          </div>

          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="h-9 rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[11px] text-ink-soft outline-none focus:border-[#214451] sm:w-44"
          >
            <option value="ALL">Todas las asignadas</option>
            <option value="T">Tomadas (T)</option>
            <option value="E">En ejecución (E)</option>
          </select>

          <button
            type="button"
            onClick={cargarMisOrdenes}
            disabled={loading}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-[#dce5e8] bg-white px-3 text-[11px] font-semibold text-[#214451] hover:bg-[#f4f7f8]"
            title="Actualizar listado"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>

        {/* Tabla de órdenes */}
        <Table
          headers={[
            "N° Orden",
            "Fecha Emisión",
            "Solicitante",
            "Ítems",
            "Total Solicitado",
            "Total Producido",
            "Faltante",
            "Estado",
            "Acciones",
          ]}
          rows={rows}
        />

        {loading ? (
          <p className="py-8 text-center text-[11px] text-[#91a0a4]">
            Cargando tus órdenes de producción...
          </p>
        ) : (
          rows.length === 0 && (
            <div className="py-12 text-center">
              <Package size={28} className="mx-auto mb-2 text-[#91a0a4]" />
              <p className="text-[13px] font-medium text-[#657d85]">
                {ordenes.length === 0
                  ? "No tenés órdenes de producción tomadas en este momento."
                  : "No se encontraron órdenes con el filtro seleccionado."}
              </p>
              <span className="text-[11px] text-[#91a0a4]">
                Podés tomar órdenes disponibles ingresando al módulo general de Producción.
              </span>
            </div>
          )
        )}
      </div>

      {/* Modal: Ver Detalle Producción con control de faltantes y lotes */}
      <DetalleProduccionOrdenModal
        open={modalDetalleOpen}
        onOpenChange={setModalDetalleOpen}
        orden={ordenSeleccionada}
        onActualizado={cargarMisOrdenes}
      />

      {/* Modal de confirmación para DEVOLVER orden */}
      <Dialog open={modalDevolverOpen} onOpenChange={setModalDevolverOpen}>
        <DialogContent className="max-w-md border border-[#e1e8ea] bg-white p-0 shadow-card">
          <DialogHeader className="border-b border-slate-soft bg-white px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#fff0cf] text-[#a76e1a]">
                <RotateCcw size={18} />
              </div>
              <div>
                <DialogTitle className="font-barlow text-[20px] font-bold text-[#173c4b]">
                  Devolver Orden {ordenADevolver?.nro_orden}
                </DialogTitle>
                <DialogDescription className="text-[12px] text-muted-ink">
                  Confirmación de devolución de orden de producción.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 px-6 py-4 text-[12px] text-[#4a636c]">
            <p className="m-0">
              ¿Estás seguro de que deseás devolver la orden de producción{" "}
              <strong className="text-[#173c4b]">{ordenADevolver?.nro_orden}</strong>?
            </p>
            <div className="rounded-lg border border-[#f5dfb8] bg-[#fff9ed] p-3 text-[11.5px] text-[#8f5d13]">
              <strong className="block font-semibold">Efecto de la acción:</strong>
              La orden pasará a estado <strong>Devuelta (D)</strong> y dejará de figurar en tu módulo «Mis Órdenes», quedando disponible nuevamente en el listado general de Producción para su modificación o reasignación.
            </div>
          </div>

          <DialogFooter className="border-t border-slate-soft bg-white px-6 py-3.5">
            <Button
              type="button"
              variant="outline"
              disabled={devolviendo}
              onClick={() => setModalDevolverOpen(false)}
              className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={devolviendo}
              onClick={handleConfirmarDevolver}
              className="h-9 cursor-pointer bg-[#a76e1a] text-[11px] font-semibold text-white hover:bg-[#8f5d13]"
            >
              {devolviendo ? "Devolviendo orden..." : "Confirmar Devolución"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
