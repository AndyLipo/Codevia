import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  MapPin,
  Package,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  AlertTriangle,
  ArrowUpDown,
  X,
  Layers,
  Archive,
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

// Mapeo de estados de lote según requerimiento:
// P: Pendiente de Ubicación (campo ubicación permanece null)
// R: Recibidos por depósito (campo ubicación permanece null)
// U: Ubicado
// A: Agotado (aparece cesto de basura para eliminar: estado = 'E')
const ESTADO_LOTE_META = {
  P: {
    label: "Pendiente",
    descripcion: "Pendiente de Ubicación",
    tone: "amber",
  },
  R: {
    label: "Recibido",
    descripcion: "Recibido por depósito",
    tone: "blue",
  },
  U: {
    label: "Ubicado",
    descripcion: "Ubicado en depósito",
    tone: "green",
  },
  A: {
    label: "Agotado",
    descripcion: "Lote Agotado",
    tone: "slate",
  },
};

// Orden de visualización de lotes requerido:
// 1° Pendientes (P), 2° Recibidos (R), 3° Ubicados (U), 4° Agotados (A)
const ORDEN_ESTADO_LOTE = {
  P: 1,
  R: 2,
  U: 3,
  A: 4,
};

const formIngresoInicial = {
  idProducto: "",
  cantidad: "",
  fechaFabricacion: "",
  fechaVencimiento: "",
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

const formatNumero = (num) => {
  if (num == null || isNaN(num)) return "0";
  return Number(num).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
};

export default function Lotes({ fakeAction }) {
  const { user, token } = useAuth();
  const auditUser = user?.usuario_login || user?.usuario || "SISTEMA";

  // Datos principales
  const [lotes, setLotes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [stocksMap, setStocksMap] = useState(new Map());
  const [ubicacionesMap, setUbicacionesMap] = useState(new Map());
  const [ubicacionesZonaMap, setUbicacionesZonaMap] = useState(new Map());
  const [zonas, setZonas] = useState([]);
  const [unidadesMap, setUnidadesMap] = useState(new Map());
  const [loading, setLoading] = useState(true);

  // Filtros y búsquedas
  const [search, setSearch] = useState("");
  const [estadoLoteFilter, setEstadoLoteFilter] = useState("ALL");
  const [ubicacionFilter, setUbicacionFilter] = useState("ALL");
  const [estadoRegistroFilter, setEstadoRegistroFilter] = useState("A"); // Por defecto lotes activos

  // Modal Ingreso de Lote Externo
  const [modalIngresoOpen, setModalIngresoOpen] = useState(false);
  const [formIngreso, setFormIngreso] = useState(formIngresoInicial);
  const [productoSearchInput, setProductoSearchInput] = useState("");
  const [productoDropdownOpen, setProductoDropdownOpen] = useState(false);
  const productoDropdownRef = useRef(null);
  const [savingIngreso, setSavingIngreso] = useState(false);
  const [errorIngresoMsg, setErrorIngresoMsg] = useState(null);

  // Modal Eliminación de Lote Agotado
  const [loteAEliminar, setLoteAEliminar] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Cierre del dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        productoDropdownRef.current &&
        !productoDropdownRef.current.contains(event.target)
      ) {
        setProductoDropdownOpen(false);
      }
    };

    if (productoDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [productoDropdownOpen]);

  // Carga de datos completos
  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [
        resLotes,
        resProductos,
        resUnidades,
        resStocks,
        resLotePos,
        resPos,
        resZonas,
        resPasillos,
        resModulos,
        resNiveles,
      ] = await Promise.all([
        supabase
          .schema("produccion")
          .from("lote_producto")
          .select(
            "id_lote_producto, id_produccion, id_producto, nro_lote, fecha_fabricacion, fecha_vencimiento, cantidad_total, estado_lote, estado, usu_alta, fec_alta, usu_mod, fec_mod, origen_lote"
          )
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
          .from("posicion")
          .select("id_posicion, id_nivel, codigo, estado")
          .eq("estado", "A"),

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
      ]);

      if (resLotes.error) throw resLotes.error;
      if (resProductos.error) throw resProductos.error;

      // Mapa de unidades de medida
      const mapUnidades = new Map();
      for (const u of resUnidades.data || []) {
        mapUnidades.set(Number(u.id_unidad_medida), u.codigo || u.nombre);
      }
      setUnidadesMap(mapUnidades);

      // Mapa de stocks: id_lote_producto -> stock row
      const mapStocks = new Map();
      for (const st of resStocks.data || []) {
        mapStocks.set(Number(st.id_lote_producto), st);
      }
      setStocksMap(mapStocks);

      // Jerarquía de depósito para resolver a qué zona pertenece cada posición
      const zonasActivas = resZonas.data || [];
      setZonas(zonasActivas);

      const mapZonaById = new Map();
      for (const z of zonasActivas) {
        mapZonaById.set(Number(z.id_zona), z);
      }

      const mapPasilloZona = new Map();
      for (const pas of resPasillos.data || []) {
        mapPasilloZona.set(Number(pas.id_pasillo), Number(pas.id_zona));
      }

      const mapModuloPasillo = new Map();
      for (const mod of resModulos.data || []) {
        mapModuloPasillo.set(Number(mod.id_modulo), Number(mod.id_pasillo));
      }

      const mapNivelModulo = new Map();
      for (const niv of resNiveles.data || []) {
        mapNivelModulo.set(Number(niv.id_nivel), Number(niv.id_modulo));
      }

      // Mapa de posiciones: id_posicion -> { codigo, id_zona, zona_codigo }
      const mapPosCodigos = new Map();
      const mapPosZonaInfo = new Map();
      for (const p of resPos.data || []) {
        const idPos = Number(p.id_posicion);
        const idMod = mapNivelModulo.get(Number(p.id_nivel));
        const idPas = idMod != null ? mapModuloPasillo.get(idMod) : null;
        const idZona = idPas != null ? mapPasilloZona.get(idPas) : null;
        const zonaObj = idZona != null ? mapZonaById.get(idZona) : null;

        mapPosCodigos.set(idPos, p.codigo);
        mapPosZonaInfo.set(idPos, {
          id_zona: idZona ?? null,
          zona_codigo: zonaObj?.codigo ? String(zonaObj.codigo).trim() : null,
        });
      }

      // Mapa de ubicaciones activas: id_lote_producto -> codigo_posicion y zona
      const mapUbic = new Map();
      const mapUbicZona = new Map();
      for (const lp of resLotePos.data || []) {
        const idLote = Number(lp.id_lote_producto);
        const idPos = Number(lp.id_posicion);
        const codigoPos = mapPosCodigos.get(idPos);
        if (codigoPos) {
          mapUbic.set(idLote, codigoPos);
          const zInfo = mapPosZonaInfo.get(idPos);
          if (zInfo) {
            mapUbicZona.set(idLote, zInfo);
          }
        }
      }
      setUbicacionesMap(mapUbic);
      setUbicacionesZonaMap(mapUbicZona);

      setLotes(resLotes.data || []);
      setProductos(resProductos.data || []);
    } catch (err) {
      console.error("Error al cargar datos de lotes:", err);
      toast.error(err.message || "No se pudo cargar la información de lotes");
      setLotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Mapa rápido de producto por ID
  const productosMap = useMemo(() => {
    const map = new Map();
    for (const p of productos) {
      map.set(Number(p.id_producto), p);
    }
    return map;
  }, [productos]);

  // Lista enriquecida con cálculo de stock disponible y ubicación
  const lotesEnriquecidos = useMemo(() => {
    return lotes.map((lote) => {
      const prod = productosMap.get(Number(lote.id_producto));
      const stock = stocksMap.get(Number(lote.id_lote_producto));

      const cantTotal = Number(lote.cantidad_total || 0);
      const cantReservada = Number(stock?.cantidad_reservada || 0);
      const cantConsumida = Number(stock?.cantidad_consumida || 0);

      // Cálculo de lo que queda considerando cantidad_total, cantidad_reservada y cantidad_consumida
      const cantDisponible = Math.max(0, cantTotal - cantReservada - cantConsumida);

      const unidadCodigo = prod?.id_unidad_medida
        ? unidadesMap.get(Number(prod.id_unidad_medida)) || ""
        : "";

      // Estados: P y R permanecen con ubicación NULL según especificación
      let ubicacionCodigo = null;
      let ubicacionIdZona = null;
      let ubicacionZonaCodigo = null;
      if (lote.estado_lote === "U") {
        const idLote = Number(lote.id_lote_producto);
        ubicacionCodigo = ubicacionesMap.get(idLote) || null;
        const zInfo = ubicacionesZonaMap.get(idLote);
        if (zInfo) {
          ubicacionIdZona = zInfo.id_zona ?? null;
          ubicacionZonaCodigo = zInfo.zona_codigo ?? null;
        }
      }

      return {
        ...lote,
        productoCodigo: prod?.codigo || "—",
        productoNombre: prod?.nombre || "Producto no especificado",
        unidadCodigo,
        cantidadTotalNum: cantTotal,
        cantidadReservadaNum: cantReservada,
        cantidadConsumidaNum: cantConsumida,
        cantidadDisponibleNum: cantDisponible,
        ubicacionCodigo,
        ubicacionIdZona,
        ubicacionZonaCodigo,
      };
    });
  }, [lotes, productosMap, stocksMap, ubicacionesMap, ubicacionesZonaMap, unidadesMap]);

  // Métricas / KPIs
  const stats = useMemo(() => {
    const activos = lotesEnriquecidos.filter((l) => l.estado !== "E");
    const total = activos.length;
    const ubicados = activos.filter((l) => l.estado_lote === "U").length;
    const pendientes = activos.filter(
      (l) => l.estado_lote === "P" || l.estado_lote === "R"
    ).length;
    const agotados = activos.filter((l) => l.estado_lote === "A").length;
    const stockTotalDisp = activos.reduce(
      (acc, l) => acc + l.cantidadDisponibleNum,
      0
    );

    return {
      total,
      ubicados,
      pendientes,
      agotados,
      stockTotalDisp,
    };
  }, [lotesEnriquecidos]);

  // Filtrado de la tabla principal
  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    const zonaSeleccionada =
      ubicacionFilter !== "ALL"
        ? zonas.find((z) => String(z.id_zona) === String(ubicacionFilter))
        : null;
    const codZonaSel = zonaSeleccionada?.codigo
      ? String(zonaSeleccionada.codigo).trim().toUpperCase()
      : null;

    const items = lotesEnriquecidos.filter((l) => {
      // Filtro de estado general (Activo / Eliminado)
      if (estadoRegistroFilter !== "ALL" && l.estado !== estadoRegistroFilter) {
        return false;
      }

      // Filtro de estado de lote (P, R, U, A)
      if (estadoLoteFilter !== "ALL" && l.estado_lote !== estadoLoteFilter) {
        return false;
      }

      // Filtro de ubicación por Zona de depósito (ALL incluye todas las ubicaciones y también los que no tienen ubicación)
      if (ubicacionFilter !== "ALL") {
        if (!l.ubicacionCodigo) {
          return false;
        }
        const matchByIdZona =
          l.ubicacionIdZona != null &&
          String(l.ubicacionIdZona) === String(ubicacionFilter);
        const codUbicUpper = String(l.ubicacionCodigo).trim().toUpperCase();
        const matchByPrefix =
          codZonaSel &&
          (String(l.ubicacionZonaCodigo || "").toUpperCase() === codZonaSel ||
            codUbicUpper === codZonaSel ||
            codUbicUpper.startsWith(`${codZonaSel}-`) ||
            codUbicUpper.startsWith(`Z${codZonaSel}-`) ||
            codUbicUpper.startsWith(`ZONA-${codZonaSel}`));

        if (!matchByIdZona && !matchByPrefix) {
          return false;
        }
      }

      // Búsqueda en nro_lote, producto, código o ubicación
      if (q) {
        const matchNro = String(l.nro_lote || "").toLowerCase().includes(q);
        const matchProd = String(l.productoNombre || "").toLowerCase().includes(q);
        const matchCod = String(l.productoCodigo || "").toLowerCase().includes(q);
        const matchUbic = String(l.ubicacionCodigo || "").toLowerCase().includes(q);
        if (!matchNro && !matchProd && !matchCod && !matchUbic) {
          return false;
        }
      }

      return true;
    });

    return items.sort((a, b) => {
      const ordenA = ORDEN_ESTADO_LOTE[a.estado_lote] ?? 99;
      const ordenB = ORDEN_ESTADO_LOTE[b.estado_lote] ?? 99;
      if (ordenA !== ordenB) {
        return ordenA - ordenB;
      }
      return Number(b.id_lote_producto) - Number(a.id_lote_producto);
    });
  }, [
    lotesEnriquecidos,
    search,
    estadoLoteFilter,
    ubicacionFilter,
    estadoRegistroFilter,
    zonas,
  ]);

  // Abrir modal de Ingreso de Lote Externo
  const abrirModalIngreso = () => {
    setFormIngreso(formIngresoInicial);
    setProductoSearchInput("");
    setProductoDropdownOpen(false);
    setErrorIngresoMsg(null);
    setModalIngresoOpen(true);
  };

  // Autocalcular fecha de vencimiento según vida útil del producto si se ingresó fecha de fabricación
  const autocalcularVencimiento = () => {
    if (!formIngreso.idProducto || !formIngreso.fechaFabricacion) {
      toast.info("Seleccioná un producto y una fecha de fabricación primero.");
      return;
    }
    const prod = productosMap.get(Number(formIngreso.idProducto));
    if (!prod || !prod.vida_util_meses) {
      toast.info("Este producto no tiene configurada una vida útil en meses.");
      return;
    }

    const [y, m, d] = formIngreso.fechaFabricacion.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setMonth(date.getMonth() + Number(prod.vida_util_meses));

    const vy = date.getFullYear();
    const vm = String(date.getMonth() + 1).padStart(2, "0");
    const vd = String(date.getDate()).padStart(2, "0");

    setFormIngreso((prev) => ({
      ...prev,
      fechaVencimiento: `${vy}-${vm}-${vd}`,
    }));
    toast.success(`Vencimiento calculado a +${prod.vida_util_meses} meses.`);
  };

  // Enviar formulario de Ingreso de Lote Externo
  const handleIngresarLoteExterno = async (e) => {
    e.preventDefault();
    if (!formIngreso.idProducto) {
      toast.error("Por favor seleccioná un producto.");
      return;
    }
    const cant = parseFloat(formIngreso.cantidad);
    if (isNaN(cant) || cant <= 0) {
      toast.error("Ingresá una cantidad válida mayor a cero.");
      return;
    }

    setSavingIngreso(true);
    setErrorIngresoMsg(null);

    try {
      // Invocación a la función de base de datos:
      // SELECT deposito.fn_registrar_lote_inicial(p_id_producto, p_cantidad_total, p_usuario, p_fecha_fabricacion, p_fecha_vencimiento)
      const params = {
        p_id_producto: Number(formIngreso.idProducto),
        p_cantidad_total: cant,
        p_usuario: auditUser,
        p_fecha_fabricacion: formIngreso.fechaFabricacion
          ? `${formIngreso.fechaFabricacion}T00:00:00`
          : null,
        p_fecha_vencimiento: formIngreso.fechaVencimiento
          ? formIngreso.fechaVencimiento
          : null,
      };

      const { data, error } = await supabase
        .schema("deposito")
        .rpc("fn_registrar_lote_inicial", params);

      if (error) {
        console.error("Error al registrar lote inicial:", error);
        setErrorIngresoMsg(error.message || "Error al registrar el lote externo.");
        return;
      }

      toast.success("Lote externo registrado exitosamente.");
      setModalIngresoOpen(false);
      await cargar();
    } catch (err) {
      console.error("Error inesperado:", err);
      setErrorIngresoMsg(err.message || "Error inesperado al registrar el lote.");
    } finally {
      setSavingIngreso(false);
    }
  };

  // Confirmar eliminación de lote agotado:
  // "si figura agotado debe aparecer un cesto de basura que permita eliminar el producto, cambia estado ='E' (No estado_lote)"
  const confirmarEliminarLote = async () => {
    if (!loteAEliminar || deleting) return;
    setDeleting(true);

    try {
      const { error } = await supabase
        .schema("produccion")
        .from("lote_producto")
        .update({
          estado: "E",
          usu_mod: auditUser,
          fec_mod: new Date().toISOString(),
        })
        .eq("id_lote_producto", loteAEliminar.id_lote_producto);

      if (error) throw error;

      toast.success(
        `Lote ${loteAEliminar.nro_lote} marcado como eliminado (estado = 'E').`
      );
      setLoteAEliminar(null);
      await cargar();
    } catch (err) {
      console.error("Error al eliminar lote agotado:", err);
      toast.error(err.message || "No se pudo eliminar el lote agotado.");
    } finally {
      setDeleting(false);
    }
  };

  // Productos disponibles para el buscador desplegable del modal
  const productosModalFiltrados = useMemo(() => {
    const q = productoSearchInput.trim().toLowerCase();
    const activos = productos.filter((p) => p.estado === "A");
    if (!q) return activos;

    // Si el texto coincide exactamente con el producto seleccionado, mostrar todos los activos
    const selectedProd = productosMap.get(Number(formIngreso.idProducto));
    if (selectedProd && `[${selectedProd.codigo}] ${selectedProd.nombre}`.toLowerCase() === q) {
      return activos;
    }

    return activos.filter(
      (p) =>
        String(p.nombre || "").toLowerCase().includes(q) ||
        String(p.codigo || "").toLowerCase().includes(q)
    );
  }, [productos, productoSearchInput, formIngreso.idProducto, productosMap]);

  const productoSeleccionado = useMemo(() => {
    if (!formIngreso.idProducto) return null;
    return productosMap.get(Number(formIngreso.idProducto));
  }, [formIngreso.idProducto, productosMap]);

  // Selección de producto en el buscador desplegable
  const handleSelectProducto = (p) => {
    setFormIngreso((prev) => ({
      ...prev,
      idProducto: String(p.id_producto),
    }));
    setProductoSearchInput(`[${p.codigo}] ${p.nombre}`);
    setProductoDropdownOpen(false);
  };

  // Limpiar selección de producto
  const handleClearProducto = () => {
    setFormIngreso((prev) => ({
      ...prev,
      idProducto: "",
    }));
    setProductoSearchInput("");
    setProductoDropdownOpen(false);
  };

  // Armado de filas para la tabla
  const rows = filtrados.map((lote) => {
    const metaEstadoLote =
      ESTADO_LOTE_META[lote.estado_lote] || {
        label: lote.estado_lote || "—",
        tone: "slate",
        descripcion: "",
      };

    const situacionVenc = obtenerSituacion(lote.fecha_vencimiento);
    const esEliminado = lote.estado === "E";
    const esAgotado = lote.estado_lote === "A";

    return [
      // 1. Nro Lote
      <div key={`nro-${lote.id_lote_producto}`} className="flex flex-col">
        <span className="font-mono font-semibold text-[#145c73]">
          {lote.nro_lote}
        </span>
        <span className="text-[9px] text-[#86979c]">
          {lote.origen_lote === "I"
            ? "Lote Inicial / Externo"
            : lote.id_produccion
            ? `Prod. #${lote.id_produccion}`
            : "Producción"}
        </span>
      </div>,

      // 2. Producto
      <div key={`prod-${lote.id_lote_producto}`} className="max-w-[220px]">
        <strong className="block truncate font-medium text-[#214451]" title={lote.productoNombre}>
          {lote.productoNombre}
        </strong>
        <span className="font-mono text-[10px] text-[#71858c]">
          {lote.productoCodigo}
        </span>
      </div>,

      // 3. Cantidad Total (campo cantidad_total)
      <div key={`tot-${lote.id_lote_producto}`} className="text-right font-medium text-[#214451]">
        <span>{formatNumero(lote.cantidadTotalNum)}</span>
        {lote.unidadCodigo && (
          <span className="ml-1 text-[10px] text-[#7d9096]">
            {lote.unidadCodigo}
          </span>
        )}
      </div>,

      // 4. Cantidad Disponible (cálculo de lo que queda considerando cantidad_total, reservada y consumida)
      <div key={`disp-${lote.id_lote_producto}`} className="flex flex-col text-right">
        <span
          className={`font-semibold ${
            lote.cantidadDisponibleNum > 0
              ? "text-[#287955]"
              : "text-[#8d9ca1]"
          }`}
        >
          {formatNumero(lote.cantidadDisponibleNum)} {lote.unidadCodigo}
        </span>
        {(lote.cantidadReservadaNum > 0 || lote.cantidadConsumidaNum > 0) && (
          <span className="text-[9px] text-[#8ea0a6]">
            Res: {formatNumero(lote.cantidadReservadaNum)} · Cons:{" "}
            {formatNumero(lote.cantidadConsumidaNum)}
          </span>
        )}
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
      <div key={`est-lote-${lote.id_lote_producto}`}>
        <Badge tone={metaEstadoLote.tone}>
          {metaEstadoLote.label}
        </Badge>
      </div>,

      // 8. Ubicación (campo codigo de deposito.posicion)
      // P: Pendiente de Ubicacion (null)
      // R: Recibidos por deposito (null)
      // U: Ubicado (muestra código)
      // A: Agotado (null)
      <div key={`ubic-${lote.id_lote_producto}`}>
        {lote.ubicacionCodigo ? (
          <span className="inline-flex items-center gap-1 rounded bg-[#e8f1f4] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#145c73]">
            <MapPin size={11} />
            {lote.ubicacionCodigo}
          </span>
        ) : (
          <span className="text-[11px] text-[#97a6ab] italic">
            {lote.estado_lote === "P"
              ? "Pendiente"
              : lote.estado_lote === "R"
              ? "Recibido"
              : "—"}
          </span>
        )}
      </div>,

      // 9. Acciones:
      // A: Agotado (si figura agotado debe aparecer un cesto de basura que permita eliminar el producto, cambia estado ='E' (No estado_lote)
      <div key={`acc-${lote.id_lote_producto}`} className="flex items-center justify-end">
        {esEliminado ? (
          <Badge tone="red">Eliminado</Badge>
        ) : esAgotado ? (
          <button
            type="button"
            onClick={() => setLoteAEliminar(lote)}
            title="Eliminar lote agotado (cambia estado a 'E')"
            className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#f1cfcb] bg-[#fbe9e7] px-2.5 py-1 text-[11px] font-semibold text-[#ba584d] transition-colors hover:bg-[#f5d5d1]"
          >
            <Trash2 size={12} />
            <span>Eliminar</span>
          </button>
        ) : (
          <span className="text-[11px] text-[#9db0b5]">—</span>
        )}
      </div>,
    ];
  });

  return (
    <>
      <SectionTitle
        eyebrow="04 · CONTROL DE STOCK Y TRAZABILIDAD"
        title="Lotes"
        description="Listado integral de lotes de producción e ingresos externos, stock disponible, estados y ubicaciones."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cargar}
              title="Recargar lotes"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[#dfe7e9] bg-white text-[#556d75] transition-colors hover:bg-[#f4f7f8]"
            >
              <RotateCcw size={15} />
            </button>

            <ActionButton onClick={abrirModalIngreso}>
              <Plus size={16} />
              Ingresar Lote Externo
            </ActionButton>
          </div>
        }
      />

      {/* Tarjetas KPI */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi
          icon={Boxes}
          label="Total lotes activos"
          value={stats.total}
          trend={`${stats.total} reg.`}
          note="En inventario"
          tone="blue"
        />
        <Kpi
          icon={CheckCircle2}
          label="Lotes ubicados (U)"
          value={stats.ubicados}
          trend={`${stats.ubicados} pos.`}
          note="Con posición asignada"
          tone="green"
        />
        <Kpi
          icon={Clock}
          label="Pendientes (P / R)"
          value={stats.pendientes}
          trend={`${stats.pendientes} lotes`}
          note="Por ingresar/ubicar"
          tone="amber"
        />
        <Kpi
          icon={Archive}
          label="Agotados (A)"
          value={stats.agotados}
          trend={`${stats.agotados} lotes`}
          note="Listos para dar de baja"
          tone="slate"
        />
        <Kpi
          icon={Package}
          label="Stock disponible total"
          value={formatNumero(stats.stockTotalDisp)}
          trend="Disponible"
          note="Descontando reservas"
          tone="green"
        />
      </div>

      {/* Contenedor principal con filtros y tabla */}
      <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
        {/* Barra de Filtros */}
        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {/* Búsqueda */}
          <div className="relative min-w-0 sm:col-span-2 lg:col-span-2">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#82979e]"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nro de lote, producto, código o ubicación..."
              className="h-9 w-full rounded-md border border-[#dfe7e9] bg-white pl-9 pr-3 text-[12px] text-[#173d4b] outline-none transition-colors focus:border-[#214451]"
            />
          </div>

          {/* Filtro Ubicación (Todas las ubicaciones / Zonas de depósito existentes) */}
          <div className="min-w-0">
            <select
              value={ubicacionFilter}
              onChange={(e) => setUbicacionFilter(e.target.value)}
              className={selectCls}
            >
              <option value="ALL">Todas las ubicaciones</option>
              {zonas.map((z) => {
                const cod = String(z.codigo || "").trim();
                const nom = String(z.nombre || "").trim();
                const labelZona = nom.toLowerCase().startsWith("zona")
                  ? nom
                  : `Zona ${cod}${nom ? ` · ${nom}` : ""}`;
                return (
                  <option key={z.id_zona} value={String(z.id_zona)}>
                    {labelZona}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Filtro Estado de Lote (P, R, U, A) */}
          <div className="min-w-0">
            <select
              value={estadoLoteFilter}
              onChange={(e) => setEstadoLoteFilter(e.target.value)}
              className={selectCls}
            >
              <option value="ALL">Todos los estados de lote</option>
              <option value="P">P · Pendiente de Ubicación</option>
              <option value="R">R · Recibido por depósito</option>
              <option value="U">U · Ubicado</option>
              <option value="A">A · Agotado</option>
            </select>
          </div>

          {/* Filtro Registro (Activo / Eliminado) */}
          <div className="min-w-0">
            <select
              value={estadoRegistroFilter}
              onChange={(e) => setEstadoRegistroFilter(e.target.value)}
              className={selectCls}
            >
              <option value="A">Lotes Activos (estado = 'A')</option>
              <option value="E">Lotes Eliminados (estado = 'E')</option>
              <option value="ALL">Todos los registros (A y E)</option>
            </select>
          </div>
        </div>

        {/* Tabla */}
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
          rows={rows}
        />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-[#91a0a4]">
            <RotateCcw className="mb-2 h-5 w-5 animate-spin text-[#145c73]" />
            <p className="text-[12px]">Cargando listado de lotes...</p>
          </div>
        ) : (
          rows.length === 0 && (
            <div className="py-10 text-center text-[#91a0a4]">
              <Boxes className="mx-auto mb-2 h-8 w-8 text-[#b2c0c5]" />
              <p className="text-[13px] font-semibold text-[#50666e]">
                No se encontraron lotes
              </p>
              <p className="text-[11px] text-[#86999f]">
                {search || estadoLoteFilter !== "ALL" || estadoRegistroFilter !== "A"
                  ? "Probá ajustando los filtros de búsqueda."
                  : "Comenzá registrando un lote externo o produciendo órdenes."}
              </p>
            </div>
          )
        )}
      </div>

      {/* =====================================================================
          MODAL: INGRESAR LOTE EXTERNO
         ===================================================================== */}
      <Dialog open={modalIngresoOpen} onOpenChange={setModalIngresoOpen}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="max-w-lg bg-white p-6 sm:rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold text-[#173d4b]">
              <Boxes size={18} className="text-[#145c73]" />
              Ingresar Lote Externo
            </DialogTitle>
          </DialogHeader>

          {errorIngresoMsg && (
            <div className="mt-2 flex items-start gap-2.5 rounded-md border border-[#f1cfcb] bg-[#fdf2f0] p-3 text-[11px] text-[#ba584d]">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <div>{errorIngresoMsg}</div>
            </div>
          )}

          <form onSubmit={handleIngresarLoteExterno} className="mt-3 space-y-4">
            {/* 1. Selección de Producto - 1 sola barra buscadora desplegable */}
            <div>
              <Label className={labelCls}>
                Producto <span className="text-[#ba584d]">*</span>
              </Label>

              <div ref={productoDropdownRef} className="relative mt-1">
                <div className="relative flex items-center">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#82979e]"
                  />
                  <input
                    type="text"
                    value={productoSearchInput}
                    onClick={() => setProductoDropdownOpen((prev) => !prev)}
                    onChange={(e) => {
                      setProductoSearchInput(e.target.value);
                      if (formIngreso.idProducto) {
                        setFormIngreso((prev) => ({ ...prev, idProducto: "" }));
                      }
                      setProductoDropdownOpen(true);
                    }}
                    placeholder="Buscar o seleccionar producto por código o nombre..."
                    className="h-9 w-full rounded-md border border-[#dfe7e9] bg-white pl-9 pr-16 text-[12px] text-[#173d4b] outline-none transition-colors focus:border-[#214451]"
                    required={!formIngreso.idProducto}
                  />

                  <div className="absolute right-2 flex items-center gap-0.5">
                    {formIngreso.idProducto && (
                      <button
                        type="button"
                        onClick={handleClearProducto}
                        className="grid h-6 w-6 cursor-pointer place-items-center rounded text-[#82979e] transition-colors hover:bg-[#f4f7f8] hover:text-[#173d4b]"
                        title="Limpiar selección"
                      >
                        <X size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setProductoDropdownOpen((prev) => !prev)}
                      className="grid h-6 w-6 cursor-pointer place-items-center rounded text-[#82979e] transition-colors hover:bg-[#f4f7f8] hover:text-[#173d4b]"
                      title="Desplegar lista de productos"
                    >
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-150 ${
                          productoDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Panel desplegable con scroll */}
                {productoDropdownOpen && (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-56 overflow-y-auto rounded-md border border-[#cfdce0] bg-white py-1 shadow-lg">
                    {productosModalFiltrados.length === 0 ? (
                      <div className="px-3 py-3 text-center text-[11px] text-[#758990]">
                        No se encontraron productos activos que coincidan.
                      </div>
                    ) : (
                      productosModalFiltrados.map((p) => {
                        const isSelected =
                          String(p.id_producto) === String(formIngreso.idProducto);
                        const unidad =
                          unidadesMap.get(Number(p.id_unidad_medida)) || "";

                        return (
                          <button
                            key={p.id_producto}
                            type="button"
                            onClick={() => handleSelectProducto(p)}
                            className={`flex w-full cursor-pointer items-center justify-between border-b border-[#f0f4f5] px-3 py-2 text-left text-[11px] transition-colors last:border-b-0 ${
                              isSelected
                                ? "bg-[#e9f2f5] font-semibold text-[#145c73]"
                                : "text-[#173d4b] hover:bg-[#f4f8f9]"
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">
                                <span className="mr-1.5 font-mono font-semibold text-[#145c73]">
                                  [{p.codigo}]
                                </span>
                                {p.nombre}
                              </span>
                              <span className="text-[10px] text-[#788d94]">
                                {unidad && `Unidad: ${unidad} · `}
                                {p.vida_util_meses
                                  ? `Vida útil: ${p.vida_util_meses} meses`
                                  : "Vida útil: no especificada"}
                              </span>
                            </div>
                            {isSelected && (
                              <span className="text-[10px] font-bold text-[#145c73]">
                                Seleccionado
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {productoSeleccionado && (
                <div className="mt-1 flex items-center justify-between text-[10px] text-[#6b7f86]">
                  <span>
                    Vida útil declarada:{" "}
                    <strong>
                      {productoSeleccionado.vida_util_meses
                        ? `${productoSeleccionado.vida_util_meses} meses`
                        : "No especificada"}
                    </strong>
                  </span>
                  <span>
                    Unidad:{" "}
                    <strong>
                      {unidadesMap.get(Number(productoSeleccionado.id_unidad_medida)) || "—"}
                    </strong>
                  </span>
                </div>
              )}
            </div>

            {/* 2. Cantidad */}
            <div>
              <Label className={labelCls}>
                Cantidad Total <span className="text-[#ba584d]">*</span>
              </Label>
              <Input
                type="number"
                step="any"
                min="0.001"
                required
                value={formIngreso.cantidad}
                onChange={(e) =>
                  setFormIngreso((prev) => ({
                    ...prev,
                    cantidad: e.target.value,
                  }))
                }
                placeholder="Ej: 5000"
                className="mt-1 h-9 rounded-md border-[#dfe7e9] bg-white text-[12px] text-[#173d4b]"
              />
            </div>

            {/* 3. Fechas */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Fecha de Fabricación */}
              <div>
                <Label className={labelCls}>Fecha de fabricación</Label>
                <Input
                  type="date"
                  value={formIngreso.fechaFabricacion}
                  onChange={(e) =>
                    setFormIngreso((prev) => ({
                      ...prev,
                      fechaFabricacion: e.target.value,
                    }))
                  }
                  className="mt-1 h-9 rounded-md border-[#dfe7e9] bg-white text-[12px] text-[#173d4b]"
                />
                <span className="mt-0.5 block text-[9px] text-[#8ea0a6]">
                  Por defecto vacío si no se conoce.
                </span>
              </div>

              {/* Fecha de Vencimiento */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className={labelCls}>Fecha de vencimiento</Label>
                  {productoSeleccionado?.vida_util_meses &&
                    formIngreso.fechaFabricacion && (
                      <button
                        type="button"
                        onClick={autocalcularVencimiento}
                        className="text-[9px] font-semibold text-[#145c73] underline hover:text-[#0e4354]"
                      >
                        +Calcular
                      </button>
                    )}
                </div>
                <Input
                  type="date"
                  value={formIngreso.fechaVencimiento}
                  onChange={(e) =>
                    setFormIngreso((prev) => ({
                      ...prev,
                      fechaVencimiento: e.target.value,
                    }))
                  }
                  className="mt-1 h-9 rounded-md border-[#dfe7e9] bg-white text-[12px] text-[#173d4b]"
                />
                <span className="mt-0.5 block text-[9px] text-[#8ea0a6]">
                  Por defecto vacío si no se conoce.
                </span>
              </div>
            </div>

            {/* 4. Usuario de registro */}
            <div className="rounded-md border border-[#e7eef0] bg-[#f9fbfb] p-2.5 text-[11px] text-[#697d84]">
              Usuario que registra:{" "}
              <strong className="font-semibold text-[#1d4350]">
                {auditUser}
              </strong>
            </div>

            <DialogFooter className="mt-5 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalIngresoOpen(false)}
                disabled={savingIngreso}
                className="h-9 border-[#dfe7e9] text-[12px] text-[#556d75]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingIngreso}
                className="h-9 bg-[#145c73] text-[12px] font-semibold text-white hover:bg-[#0f4657]"
              >
                {savingIngreso ? "Registrando..." : "Registrar Lote Externo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =====================================================================
          MODAL: CONFIRMAR ELIMINACIÓN DE LOTE AGOTADO
          "A: Agotado (si figura agotado debe aparecer un cesto de basura que permita
           eliminar el producto, cambia estado ='E' (No estado_lote)"
         ===================================================================== */}
      <Dialog
        open={Boolean(loteAEliminar)}
        onOpenChange={(open) => !open && setLoteAEliminar(null)}
      >
        <DialogContent className="max-w-md bg-white p-6 sm:rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[16px] font-semibold text-[#ba584d]">
              <Trash2 size={18} />
              ¿Eliminar lote agotado?
            </DialogTitle>
            <DialogDescription className="pt-2 text-[12px] text-[#677a81]">
              Estás a punto de dar de baja el lote agotado{" "}
              <strong className="font-mono text-[#173d4b]">
                {loteAEliminar?.nro_lote}
              </strong>{" "}
              del producto{" "}
              <strong className="text-[#173d4b]">
                {loteAEliminar?.productoNombre}
              </strong>
              .
              <br />
              <br />
              Esta acción modificará el estado del registro a{" "}
              <code className="rounded bg-[#fbe9e7] px-1 py-0.5 font-bold text-[#ba584d]">
                estado = 'E'
              </code>{" "}
              (manteniendo{" "}
              <code className="rounded bg-[#edf1f2] px-1 py-0.5 font-bold text-[#6f8087]">
                estado_lote = 'A'
              </code>
              ).
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLoteAEliminar(null)}
              disabled={deleting}
              className="h-9 border-[#dfe7e9] text-[12px] text-[#556d75]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={confirmarEliminarLote}
              disabled={deleting}
              className="h-9 bg-[#ba584d] text-[12px] font-semibold text-white hover:bg-[#a64b41]"
            >
              {deleting ? "Eliminando..." : "Eliminar Lote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
