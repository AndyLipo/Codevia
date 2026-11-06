import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  History,
  Info,
  Layers,
  MapPin,
  MapPinCheck,
  MoveRight,
  Package,
  RotateCcw,
  Search,
  Warehouse as WarehouseIcon,
  X,
  AlertCircle,
  ArrowRightLeft,
  Navigation,
} from "lucide-react";
import { toast } from "sonner";

import SectionTitle from "@/components/common/SectionTitle";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import ActionButton from "@/components/common/ActionButton";
import Kpi from "@/components/common/Kpi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { obtenerSituacion } from "@/lib/situacionLote";

// Mapeo de estados de posición en depósito según especificación:
// 'D': Disponible (Posición libre para almacenar un lote)
// 'O': Ocupada (Posición que tiene un lote almacenado)
// 'R': Reservada (Posición reservada para una operación o asignación)
// 'B': Bloqueada (Posición inhabilitada para almacenar o retirar stock)
// 'M': En mantenimiento (Posición temporalmente fuera de servicio)
const ESTADO_POSICION_META = {
  D: {
    label: "Disponible",
    descripcion: "Posición libre para almacenar un lote.",
    tone: "green",
    badgeClass: "bg-[#e7f4ed] text-[#256349] border-[#bfe2d0]",
    cellClass: "bg-[#e7f4ed] text-[#1e6b49] border-[#a5d8bf] hover:bg-[#d5ece0]",
    selectable: true,
  },
  O: {
    label: "Ocupada",
    descripcion: "Posición que tiene un lote almacenado.",
    tone: "blue",
    badgeClass: "bg-[#e9f2f5] text-[#145c73] border-[#bdd8e1]",
    cellClass: "bg-[#e9f2f5] text-[#145c73] border-[#b4d4de] hover:bg-[#d8e9ef]",
    selectable: false,
  },
  R: {
    label: "Reservada",
    descripcion: "Posición reservada para una operación o asignación.",
    tone: "amber",
    badgeClass: "bg-[#fff2d8] text-[#a76e1a] border-[#fae0ab]",
    cellClass: "bg-[#fff2d8] text-[#935f14] border-[#f5d492] hover:bg-[#ffe8be]",
    selectable: false,
  },
  B: {
    label: "Bloqueada",
    descripcion: "Posición inhabilitada para almacenar o retirar stock.",
    tone: "red",
    badgeClass: "bg-[#fbe9e7] text-[#ba584d] border-[#f5c7c1]",
    cellClass: "bg-[#fbe9e7] text-[#a8473c] border-[#f0b5ad] hover:bg-[#f6d7d4]",
    selectable: false,
  },
  M: {
    label: "En mantenimiento",
    descripcion: "Posición temporalmente fuera de servicio por mantenimiento.",
    tone: "slate",
    badgeClass: "bg-[#f3edf8] text-[#714194] border-[#e0cfee]",
    cellClass: "bg-[#f3edf8] text-[#633585] border-[#d4bee6] hover:bg-[#e7d8f3]",
    selectable: false,
  },
};

const labelCls =
  "text-[10px] font-bold uppercase tracking-widest text-[#72848c]";
const selectCls =
  "h-9 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[12px] text-[#173d4b] outline-none transition-colors focus:border-[#214451]";

const formatFecha = (val) => {
  if (!val) return "—";
  const dateStr = String(val).slice(0, 10);
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return val;
  return `${d}/${m}/${y}`;
};

const formatDateTime = (val) => {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return val;
  }
};

const formatNumero = (num) => {
  if (num == null || isNaN(num)) return "0";
  return Number(num).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
};

export default function UbicarLotes({ fakeAction }) {
  const { user } = useAuth();
  const auditUser = user?.usuario_login || user?.usuario || "SISTEMA";

  // Control de pestañas internas: "ubicar" | "mover"
  const [activeTab, setActiveTab] = useState("ubicar");

  // Datos principales
  const [lotes, setLotes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [stocksMap, setStocksMap] = useState(new Map());
  const [ubicacionesMap, setUbicacionesMap] = useState(new Map());
  const [unidadesMap, setUnidadesMap] = useState(new Map());

  // Estructura de depósito
  const [depositos, setDepositos] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [pasillos, setPasillos] = useState([]);
  const [modulos, setModulos] = useState([]);
  const [niveles, setNiveles] = useState([]);
  const [posiciones, setPosiciones] = useState([]);
  const [loading, setLoading] = useState(true);

  // Búsqueda en tabla
  const [search, setSearch] = useState("");

  // Modal 1: Asignar Ubicación (para lotes en estado 'R')
  const [modalUbicarOpen, setModalUbicarOpen] = useState(false);
  const [loteParaUbicar, setLoteParaUbicar] = useState(null);
  const [selectedDepositoId, setSelectedDepositoId] = useState("");
  const [selectedZonaId, setSelectedZonaId] = useState("");
  const [selectedPosicion, setSelectedPosicion] = useState(null);
  const [savingUbicar, setSavingUbicar] = useState(false);

  // Modal 2: Mover Lote (para lotes en estado 'U')
  const [modalMoverOpen, setModalMoverOpen] = useState(false);
  const [loteParaMover, setLoteParaMover] = useState(null);
  const [selectedDepositoMoverId, setSelectedDepositoMoverId] = useState("");
  const [selectedZonaMoverId, setSelectedZonaMoverId] = useState("");
  const [selectedPosicionMover, setSelectedPosicionMover] = useState(null);
  const [savingMover, setSavingMover] = useState(false);

  // Modal 3: Historial de Movimientos
  const [modalHistorialOpen, setModalHistorialOpen] = useState(false);
  const [loteHistorial, setLoteHistorial] = useState(null);
  const [historialPosiciones, setHistorialPosiciones] = useState([]);
  const [historialMovimientos, setHistorialMovimientos] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Carga general de datos
  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [
        resLotes,
        resProductos,
        resUnidades,
        resStocks,
        resLotePos,
        resDepositos,
        resZonas,
        resPasillos,
        resModulos,
        resNiveles,
        resPosiciones,
      ] = await Promise.all([
        supabase
          .schema("produccion")
          .from("lote_producto")
          .select(
            "id_lote_producto, id_produccion, id_producto, nro_lote, fecha_fabricacion, fecha_vencimiento, cantidad_total, estado_lote, estado, usu_alta, fec_alta, usu_mod, fec_mod, origen_lote"
          )
          .eq("estado", "A")
          .order("id_lote_producto", { ascending: false }),

        supabase
          .schema("produccion")
          .from("producto")
          .select(
            "id_producto, codigo, nombre, id_tipo_producto, id_material, id_unidad_medida, es_biodegradable, estado, vida_util_meses"
          )
          .order("nombre", { ascending: true }),

        supabase
          .schema("produccion")
          .from("unidad_medida")
          .select("id_unidad_medida, codigo, nombre")
          .eq("estado", "A"),

        supabase
          .schema("deposito")
          .from("stock")
          .select(
            "id_stock, id_lote_producto, cantidad_reservada, cantidad_consumida, estado"
          )
          .eq("estado", "A"),

        supabase
          .schema("deposito")
          .from("lote_posicion")
          .select("id_lote_posicion, id_lote_producto, id_posicion, estado")
          .eq("estado", "A"),

        supabase
          .schema("deposito")
          .from("deposito")
          .select("id_deposito, codigo, nombre, descripcion, estado")
          .eq("estado", "A")
          .order("id_deposito", { ascending: true }),

        supabase
          .schema("deposito")
          .from("zona")
          .select("id_zona, id_deposito, codigo, nombre, descripcion, estado")
          .eq("estado", "A")
          .order("codigo", { ascending: true }),

        supabase
          .schema("deposito")
          .from("pasillo")
          .select("id_pasillo, id_zona, codigo, estado")
          .eq("estado", "A"),

        supabase
          .schema("deposito")
          .from("modulo")
          .select("id_modulo, id_pasillo, numero, estado")
          .eq("estado", "A"),

        supabase
          .schema("deposito")
          .from("nivel")
          .select("id_nivel, id_modulo, numero, estado")
          .eq("estado", "A"),

        supabase
          .schema("deposito")
          .from("posicion")
          .select(
            "id_posicion, id_nivel, codigo, capacidad_kg, capacidad_m3, estado_posicion, estado"
          )
          .eq("estado", "A")
          .order("codigo", { ascending: true }),
      ]);

      if (resLotes.error) throw resLotes.error;
      if (resProductos.error) throw resProductos.error;

      // Mapa de unidades
      const mapUnidades = new Map();
      for (const u of resUnidades.data || []) {
        mapUnidades.set(Number(u.id_unidad_medida), u.codigo || u.nombre);
      }
      setUnidadesMap(mapUnidades);

      // Mapa de stocks
      const mapStocks = new Map();
      for (const st of resStocks.data || []) {
        mapStocks.set(Number(st.id_lote_producto), st);
      }
      setStocksMap(mapStocks);

      // Mapa de posiciones: id_posicion -> row
      const mapPos = new Map();
      for (const p of resPosiciones.data || []) {
        mapPos.set(Number(p.id_posicion), p);
      }

      // Mapa de ubicaciones activas: id_lote_producto -> codigo y objeto
      const mapUbic = new Map();
      for (const lp of resLotePos.data || []) {
        const posObj = mapPos.get(Number(lp.id_posicion));
        if (posObj) {
          mapUbic.set(Number(lp.id_lote_producto), {
            id_posicion: posObj.id_posicion,
            codigo: posObj.codigo,
            posicion: posObj,
          });
        }
      }
      setUbicacionesMap(mapUbic);

      setLotes(resLotes.data || []);
      setProductos(resProductos.data || []);
      setDepositos(resDepositos.data || []);
      setZonas(resZonas.data || []);
      setPasillos(resPasillos.data || []);
      setModulos(resModulos.data || []);
      setNiveles(resNiveles.data || []);
      setPosiciones(resPosiciones.data || []);
    } catch (err) {
      console.error("Error al cargar datos en Ubicar Lotes:", err);
      toast.error(err.message || "Error al cargar datos del depósito");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Mapa rápido de productos
  const productosMap = useMemo(() => {
    const map = new Map();
    for (const p of productos) {
      map.set(Number(p.id_producto), p);
    }
    return map;
  }, [productos]);

  // Mapeo jerárquico: id_nivel -> id_zona
  const nivelToZonaMap = useMemo(() => {
    const pasilloToZona = new Map();
    for (const p of pasillos) {
      pasilloToZona.set(Number(p.id_pasillo), Number(p.id_zona));
    }

    const moduloToZona = new Map();
    for (const m of modulos) {
      const zid = pasilloToZona.get(Number(m.id_pasillo));
      if (zid) moduloToZona.set(Number(m.id_modulo), zid);
    }

    const map = new Map();
    for (const n of niveles) {
      const zid = moduloToZona.get(Number(n.id_modulo));
      if (zid) map.set(Number(n.id_nivel), zid);
    }

    return map;
  }, [pasillos, modulos, niveles]);

  // Lista enriquecida de lotes
  const lotesEnriquecidos = useMemo(() => {
    return lotes.map((lote) => {
      const prod = productosMap.get(Number(lote.id_producto));
      const stock = stocksMap.get(Number(lote.id_lote_producto));
      const ubicInfo = ubicacionesMap.get(Number(lote.id_lote_producto));

      const cantTotal = Number(lote.cantidad_total || 0);
      const cantReservada = Number(stock?.cantidad_reservada || 0);
      const cantConsumida = Number(stock?.cantidad_consumida || 0);
      const cantDisponible = Math.max(0, cantTotal - cantReservada - cantConsumida);

      const unidadCodigo = prod?.id_unidad_medida
        ? unidadesMap.get(Number(prod.id_unidad_medida)) || ""
        : "";

      return {
        ...lote,
        productoCodigo: prod?.codigo || "—",
        productoNombre: prod?.nombre || "Producto sin definir",
        unidadCodigo,
        cantidadTotalNum: cantTotal,
        cantidadReservadaNum: cantReservada,
        cantidadConsumidaNum: cantConsumida,
        cantidadDisponibleNum: cantDisponible,
        ubicacionActualCodigo: ubicInfo?.codigo || null,
        idPosicionActual: ubicInfo?.id_posicion || null,
      };
    });
  }, [lotes, productosMap, stocksMap, ubicacionesMap, unidadesMap]);

  // Lotes para la Pestaña 1: "Ubicar Lotes" (estado_lote P o R)
  const lotesPestanaUbicar = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lotesEnriquecidos
      .filter((l) => l.estado_lote === "P" || l.estado_lote === "R")
      .filter((l) => {
        if (!q) return true;
        return (
          String(l.nro_lote || "").toLowerCase().includes(q) ||
          String(l.productoNombre || "").toLowerCase().includes(q) ||
          String(l.productoCodigo || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Primero P, segundo R, y dentro de cada uno por ID descendente
        if (a.estado_lote !== b.estado_lote) {
          return a.estado_lote === "P" ? -1 : 1;
        }
        return Number(b.id_lote_producto) - Number(a.id_lote_producto);
      });
  }, [lotesEnriquecidos, search]);

  // Lotes para la Pestaña 2: "Mover Lotes" (estado_lote U)
  const lotesPestanaMover = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lotesEnriquecidos
      .filter((l) => l.estado_lote === "U")
      .filter((l) => {
        if (!q) return true;
        return (
          String(l.nro_lote || "").toLowerCase().includes(q) ||
          String(l.productoNombre || "").toLowerCase().includes(q) ||
          String(l.productoCodigo || "").toLowerCase().includes(q) ||
          String(l.ubicacionActualCodigo || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Number(b.id_lote_producto) - Number(a.id_lote_producto));
  }, [lotesEnriquecidos, search]);

  // Métricas para la cabecera
  const kpis = useMemo(() => {
    const pendientes = lotesEnriquecidos.filter((l) => l.estado_lote === "P").length;
    const recibidos = lotesEnriquecidos.filter((l) => l.estado_lote === "R").length;
    const ubicados = lotesEnriquecidos.filter((l) => l.estado_lote === "U").length;
    const posDisponibles = posiciones.filter((p) => p.estado_posicion === "D").length;
    const posOcupadas = posiciones.filter((p) => p.estado_posicion === "O").length;

    return { pendientes, recibidos, ubicados, posDisponibles, posOcupadas };
  }, [lotesEnriquecidos, posiciones]);

  // -------------------------------------------------------------------------
  // ACCIÓN 1: Confirmar Recepción (Cambia P -> R mediante fn_recibir_lote)
  // -------------------------------------------------------------------------
  const handleConfirmarRecepcion = async (lote) => {
    try {
      const { error } = await supabase
        .schema("deposito")
        .rpc("fn_recibir_lote", {
          p_id_lote_producto: Number(lote.id_lote_producto),
          p_usuario: auditUser,
        });

      if (error) throw error;

      toast.success(
        `Recepción confirmada para lote ${lote.nro_lote}. Ahora se encuentra en estado 'Recibido' (R).`
      );
      await cargar();
    } catch (err) {
      console.error("Error al confirmar recepción:", err);
      toast.error(err.message || "No se pudo confirmar la recepción del lote.");
    }
  };

  // -------------------------------------------------------------------------
  // MODAL 1: Asignar Ubicación (para lote en estado R)
  // -------------------------------------------------------------------------
  const abrirModalUbicar = (lote) => {
    setLoteParaUbicar(lote);
    const depDefecto = depositos[0]?.id_deposito ? String(depositos[0].id_deposito) : "";
    setSelectedDepositoId(depDefecto);

    const zonasDep = zonas.filter((z) => Number(z.id_deposito) === Number(depDefecto));
    setSelectedZonaId(zonasDep[0]?.id_zona ? String(zonasDep[0].id_zona) : "");
    setSelectedPosicion(null);
    setModalUbicarOpen(true);
  };

  const zonasDisponiblesModal = useMemo(() => {
    if (!selectedDepositoId) return [];
    return zonas.filter((z) => Number(z.id_deposito) === Number(selectedDepositoId));
  }, [zonas, selectedDepositoId]);

  const posicionesZonaSeleccionada = useMemo(() => {
    if (!selectedZonaId) return [];
    return posiciones.filter(
      (p) => nivelToZonaMap.get(Number(p.id_nivel)) === Number(selectedZonaId)
    );
  }, [posiciones, selectedZonaId, nivelToZonaMap]);

  const handleConfirmarUbicacion = async () => {
    if (!loteParaUbicar || !selectedPosicion) return;

    if (selectedPosicion.estado_posicion !== "D") {
      toast.error(
        `La posición ${selectedPosicion.codigo} no está disponible (Estado: ${selectedPosicion.estado_posicion}).`
      );
      return;
    }

    setSavingUbicar(true);
    try {
      const { error } = await supabase
        .schema("deposito")
        .rpc("fn_ubicar_lote", {
          p_id_lote_producto: Number(loteParaUbicar.id_lote_producto),
          p_id_posicion: Number(selectedPosicion.id_posicion),
          p_usuario: auditUser,
        });

      if (error) throw error;

      toast.success(
        `Lote ${loteParaUbicar.nro_lote} asignado a la posición ${selectedPosicion.codigo} (estado 'U').`
      );
      setModalUbicarOpen(false);
      setLoteParaUbicar(null);
      await cargar();
    } catch (err) {
      console.error("Error al ubicar lote:", err);
      toast.error(err.message || "No se pudo ubicar el lote.");
    } finally {
      setSavingUbicar(false);
    }
  };

  // -------------------------------------------------------------------------
  // MODAL 2: Mover Lote (para lote en estado U)
  // -------------------------------------------------------------------------
  const abrirModalMover = (lote) => {
    setLoteParaMover(lote);
    const depDefecto = depositos[0]?.id_deposito ? String(depositos[0].id_deposito) : "";
    setSelectedDepositoMoverId(depDefecto);

    const zonasDep = zonas.filter((z) => Number(z.id_deposito) === Number(depDefecto));
    setSelectedZonaMoverId(zonasDep[0]?.id_zona ? String(zonasDep[0].id_zona) : "");
    setSelectedPosicionMover(null);
    setModalMoverOpen(true);
  };

  const zonasDisponiblesMoverModal = useMemo(() => {
    if (!selectedDepositoMoverId) return [];
    return zonas.filter((z) => Number(z.id_deposito) === Number(selectedDepositoMoverId));
  }, [zonas, selectedDepositoMoverId]);

  const posicionesZonaMover = useMemo(() => {
    if (!selectedZonaMoverId) return [];
    return posiciones.filter(
      (p) => nivelToZonaMap.get(Number(p.id_nivel)) === Number(selectedZonaMoverId)
    );
  }, [posiciones, selectedZonaMoverId, nivelToZonaMap]);

  const handleConfirmarMovimiento = async () => {
    if (!loteParaMover || !selectedPosicionMover) return;

    if (selectedPosicionMover.id_posicion === loteParaMover.idPosicionActual) {
      toast.error("La posición destino es la misma que la posición actual.");
      return;
    }

    if (selectedPosicionMover.estado_posicion !== "D") {
      toast.error(
        `La posición destino ${selectedPosicionMover.codigo} no está disponible (Estado: ${selectedPosicionMover.estado_posicion}).`
      );
      return;
    }

    setSavingMover(true);
    try {
      const { error } = await supabase
        .schema("deposito")
        .rpc("fn_trasladar_lote", {
          p_id_lote_producto: Number(loteParaMover.id_lote_producto),
          p_id_posicion_destino: Number(selectedPosicionMover.id_posicion),
          p_usuario: auditUser,
        });

      if (error) throw error;

      toast.success(
        `Lote ${loteParaMover.nro_lote} trasladado con éxito a ${selectedPosicionMover.codigo}.`
      );
      setModalMoverOpen(false);
      setLoteParaMover(null);
      await cargar();
    } catch (err) {
      console.error("Error al mover lote:", err);
      toast.error(err.message || "No se pudo mover el lote.");
    } finally {
      setSavingMover(false);
    }
  };

  // -------------------------------------------------------------------------
  // MODAL 3: Historial de Movimientos
  // -------------------------------------------------------------------------
  const abrirModalHistorial = async (lote) => {
    setLoteHistorial(lote);
    setHistorialPosiciones([]);
    setHistorialMovimientos([]);
    setLoadingHistorial(true);
    setModalHistorialOpen(true);

    try {
      const [resLp, resMov] = await Promise.all([
        supabase
          .schema("deposito")
          .from("lote_posicion")
          .select("id_lote_posicion, id_lote_producto, id_posicion, fecha_asignacion, estado, usu_alta, fec_alta, usu_mod, fec_mod")
          .eq("id_lote_producto", Number(lote.id_lote_producto))
          .order("id_lote_posicion", { ascending: false }),

        supabase
          .schema("deposito")
          .from("movimiento_lote")
          .select("*")
          .eq("id_lote_producto", Number(lote.id_lote_producto))
          .order("fecha_movimiento", { ascending: false }),
      ]);

      const mapPos = new Map(posiciones.map((p) => [p.id_posicion, p.codigo]));

      const lpConCodigos = (resLp.data || []).map((item) => ({
        ...item,
        posicionCodigo: mapPos.get(Number(item.id_posicion)) || `ID #${item.id_posicion}`,
      }));

      const movConCodigos = (resMov.data || []).map((m) => ({
        ...m,
        posicionOrigenCodigo: m.id_posicion_origen ? mapPos.get(Number(m.id_posicion_origen)) : "—",
        posicionDestinoCodigo: m.id_posicion_destino ? mapPos.get(Number(m.id_posicion_destino)) : "—",
      }));

      setHistorialPosiciones(lpConCodigos);
      setHistorialMovimientos(movConCodigos);
    } catch (err) {
      console.error("Error al cargar historial:", err);
      toast.error("No se pudo cargar el historial del lote.");
    } finally {
      setLoadingHistorial(false);
    }
  };

  // -------------------------------------------------------------------------
  // Filas para Tabla Pestaña 1 ("Ubicar Lotes")
  // -------------------------------------------------------------------------
  const rowsUbicar = lotesPestanaUbicar.map((lote) => {
    const esPendiente = lote.estado_lote === "P";
    const esRecibido = lote.estado_lote === "R";
    const situacionVenc = obtenerSituacion(lote.fecha_vencimiento);

    return [
      // 1. N° Lote
      <div key={`nro-${lote.id_lote_producto}`} className="flex flex-col">
        <span className="font-mono font-semibold text-[#145c73]">{lote.nro_lote}</span>
        <span className="text-[9px] text-[#86979c]">
          {lote.origen_lote === "I"
            ? "Lote Externo / Inicial"
            : lote.id_produccion
            ? `OP #${lote.id_produccion}`
            : "Producción"}
        </span>
      </div>,

      // 2. Producto
      <div key={`prod-${lote.id_lote_producto}`} className="max-w-[220px]">
        <strong className="block truncate font-medium text-[#214451]" title={lote.productoNombre}>
          {lote.productoNombre}
        </strong>
        <span className="font-mono text-[10px] text-[#71858c]">{lote.productoCodigo}</span>
      </div>,

      // 3. Cantidad Total
      <div key={`tot-${lote.id_lote_producto}`} className="text-right font-medium text-[#214451]">
        <span>{formatNumero(lote.cantidadTotalNum)}</span>{" "}
        <span className="text-[10px] text-[#7d9096]">{lote.unidadCodigo}</span>
      </div>,

      // 4. Cantidad Disponible
      <div key={`disp-${lote.id_lote_producto}`} className="text-right font-semibold text-[#287955]">
        {formatNumero(lote.cantidadDisponibleNum)} {lote.unidadCodigo}
      </div>,

      // 5. Fecha Fabricación
      <div key={`fab-${lote.id_lote_producto}`} className="text-[#516972]">
        {formatFecha(lote.fecha_fabricacion)}
      </div>,

      // 6. Fecha Vencimiento
      <div key={`venc-${lote.id_lote_producto}`} className="flex items-center gap-1.5 text-[#516972]">
        <span>{formatFecha(lote.fecha_vencimiento)}</span>
        {lote.fecha_vencimiento && situacionVenc === "Vencido" && (
          <Badge tone="red">Vencido</Badge>
        )}
        {lote.fecha_vencimiento && situacionVenc === "Próximo a vencer" && (
          <Badge tone="amber">Próximo</Badge>
        )}
      </div>,

      // 7. Estado Lote
      <div key={`est-${lote.id_lote_producto}`}>
        <Badge tone={esPendiente ? "amber" : "blue"}>
          {esPendiente ? "Pendiente" : "Recibido"}
        </Badge>
      </div>,

      // 8. Ubicación (Permanence null / '-')
      <div key={`ubic-${lote.id_lote_producto}`} className="text-[11px] italic text-[#95a5aa]">
        {esPendiente ? "Sin recepción" : "Sin ubicar"}
      </div>,

      // 9. Acciones específicas
      <div key={`acc-${lote.id_lote_producto}`} className="flex items-center gap-2 justify-end">
        {esPendiente && (
          <button
            type="button"
            onClick={() => handleConfirmarRecepcion(lote)}
            className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#fae0ab] bg-[#fff6e6] px-2.5 py-1 text-[11px] font-semibold text-[#935f14] transition-colors hover:bg-[#ffeed0]"
          >
            <CheckCircle2 size={12} />
            <span>Confirmar Recepción</span>
          </button>
        )}

        {esRecibido && (
          <button
            type="button"
            onClick={() => abrirModalUbicar(lote)}
            className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#bdd8e1] bg-[#e9f2f5] px-2.5 py-1 text-[11px] font-semibold text-[#145c73] transition-colors hover:bg-[#d8e9ef]"
          >
            <MapPinCheck size={12} />
            <span>Asignar Ubicación</span>
          </button>
        )}
      </div>,
    ];
  });

  // -------------------------------------------------------------------------
  // Filas para Tabla Pestaña 2 ("Mover Lotes")
  // -------------------------------------------------------------------------
  const rowsMover = lotesPestanaMover.map((lote) => {
    const situacionVenc = obtenerSituacion(lote.fecha_vencimiento);

    return [
      // 1. N° Lote
      <div key={`nro-${lote.id_lote_producto}`} className="flex flex-col">
        <span className="font-mono font-semibold text-[#145c73]">{lote.nro_lote}</span>
        <span className="text-[9px] text-[#86979c]">
          {lote.origen_lote === "I"
            ? "Lote Externo / Inicial"
            : lote.id_produccion
            ? `OP #${lote.id_produccion}`
            : "Producción"}
        </span>
      </div>,

      // 2. Producto
      <div key={`prod-${lote.id_lote_producto}`} className="max-w-[220px]">
        <strong className="block truncate font-medium text-[#214451]" title={lote.productoNombre}>
          {lote.productoNombre}
        </strong>
        <span className="font-mono text-[10px] text-[#71858c]">{lote.productoCodigo}</span>
      </div>,

      // 3. Cantidad Total
      <div key={`tot-${lote.id_lote_producto}`} className="text-right font-medium text-[#214451]">
        <span>{formatNumero(lote.cantidadTotalNum)}</span>{" "}
        <span className="text-[10px] text-[#7d9096]">{lote.unidadCodigo}</span>
      </div>,

      // 4. Cantidad Disponible
      <div key={`disp-${lote.id_lote_producto}`} className="text-right font-semibold text-[#287955]">
        {formatNumero(lote.cantidadDisponibleNum)} {lote.unidadCodigo}
      </div>,

      // 5. Fecha Fabricación
      <div key={`fab-${lote.id_lote_producto}`} className="text-[#516972]">
        {formatFecha(lote.fecha_fabricacion)}
      </div>,

      // 6. Fecha Vencimiento
      <div key={`venc-${lote.id_lote_producto}`} className="flex items-center gap-1.5 text-[#516972]">
        <span>{formatFecha(lote.fecha_vencimiento)}</span>
        {lote.fecha_vencimiento && situacionVenc === "Vencido" && (
          <Badge tone="red">Vencido</Badge>
        )}
        {lote.fecha_vencimiento && situacionVenc === "Próximo a vencer" && (
          <Badge tone="amber">Próximo</Badge>
        )}
      </div>,

      // 7. Estado Lote
      <div key={`est-${lote.id_lote_producto}`}>
        <Badge tone="green">Ubicado</Badge>
      </div>,

      // 8. Ubicación Actual
      <div key={`ubic-${lote.id_lote_producto}`}>
        <span className="inline-flex items-center gap-1 rounded bg-[#e8f1f4] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#145c73]">
          <MapPin size={11} />
          {lote.ubicacionActualCodigo || "—"}
        </span>
      </div>,

      // 9. Acciones: Mover Lote e Historial de movimientos
      <div key={`acc-${lote.id_lote_producto}`} className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={() => abrirModalMover(lote)}
          className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#bdd8e1] bg-[#e9f2f5] px-2.5 py-1 text-[11px] font-semibold text-[#145c73] transition-colors hover:bg-[#d8e9ef]"
        >
          <ArrowRightLeft size={12} />
          <span>Mover Lote</span>
        </button>

        <button
          type="button"
          onClick={() => abrirModalHistorial(lote)}
          className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#dfe7e9] bg-white px-2 py-1 text-[11px] font-medium text-[#587078] transition-colors hover:bg-[#f4f7f8]"
          title="Ver historial de movimientos del lote"
        >
          <History size={12} />
          <span>Historial</span>
        </button>
      </div>,
    ];
  });

  return (
    <>
      <SectionTitle
        eyebrow="04 · CONTROL DE DEPÓSITO"
        title="Ubicar Lotes"
        description="Recepción de lotes de producción y externos, asignación de posiciones físicas en depósito y traslados."
        action={
          <button
            type="button"
            onClick={cargar}
            title="Recargar datos"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#dfe7e9] bg-white px-3 text-[12px] font-medium text-[#556d75] transition-colors hover:bg-[#f4f7f8]"
          >
            <RotateCcw size={14} />
            <span>Actualizar</span>
          </button>
        }
      />

      {/* Tarjetas KPI */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi
          icon={Clock}
          label="Pendientes de recepción (P)"
          value={kpis.pendientes}
          trend={`${kpis.pendientes} lotes`}
          note="Requieren confirmar recepción"
          tone="amber"
        />
        <Kpi
          icon={MapPinCheck}
          label="Recibidos por ubicar (R)"
          value={kpis.recibidos}
          trend={`${kpis.recibidos} lotes`}
          note="Listos para asignar posición"
          tone="blue"
        />
        <Kpi
          icon={CheckCircle2}
          label="Lotes ubicados (U)"
          value={kpis.ubicados}
          trend={`${kpis.ubicados} lotes`}
          note="Con posición activa"
          tone="green"
        />
        <Kpi
          icon={WarehouseIcon}
          label="Posiciones libres (D)"
          value={kpis.posDisponibles}
          trend="Disponibles"
          note="Capacidad libre para ubicar"
          tone="green"
        />
        <Kpi
          icon={Layers}
          label="Posiciones ocupadas (O)"
          value={kpis.posOcupadas}
          trend="Ocupadas"
          note="Con lote almacenado"
          tone="slate"
        />
      </div>

      {/* Pestañas del Módulo */}
      <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
        {/* Selector de pestañas */}
        <div className="mb-4 flex flex-col gap-3 border-b border-[#edf1f2] pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("ubicar")}
              className={`flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-2 text-[13px] font-semibold transition-all ${
                activeTab === "ubicar"
                  ? "bg-[#145c73] text-white shadow-sm"
                  : "bg-[#f4f7f8] text-[#556e77] hover:bg-[#e9f0f3] hover:text-[#173d4b]"
              }`}
            >
              <MapPinCheck size={15} />
              <span>Ubicar Lotes</span>
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeTab === "ubicar"
                    ? "bg-white/20 text-white"
                    : "bg-[#e1e9ec] text-[#425860]"
                }`}
              >
                {lotesPestanaUbicar.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("mover")}
              className={`flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-2 text-[13px] font-semibold transition-all ${
                activeTab === "mover"
                  ? "bg-[#145c73] text-white shadow-sm"
                  : "bg-[#f4f7f8] text-[#556e77] hover:bg-[#e9f0f3] hover:text-[#173d4b]"
              }`}
            >
              <ArrowRightLeft size={15} />
              <span>Mover Lotes</span>
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeTab === "mover"
                    ? "bg-white/20 text-white"
                    : "bg-[#e1e9ec] text-[#425860]"
                }`}
              >
                {lotesPestanaMover.length}
              </span>
            </button>
          </div>

          {/* Buscador */}
          <div className="relative w-full sm:w-72">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#82979e]"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por lote, producto o código..."
              className="h-9 w-full rounded-md border border-[#dfe7e9] bg-white pl-9 pr-3 text-[12px] text-[#173d4b] outline-none transition-colors focus:border-[#214451]"
            />
          </div>
        </div>

        {/* Contenido Pestaña 1: Ubicar Lotes (P y R) */}
        {activeTab === "ubicar" && (
          <div>
            <div className="mb-3 rounded-md bg-[#f7fafb] px-3.5 py-2 text-[11.5px] text-[#587078] flex items-center justify-between">
              <span>
                Mostrando lotes <strong>Pendientes (P)</strong> para recepción y{" "}
                <strong>Recibidos (R)</strong> listos para asignar ubicación física.
              </span>
              <span className="text-[10.5px] text-[#86999f]">
                {lotesPestanaUbicar.length} lotes encontrados
              </span>
            </div>

            <Table
              headers={[
                "N° Lote",
                "Producto",
                "Cantidad Total",
                "Cant. Disponible",
                "Fec. Fabricación",
                "Fec. Vencimiento",
                "Estado Lote",
                "Ubicación",
                "Acciones",
              ]}
              rows={rowsUbicar}
            />

            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 text-[#91a0a4]">
                <RotateCcw className="mb-2 h-5 w-5 animate-spin text-[#145c73]" />
                <p className="text-[12px]">Cargando lotes...</p>
              </div>
            ) : (
              rowsUbicar.length === 0 && (
                <div className="py-10 text-center text-[#91a0a4]">
                  <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-[#98aab0]" />
                  <p className="text-[13px] font-semibold text-[#50666e]">
                    No hay lotes pendientes de recepción o ubicación
                  </p>
                  <p className="text-[11px] text-[#86999f]">
                    Todos los lotes activos se encuentran ubicados en depósito.
                  </p>
                </div>
              )
            )}
          </div>
        )}

        {/* Contenido Pestaña 2: Mover Lotes (U) */}
        {activeTab === "mover" && (
          <div>
            <div className="mb-3 rounded-md bg-[#f7fafb] px-3.5 py-2 text-[11.5px] text-[#587078] flex items-center justify-between">
              <span>
                Mostrando lotes <strong>Ubicados (U)</strong> con su posición física actual para
                traslados o consulta de trazabilidad.
              </span>
              <span className="text-[10.5px] text-[#86999f]">
                {lotesPestanaMover.length} lotes ubicados
              </span>
            </div>

            <Table
              headers={[
                "N° Lote",
                "Producto",
                "Cantidad Total",
                "Cant. Disponible",
                "Fec. Fabricación",
                "Fec. Vencimiento",
                "Estado Lote",
                "Ubicación Actual",
                "Acciones",
              ]}
              rows={rowsMover}
            />

            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 text-[#91a0a4]">
                <RotateCcw className="mb-2 h-5 w-5 animate-spin text-[#145c73]" />
                <p className="text-[12px]">Cargando lotes ubicados...</p>
              </div>
            ) : (
              rowsMover.length === 0 && (
                <div className="py-10 text-center text-[#91a0a4]">
                  <Boxes className="mx-auto mb-2 h-8 w-8 text-[#98aab0]" />
                  <p className="text-[13px] font-semibold text-[#50666e]">
                    No se encontraron lotes ubicados
                  </p>
                  <p className="text-[11px] text-[#86999f]">
                    Comenzá asignando ubicaciones en la pestaña "Ubicar Lotes".
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* =====================================================================
          MODAL: ASIGNAR UBICACIÓN (Lote en estado R)
          Ejecuta: SELECT deposito.fn_ubicar_lote(id_lote, id_posicion, 'Usuario')
         ===================================================================== */}
      <Dialog open={modalUbicarOpen} onOpenChange={setModalUbicarOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="max-w-2xl bg-white p-6 sm:rounded-lg max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold text-[#173d4b]">
              <MapPinCheck size={18} className="text-[#145c73]" />
              Asignar Ubicación al Lote
            </DialogTitle>
            <DialogDescription className="text-[12px] text-[#72848c]">
              Seleccioná el depósito, la zona y elegí una casilla disponible de la grilla.
            </DialogDescription>
          </DialogHeader>

          {/* Ficha resumen del lote a ubicar */}
          {loteParaUbicar && (
            <div className="rounded-lg border border-[#d8e6eb] bg-[#f4f9fb] p-3 text-[11.5px] text-[#334e58]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-[#145c73] font-mono text-[13px]">
                    {loteParaUbicar.nro_lote}
                  </span>
                  <span className="mx-2 text-[#9bb0b7]">·</span>
                  <strong className="text-[#193d4b]">{loteParaUbicar.productoNombre}</strong>
                  <span className="ml-1 text-[10.5px] text-[#72848c]">
                    ({loteParaUbicar.productoCodigo})
                  </span>
                </div>
                <Badge tone="blue">Recibido (R)</Badge>
              </div>

              <div className="mt-1 flex gap-4 text-[11px] text-[#637a82]">
                <span>
                  Cantidad Total:{" "}
                  <strong>
                    {formatNumero(loteParaUbicar.cantidadTotalNum)} {loteParaUbicar.unidadCodigo}
                  </strong>
                </span>
                <span>
                  Disponible:{" "}
                  <strong className="text-[#256349]">
                    {formatNumero(loteParaUbicar.cantidadDisponibleNum)}{" "}
                    {loteParaUbicar.unidadCodigo}
                  </strong>
                </span>
              </div>
            </div>
          )}

          <div className="mt-3 space-y-4">
            {/* a. Selección de Depósito y b. Selección de Zona */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className={labelCls}>a. Depósito</Label>
                <select
                  value={selectedDepositoId}
                  onChange={(e) => {
                    const did = e.target.value;
                    setSelectedDepositoId(did);
                    const zList = zonas.filter((z) => Number(z.id_deposito) === Number(did));
                    setSelectedZonaId(zList[0]?.id_zona ? String(zList[0].id_zona) : "");
                    setSelectedPosicion(null);
                  }}
                  className={selectCls}
                >
                  <option value="">-- Seleccionar depósito --</option>
                  {depositos.map((d) => (
                    <option key={d.id_deposito} value={d.id_deposito}>
                      [{d.codigo}] {d.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className={labelCls}>b. Zona de almacenamiento</Label>
                <select
                  value={selectedZonaId}
                  onChange={(e) => {
                    setSelectedZonaId(e.target.value);
                    setSelectedPosicion(null);
                  }}
                  className={selectCls}
                >
                  <option value="">-- Seleccionar zona --</option>
                  {zonasDisponiblesModal.map((z) => (
                    <option key={z.id_zona} value={z.id_zona}>
                      Zona {z.codigo} - {z.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* c. Grilla numérica de posiciones */}
            <div>
              <div className="flex flex-wrap items-center justify-between mb-2">
                <Label className={labelCls}>
                  c. Posiciones en la Zona ({posicionesZonaSeleccionada.length} posiciones)
                </Label>

                {/* Referencias de colores */}
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="flex items-center gap-1 text-[#1e6b49]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#1e6b49]" /> D: Disponible
                  </span>
                  <span className="flex items-center gap-1 text-[#145c73]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#145c73]" /> O: Ocupada
                  </span>
                  <span className="flex items-center gap-1 text-[#a76e1a]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#a76e1a]" /> R: Reservada
                  </span>
                  <span className="flex items-center gap-1 text-[#ba584d]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ba584d]" /> B: Bloqueada
                  </span>
                  <span className="flex items-center gap-1 text-[#714194]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#714194]" /> M: Mantenimiento
                  </span>
                </div>
              </div>

              {posicionesZonaSeleccionada.length === 0 ? (
                <div className="rounded-md border border-dashed border-[#d2dde0] p-6 text-center text-[12px] text-[#7d9096]">
                  Seleccioná un depósito y una zona para cargar la grilla de posiciones.
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-lg border border-[#dfe7e9] bg-[#fbfcfc] p-2.5">
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8">
                    {posicionesZonaSeleccionada.map((pos) => {
                      const meta = ESTADO_POSICION_META[pos.estado_posicion] || ESTADO_POSICION_META.D;
                      const isSelected = selectedPosicion?.id_posicion === pos.id_posicion;

                      return (
                        <button
                          key={pos.id_posicion}
                          type="button"
                          onClick={() => setSelectedPosicion(pos)}
                          className={`flex h-11 cursor-pointer flex-col items-center justify-center rounded-md border text-center transition-all ${
                            meta.cellClass
                          } ${
                            isSelected
                              ? "ring-2 ring-[#145c73] ring-offset-1 font-bold shadow-md scale-105"
                              : "opacity-90"
                          }`}
                          title={`[${pos.codigo}] - Estado: ${meta.label}`}
                        >
                          <span className="font-mono text-[10px] leading-tight">
                            {pos.codigo.replace(/^[A-Z]-/, "")}
                          </span>
                          <span className="text-[8.5px] font-bold uppercase tracking-wider">
                            {pos.estado_posicion}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* d. Datos de la casilla seleccionada */}
            <div className="rounded-lg border border-[#dfe7e9] bg-white p-3 text-[11.5px]">
              <span className="block font-bold uppercase tracking-widest text-[9.5px] text-[#7b8f96] mb-1">
                d. Detalle de la casilla seleccionada
              </span>

              {selectedPosicion ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
                  <div>
                    <span className="text-[10px] text-[#86999f] block">Código Posición:</span>
                    <strong className="font-mono text-[#145c73] text-[12.5px]">
                      {selectedPosicion.codigo}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#86999f] block">Estado Posición:</span>
                    <Badge tone={ESTADO_POSICION_META[selectedPosicion.estado_posicion]?.tone || "slate"}>
                      {selectedPosicion.estado_posicion} ·{" "}
                      {ESTADO_POSICION_META[selectedPosicion.estado_posicion]?.label}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#86999f] block">Capacidad (kg):</span>
                    <strong className="text-[#204452]">
                      {selectedPosicion.capacidad_kg ? `${selectedPosicion.capacidad_kg} kg` : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#86999f] block">Capacidad (m³):</span>
                    <strong className="text-[#204452]">
                      {selectedPosicion.capacidad_m3 ? `${selectedPosicion.capacidad_m3} m³` : "—"}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-[#93a4a9] italic">
                  Hacé clic sobre una casilla en la grilla para ver sus detalles y seleccionarla.
                </div>
              )}

              {selectedPosicion && selectedPosicion.estado_posicion !== "D" && (
                <div className="mt-2 flex items-center gap-1.5 rounded bg-[#fdf2f0] p-2 text-[10.5px] text-[#ba584d]">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>
                    Atención: La posición se encuentra{" "}
                    <strong>{ESTADO_POSICION_META[selectedPosicion.estado_posicion]?.label}</strong>. Solo podés ubicar en posiciones Disponibles ('D').
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* e. Botón Confirmar Ubicación */}
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalUbicarOpen(false)}
              disabled={savingUbicar}
              className="h-9 border-[#dfe7e9] text-[12px] text-[#556d75]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarUbicacion}
              disabled={savingUbicar || !selectedPosicion || selectedPosicion.estado_posicion !== "D"}
              className="h-9 bg-[#145c73] text-[12px] font-semibold text-white hover:bg-[#0f4657]"
            >
              {savingUbicar ? "Asignando..." : "Confirmar Ubicación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =====================================================================
          MODAL: MOVER LOTE (Lote en estado U)
          Ejecuta: SELECT deposito.fn_trasladar_lote(id_lote, id_posicion_destino, 'Usuario')
         ===================================================================== */}
      <Dialog open={modalMoverOpen} onOpenChange={setModalMoverOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="max-w-2xl bg-white p-6 sm:rounded-lg max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold text-[#173d4b]">
              <ArrowRightLeft size={18} className="text-[#145c73]" />
              Mover Lote a Nueva Posición
            </DialogTitle>
            <DialogDescription className="text-[12px] text-[#72848c]">
              Seleccioná el depósito destino, la zona y elegí una posición disponible.
            </DialogDescription>
          </DialogHeader>

          {/* Ficha resumen del lote y ubicación actual */}
          {loteParaMover && (
            <div className="rounded-lg border border-[#d8e6eb] bg-[#f4f9fb] p-3 text-[11.5px] text-[#334e58]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-[#145c73] font-mono text-[13px]">
                    {loteParaMover.nro_lote}
                  </span>
                  <span className="mx-2 text-[#9bb0b7]">·</span>
                  <strong className="text-[#193d4b]">{loteParaMover.productoNombre}</strong>
                  <span className="ml-1 text-[10.5px] text-[#72848c]">
                    ({loteParaMover.productoCodigo})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#7b8f96]">Ubicación actual:</span>
                  <span className="inline-flex items-center gap-1 rounded bg-[#e8f1f4] px-2 py-0.5 font-mono text-[11px] font-bold text-[#145c73]">
                    <MapPin size={11} />
                    {loteParaMover.ubicacionActualCodigo || "—"}
                  </span>
                </div>
              </div>

              <div className="mt-1 flex gap-4 text-[11px] text-[#637a82]">
                <span>
                  Cantidad Total:{" "}
                  <strong>
                    {formatNumero(loteParaMover.cantidadTotalNum)} {loteParaMover.unidadCodigo}
                  </strong>
                </span>
                <span>
                  Disponible:{" "}
                  <strong className="text-[#256349]">
                    {formatNumero(loteParaMover.cantidadDisponibleNum)}{" "}
                    {loteParaMover.unidadCodigo}
                  </strong>
                </span>
              </div>
            </div>
          )}

          <div className="mt-3 space-y-4">
            {/* a. Selección de Depósito Destino y b. Zona Destino */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className={labelCls}>a. Depósito Destino</Label>
                <select
                  value={selectedDepositoMoverId}
                  onChange={(e) => {
                    const did = e.target.value;
                    setSelectedDepositoMoverId(did);
                    const zList = zonas.filter((z) => Number(z.id_deposito) === Number(did));
                    setSelectedZonaMoverId(zList[0]?.id_zona ? String(zList[0].id_zona) : "");
                    setSelectedPosicionMover(null);
                  }}
                  className={selectCls}
                >
                  <option value="">-- Seleccionar depósito --</option>
                  {depositos.map((d) => (
                    <option key={d.id_deposito} value={d.id_deposito}>
                      [{d.codigo}] {d.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className={labelCls}>b. Zona Destino</Label>
                <select
                  value={selectedZonaMoverId}
                  onChange={(e) => {
                    setSelectedZonaMoverId(e.target.value);
                    setSelectedPosicionMover(null);
                  }}
                  className={selectCls}
                >
                  <option value="">-- Seleccionar zona --</option>
                  {zonasDisponiblesMoverModal.map((z) => (
                    <option key={z.id_zona} value={z.id_zona}>
                      Zona {z.codigo} - {z.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* c. Grilla numérica de posiciones de la zona destino */}
            <div>
              <div className="flex flex-wrap items-center justify-between mb-2">
                <Label className={labelCls}>
                  c. Posiciones en Zona ({posicionesZonaMover.length} posiciones)
                </Label>

                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="flex items-center gap-1 text-[#1e6b49]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#1e6b49]" /> D: Disponible
                  </span>
                  <span className="flex items-center gap-1 text-[#145c73]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#145c73]" /> O: Ocupada
                  </span>
                  <span className="flex items-center gap-1 text-[#a76e1a]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#a76e1a]" /> R: Reservada
                  </span>
                  <span className="flex items-center gap-1 text-[#ba584d]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ba584d]" /> B: Bloqueada
                  </span>
                  <span className="flex items-center gap-1 text-[#714194]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#714194]" /> M: Mantenimiento
                  </span>
                </div>
              </div>

              {posicionesZonaMover.length === 0 ? (
                <div className="rounded-md border border-dashed border-[#d2dde0] p-6 text-center text-[12px] text-[#7d9096]">
                  Seleccioná depósito y zona destino para visualizar las casillas.
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-lg border border-[#dfe7e9] bg-[#fbfcfc] p-2.5">
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8">
                    {posicionesZonaMover.map((pos) => {
                      const meta = ESTADO_POSICION_META[pos.estado_posicion] || ESTADO_POSICION_META.D;
                      const isSelected = selectedPosicionMover?.id_posicion === pos.id_posicion;
                      const isCurrentPos = loteParaMover?.idPosicionActual === pos.id_posicion;

                      return (
                        <button
                          key={pos.id_posicion}
                          type="button"
                          onClick={() => setSelectedPosicionMover(pos)}
                          className={`flex h-11 cursor-pointer flex-col items-center justify-center rounded-md border text-center transition-all ${
                            meta.cellClass
                          } ${
                            isSelected
                              ? "ring-2 ring-[#145c73] ring-offset-1 font-bold shadow-md scale-105"
                              : isCurrentPos
                              ? "border-dashed border-[#145c73] font-bold"
                              : "opacity-90"
                          }`}
                          title={`[${pos.codigo}] - ${isCurrentPos ? "Posición Actual del lote" : meta.label}`}
                        >
                          <span className="font-mono text-[10px] leading-tight">
                            {pos.codigo.replace(/^[A-Z]-/, "")}
                          </span>
                          <span className="text-[8.5px] font-bold uppercase tracking-wider">
                            {isCurrentPos ? "ACTUAL" : pos.estado_posicion}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* d. Datos de la casilla destino seleccionada */}
            <div className="rounded-lg border border-[#dfe7e9] bg-white p-3 text-[11.5px]">
              <span className="block font-bold uppercase tracking-widest text-[9.5px] text-[#7b8f96] mb-1">
                d. Casilla destino seleccionada
              </span>

              {selectedPosicionMover ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
                  <div>
                    <span className="text-[10px] text-[#86999f] block">Código Destino:</span>
                    <strong className="font-mono text-[#145c73] text-[12.5px]">
                      {selectedPosicionMover.codigo}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#86999f] block">Estado:</span>
                    <Badge tone={ESTADO_POSICION_META[selectedPosicionMover.estado_posicion]?.tone || "slate"}>
                      {selectedPosicionMover.estado_posicion} ·{" "}
                      {ESTADO_POSICION_META[selectedPosicionMover.estado_posicion]?.label}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#86999f] block">Capacidad (kg):</span>
                    <strong className="text-[#204452]">
                      {selectedPosicionMover.capacidad_kg ? `${selectedPosicionMover.capacidad_kg} kg` : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#86999f] block">Capacidad (m³):</span>
                    <strong className="text-[#204452]">
                      {selectedPosicionMover.capacidad_m3 ? `${selectedPosicionMover.capacidad_m3} m³` : "—"}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-[#93a4a9] italic">
                  Elegí una casilla destino disponible de la grilla superior.
                </div>
              )}

              {selectedPosicionMover && selectedPosicionMover.id_posicion === loteParaMover?.idPosicionActual && (
                <div className="mt-2 flex items-center gap-1.5 rounded bg-[#fdf2f0] p-2 text-[10.5px] text-[#ba584d]">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>
                    La posición elegida es la misma en la que el lote se encuentra actualmente.
                  </span>
                </div>
              )}

              {selectedPosicionMover &&
                selectedPosicionMover.id_posicion !== loteParaMover?.idPosicionActual &&
                selectedPosicionMover.estado_posicion !== "D" && (
                  <div className="mt-2 flex items-center gap-1.5 rounded bg-[#fdf2f0] p-2 text-[10.5px] text-[#ba584d]">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>
                      Atención: La posición destino no está Disponible (Estado:{" "}
                      {ESTADO_POSICION_META[selectedPosicionMover.estado_posicion]?.label}).
                    </span>
                  </div>
                )}
            </div>
          </div>

          {/* e. Botón Confirmar Movimiento */}
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalMoverOpen(false)}
              disabled={savingMover}
              className="h-9 border-[#dfe7e9] text-[12px] text-[#556d75]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarMovimiento}
              disabled={
                savingMover ||
                !selectedPosicionMover ||
                selectedPosicionMover.estado_posicion !== "D" ||
                selectedPosicionMover.id_posicion === loteParaMover?.idPosicionActual
              }
              className="h-9 bg-[#145c73] text-[12px] font-semibold text-white hover:bg-[#0f4657]"
            >
              {savingMover ? "Moviendo..." : "Confirmar Movimiento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =====================================================================
          MODAL: HISTORIAL DE MOVIMIENTOS
          Despliega movimientos realizados por el lote en deposito.lote_posicion
         ===================================================================== */}
      <Dialog open={modalHistorialOpen} onOpenChange={setModalHistorialOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="max-w-2xl bg-white p-6 sm:rounded-lg max-h-[85vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold text-[#173d4b]">
              <History size={18} className="text-[#145c73]" />
              Historial de Movimientos de Lote
            </DialogTitle>
            <DialogDescription className="text-[12px] text-[#72848c]">
              Trazabilidad física de ubicaciones y traslados registrados para el lote.
            </DialogDescription>
          </DialogHeader>

          {loteHistorial && (
            <div className="rounded-lg border border-[#d8e6eb] bg-[#f4f9fb] p-3 text-[11.5px] text-[#334e58]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-[#145c73] font-mono text-[13px]">
                    {loteHistorial.nro_lote}
                  </span>
                  <span className="mx-2 text-[#9bb0b7]">·</span>
                  <strong className="text-[#193d4b]">{loteHistorial.productoNombre}</strong>
                </div>
                <span className="font-mono text-[11px] text-[#72848c]">
                  Código: {loteHistorial.productoCodigo}
                </span>
              </div>
            </div>
          )}

          {loadingHistorial ? (
            <div className="flex flex-col items-center justify-center py-8 text-[#91a0a4]">
              <RotateCcw className="mb-2 h-5 w-5 animate-spin text-[#145c73]" />
              <p className="text-[12px]">Cargando trazabilidad del lote...</p>
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              {/* Tabla de asignaciones de posiciones (deposito.lote_posicion) */}
              <div>
                <span className="block font-bold uppercase tracking-widest text-[10px] text-[#7b8f96] mb-1.5">
                  Registro de Ubicaciones Físicas (deposito.lote_posicion)
                </span>

                {historialPosiciones.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-[#91a0a4]">
                    No se registran ubicaciones previas para este lote.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-[#e7edef]">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-[#f7fafb] text-[9.5px] font-bold uppercase tracking-wider text-[#798e95] border-b border-[#e7edef]">
                        <tr>
                          <th className="px-3 py-2">ID</th>
                          <th className="px-3 py-2">Posición</th>
                          <th className="px-3 py-2">Fecha Asignación</th>
                          <th className="px-3 py-2">Estado</th>
                          <th className="px-3 py-2">Usuario Alta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f4f5]">
                        {historialPosiciones.map((item) => (
                          <tr
                            key={item.id_lote_posicion}
                            className={item.estado === "A" ? "bg-[#f3faf6]" : "hover:bg-[#fafcfc]"}
                          >
                            <td className="px-3 py-2 font-mono text-[#81949a]">
                              #{item.id_lote_posicion}
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1 font-mono font-bold text-[#145c73]">
                                <MapPin size={11} />
                                {item.posicionCodigo}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-[#4c636c]">
                              {formatDateTime(item.fecha_asignacion)}
                            </td>
                            <td className="px-3 py-2">
                              <Badge tone={item.estado === "A" ? "green" : "slate"}>
                                {item.estado === "A" ? "Activa (Actual)" : "Histórica"}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 font-mono text-[#62777f]">
                              {item.usu_alta || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Registro de movimientos (deposito.movimiento_lote si existen) */}
              {historialMovimientos.length > 0 && (
                <div>
                  <span className="block font-bold uppercase tracking-widest text-[10px] text-[#7b8f96] mb-1.5">
                    Detalle de Movimientos Registrados (deposito.movimiento_lote)
                  </span>

                  <div className="overflow-x-auto rounded-md border border-[#e7edef]">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-[#f7fafb] text-[9.5px] font-bold uppercase tracking-wider text-[#798e95] border-b border-[#e7edef]">
                        <tr>
                          <th className="px-3 py-2">Tipo</th>
                          <th className="px-3 py-2">Origen</th>
                          <th className="px-3 py-2">Destino</th>
                          <th className="px-3 py-2">Fecha</th>
                          <th className="px-3 py-2">Observación</th>
                          <th className="px-3 py-2">Usuario</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f4f5]">
                        {historialMovimientos.map((m) => (
                          <tr key={m.id_movimiento_lote} className="hover:bg-[#fafcfc]">
                            <td className="px-3 py-2 font-semibold text-[#1e4654]">
                              {m.tipo_movimiento}
                            </td>
                            <td className="px-3 py-2 font-mono text-[#617881]">
                              {m.posicionOrigenCodigo}
                            </td>
                            <td className="px-3 py-2 font-mono font-bold text-[#145c73]">
                              {m.posicionDestinoCodigo}
                            </td>
                            <td className="px-3 py-2 text-[#4c636c]">
                              {formatDateTime(m.fecha_movimiento)}
                            </td>
                            <td className="px-3 py-2 text-[#5e747d] italic">
                              {m.observacion || "—"}
                            </td>
                            <td className="px-3 py-2 font-mono text-[#62777f]">
                              {m.usu_alta || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalHistorialOpen(false)}
              className="h-9 border-[#dfe7e9] text-[12px] text-[#556d75]"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
