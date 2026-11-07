import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
import {
  Search,
  RefreshCcw,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Play,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Box,
  SendHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import Badge from "@/components/common/Badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import FinalizarVerificacionModal from "@/components/dashboard/modals/FinalizarVerificacionModal";

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
  P: { label: "Pendiente", tone: "amber" },
  C: { label: "Confirmado", tone: "blue" },
  M: { label: "Modificado", tone: "amber" },
  E: { label: "En preparación", tone: "blue" },
  L: { label: "Listo para despacho", tone: "green" },
  D: { label: "Despachado", tone: "green" },
  A: { label: "Anulado", tone: "red" },
};

const ESTADO_PICKING_LOTE_META = {
  P: { label: "Pendiente", tone: "amber" },
  E: { label: "En proceso", tone: "blue" },
  L: { label: "Recogido", tone: "green" },
  C: { label: "Completado", tone: "green" },
  X: { label: "Con excepción", tone: "red" },
};

const PAGE_SIZE = 10;

const formatNroPedido = (idPedido, numeroPedido) => {
  if (numeroPedido) return numeroPedido;
  if (!idPedido) return "—";
  return `#${String(idPedido).padStart(5, "0")}`;
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

export default function PreparacionPedidos() {
  const { token, user } = useAuth();

  const idRol = Number(user?.id_rol ?? 0);
  // Regla: la columna Marcar como Verificado y el botón Finalizar Verificación
  // solo pueden verlos el id_rol 1 (sysadmin) y 14 (encargado de depósito)
  const canVerify = [1, 14].includes(idRol);

  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros estilo SeguimientoPedidos
  const [searchTerm, setSearchTerm] = useState("");
  const [clienteFilter, setClienteFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("ACTIVE"); // "ACTIVE" (C/E) | "C" | "E" | "L" | "ALL"
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Pedido expandido y su detalle de lotes
  const [expandedPedidoId, setExpandedPedidoId] = useState(null);
  const [detallesMap, setDetallesMap] = useState({});
  const [loadingDetalleId, setLoadingDetalleId] = useState(null);
  const [actionInProgress, setActionInProgress] = useState({});
  const localEstadosRef = useRef({});

  // Modal Finalizar Verificación
  const [modalVerifOpen, setModalVerifOpen] = useState(false);
  const [pedidoParaFinalizar, setPedidoParaFinalizar] = useState(null);

  // Cargar pedidos confirmados / en preparación
  const fetchPedidos = useCallback(async () => {
    if (!token) {
      setPedidos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .schema("usuarios")
        .rpc("listar_pedidos_preparacion", { p_token: token });

      if (!error && Array.isArray(data)) {
        const merged = data.map((p) => {
          const srvEst = String(p.estado_pedido || p.estado || "C").trim();
          const localOverride = localEstadosRef.current[p.id_pedido];
          const finalEst =
            srvEst === "L"
              ? "L"
              : localOverride || srvEst;
          return {
            ...p,
            estado_pedido: finalEst,
            estado: finalEst,
          };
        });
        setPedidos(merged);
        return;
      }

      // Fallback a listar_pedidos_gestion si aún no se corrió la migración 61
      const { data: fallbackData, error: fallbackErr } = await supabase
        .schema("usuarios")
        .rpc("listar_pedidos_gestion", { p_token: token });

      if (fallbackErr) {
        console.error("Error al listar preparación de pedidos:", error || fallbackErr);
        toast.error(
          (error || fallbackErr).message || "No se pudo cargar la preparación de pedidos"
        );
        setPedidos([]);
        return;
      }

      const normalized = (Array.isArray(fallbackData) ? fallbackData : [])
        .filter((p) => ["C", "E", "L"].includes(String(p.estado || p.estado_pedido || "").trim()))
        .map((p) => {
          const rawEst = String(p.estado || p.estado_pedido || "C").trim();
          const localOverride = localEstadosRef.current[p.id_pedido];
          const inferredEst =
            rawEst === "L"
              ? "L"
              : localOverride
                ? localOverride
                : rawEst === "C" &&
                    (String(p.estado_preparacion || "").trim() === "E" ||
                      Boolean(p.picking_iniciado))
                  ? "E"
                  : rawEst;
          return {
            ...p,
            estado_pedido: inferredEst,
            estado: inferredEst,
            total_solicitado: Number(p.cantidad_productos ?? 0),
            total_reservado: Number(p.total_reservado ?? 0),
            total_recogido: Number(p.total_recogido ?? 0),
            cant_lineas: Number(p.cantidad_lineas ?? 0),
            cant_lineas_verificadas: Number(p.lineas_verificadas ?? 0),
          };
        });

      setPedidos(normalized);
    } catch (err) {
      console.error("Error inesperado al listar preparación:", err);
      toast.error("Error al conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPedidos();
  }, [fetchPedidos]);

  // Cargar detalle de lotes de un pedido
  const fetchDetallePedido = useCallback(
    async (idPedido, forceReload = false) => {
      if (!token || !idPedido) return null;
      if (!forceReload && detallesMap[idPedido]) {
        return detallesMap[idPedido];
      }

      setLoadingDetalleId(idPedido);
      try {
        const { data, error } = await supabase
          .schema("usuarios")
          .rpc("obtener_detalle_preparacion_pedido", {
            p_token: token,
            p_id_pedido: idPedido,
          });

        if (!error && data) {
          const detalleData = {
            pedido: data.pedido || {},
            lotes: Array.isArray(data.lotes) ? data.lotes : [],
          };
          setDetallesMap((prev) => ({ ...prev, [idPedido]: detalleData }));
          return detalleData;
        }

        // Fallback usando obtener_detalle_seguimiento_pedido si la migración 61 no se corrió aún
        const { data: trackData, error: trackErr } = await supabase
          .schema("usuarios")
          .rpc("obtener_detalle_seguimiento_pedido", {
            p_token: token,
            p_id_pedido: idPedido,
          });

        if (trackErr || !trackData) {
          toast.error(
            (error || trackErr)?.message || "No se pudo obtener el detalle del pedido"
          );
          return null;
        }

        const flatLotes = [];
        (trackData.lineas || []).forEach((lin) => {
          (lin.lotes || []).forEach((lt) => {
            flatLotes.push({
              id_detalle_preparacion: lt.id_detalle_preparacion,
              id_detalle_pedido: lin.id_detalle_pedido,
              id_producto: lin.id_producto,
              producto_codigo: lin.producto_codigo,
              producto_nombre: lin.producto_nombre,
              unidad_medida: lin.unidad_codigo || "un.",
              id_lote_producto: lt.id_lote_producto,
              nro_lote: lt.nro_lote,
              posicion_codigo: lt.posicion_codigo,
              fecha_fabricacion: lt.fecha_fabricacion,
              fecha_vencimiento: lt.fecha_vencimiento,
              cantidad_solicitada: lt.cantidad_reservada,
              cantidad_recogida: lt.cantidad_recogida,
              estado_picking: String(lt.estado_picking || "P").trim(),
              usu_picking: lt.usu_picking,
              fec_picking: lt.fec_picking,
              verificado: Boolean(lin.verificado),
              usu_verificacion: lin.usu_verificacion,
              fec_verificacion: lin.fec_verificacion,
              disponible_verificar: Boolean(lin.disponible_verificar),
            });
          });
        });

        const todosRecogidos =
          flatLotes.length > 0 && flatLotes.every((l) => l.estado_picking === "L");
        const dispVerif = flatLotes.some((l) => l.disponible_verificar || l.verificado);

        const detalleFallback = {
          pedido: {
            ...(trackData.pedido || {}),
            estado_pedido: String(trackData.pedido?.estado || "C").trim(),
            todos_recogidos: todosRecogidos,
            disponible_verificar: dispVerif,
          },
          lotes: flatLotes,
        };

        setDetallesMap((prev) => ({ ...prev, [idPedido]: detalleFallback }));
        return detalleFallback;
      } catch (err) {
        console.error("Error inesperado al obtener detalle:", err);
        toast.error("Error al consultar el detalle de preparación");
        return null;
      } finally {
        setLoadingDetalleId(null);
      }
    },
    [token, detallesMap]
  );

  // Botón "Iniciar Preparacion" -> pasa pedido a 'E' en administracion.pedido y despliega tabla inmediatamente
  const handleIniciarPreparacion = async (idPedido) => {
    if (!token) return;

    // Actualización optimista inmediata al hacer click: pasa a 'E', despliega detalle y muestra "Cancelar Preparación"
    localEstadosRef.current[idPedido] = "E";
    setExpandedPedidoId(idPedido);
    setPedidos((prev) =>
      prev.map((p) =>
        p.id_pedido === idPedido
          ? { ...p, estado_pedido: "E", estado: "E" }
          : p
      )
    );

    setActionInProgress((prev) => ({ ...prev, [idPedido]: true }));
    try {
      // Disparar carga del detalle en paralelo para que aparezca de inmediato
      fetchDetallePedido(idPedido, true);

      const { error } = await supabase
        .schema("usuarios")
        .rpc("iniciar_preparacion_pedido", {
          p_token: token,
          p_id_pedido: idPedido,
        });

      if (error) {
        const nowIso = new Date().toISOString();
        const usuLogin = user?.usuario_login || "operador";

        // Actualizar deposito.preparacion_pedido a 'E'
        await supabase
          .schema("deposito")
          .from("preparacion_pedido")
          .update({
            estado: "E",
            usu_mod: usuLogin,
            fec_mod: nowIso,
          })
          .eq("id_pedido", idPedido);

        // Actualizar administracion.pedido a 'E'
        await supabase
          .schema("administracion")
          .from("pedido")
          .update({
            estado: "E",
            usu_mod: usuLogin,
            fec_mod: nowIso,
          })
          .eq("id_pedido", idPedido);
      }

      await fetchPedidos();
    } catch (err) {
      console.error("Error al iniciar preparación:", err);
      toast.error("Error al conectar con el servidor");
    } finally {
      setActionInProgress((prev) => ({ ...prev, [idPedido]: false }));
    }
  };

  // Botón "Cancelar Preparacion" -> vuelve el pedido a estado 'C' y reinicia avances de picking/verificación
  const handleCancelarPreparacion = async (idPedido) => {
    if (!token) return;

    localEstadosRef.current[idPedido] = "C";
    setActionInProgress((prev) => ({ ...prev, [`cancel_${idPedido}`]: true }));
    try {
      const { error } = await supabase
        .schema("usuarios")
        .rpc("cancelar_preparacion_pedido", {
          p_token: token,
          p_id_pedido: idPedido,
        });

      if (error) {
        const nowIso = new Date().toISOString();
        const usuLogin = user?.usuario_login || "operador";

        // 1. Revertir verificación si hubiera
        const lotes = detallesMap[idPedido]?.lotes || [];
        const uniqueIds = [...new Set(lotes.map((l) => l.id_detalle_pedido).filter(Boolean))];
        for (const idDet of uniqueIds) {
          await supabase
            .schema("deposito")
            .from("verificacion_detalle_pedido")
            .update({
              disponible_verificar: false,
              verificado: false,
              usu_verificacion: null,
              fec_verificacion: null,
              usu_mod: usuLogin,
              fec_mod: nowIso,
            })
            .eq("id_detalle_pedido", idDet);
        }

        // 2. Revertir picking de lotes y estado de preparacion_pedido
        const { data: prepRow } = await supabase
          .schema("deposito")
          .from("preparacion_pedido")
          .select("id_preparacion")
          .eq("id_pedido", idPedido)
          .maybeSingle();

        if (prepRow?.id_preparacion) {
          await supabase
            .schema("deposito")
            .from("detalle_preparacion_pedido")
            .update({
              estado_picking: "P",
              cantidad_recogida: 0,
              usu_picking: null,
              fec_picking: null,
              usu_mod: usuLogin,
              fec_mod: nowIso,
            })
            .eq("id_preparacion", prepRow.id_preparacion)
            .neq("estado", "C");

          await supabase
            .schema("deposito")
            .from("preparacion_pedido")
            .update({
              estado: "P",
              finalizada_con_excepcion: false,
              observacion_excepcion: null,
              usu_finalizacion: null,
              fec_finalizacion: null,
              usu_mod: usuLogin,
              fec_mod: nowIso,
            })
            .eq("id_preparacion", prepRow.id_preparacion);
        }

        // 3. Volver administracion.pedido a estado 'C'
        await supabase
          .schema("administracion")
          .from("pedido")
          .update({
            estado: "C",
            usu_mod: usuLogin,
            fec_mod: nowIso,
          })
          .eq("id_pedido", idPedido);
      }

      setPedidos((prev) =>
        prev.map((p) =>
          p.id_pedido === idPedido
            ? {
                ...p,
                estado_pedido: "C",
                estado: "C",
                total_recogido: 0,
                cant_lotes_recogidos: 0,
                disponible_verificar: false,
              }
            : p
        )
      );

      if (expandedPedidoId === idPedido) {
        setExpandedPedidoId(null);
      }

      setDetallesMap((prev) => {
        const copy = { ...prev };
        delete copy[idPedido];
        return copy;
      });

      await fetchPedidos();
    } catch (err) {
      console.error("Error al cancelar preparación:", err);
      toast.error("Error al conectar con el servidor");
    } finally {
      setActionInProgress((prev) => ({ ...prev, [`cancel_${idPedido}`]: false }));
    }
  };

  // Alternar despliegue de tabla de detalle
  const handleToggleExpand = async (idPedido) => {
    if (expandedPedidoId === idPedido) {
      setExpandedPedidoId(null);
    } else {
      setExpandedPedidoId(idPedido);
      await fetchDetallePedido(idPedido);
    }
  };

  // Checklist "Marcar como Recogido"
  const handleTogglePickingLote = async (idPedido, lote) => {
    if (!token) return;
    const nuevoRecogido = lote.estado_picking !== "L";
    const idDetallePrep = lote.id_detalle_preparacion;
    const cantSolicitada = Number(lote.cantidad_solicitada ?? 0);

    // Actualización optimista inmediata en detalle y fila superior
    setDetallesMap((prev) => {
      const current = prev[idPedido];
      if (!current) return prev;
      const lotesUpdated = current.lotes.map((l) =>
        l.id_detalle_preparacion === idDetallePrep
          ? {
              ...l,
              estado_picking: nuevoRecogido ? "L" : "P",
              cantidad_recogida: nuevoRecogido ? cantSolicitada : 0,
              usu_picking: nuevoRecogido ? user?.usuario_login : null,
              fec_picking: nuevoRecogido ? new Date().toISOString() : null,
            }
          : l
      );
      const todosRecogidos =
        lotesUpdated.length > 0 && lotesUpdated.every((l) => l.estado_picking === "L");
      return {
        ...prev,
        [idPedido]: {
          ...current,
          pedido: { ...current.pedido, todos_recogidos: todosRecogidos },
          lotes: lotesUpdated,
        },
      };
    });

    try {
      const { error } = await supabase
        .schema("usuarios")
        .rpc("cambiar_picking_lote", {
          p_token: token,
          p_id_detalle_preparacion: idDetallePrep,
          p_recogido: nuevoRecogido,
        });

      if (error) {
        // Fallback directo a deposito.detalle_preparacion_pedido
        const { error: directErr } = await supabase
          .schema("deposito")
          .from("detalle_preparacion_pedido")
          .update({
            estado_picking: nuevoRecogido ? "L" : "P",
            cantidad_recogida: nuevoRecogido ? cantSolicitada : 0,
            usu_picking: nuevoRecogido ? user?.usuario_login : null,
            fec_picking: nuevoRecogido ? new Date().toISOString() : null,
            usu_mod: user?.usuario_login,
            fec_mod: new Date().toISOString(),
          })
          .eq("id_detalle_preparacion", idDetallePrep);

        if (directErr) {
          toast.error(error.message || "No se pudo actualizar el estado de picking");
          fetchDetallePedido(idPedido, true);
          return;
        }
      }

      fetchPedidos();
    } catch (err) {
      console.error("Error al cambiar picking:", err);
      toast.error("Error al conectar con el servidor");
      fetchDetallePedido(idPedido, true);
    }
  };

  // Botón "Solicitar la Verificacion del Picking"
  const handleSolicitarVerificacion = async (idPedido) => {
    if (!token) return;

    setActionInProgress((prev) => ({ ...prev, [`verif_${idPedido}`]: true }));
    try {
      const lotes = detallesMap[idPedido]?.lotes || [];
      const nowIso = new Date().toISOString();
      const usuLogin = user?.usuario_login || "operador";

      // Asegurar que todos los cambios de picking de los lotes del pedido estén persistidos
      for (const lt of lotes) {
        if (lt.id_detalle_preparacion) {
          const isRec = lt.estado_picking === "L";
          await supabase
            .schema("deposito")
            .from("detalle_preparacion_pedido")
            .update({
              estado_picking: isRec ? "L" : "P",
              cantidad_recogida: isRec ? Number(lt.cantidad_solicitada ?? 0) : 0,
              usu_picking: isRec ? lt.usu_picking || usuLogin : null,
              fec_picking: isRec ? lt.fec_picking || nowIso : null,
              usu_mod: usuLogin,
              fec_mod: nowIso,
            })
            .eq("id_detalle_preparacion", lt.id_detalle_preparacion);
        }
      }

      const { error } = await supabase
        .schema("usuarios")
        .rpc("solicitar_verificacion_picking", {
          p_token: token,
          p_id_pedido: idPedido,
        });

      if (error) {
        // Fallback directo insertando o actualizando en deposito.verificacion_detalle_pedido
        const uniqueIds = [...new Set(lotes.map((l) => l.id_detalle_pedido).filter(Boolean))];

        for (const idDet of uniqueIds) {
          await supabase
            .schema("deposito")
            .from("verificacion_detalle_pedido")
            .upsert(
              {
                id_detalle_pedido: idDet,
                verificado: false,
                disponible_verificar: true,
                estado: "A",
                usu_mod: usuLogin,
                fec_mod: nowIso,
              },
              { onConflict: "id_detalle_pedido" }
            );
        }
      }

      setPedidos((prev) =>
        prev.map((p) =>
          p.id_pedido === idPedido ? { ...p, disponible_verificar: true } : p
        )
      );

      setDetallesMap((prev) => {
        const current = prev[idPedido];
        if (!current) return prev;
        return {
          ...prev,
          [idPedido]: {
            ...current,
            pedido: { ...current.pedido, disponible_verificar: true },
            lotes: current.lotes.map((l) => ({ ...l, disponible_verificar: true })),
          },
        };
      });

      await fetchPedidos();
      await fetchDetallePedido(idPedido, true);
    } catch (err) {
      console.error("Error al solicitar verificación:", err);
      toast.error("Error al conectar con el servidor");
    } finally {
      setActionInProgress((prev) => ({ ...prev, [`verif_${idPedido}`]: false }));
    }
  };

  // Botón "Volver a Preparacion" -> desbloquea Marcar como Recogido y vuelve Marcar como Verificado a su estado previo
  const handleVolverAPreparacion = async (idPedido) => {
    if (!token) return;

    setActionInProgress((prev) => ({ ...prev, [`volver_${idPedido}`]: true }));
    try {
      const { error } = await supabase
        .schema("usuarios")
        .rpc("volver_a_preparacion_pedido", {
          p_token: token,
          p_id_pedido: idPedido,
        });

      if (error) {
        // Fallback directo sobre deposito.verificacion_detalle_pedido
        const lotes = detallesMap[idPedido]?.lotes || [];
        const uniqueIds = [...new Set(lotes.map((l) => l.id_detalle_pedido).filter(Boolean))];
        const nowIso = new Date().toISOString();
        const usuLogin = user?.usuario_login || "operador";

        for (const idDet of uniqueIds) {
          await supabase
            .schema("deposito")
            .from("verificacion_detalle_pedido")
            .update({
              disponible_verificar: false,
              verificado: false,
              usu_verificacion: null,
              fec_verificacion: null,
              usu_mod: usuLogin,
              fec_mod: nowIso,
            })
            .eq("id_detalle_pedido", idDet);
        }
      }

      setPedidos((prev) =>
        prev.map((p) =>
          p.id_pedido === idPedido ? { ...p, disponible_verificar: false } : p
        )
      );

      setDetallesMap((prev) => {
        const current = prev[idPedido];
        if (!current) return prev;
        return {
          ...prev,
          [idPedido]: {
            ...current,
            pedido: { ...current.pedido, disponible_verificar: false },
            lotes: current.lotes.map((l) => ({
              ...l,
              disponible_verificar: false,
              verificado: false,
              usu_verificacion: null,
              fec_verificacion: null,
            })),
          },
        };
      });

      await fetchPedidos();
      await fetchDetallePedido(idPedido, true);
    } catch (err) {
      console.error("Error al volver a preparación:", err);
      toast.error("Error al conectar con el servidor");
    } finally {
      setActionInProgress((prev) => ({ ...prev, [`volver_${idPedido}`]: false }));
    }
  };

  // Checklist "Marcar como Verificado" (Exclusivo roles 1 y 14)
  const handleToggleVerificadoLinea = async (idPedido, lote) => {
    if (!token || !canVerify) return;
    const nuevoVerificado = !lote.verificado;
    const idDetallePedido = lote.id_detalle_pedido;

    if (!idDetallePedido) {
      toast.error("No se encontró el identificador del detalle del pedido");
      return;
    }

    const nowIso = new Date().toISOString();
    const usuLogin = user?.usuario_login || "verificador";

    // Actualización optimista local
    setDetallesMap((prev) => {
      const current = prev[idPedido];
      if (!current) return prev;
      const lotesUpdated = current.lotes.map((l) =>
        l.id_detalle_pedido === idDetallePedido
          ? {
              ...l,
              verificado: nuevoVerificado,
              usu_verificacion: nuevoVerificado ? usuLogin : null,
              fec_verificacion: nuevoVerificado ? nowIso : null,
            }
          : l
      );
      return {
        ...prev,
        [idPedido]: {
          ...current,
          lotes: lotesUpdated,
        },
      };
    });

    try {
      const { error } = await supabase
        .schema("usuarios")
        .rpc("cambiar_verificacion_linea", {
          p_token: token,
          p_id_detalle_pedido: idDetallePedido,
          p_verificado: nuevoVerificado,
        });

      if (error) {
        // Fallback directo sobre deposito.verificacion_detalle_pedido
        const { error: directErr } = await supabase
          .schema("deposito")
          .from("verificacion_detalle_pedido")
          .upsert(
            {
              id_detalle_pedido: idDetallePedido,
              verificado: nuevoVerificado,
              usu_verificacion: nuevoVerificado ? usuLogin : null,
              fec_verificacion: nuevoVerificado ? nowIso : null,
              usu_mod: usuLogin,
              fec_mod: nowIso,
              estado: "A",
              disponible_verificar: true,
            },
            { onConflict: "id_detalle_pedido" }
          );

        if (directErr) {
          toast.error(error.message || "No se pudo actualizar la verificación");
          fetchDetallePedido(idPedido, true);
          return;
        }
      }

      fetchPedidos();
    } catch (err) {
      console.error("Error al cambiar verificación:", err);
      toast.error("Error al conectar con el servidor");
      fetchDetallePedido(idPedido, true);
    }
  };

  // Botón "Finalizar Verificación" (Roles 1 y 14)
  const handleAbrirModalFinalizar = (idPedido) => {
    const detalle = detallesMap[idPedido];
    const lotes = detalle?.lotes || [];
    const pedido =
      detalle?.pedido ||
      pedidos.find((p) => p.id_pedido === idPedido) || { id_pedido: idPedido };

    const lineasUnicas = [];
    const seen = new Set();
    lotes.forEach((l) => {
      const key = l.id_detalle_pedido ?? l.id_detalle_preparacion;
      if (!seen.has(key)) {
        seen.add(key);
        lineasUnicas.push(l);
      }
    });

    const unverifiedCount = lineasUnicas.filter((l) => !l.verificado).length;

    setPedidoParaFinalizar({
      pedido,
      unverifiedCount,
      totalItems: lineasUnicas.length,
    });
    setModalVerifOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setClienteFilter("");
    setEstadoFilter("ACTIVE");
    setFechaDesde("");
    setFechaHasta("");
  };

  // KPIs para los 4 recuadros superiores (idénticos en tamaño a Seguimiento de Pedidos)
  const metrics = useMemo(() => {
    const total = pedidos.length;
    const confirmados = pedidos.filter(
      (p) => String(p.estado_pedido || p.estado || "").trim() === "C"
    ).length;
    const enPreparacion = pedidos.filter(
      (p) => String(p.estado_pedido || p.estado || "").trim() === "E"
    ).length;
    const listos = pedidos.filter(
      (p) => String(p.estado_pedido || p.estado || "").trim() === "L"
    ).length;

    return { total, confirmados, enPreparacion, listos };
  }, [pedidos]);

  // Filtrado
  const filteredPedidos = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const cli = clienteFilter.trim().toLowerCase();

    return pedidos.filter((p) => {
      const est = String(p.estado_pedido ?? p.estado ?? "").trim();

      if (estadoFilter === "ACTIVE" && !["C", "E"].includes(est)) {
        return false;
      }
      if (
        estadoFilter !== "ACTIVE" &&
        estadoFilter !== "ALL" &&
        est !== estadoFilter
      ) {
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
        String(p.id_pedido ?? ""),
        p.cliente_nombre,
        p.cliente_cuit,
        p.observaciones,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
  }, [pedidos, searchTerm, clienteFilter, estadoFilter, fechaDesde, fechaHasta]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [searchTerm, clienteFilter, estadoFilter, fechaDesde, fechaHasta]);

  const totalPages = Math.max(1, Math.ceil(filteredPedidos.length / PAGE_SIZE));
  const paginatedPedidos = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPedidos.slice(start, start + PAGE_SIZE);
  }, [filteredPedidos, currentPage]);

  return (
    <div>
      {/* CABECERA COMPACTA + 4 CUADROS PEQUEÑOS A LA DERECHA (ESTÉTICA SEGUIMIENTO DE PEDIDOS) */}
      <div className="mb-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5e6f77]">
            06 · DEPÓSITO Y EXPEDICIÓN
          </div>
          <h2 className="m-0 font-barlow text-[24px] leading-tight tracking-[0.01em] text-[#163946]">
            Preparación de pedidos
          </h2>
          <p className="mt-0.5 text-[12px] text-[#6b7d85]">
            Ejecución de picking por lote en depósito, control de recolección y verificación para despacho.
          </p>
        </div>

        {/* 4 Recuadros pequeños a la derecha */}
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="min-w-31.25 rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Total pedidos
              </span>
              <Badge tone="blue">Asignados</Badge>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metrics.total}
              </span>
            </div>
          </div>

          <div className="min-w-31.25 rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Confirmados
              </span>
              <Badge tone="blue">Por iniciar</Badge>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metrics.confirmados}
              </span>
            </div>
          </div>

          <div className="min-w-31.25 rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                En preparación
              </span>
              <Badge tone="amber">Picking</Badge>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metrics.enPreparacion}
              </span>
            </div>
          </div>

          <div className="min-w-31.25 rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Verificados
              </span>
              <Badge tone="green">Listos</Badge>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metrics.listos}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL PRINCIPAL */}
      <Panel
        eyebrow="CONTROL DE PICKING · RECOLECCIÓN DE LOTES · VERIFICACIÓN DE DEPÓSITO"
        title="Pedidos confirmados para preparación"
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
        {/* Barra de filtros uniforme en una sola fila */}
        <div className="mb-3.5 flex flex-wrap items-center gap-2 md:flex-nowrap">
          <div className="relative min-w-42.5 flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#82979e]"
            />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nº de pedido u observación..."
              className="h-9 w-full rounded-md border border-[#d8e2e5] bg-[#f8fafb] pl-8 pr-3 text-[12px] text-[#173d4b] outline-none transition-colors focus:border-brand focus:bg-white"
            />
          </div>

          <input
            type="search"
            value={clienteFilter}
            onChange={(e) => setClienteFilter(e.target.value)}
            placeholder="Filtrar por cliente o CUIT..."
            className="h-9 min-w-40 flex-1 rounded-md border border-[#d8e2e5] bg-white px-3 text-[12px] text-[#173d4b] outline-none focus:border-brand"
          />

          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            title="Fecha desde"
            className="h-9 w-34 shrink-0 rounded-md border border-[#d8e2e5] bg-white px-2.5 text-[11.5px] text-[#173d4b] outline-none focus:border-brand"
          />

          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            title="Fecha hasta"
            className="h-9 w-34 shrink-0 rounded-md border border-[#d8e2e5] bg-white px-2.5 text-[11.5px] text-[#173d4b] outline-none focus:border-brand"
          />

          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="h-9 w-48 shrink-0 rounded-md border border-[#d8e2e5] bg-white px-2.5 text-[12px] text-[#173d4b] outline-none focus:border-brand"
          >
            <option value="ACTIVE">Activos (Confirmados / En prep.)</option>
            <option value="C">C · Confirmado</option>
            <option value="E">E · En preparación</option>
            <option value="L">L · Listo para despacho</option>
            <option value="ALL">Estado: Todos</option>
          </select>

          <Button
            type="button"
            variant="outline"
            onClick={clearFilters}
            className="h-9 shrink-0 border-[#d8e2e5] px-3 text-[11px] text-[#5e6f77]"
          >
            Limpiar
          </Button>
        </div>

        {/* Tabla Principal */}
        <div className="overflow-x-auto rounded-lg border border-[#e3eaec]">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#e3eaec] bg-[#f4f8f9] text-[10px] font-bold uppercase tracking-widest text-[#697e86]">
                <th className="px-3 py-2.5">Nº Pedido / Fecha</th>
                <th className="px-3 py-2.5">Cliente</th>
                <th className="px-3 py-2.5">Estado General</th>
                <th className="px-3 py-2.5">Reserva de Stock</th>
                <th className="px-3 py-2.5">Avance Picking</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2f4]">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-[12px] text-[#758990]"
                  >
                    Cargando pedidos confirmados para preparación...
                  </td>
                </tr>
              ) : paginatedPedidos.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-[12px] text-[#758990]"
                  >
                    No se encontraron pedidos confirmados con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedPedidos.map((row) => {
                  const isExpanded = expandedPedidoId === row.id_pedido;
                  const rawRowEstado = String(
                    row.estado_pedido ?? row.estado ?? "C"
                  ).trim();
                  const rowEstado =
                    isExpanded && rawRowEstado === "C" ? "E" : rawRowEstado;
                  const estadoInfo = ESTADO_PEDIDO_META[rowEstado] ?? {
                    label: rowEstado,
                    tone: "slate",
                  };

                  const isStarting = !!actionInProgress[row.id_pedido];
                  const detalleActual = detallesMap[row.id_pedido];
                  const lotesActuales = detalleActual?.lotes || [];
                  const isLoadingDetalle = loadingDetalleId === row.id_pedido;

                  // Cantidades desde el detalle cargado (tiempo real) o desde la fila
                  const cantSolicitada =
                    lotesActuales.length > 0
                      ? lotesActuales.reduce(
                          (acc, l) => acc + Number(l.cantidad_solicitada ?? 0),
                          0
                        )
                      : Number(row.total_solicitado ?? row.cantidad_productos ?? 0);

                  const cantReservada =
                    lotesActuales.length > 0
                      ? cantSolicitada
                      : Number(row.total_reservado ?? 0);

                  const cantRecogida =
                    lotesActuales.length > 0
                      ? lotesActuales.reduce(
                          (acc, l) => acc + Number(l.cantidad_recogida ?? 0),
                          0
                        )
                      : Number(row.total_recogido ?? 0);

                  const pctReserva =
                    cantSolicitada > 0
                      ? Math.min(100, Math.round((cantReservada / cantSolicitada) * 100))
                      : 0;
                  const pctPicking =
                    cantSolicitada > 0
                      ? Math.min(100, Math.round((cantRecogida / cantSolicitada) * 100))
                      : 0;

                  // Condición todos recogidos y verificación solicitada
                  const todosRecogidos =
                    lotesActuales.length > 0
                      ? lotesActuales.every((l) => l.estado_picking === "L")
                      : Number(row.cant_lotes ?? 0) > 0 &&
                        Number(row.cant_lotes_recogidos ?? 0) === Number(row.cant_lotes ?? 0);

                  const disponibleVerificar =
                    detalleActual != null
                      ? Boolean(
                          detalleActual.pedido?.disponible_verificar ||
                            lotesActuales.some((l) => l.disponible_verificar)
                        )
                      : Boolean(row.disponible_verificar);

                  return (
                    <Fragment key={row.id_pedido}>
                      <tr
                        className={`transition-colors ${
                          isExpanded ? "bg-[#f2f7f9]" : "hover:bg-[#f8fbfc]"
                        }`}
                      >
                        {/* Nº Pedido / Fecha */}
                        <td className="px-3 py-2.5 align-middle">
                          <div className="font-mono text-[12px] font-bold text-brand">
                            {formatNroPedido(row.id_pedido, row.numero_pedido)}
                          </div>
                          <div className="text-[10.5px] text-[#6d8088]">
                            {formatDateTime(row.fecha_pedido)}
                          </div>
                        </td>

                        {/* Cliente */}
                        <td className="px-3 py-2.5 align-middle">
                          <div className="font-semibold text-[#173d4b]">
                            {row.cliente_nombre || "—"}
                          </div>
                          {row.cliente_cuit && (
                            <div className="text-[10.5px] text-[#73878f]">
                              CUIT {row.cliente_cuit}
                            </div>
                          )}
                        </td>

                        {/* Estado General */}
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

                        {/* Reserva de Stock */}
                        <td className="px-3 py-2.5 align-middle">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono font-semibold text-[#173d4b]">
                              {formatQty(cantReservada)} / {formatQty(cantSolicitada)}
                            </span>
                            <span className="text-[10px] text-[#6d8088]">
                              {pctReserva}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-[#e6eef0]">
                            <div
                              className="h-full rounded-full bg-brand transition-all"
                              style={{ width: `${pctReserva}%` }}
                            />
                          </div>
                        </td>

                        {/* Avance Picking */}
                        <td className="px-3 py-2.5 align-middle">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono font-semibold text-[#173d4b]">
                              {formatQty(cantRecogida)} / {formatQty(cantSolicitada)}
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

                        {/* Botón Iniciar Preparacion / Cancelar Preparacion / Ver Detalle */}
                        <td className="px-3 py-2.5 text-right align-middle">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            {rowEstado === "C" ? (
                              <Button
                                type="button"
                                onClick={() => handleIniciarPreparacion(row.id_pedido)}
                                disabled={isStarting}
                                className="h-7 bg-brand px-2.5 text-[11px] font-semibold text-white hover:bg-[#114c5f]"
                              >
                                <Play size={12} className="mr-1" />
                                {isStarting ? "Iniciando..." : "Iniciar Preparación"}
                              </Button>
                            ) : (
                              <>
                                {rowEstado === "E" && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                      handleCancelarPreparacion(row.id_pedido)
                                    }
                                    disabled={
                                      !!actionInProgress[`cancel_${row.id_pedido}`]
                                    }
                                    title="Cancelar preparación y devolver el pedido a estado Confirmado (C)"
                                    className="h-7 border-[#f1cfcb] bg-[#fbe9e7] px-2.5 text-[11px] font-semibold text-[#ba584d] hover:bg-[#f5d5d1]"
                                  >
                                    <XCircle size={12} className="mr-1" />
                                    {actionInProgress[`cancel_${row.id_pedido}`]
                                      ? "Cancelando..."
                                      : "Cancelar Preparación"}
                                  </Button>
                                )}

                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleToggleExpand(row.id_pedido)}
                                  className={`h-7 px-2.5 text-[11px] font-semibold ${
                                    isExpanded
                                      ? "border-brand bg-brand text-white hover:bg-[#114c5f]"
                                      : "border-[#cfe0e6] bg-[#f4f9fb] text-brand hover:bg-[#e6f2f6]"
                                  }`}
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp size={13} className="mr-1" />
                                      Ocultar detalle
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown size={13} className="mr-1" />
                                      {rowEstado === "E"
                                        ? "Continuar preparación"
                                        : "Ver preparación"}
                                    </>
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* FILA DESPLEGABLE CON EL DETALLE DEL PEDIDO */}
                      {isExpanded && (
                        <tr className="bg-[#f4f8f9]/65">
                          <td colSpan={6} className="p-3.5">
                            <div className="overflow-hidden rounded-lg border border-[#dce6e9] bg-white shadow-2xs">
                              {/* Encabezado interno del detalle */}
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8eff1] bg-[#f6fafb] px-3.5 py-2.5">
                                <div className="flex items-center gap-2">
                                  <Box size={16} className="text-brand" />
                                  <div>
                                    <span className="font-semibold text-[#173d4b]">
                                      Detalle de Picking y Verificación · Pedido{" "}
                                      {formatNroPedido(row.id_pedido)}
                                    </span>
                                    <span className="ml-2 rounded bg-[#e5eff3] px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-brand">
                                      {lotesActuales.length} lote(s)
                                    </span>
                                  </div>
                                </div>

                                {/* Botones de Acción de Verificación */}
                                <div className="flex flex-wrap items-center gap-2">
                                  {!disponibleVerificar && rowEstado !== "L" && (
                                    <Button
                                      type="button"
                                      onClick={() =>
                                        handleSolicitarVerificacion(row.id_pedido)
                                      }
                                      disabled={
                                        !todosRecogidos ||
                                        !!actionInProgress[`verif_${row.id_pedido}`]
                                      }
                                      title={
                                        todosRecogidos
                                          ? "Habilitar la verificación para el Encargado de Depósito o Sysadmin"
                                          : "Debe marcar todos los productos en estado Recogido (L) para solicitar la verificación"
                                      }
                                      className={`h-7 px-3 text-[11px] font-semibold ${
                                        todosRecogidos
                                          ? "bg-brand text-white hover:bg-[#114c5f]"
                                          : "cursor-not-allowed border border-[#dce6e9] bg-[#eef3f5] text-[#82979e]"
                                      }`}
                                    >
                                      <SendHorizontal size={12} className="mr-1.5" />
                                      {actionInProgress[`verif_${row.id_pedido}`]
                                        ? "Solicitando..."
                                        : "Solicitar la Verificación del Picking"}
                                    </Button>
                                  )}

                                  {disponibleVerificar && rowEstado !== "L" && (
                                    <>
                                      <span className="inline-flex items-center gap-1 rounded-full bg-[#e9f2f5] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#145c73]">
                                        <CheckCircle2 size={12} /> Verificación habilitada
                                      </span>

                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                          handleVolverAPreparacion(row.id_pedido)
                                        }
                                        disabled={
                                          !!actionInProgress[`volver_${row.id_pedido}`]
                                        }
                                        title="Desbloquear 'Marcar como Recogido' y regresar la columna 'Marcar como Verificado' a su estado previo"
                                        className="h-7 border-[#cfe0e6] bg-white px-2.5 text-[11px] font-semibold text-[#173d4b] hover:bg-[#f4f8f9]"
                                      >
                                        <RotateCcw size={12} className="mr-1.5" />
                                        {actionInProgress[`volver_${row.id_pedido}`]
                                          ? "Volviendo..."
                                          : "Volver a Preparación"}
                                      </Button>
                                    </>
                                  )}

                                  {/* Botón Finalizar Verificacion (Solo roles 1 y 14 cuando está habilitada la columna) */}
                                  {canVerify &&
                                    disponibleVerificar &&
                                    rowEstado !== "L" && (
                                      <Button
                                        type="button"
                                        onClick={() =>
                                          handleAbrirModalFinalizar(row.id_pedido)
                                        }
                                        className="h-7 bg-[#2e8b62] px-3 text-[11px] font-semibold text-white hover:bg-[#246e4d]"
                                      >
                                        <CheckCircle2 size={12} className="mr-1.5" />
                                        Finalizar Verificación
                                      </Button>
                                    )}

                                  {rowEstado === "L" && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f4ed] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#256349]">
                                      <CheckCircle2 size={12} /> Pedido Verificado (Listo)
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Cuerpo de la subtabla de lotes */}
                              <div className="p-3">
                                {isLoadingDetalle ? (
                                  <div className="py-6 text-center text-[11.5px] text-[#758990]">
                                    Consultando lotes asignados del pedido...
                                  </div>
                                ) : lotesActuales.length === 0 ? (
                                  <div className="rounded border border-dashed border-[#dce6e9] bg-[#fafcfd] py-4 text-center text-[11.5px] text-[#758990]">
                                    Este pedido no posee lotes reservados en preparación.
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto rounded border border-[#e6eef0]">
                                    <table className="w-full border-collapse text-left text-[11.5px]">
                                      <thead>
                                        <tr className="border-b border-[#e6eef0] bg-[#f9fbfc] text-[9.5px] font-bold uppercase text-[#6d8088]">
                                          <th className="px-2.5 py-2">Nº Lote</th>
                                          <th className="px-2.5 py-2">
                                            Posición Depósito
                                          </th>
                                          <th className="px-2.5 py-2">
                                            Fabricación / Venc.
                                          </th>
                                          <th className="px-2.5 py-2 text-right">
                                            Cant. Solicitada
                                          </th>
                                          <th className="px-2.5 py-2">
                                            Estado Picking Lote
                                          </th>
                                          <th className="px-2.5 py-2 text-center">
                                            Marcar como Recogido
                                          </th>
                                          {canVerify && (
                                            <th className="px-2.5 py-2 text-center">
                                              Marcar como Verificado
                                            </th>
                                          )}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-[#eef3f5]">
                                        {lotesActuales.map((lt) => {
                                          const isRecogido = lt.estado_picking === "L";
                                          const isVerificado = Boolean(lt.verificado);
                                          const ltMeta = ESTADO_PICKING_LOTE_META[
                                            lt.estado_picking
                                          ] ?? {
                                            label: lt.estado_picking,
                                            tone: "amber",
                                          };

                                          return (
                                            <tr
                                              key={lt.id_detalle_preparacion}
                                              className={`transition-colors ${
                                                isRecogido
                                                  ? "bg-[#f4faf7]/70"
                                                  : "hover:bg-[#f8fbfc]"
                                              }`}
                                            >
                                              {/* Nº Lote + Producto */}
                                              <td className="px-2.5 py-2 align-middle">
                                                <div className="flex items-center gap-1.5">
                                                  <span className="font-mono font-bold text-brand">
                                                    {lt.nro_lote ||
                                                      `#${lt.id_lote_producto}`}
                                                  </span>
                                                  {lt.producto_codigo && (
                                                    <span className="rounded bg-[#e5eff3] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-brand">
                                                      {lt.producto_codigo}
                                                    </span>
                                                  )}
                                                </div>
                                                {lt.producto_nombre && (
                                                  <div className="text-[10.5px] text-[#5f737b]">
                                                    {lt.producto_nombre}
                                                  </div>
                                                )}
                                              </td>

                                              {/* Posición Depósito */}
                                              <td className="px-2.5 py-2 align-middle font-mono font-semibold text-[#173d4b]">
                                                {lt.posicion_codigo || "—"}
                                              </td>

                                              {/* Fabricación / Venc. */}
                                              <td className="px-2.5 py-2 align-middle text-[#5f737b]">
                                                Fab:{" "}
                                                {formatDateOnly(lt.fecha_fabricacion)} ·
                                                Vto:{" "}
                                                {formatDateOnly(lt.fecha_vencimiento)}
                                              </td>

                                              {/* Cant. Solicitada */}
                                              <td className="px-2.5 py-2 text-right align-middle">
                                                <div className="font-mono font-semibold text-[#173d4b]">
                                                  {formatQty(lt.cantidad_solicitada)}{" "}
                                                  <span className="text-[10px] font-normal text-[#6d8088]">
                                                    {lt.unidad_medida || "un."}
                                                  </span>
                                                </div>
                                                <div className="font-mono text-[10px] text-[#256349]">
                                                  Recogido:{" "}
                                                  {formatQty(lt.cantidad_recogida)}
                                                </div>
                                              </td>

                                              {/* Estado Picking Lote */}
                                              <td className="px-2.5 py-2 align-middle">
                                                <Badge tone={ltMeta.tone}>
                                                  {lt.estado_picking} · {ltMeta.label}
                                                </Badge>
                                              </td>

                                              {/* Marcar como Recogido (Bloqueado cuando la verificación está habilitada o el pedido finalizado) */}
                                              <td className="px-2.5 py-2 text-center align-middle">
                                                {disponibleVerificar || rowEstado === "L" ? (
                                                  <span
                                                    className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-[#e3eaec] bg-[#f4f8f9] px-2.5 py-1 text-[10.5px] font-medium text-[#82979e]"
                                                    title={
                                                      disponibleVerificar
                                                        ? "Bloqueado mientras la verificación está habilitada. Presione 'Volver a Preparación' para modificar."
                                                        : "Pedido verificado"
                                                    }
                                                  >
                                                    <input
                                                      type="checkbox"
                                                      checked={isRecogido}
                                                      disabled
                                                      readOnly
                                                      className="h-3.5 w-3.5 cursor-not-allowed rounded border-[#b8c9cf] accent-[#145c73]"
                                                    />
                                                    <Lock size={11} />
                                                    <span>
                                                      {isRecogido ? "Recogido (Bloq.)" : "Bloqueado"}
                                                    </span>
                                                  </span>
                                                ) : (
                                                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#d8e2e5] bg-white px-2.5 py-1 text-[11px] font-medium text-[#173d4b] shadow-2xs transition-colors hover:border-brand">
                                                    <input
                                                      type="checkbox"
                                                      checked={isRecogido}
                                                      onChange={() =>
                                                        handleTogglePickingLote(
                                                          row.id_pedido,
                                                          lt
                                                        )
                                                      }
                                                      className="h-3.5 w-3.5 cursor-pointer rounded border-[#b8c9cf] accent-[#145c73]"
                                                    />
                                                    <span>
                                                      {isRecogido ? "Recogido" : "Marcar"}
                                                    </span>
                                                  </label>
                                                )}
                                              </td>

                                              {/* Marcar como Verificado (Solo id_rol 1 y 14) */}
                                              {canVerify && (
                                                <td className="px-2.5 py-2 text-center align-middle">
                                                  {!disponibleVerificar ? (
                                                    <span
                                                      className="inline-flex items-center gap-1 rounded-md border border-[#e3eaec] bg-[#f4f8f9] px-2.5 py-1 text-[10.5px] text-[#82979e]"
                                                      title="Deshabilitado hasta que se seleccione 'Solicitar la Verificación del Picking'"
                                                    >
                                                      <Lock size={11} />
                                                      Pendiente solicitud
                                                    </span>
                                                  ) : (
                                                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#cfe0e6] bg-[#f6fafb] px-2.5 py-1 text-[11px] font-semibold text-[#173d4b] shadow-2xs transition-colors hover:border-[#2e8b62]">
                                                      <input
                                                        type="checkbox"
                                                        checked={isVerificado}
                                                        disabled={rowEstado === "L"}
                                                        onChange={() =>
                                                          handleToggleVerificadoLinea(
                                                            row.id_pedido,
                                                            lt
                                                          )
                                                        }
                                                        className="h-3.5 w-3.5 cursor-pointer rounded border-[#b8c9cf] accent-[#2e8b62]"
                                                      />
                                                      <span>
                                                        {isVerificado
                                                          ? "Verificado"
                                                          : "Verificar"}
                                                      </span>
                                                    </label>
                                                  )}
                                                </td>
                                              )}
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación idéntica al resto de los módulos */}
        <div className="mt-3 flex flex-col items-center justify-between gap-2 text-[11px] text-[#6d8088] sm:flex-row">
          <div>
            Mostrando{" "}
            <strong className="text-[#173d4b]">{paginatedPedidos.length}</strong>{" "}
            de{" "}
            <strong className="text-[#173d4b]">{filteredPedidos.length}</strong>{" "}
            pedidos
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-7 border-[#d8e2e5] px-2 text-[11px]"
            >
              <ChevronLeft size={13} />
              Anterior
            </Button>
            <span className="px-2 font-medium text-[#173d4b]">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-7 border-[#d8e2e5] px-2 text-[11px]"
            >
              Siguiente
              <ChevronRight size={13} />
            </Button>
          </div>
        </div>
      </Panel>

      {/* Modal Finalizar Verificación */}
      {pedidoParaFinalizar && (
        <FinalizarVerificacionModal
          isOpen={modalVerifOpen}
          onClose={() => {
            setModalVerifOpen(false);
            setPedidoParaFinalizar(null);
          }}
          pedido={pedidoParaFinalizar.pedido}
          unverifiedCount={pedidoParaFinalizar.unverifiedCount}
          totalItems={pedidoParaFinalizar.totalItems}
          onSuccess={async () => {
            await fetchPedidos();
            if (expandedPedidoId) {
              await fetchDetallePedido(expandedPedidoId, true);
            }
          }}
        />
      )}
    </div>
  );
}
