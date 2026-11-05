import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Play,
  CheckCircle2,
  AlertCircle,
  Ban,
  Clock,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Badge from "@/components/common/Badge";
import FinalizarProduccionModal from "./FinalizarProduccionModal";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

const ESTADO_PROD_META = {
  E: { label: "En ejecución", tone: "blue" },
  C: { label: "Finalizada", tone: "green" },
  I: { label: "Finalizada incompleta", tone: "amber" },
  A: { label: "Anulada", tone: "red" },
  P: { label: "Pendiente", tone: "slate" },
};

const ESTADO_DETALLE_META = {
  P: { label: "Pendiente", tone: "amber" },
  E: { label: "En proceso", tone: "blue" },
  I: { label: "Incompleto", tone: "slate" },
  C: { label: "Completo", tone: "green" },
  A: { label: "Anulado", tone: "red" },
};

const formatFechaHora = (fh) => {
  if (!fh) return "—";
  const d = new Date(fh);
  if (Number.isNaN(d.getTime())) return String(fh);
  return (
    d.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " hs"
  );
};

const formatFecha = (f) => {
  if (!f) return "—";
  const [y, m, d] = String(f).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export default function DetalleProduccionOrdenModal({
  open,
  onOpenChange,
  orden,
  onActualizado,
}) {
  const { token, user } = useAuth();
  const [detalles, setDetalles] = useState([]);
  const [produccionesPorDetalle, setProduccionesPorDetalle] = useState({});
  const [loading, setLoading] = useState(false);
  const [iniciandoId, setIniciandoId] = useState(null);

  // Estados para el modal de finalizar / finalizar incompleta / anular
  const [modalProcesarOpen, setModalProcesarOpen] = useState(false);
  const [produccionAProcesar, setProduccionAProcesar] = useState(null);
  const [modoProcesar, setModoProcesar] = useState("C");
  const [productoAProcesar, setProductoAProcesar] = useState(null);
  const [faltanteMaximoProcesar, setFaltanteMaximoProcesar] = useState(0);

  // Control de acordeón desplegado por producto
  const [desplegados, setDesplegados] = useState({});

  const idOrden = orden?.id_orden_produccion;

  const toggleDesplegado = (idDetalle) => {
    setDesplegados((prev) => ({
      ...prev,
      [idDetalle]: !prev[idDetalle],
    }));
  };

  // Cargar lista de productos del detalle y sus producciones asociadas
  const cargarDetallesYProducciones = useCallback(async () => {
    if (!open || !idOrden) return;
    setLoading(true);
    try {
      const resRpc = await supabase
        .schema("usuarios")
        .rpc("obtener_detalle_mis_ordenes", {
          p_token: token ?? null,
          p_id_orden_produccion: idOrden,
        });

      let items = [];
      if (!resRpc.error && Array.isArray(resRpc.data)) {
        items = resRpc.data;
      } else {
        // Fallback directo a detalle_orden_produccion
        const { data: directData, error: directErr } = await supabase
          .schema("produccion")
          .from("detalle_orden_produccion")
          .select(`
            id_detalle_orden,
            id_orden_produccion,
            id_producto,
            cantidad_solicitada,
            cantidad_producida,
            fecha_limite,
            estado_detalle,
            producto:id_producto (
              codigo,
              nombre,
              material:id_material (nombre),
              unidad:id_unidad_medida (codigo, nombre)
            )
          `)
          .eq("id_orden_produccion", idOrden)
          .neq("estado", "E")
          .order("id_detalle_orden", { ascending: true });

        if (directErr) throw directErr;

        items = (directData || []).map((d) => {
          const solic = Number(d.cantidad_solicitada || 0);
          const prod = Number(d.cantidad_producida || 0);
          return {
            id_detalle_orden: d.id_detalle_orden,
            id_orden_produccion: d.id_orden_produccion,
            id_producto: d.id_producto,
            producto_codigo: d.producto?.codigo || "—",
            producto_nombre: d.producto?.nombre || "—",
            material_nombre: d.producto?.material?.nombre || "—",
            unidad_codigo: d.producto?.unidad?.codigo || "",
            unidad_nombre: d.producto?.unidad?.nombre || "",
            cantidad_solicitada: solic,
            cantidad_producida: prod,
            cantidad_faltante: Math.max(0, solic - prod),
            fecha_limite: d.fecha_limite,
            estado_detalle: d.estado_detalle,
            estado_detalle_nombre:
              ESTADO_DETALLE_META[d.estado_detalle]?.label || d.estado_detalle,
          };
        });
      }

      setDetalles(items);

      // Cargar producciones para cada detalle_orden
      const mapProd = {};
      const inicialDesplegados = {};

      await Promise.all(
        items.map(async (item) => {
          try {
            const resProdRpc = await supabase
              .schema("usuarios")
              .rpc("listar_producciones_detalle", {
                p_token: token ?? null,
                p_id_detalle_orden: item.id_detalle_orden,
              });

            if (!resProdRpc.error && Array.isArray(resProdRpc.data)) {
              mapProd[item.id_detalle_orden] = resProdRpc.data;
            } else {
              const { data: directProd } = await supabase
                .schema("produccion")
                .from("produccion")
                .select(`
                  id_produccion,
                  id_detalle_orden,
                  id_responsable,
                  fecha_inicio,
                  fecha_fin,
                  cantidad_producida,
                  estado_produccion,
                  id_motivo_estado,
                  usu_alta,
                  fec_alta,
                  responsable:id_responsable (usuario_login, nombre, apellido),
                  motivo:id_motivo_estado (codigo, nombre, descripcion)
                `)
                .eq("id_detalle_orden", item.id_detalle_orden)
                .neq("estado", "E")
                .order("id_produccion", { ascending: false });

              mapProd[item.id_detalle_orden] = (directProd || []).map((p) => ({
                id_produccion: p.id_produccion,
                id_detalle_orden: p.id_detalle_orden,
                id_responsable: p.id_responsable,
                responsable_login: p.responsable?.usuario_login || "—",
                responsable_nombre: p.responsable
                  ? `${p.responsable.nombre || ""} ${p.responsable.apellido || ""}`.trim()
                  : "",
                fecha_inicio: p.fecha_inicio,
                fecha_fin: p.fecha_fin,
                cantidad_producida: p.cantidad_producida,
                estado_produccion: p.estado_produccion,
                estado_produccion_nom:
                  ESTADO_PROD_META[p.estado_produccion]?.label || p.estado_produccion,
                id_motivo_estado: p.id_motivo_estado,
                motivo_codigo: p.motivo?.codigo || "",
                motivo_nombre: p.motivo?.nombre || "",
                motivo_descripcion: p.motivo?.descripcion || "",
                usu_alta: p.usu_alta,
                fec_alta: p.fec_alta,
              }));
            }

            // Desplegar automáticamente si tiene producciones
            if ((mapProd[item.id_detalle_orden] || []).length > 0) {
              inicialDesplegados[item.id_detalle_orden] = true;
            }
          } catch (e) {
            console.error(
              "Error al cargar producciones para detalle:",
              item.id_detalle_orden,
              e
            );
            mapProd[item.id_detalle_orden] = [];
          }
        })
      );

      setProduccionesPorDetalle(mapProd);
      setDesplegados((prev) => ({ ...inicialDesplegados, ...prev }));
    } catch (err) {
      console.error("Error al cargar detalles de la orden:", err);
      toast.error("No se pudo obtener el detalle de producción");
      setDetalles([]);
    } finally {
      setLoading(false);
    }
  }, [open, idOrden, token]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarDetallesYProducciones();
    }
  }, [open, cargarDetallesYProducciones]);

  // Iniciar Nueva Producción para una línea de producto
  const handleIniciarNuevaProduccion = async (detalle) => {
    if (iniciandoId) return;

    if (Number(detalle.cantidad_faltante) <= 0) {
      toast.error("Este producto ya completó la cantidad requerida.");
      return;
    }

    setIniciandoId(detalle.id_detalle_orden);
    try {
      const resRpc = await supabase.schema("usuarios").rpc("iniciar_produccion", {
        p_token: token,
        p_id_detalle_orden: detalle.id_detalle_orden,
      });

      if (resRpc.error) {
        console.warn("RPC iniciar_produccion falló, intentando directo:", resRpc.error);

        const { error: directErr } = await supabase
          .schema("produccion")
          .from("produccion")
          .insert({
            id_detalle_orden: detalle.id_detalle_orden,
            id_responsable: user?.id_usuario || 1,
            fecha_inicio: new Date().toISOString(),
            fecha_fin: null,
            cantidad_producida: 0,
            estado_produccion: "E",
            estado: "A",
            usu_alta: user?.usuario_login || "SISTEMA",
          });

        if (directErr) throw directErr;
      }

      toast.success(
        `Producción iniciada para ${detalle.producto_nombre || detalle.producto_codigo}.`
      );

      // Desplegar el resumen de este producto
      setDesplegados((prev) => ({ ...prev, [detalle.id_detalle_orden]: true }));

      await cargarDetallesYProducciones();
      onActualizado?.();
    } catch (err) {
      console.error("Error al iniciar producción:", err);
      toast.error(err.message || "No se pudo iniciar la nueva producción.");
    } finally {
      setIniciandoId(null);
    }
  };

  // Abrir modal de finalizar, finalizar incompleta o anular
  const handleAbrirProcesar = (produccion, detalle, modo) => {
    setProduccionAProcesar(produccion);
    setModoProcesar(modo);
    setProductoAProcesar({
      codigo: detalle.producto_codigo,
      nombre: detalle.producto_nombre,
      unidad_codigo: detalle.unidad_codigo,
    });
    setFaltanteMaximoProcesar(Number(detalle.cantidad_faltante || 0));
    setModalProcesarOpen(true);
  };

  // Totales de la orden
  const totalesOrden = useMemo(() => {
    const sol = detalles.reduce((acc, d) => acc + Number(d.cantidad_solicitada || 0), 0);
    const prod = detalles.reduce((acc, d) => acc + Number(d.cantidad_producida || 0), 0);
    const fal = detalles.reduce((acc, d) => acc + Number(d.cantidad_faltante || 0), 0);
    return { sol, prod, fal };
  }, [detalles]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl border border-[#e1e8ea] bg-white p-0 shadow-card">
          <DialogHeader className="border-b border-slate-soft bg-white px-6 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="font-barlow text-[24px] font-bold text-[#173c4b]">
                    Orden {orden?.nro_orden} · Detalle de Fabricación
                  </DialogTitle>
                  <Badge tone="blue">
                    {orden?.estado_op_nombre || orden?.estado_op || "Tomada"}
                  </Badge>
                </div>
                <DialogDescription className="text-[12px] text-muted-ink">
                  Gestión activa de lotes de fabricación, inicio de producción y control de faltantes por producto.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[75vh] space-y-4 overflow-y-auto px-6 py-4">
            {/* Banner resumen de la orden y totales */}
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-[#e1e8ea] bg-[#f8fafb] p-3.5 sm:grid-cols-4">
              <div>
                <span className="block text-[9px] font-bold uppercase tracking-wider text-[#82979e]">
                  Solicitante
                </span>
                <strong className="block text-[12px] text-[#214451]">
                  {orden?.solicitante_nombre || orden?.solicitante_login || "—"}
                </strong>
                <span className="font-mono text-[10px] text-[#71858c]">
                  {orden?.solicitante_login}
                </span>
              </div>

              <div>
                <span className="block text-[9px] font-bold uppercase tracking-wider text-[#82979e]">
                  Total Solicitado
                </span>
                <strong className="font-mono text-[14px] text-[#214451]">
                  {totalesOrden.sol.toLocaleString("es-AR")}
                </strong>
                <span className="block text-[10px] text-[#71858c]">
                  {detalles.length} productos
                </span>
              </div>

              <div>
                <span className="block text-[9px] font-bold uppercase tracking-wider text-[#82979e]">
                  Total Producido
                </span>
                <strong className="font-mono text-[14px] text-[#256349]">
                  {totalesOrden.prod.toLocaleString("es-AR")}
                </strong>
                <span className="block text-[10px] text-[#71858c]">Fabricado</span>
              </div>

              <div>
                <span className="block text-[9px] font-bold uppercase tracking-wider text-[#82979e]">
                  Total Faltante
                </span>
                <strong className="font-mono text-[14px] text-[#a76e1a]">
                  {totalesOrden.fal.toLocaleString("es-AR")}
                </strong>
                <span className="block text-[10px] text-[#71858c]">Pendiente</span>
              </div>
            </div>

            {/* Listado de productos de la orden */}
            <div className="space-y-3.5">
              <h4 className="m-0 text-[11px] font-bold uppercase tracking-wider text-[#145c73]">
                Productos a fabricar ({detalles.length})
              </h4>

              {loading ? (
                <p className="py-8 text-center text-[11px] text-[#91a0a4]">
                  Cargando productos y ejecuciones de producción...
                </p>
              ) : detalles.length === 0 ? (
                <p className="py-8 text-center text-[11px] text-[#91a0a4]">
                  No se encontraron productos en esta orden de producción.
                </p>
              ) : (
                detalles.map((d) => {
                  const prodsDeLinea = produccionesPorDetalle[d.id_detalle_orden] || [];
                  const tieneProducciones = prodsDeLinea.length > 0;
                  const estaDesplegado = desplegados[d.id_detalle_orden] ?? false;
                  const faltante = Number(d.cantidad_faltante || 0);
                  const estaCompleto = faltante <= 0;
                  const estaIncompleto =
                    d.estado_detalle === "I" ||
                    prodsDeLinea.some((pr) => pr.estado_produccion === "I");
                  const noPermiteIniciar = estaCompleto || estaIncompleto;

                  return (
                    <div
                      key={d.id_detalle_orden}
                      className="rounded-lg border border-[#dce5e8] bg-white shadow-xs transition-all"
                    >
                      {/* Cabecera del producto */}
                      <div className="flex flex-col justify-between gap-3 p-3.5 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[12px] font-bold text-[#145c73]">
                              {d.producto_codigo}
                            </span>
                            <span className="text-[#84979e]">·</span>
                            <strong className="text-[13px] text-[#173c4b]">
                              {d.producto_nombre}
                            </strong>
                            <span className="text-[11px] text-[#657d85]">
                              ({d.material_nombre})
                            </span>
                            <Badge
                              tone={
                                ESTADO_DETALLE_META[d.estado_detalle]?.tone || "slate"
                              }
                            >
                              {d.estado_detalle_nombre || d.estado_detalle}
                            </Badge>
                          </div>

                          {/* Métricas de cantidades */}
                          <div className="mt-2 flex flex-wrap items-center gap-4 text-[11.5px]">
                            <div>
                              <span className="text-[#82979e]">Solicitado: </span>
                              <strong className="font-mono text-[#214451]">
                                {Number(d.cantidad_solicitada).toLocaleString("es-AR")} {d.unidad_codigo}
                              </strong>
                            </div>

                            <div>
                              <span className="text-[#82979e]">Producido: </span>
                              <strong className="font-mono text-[#256349]">
                                {Number(d.cantidad_producida).toLocaleString("es-AR")} {d.unidad_codigo}
                              </strong>
                            </div>

                            <div className="rounded bg-[#fff9ed] px-2 py-0.5 border border-[#fae4ba]">
                              <span className="font-semibold text-[#8f5d13]">Faltante: </span>
                              <strong className="font-mono text-[#a76e1a]">
                                {faltante.toLocaleString("es-AR")} {d.unidad_codigo}
                              </strong>
                            </div>

                            <div>
                              <span className="text-[#82979e]">Fecha límite: </span>
                              <span className="font-mono text-[#4a636c]">
                                <Calendar size={11} className="mr-1 inline text-[#82979e]" />
                                {formatFecha(d.fecha_limite)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Botón de Iniciar Nueva Producción */}
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            type="button"
                            onClick={() => handleIniciarNuevaProduccion(d)}
                            disabled={iniciandoId === d.id_detalle_orden || noPermiteIniciar}
                            className={`h-8.5 cursor-pointer px-3 text-[11px] font-semibold text-white ${
                              noPermiteIniciar
                                ? "bg-[#a5b2b7] cursor-not-allowed opacity-60"
                                : "bg-[#145c73] hover:bg-[#10485b]"
                            }`}
                            title={
                              estaIncompleto
                                ? "Producción finalizada incompleta (no se puede retomar)"
                                : estaCompleto
                                  ? "Cantidad solicitada ya completada"
                                  : "Iniciar nueva tanda de producción"
                            }
                          >
                            <Play size={12} className="mr-1.5 fill-current" />
                            {iniciandoId === d.id_detalle_orden
                              ? "Iniciando..."
                              : "Iniciar Nueva Producción"}
                          </Button>

                          {tieneProducciones && (
                            <button
                              type="button"
                              onClick={() => toggleDesplegado(d.id_detalle_orden)}
                              className="inline-flex h-8.5 cursor-pointer items-center gap-1 rounded border border-[#dce5e8] bg-white px-2.5 text-[10.5px] font-semibold text-[#48636e] hover:bg-[#f4f7f8]"
                              title={estaDesplegado ? "Ocultar resumen" : "Ver resumen"}
                            >
                              <Layers size={12} />
                              <span>{prodsDeLinea.length}</span>
                              {estaDesplegado ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Resumen de producción: solo se muestra si ya tiene producciones y está desplegado */}
                      {tieneProducciones && estaDesplegado && (
                        <div className="border-t border-[#edf1f2] bg-[#f9fbfb] p-3.5">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#145c73]">
                              Resumen de producción ({prodsDeLinea.length})
                            </span>
                            <span className="text-[10.5px] text-[#71858c]">
                              {d.producto_nombre}
                            </span>
                          </div>

                          <div className="overflow-x-auto rounded-lg border border-[#e1e8ea] bg-white">
                            <table className="w-full text-left">
                              <thead className="border-b border-[#e1e8ea] bg-[#f8fafb] text-[9px] font-bold uppercase tracking-wider text-[#82979e]">
                                <tr>
                                  <th className="px-3 py-2">ID</th>
                                  <th className="px-3 py-2">Responsable</th>
                                  <th className="px-3 py-2">Inicio</th>
                                  <th className="px-3 py-2">Fin</th>
                                  <th className="px-3 py-2 text-right">Cant. Producida</th>
                                  <th className="px-3 py-2">Estado</th>
                                  <th className="px-3 py-2 text-center">Acciones</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#edf1f2] text-[11px]">
                                {prodsDeLinea.map((pr) => {
                                  const estadoPrMeta =
                                    ESTADO_PROD_META[pr.estado_produccion] || {
                                      label: pr.estado_produccion_nom || pr.estado_produccion,
                                      tone: "slate",
                                    };
                                  const esEjecucion = pr.estado_produccion === "E";

                                  return (
                                    <tr key={pr.id_produccion} className="hover:bg-[#fbfcfc]">
                                      <td className="px-3 py-2 font-mono font-semibold text-[#145c73]">
                                        #{pr.id_produccion}
                                      </td>
                                      <td className="px-3 py-2">
                                        <strong className="block text-[#214451]">
                                          {pr.responsable_nombre || pr.responsable_login}
                                        </strong>
                                        {pr.responsable_login && (
                                          <span className="font-mono text-[9.5px] text-[#71858c]">
                                            {pr.responsable_login}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 font-mono text-[#4a636c]">
                                        {formatFechaHora(pr.fecha_inicio)}
                                      </td>
                                      <td className="px-3 py-2 font-mono text-[#4a636c]">
                                        {pr.fecha_fin ? (
                                          formatFechaHora(pr.fecha_fin)
                                        ) : (
                                          <span className="inline-flex items-center gap-1 font-sans text-[10px] font-medium text-[#145c73]">
                                            <Clock size={11} className="animate-spin text-[#145c73]" />
                                            En curso...
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-right font-mono font-bold text-[#173c4b]">
                                        {pr.cantidad_producida != null
                                          ? `${Number(pr.cantidad_producida).toLocaleString("es-AR")} ${d.unidad_codigo}`
                                          : "—"}
                                      </td>
                                      <td className="px-3 py-2">
                                        <div>
                                          <Badge tone={estadoPrMeta.tone}>
                                            {estadoPrMeta.label}
                                          </Badge>
                                          {pr.motivo_nombre && (
                                            <span className="mt-0.5 block text-[9.5px] text-[#ba584d]" title={pr.motivo_descripcion}>
                                              Motivo: {pr.motivo_nombre}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        {esEjecucion ? (
                                          <div className="flex items-center justify-center gap-1.5">
                                            {/* 1. Finalizar (C) */}
                                            <button
                                              type="button"
                                              onClick={() => handleAbrirProcesar(pr, d, "C")}
                                              className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#b8dfce] bg-[#eaf6f0] px-2 py-1 text-[10px] font-semibold text-[#1f6b4d] hover:bg-[#d8efe3]"
                                              title="Finalizar producción completa"
                                            >
                                              <CheckCircle2 size={11} />
                                              Finalizar
                                            </button>

                                            {/* 2. Finalizar incompleta (I) */}
                                            <button
                                              type="button"
                                              onClick={() => handleAbrirProcesar(pr, d, "I")}
                                              className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#f5dfb8] bg-[#fff6e6] px-2 py-1 text-[10px] font-semibold text-[#965e0f] hover:bg-[#fcedcf]"
                                              title="Finalizar producción incompleta con motivo"
                                            >
                                              <AlertCircle size={11} />
                                              Incompleta
                                            </button>

                                            {/* 3. Anular (A) */}
                                            <button
                                              type="button"
                                              onClick={() => handleAbrirProcesar(pr, d, "A")}
                                              className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#f2c4be] bg-[#fbe9e7] px-2 py-1 text-[10px] font-semibold text-[#ba584d] hover:bg-[#f7d8d4]"
                                              title="Anular producción con motivo"
                                            >
                                              <Ban size={11} />
                                              Anular
                                            </button>
                                          </div>
                                        ) : (
                                          <span className="text-[10px] text-[#91a0a4]">
                                            Cerrada
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-slate-soft bg-white px-6 py-3.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Finalizar / Finalizar Incompleto / Anular Producción */}
      <FinalizarProduccionModal
        open={modalProcesarOpen}
        onOpenChange={setModalProcesarOpen}
        produccion={produccionAProcesar}
        modo={modoProcesar}
        producto={productoAProcesar}
        faltanteMaximo={faltanteMaximoProcesar}
        onProcesado={async () => {
          await cargarDetallesYProducciones();
          onActualizado?.();
        }}
      />
    </>
  );
}
