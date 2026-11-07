import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import {
  Truck,
  Plus,
  Search,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  FileEdit,
  Send,
  Trash2,
  MapPin,
  PackageCheck,
  Route,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Badge from "@/components/common/Badge";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

const ESTADO_HOJA_META = {
  P: { label: "Pendiente", tone: "amber" },
  D: { label: "Despachada", tone: "green" },
};

const MODALIDAD_META = {
  P: "Envío propio",
  T: "Transporte / Expreso",
  R: "Retira en planta",
};

const PAGE_SIZE = 10;

const formatNroPedido = (idPedido) =>
  idPedido ? `#${String(idPedido).padStart(5, "0")}` : "—";

const formatDateOnly = (value) => {
  if (!value) return "—";
  const str = String(value).slice(0, 10);
  const parts = str.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return str;
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

const formatQty = (val) =>
  Number(val ?? 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const formatMoney = (val) =>
  Number(val ?? 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function Dispatch({ fakeAction, navigate }) {
  const { token, user } = useAuth();

  const [hojasRuta, setHojasRuta] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [pedidosListos, setPedidosListos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros de la tabla principal
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("ALL"); // "ALL" | "P" | "D"
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Fila expandida en el listado
  const [expandedHojaId, setExpandedHojaId] = useState(null);

  // Estado del Modal Crear / Editar Hoja de Ruta
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHoja, setEditingHoja] = useState(null);
  const [fechaHojaInput, setFechaHojaInput] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [selectedVehiculoId, setSelectedVehiculoId] = useState("");
  const [selectedLegajoConductor, setSelectedLegajoConductor] = useState("");
  const [observacionesHoja, setObservacionesHoja] = useState("");
  const [paradasForm, setParadasForm] = useState([]);
  const [pedidoSearchModal, setPedidoSearchModal] = useState("");
  const [savingHoja, setSavingHoja] = useState(false);

  // Modal de Confirmación de Despacho ("Despachar pedido")
  const [despacharDialogHoja, setDespacharDialogHoja] = useState(null);
  const [despachandoId, setDespachandoId] = useState(null);

  // Modal de Confirmación de Eliminación de Hoja de Ruta
  const [eliminarDialogHoja, setEliminarDialogHoja] = useState(null);
  const [eliminandoId, setEliminandoId] = useState(null);

  // Fallback para cargar choferes (empleados RRHH con id_rol = 17)
  const fetchChoferesFallback = useCallback(async () => {
    try {
      const { data: rpcRrhh, error: errRrhh } = await supabase
        .schema("usuarios")
        .rpc("listar_personal_rrhh", { p_token: token });

      if (!errRrhh && Array.isArray(rpcRrhh)) {
        return rpcRrhh.filter(
          (emp) =>
            Number(emp.id_rol) === 17 &&
            String(emp.estado || "A").trim() === "A" &&
            !emp.fecha_egreso
        );
      }

      const { data: tblRrhh } = await supabase
        .schema("administracion")
        .from("recursos_humanos")
        .select("legajo, nombre, apellido, dni, cuil, telefono, id_rol, estado, fecha_egreso")
        .eq("id_rol", 17)
        .eq("estado", "A");

      return (tblRrhh ?? []).filter((emp) => !emp.fecha_egreso);
    } catch (err) {
      console.error("Error en fallback de choferes:", err);
      return [];
    }
  }, [token]);

  // Fallback para cargar pedidos en estado 'L'
  const fetchPedidosListosFallback = useCallback(
    async (idHojaActual = null) => {
      try {
        const [{ data: pedData }, { data: dhrData }] = await Promise.all([
          supabase
            .schema("usuarios")
            .rpc("listar_pedidos_gestion", { p_token: token }),
          supabase
            .schema("logistica")
            .from("detalle_hoja_ruta")
            .select("id_pedido, id_hoja_ruta, estado")
            .eq("estado", "A"),
        ]);

        const ocupadosEnOtraHoja = new Set(
          (dhrData ?? [])
            .filter(
              (d) =>
                idHojaActual == null ||
                Number(d.id_hoja_ruta) !== Number(idHojaActual)
            )
            .map((d) => Number(d.id_pedido))
        );

        return (Array.isArray(pedData) ? pedData : []).filter(
          (p) =>
            String(p.estado || p.estado_pedido || "").trim() === "L" &&
            !ocupadosEnOtraHoja.has(Number(p.id_pedido))
        );
      } catch (err) {
        console.error("Error en fallback de pedidos en L:", err);
        return [];
      }
    },
    [token]
  );

  // Fallback para cargar hojas de ruta directamente desde logistica / transporte
  const fetchHojasRutaFallback = useCallback(async () => {
    try {
      const [
        resHojas,
        resAsig,
        resVeh,
        resDet,
        resPar,
        resPedidos,
        choferesList,
      ] = await Promise.all([
        supabase
          .schema("logistica")
          .from("hoja_ruta")
          .select("*")
          .eq("estado", "A")
          .order("id_hoja_ruta", { ascending: false }),
        supabase
          .schema("logistica")
          .from("asignacion_transporte")
          .select("*")
          .in("estado", ["A", "I"]),
        supabase.schema("transporte").from("vehiculo").select("*"),
        supabase
          .schema("logistica")
          .from("detalle_hoja_ruta")
          .select("*")
          .eq("estado", "A"),
        supabase
          .schema("logistica")
          .from("parada_hoja_ruta")
          .select("*")
          .eq("estado", "A"),
        supabase
          .schema("usuarios")
          .rpc("listar_pedidos_gestion", { p_token: token }),
        fetchChoferesFallback(),
      ]);

      const hojas = resHojas.data ?? [];
      const asignaciones = resAsig.data ?? [];
      const vehs = resVeh.data ?? [];
      const detalles = resDet.data ?? [];
      const paradas = resPar.data ?? [];
      const pedidosAll = Array.isArray(resPedidos.data) ? resPedidos.data : [];

      const vehMap = new Map(vehs.map((v) => [Number(v.id_vehiculo), v]));
      const chofMap = new Map(
        choferesList.map((c) => [String(c.legajo).trim(), c])
      );
      const pedMap = new Map(pedidosAll.map((p) => [Number(p.id_pedido), p]));

      return hojas.map((hr) => {
        const idHr = Number(hr.id_hoja_ruta);
        const asigHoja = asignaciones
          .filter((a) => Number(a.id_hoja_ruta) === idHr)
          .sort((a, b) => {
            const aAct = String(a.estado).trim() === "A" ? 0 : 1;
            const bAct = String(b.estado).trim() === "A" ? 0 : 1;
            if (aAct !== bAct) return aAct - bAct;
            return (
              Number(b.id_asignacion_transporte ?? 0) -
              Number(a.id_asignacion_transporte ?? 0)
            );
          })[0];

        const veh = asigHoja ? vehMap.get(Number(asigHoja.id_vehiculo)) : null;
        const chof = asigHoja
          ? chofMap.get(String(asigHoja.legajo_conductor).trim())
          : null;

        const detsHoja = detalles.filter(
          (d) => Number(d.id_hoja_ruta) === idHr
        );

        const paradasArmadas = detsHoja
          .map((d) => {
            const par = paradas.find(
              (p) =>
                Number(p.id_detalle_hoja_ruta) ===
                Number(d.id_detalle_hoja_ruta)
            );
            const ped = pedMap.get(Number(d.id_pedido));
            return {
              id_detalle_hoja_ruta: d.id_detalle_hoja_ruta,
              id_parada: par?.id_parada ?? null,
              orden_parada: Number(par?.orden_parada ?? 1),
              id_pedido: d.id_pedido,
              fecha_pedido: ped?.fecha_pedido ?? null,
              estado_pedido: String(ped?.estado || "L").trim(),
              id_cliente: ped?.id_cliente ?? null,
              cliente_nombre: ped?.cliente_nombre || `Pedido #${d.id_pedido}`,
              cliente_cuit: ped?.cliente_cuit || "",
              modalidad_entrega: String(ped?.modalidad_entrega || "P").trim(),
              domicilio: par?.domicilio || ped?.domicilio_entrega || "",
              localidad: par?.localidad || ped?.localidad_entrega || "",
              provincia: par?.provincia || ped?.provincia_entrega || "",
              observaciones:
                par?.observaciones || d.observaciones || ped?.observaciones || "",
              cantidad_lineas: Number(ped?.cantidad_lineas ?? 0),
              cantidad_productos: Number(ped?.cantidad_productos ?? 0),
              importe_total: Number(ped?.importe_total ?? 0),
            };
          })
          .sort((a, b) => a.orden_parada - b.orden_parada);

        return {
          id_hoja_ruta: idHr,
          nro_hoja_ruta: hr.nro_hoja_ruta,
          fecha_hoja_ruta: hr.fecha_hoja_ruta,
          observaciones: hr.observaciones || "",
          estado: String(hr.estado || "A").trim(),
          estado_hoja_ruta: String(hr.estado_hoja_ruta || "P").trim(),
          usu_alta: hr.usu_alta,
          fec_alta: hr.fec_alta,
          usu_mod: hr.usu_mod,
          fec_mod: hr.fec_mod,
          id_vehiculo: veh?.id_vehiculo ?? asigHoja?.id_vehiculo ?? null,
          vehiculo_patente: veh?.patente || "",
          vehiculo_marca: veh?.marca || "",
          vehiculo_modelo: veh?.modelo || "",
          vehiculo_capacidad: veh?.capacidad_kg ?? null,
          legajo_conductor: asigHoja?.legajo_conductor || "",
          conductor_nombre: chof?.nombre || "",
          conductor_apellido: chof?.apellido || "",
          conductor_dni: chof?.dni || "",
          conductor_telefono: chof?.telefono || "",
          cant_paradas: paradasArmadas.length,
          total_unidades: paradasArmadas.reduce(
            (acc, p) => acc + Number(p.cantidad_productos ?? 0),
            0
          ),
          total_importe: paradasArmadas.reduce(
            (acc, p) => acc + Number(p.importe_total ?? 0),
            0
          ),
          paradas: paradasArmadas,
        };
      });
    } catch (err) {
      console.error("Error en fallback de hojas de ruta:", err);
      return [];
    }
  }, [token, fetchChoferesFallback]);

  const cargarDatos = useCallback(async () => {
    if (!token) {
      setHojasRuta([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [resHojas, resVehiculos, resChoferes, resPedidosL] =
        await Promise.all([
          supabase
            .schema("usuarios")
            .rpc("listar_hojas_ruta_expedicion", { p_token: token }),
          supabase
            .schema("usuarios")
            .rpc("listar_vehiculos_transporte", { p_token: token }),
          supabase
            .schema("usuarios")
            .rpc("listar_choferes_expedicion", { p_token: token }),
          supabase
            .schema("usuarios")
            .rpc("listar_pedidos_listos_expedicion", {
              p_token: token,
              p_id_hoja_ruta: null,
            }),
        ]);

      if (!resHojas.error && Array.isArray(resHojas.data)) {
        setHojasRuta(resHojas.data);
      } else {
        const fbHojas = await fetchHojasRutaFallback();
        setHojasRuta(fbHojas);
      }

      if (!resVehiculos.error && Array.isArray(resVehiculos.data)) {
        setVehiculos(resVehiculos.data);
      } else {
        const { data: tblVeh } = await supabase
          .schema("transporte")
          .from("vehiculo")
          .select("*")
          .order("patente", { ascending: true });
        setVehiculos(tblVeh ?? []);
      }

      if (!resChoferes.error && Array.isArray(resChoferes.data)) {
        setChoferes(resChoferes.data);
      } else {
        const fbChof = await fetchChoferesFallback();
        setChoferes(fbChof);
      }

      if (!resPedidosL.error && Array.isArray(resPedidosL.data)) {
        setPedidosListos(resPedidosL.data);
      } else {
        const fbPed = await fetchPedidosListosFallback(null);
        setPedidosListos(fbPed);
      }
    } catch (err) {
      console.error("Error al cargar módulo de Expedición:", err);
      toast.error("Ocurrió un error al cargar los datos de Expedición");
    } finally {
      setLoading(false);
    }
  }, [
    token,
    fetchHojasRutaFallback,
    fetchChoferesFallback,
    fetchPedidosListosFallback,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarDatos();
  }, [cargarDatos]);

  // KPIs superiores
  const metrics = useMemo(() => {
    const total = hojasRuta.length;
    const pendientes = hojasRuta.filter(
      (h) => String(h.estado_hoja_ruta || "P").trim() === "P"
    ).length;
    const despachadas = hojasRuta.filter(
      (h) => String(h.estado_hoja_ruta || "P").trim() === "D"
    ).length;
    const pedidosSinRuta = pedidosListos.length;

    return { total, pendientes, despachadas, pedidosSinRuta };
  }, [hojasRuta, pedidosListos]);

  // Filtrado de Hojas de Ruta
  const filteredHojas = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return hojasRuta
      .filter((h) => {
        const estOp = String(h.estado_hoja_ruta || "P").trim();
        if (estadoFilter !== "ALL" && estOp !== estadoFilter) {
          return false;
        }

        const fHoja = h.fecha_hoja_ruta
          ? String(h.fecha_hoja_ruta).slice(0, 10)
          : "";
        if (fechaDesde && fHoja && fHoja < fechaDesde) return false;
        if (fechaHasta && fHoja && fHoja > fechaHasta) return false;

        if (!q) return true;

        const paradasText = (Array.isArray(h.paradas) ? h.paradas : [])
          .map(
            (p) =>
              `${formatNroPedido(p.id_pedido)} ${p.cliente_nombre || ""} ${p.localidad || ""} ${p.domicilio || ""}`
          )
          .join(" ");

        return [
          h.nro_hoja_ruta,
          h.id_hoja_ruta,
          h.vehiculo_patente,
          h.vehiculo_marca,
          h.vehiculo_modelo,
          h.legajo_conductor,
          h.conductor_nombre,
          h.conductor_apellido,
          h.observaciones,
          paradasText,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const aEst = String(a.estado_hoja_ruta || "P").trim() === "P" ? 0 : 1;
        const bEst = String(b.estado_hoja_ruta || "P").trim() === "P" ? 0 : 1;
        if (aEst !== bEst) return aEst - bEst;
        return Number(b.id_hoja_ruta ?? 0) - Number(a.id_hoja_ruta ?? 0);
      });
  }, [hojasRuta, searchTerm, estadoFilter, fechaDesde, fechaHasta]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [searchTerm, estadoFilter, fechaDesde, fechaHasta]);

  const totalPages = Math.max(1, Math.ceil(filteredHojas.length / PAGE_SIZE));
  const paginatedHojas = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredHojas.slice(start, start + PAGE_SIZE);
  }, [filteredHojas, currentPage]);

  // Vehículos activos para el selector
  const vehiculosActivos = useMemo(
    () =>
      vehiculos.filter((v) => String(v.estado || "A").trim() === "A"),
    [vehiculos]
  );

  // Abrir modal para Crear Nueva Hoja de Ruta
  const handleOpenNuevaHoja = async () => {
    setEditingHoja(null);
    setFechaHojaInput(new Date().toISOString().slice(0, 10));
    setSelectedVehiculoId("");
    setSelectedLegajoConductor("");
    setObservacionesHoja("");
    setParadasForm([]);
    setPedidoSearchModal("");
    setModalOpen(true);

    // Refrescar pedidos en estado 'L' disponibles
    const { data, error } = await supabase
      .schema("usuarios")
      .rpc("listar_pedidos_listos_expedicion", {
        p_token: token,
        p_id_hoja_ruta: null,
      });
    if (!error && Array.isArray(data)) {
      setPedidosListos(data);
    } else {
      const fb = await fetchPedidosListosFallback(null);
      setPedidosListos(fb);
    }
  };

  // Abrir modal para Editar Hoja de Ruta pendiente ('P')
  const handleOpenEditarHoja = async (hoja) => {
    if (String(hoja.estado_hoja_ruta || "P").trim() !== "P") {
      toast.error("Solo se pueden editar hojas de ruta en estado Pendiente (P).");
      return;
    }

    setEditingHoja(hoja);
    setFechaHojaInput(
      hoja.fecha_hoja_ruta
        ? String(hoja.fecha_hoja_ruta).slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setSelectedVehiculoId(
      hoja.id_vehiculo != null ? String(hoja.id_vehiculo) : ""
    );
    setSelectedLegajoConductor(hoja.legajo_conductor || "");
    setObservacionesHoja(hoja.observaciones || "");

    const paradasExistentes = (Array.isArray(hoja.paradas) ? hoja.paradas : [])
      .map((p, idx) => ({
        id_pedido: Number(p.id_pedido),
        orden_parada: Number(p.orden_parada ?? idx + 1),
        cliente_nombre: p.cliente_nombre || "",
        cliente_cuit: p.cliente_cuit || "",
        fecha_pedido: p.fecha_pedido || null,
        modalidad_entrega: p.modalidad_entrega || "P",
        domicilio: p.domicilio || "",
        localidad: p.localidad || "",
        provincia: p.provincia || "",
        observaciones: p.observaciones || "",
        cantidad_productos: Number(p.cantidad_productos ?? 0),
        importe_total: Number(p.importe_total ?? 0),
      }))
      .sort((a, b) => a.orden_parada - b.orden_parada)
      .map((p, idx) => ({ ...p, orden_parada: idx + 1 }));

    setParadasForm(paradasExistentes);
    setPedidoSearchModal("");
    setModalOpen(true);

    // Cargar pedidos en 'L' disponibles incluyendo los de esta hoja
    const { data, error } = await supabase
      .schema("usuarios")
      .rpc("listar_pedidos_listos_expedicion", {
        p_token: token,
        p_id_hoja_ruta: hoja.id_hoja_ruta,
      });
    if (!error && Array.isArray(data)) {
      setPedidosListos(data);
    } else {
      const fb = await fetchPedidosListosFallback(hoja.id_hoja_ruta);
      setPedidosListos(fb);
    }
  };

  // Pedidos en 'L' disponibles que aún no fueron agregados a paradasForm
  const pedidosDisponiblesParaAgregar = useMemo(() => {
    const yaSeleccionados = new Set(paradasForm.map((p) => Number(p.id_pedido)));
    const q = pedidoSearchModal.trim().toLowerCase();

    return pedidosListos.filter((p) => {
      if (yaSeleccionados.has(Number(p.id_pedido))) return false;
      if (!q) return true;
      return [
        formatNroPedido(p.id_pedido),
        p.id_pedido,
        p.cliente_nombre,
        p.cliente_cuit,
        p.domicilio_entrega,
        p.localidad_entrega,
        p.provincia_entrega,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [pedidosListos, paradasForm, pedidoSearchModal]);

  // Incorporar pedido en 'L' al recorrido
  const handleAddPedidoAParadas = (pedido) => {
    setParadasForm((prev) => [
      ...prev,
      {
        id_pedido: Number(pedido.id_pedido),
        orden_parada: prev.length + 1,
        cliente_nombre: pedido.cliente_nombre || "",
        cliente_cuit: pedido.cliente_cuit || "",
        fecha_pedido: pedido.fecha_pedido || null,
        modalidad_entrega: String(pedido.modalidad_entrega || "P").trim(),
        domicilio: pedido.domicilio_entrega || "",
        localidad: pedido.localidad_entrega || "",
        provincia: pedido.provincia_entrega || "",
        observaciones: pedido.observaciones || "",
        cantidad_productos: Number(pedido.cantidad_productos ?? 0),
        importe_total: Number(pedido.importe_total ?? 0),
      },
    ]);
  };

  // Quitar pedido del recorrido y reenumerar orden_parada
  const handleRemoveParada = (idPedido) => {
    setParadasForm((prev) =>
      prev
        .filter((p) => Number(p.id_pedido) !== Number(idPedido))
        .map((p, idx) => ({ ...p, orden_parada: idx + 1 }))
    );
  };

  // Mover parada hacia arriba o abajo para definir el orden de recorrido
  const handleMoveParada = (index, direction) => {
    setParadasForm((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy.map((item, idx) => ({ ...item, orden_parada: idx + 1 }));
    });
  };

  // Cambiar número de orden directamente
  const handleChangeOrdenParadaInput = (index, newOrderVal) => {
    const num = Number(newOrderVal);
    if (!Number.isFinite(num) || num < 1) return;
    setParadasForm((prev) => {
      const clampedTarget = Math.min(prev.length - 1, Math.max(0, num - 1));
      if (clampedTarget === index) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(clampedTarget, 0, moved);
      return copy.map((item, idx) => ({ ...item, orden_parada: idx + 1 }));
    });
  };

  // Actualizar dirección u observación de una parada
  const handleUpdateParadaField = (idPedido, field, value) => {
    setParadasForm((prev) =>
      prev.map((p) =>
        Number(p.id_pedido) === Number(idPedido) ? { ...p, [field]: value } : p
      )
    );
  };

  // Guardar Hoja de Ruta (estado_hoja_ruta = 'P')
  const handleGuardarHojaRuta = async (e) => {
    e?.preventDefault();
    if (!token) return;

    if (!selectedVehiculoId) {
      toast.error("Debe seleccionar un vehículo para la hoja de ruta.");
      return;
    }
    if (!selectedLegajoConductor) {
      toast.error("Debe seleccionar un chofer (Rol 17) para la hoja de ruta.");
      return;
    }
    if (paradasForm.length === 0) {
      toast.error(
        "Debe seleccionar al menos un pedido en estado L para la hoja de ruta."
      );
      return;
    }

    const fechaTarget =
      fechaHojaInput || new Date().toISOString().slice(0, 10);

    // Validar que el vehículo o chofer no estén asignados a otra hoja pendiente en la MISMA fecha
    const conflictoVehiculoMismaFecha = hojasRuta.find(
      (h) =>
        String(h.estado_hoja_ruta || "P").trim() === "P" &&
        String(h.fecha_hoja_ruta || "").slice(0, 10) === fechaTarget &&
        Number(h.id_vehiculo) === Number(selectedVehiculoId) &&
        (!editingHoja ||
          Number(h.id_hoja_ruta) !== Number(editingHoja.id_hoja_ruta))
    );
    if (conflictoVehiculoMismaFecha) {
      toast.error(
        `El vehículo seleccionado ya está asignado a la hoja ${conflictoVehiculoMismaFecha.nro_hoja_ruta} en la fecha ${formatDateOnly(fechaTarget)}.`
      );
      return;
    }

    const conflictoChoferMismaFecha = hojasRuta.find(
      (h) =>
        String(h.estado_hoja_ruta || "P").trim() === "P" &&
        String(h.fecha_hoja_ruta || "").slice(0, 10) === fechaTarget &&
        String(h.legajo_conductor || "").trim() ===
          String(selectedLegajoConductor).trim() &&
        (!editingHoja ||
          Number(h.id_hoja_ruta) !== Number(editingHoja.id_hoja_ruta))
    );
    if (conflictoChoferMismaFecha) {
      toast.error(
        `El chofer seleccionado ya está asignado a la hoja ${conflictoChoferMismaFecha.nro_hoja_ruta} en la fecha ${formatDateOnly(fechaTarget)}.`
      );
      return;
    }

    const paradasPayload = paradasForm.map((p, idx) => ({
      id_pedido: Number(p.id_pedido),
      orden_parada: idx + 1,
      domicilio: (p.domicilio || "").trim(),
      localidad: (p.localidad || "").trim(),
      provincia: (p.provincia || "").trim(),
      observaciones: (p.observaciones || "").trim(),
    }));

    setSavingHoja(true);
    try {
      const { data, error } = await supabase
        .schema("usuarios")
        .rpc("guardar_hoja_ruta_expedicion", {
          p_token: token,
          p_id_hoja_ruta: editingHoja ? editingHoja.id_hoja_ruta : null,
          p_fecha_hoja_ruta:
            fechaHojaInput || new Date().toISOString().slice(0, 10),
          p_id_vehiculo: Number(selectedVehiculoId),
          p_legajo_conductor: selectedLegajoConductor,
          p_observaciones: observacionesHoja.trim() || null,
          p_paradas: paradasPayload,
        });

      if (error) {
        // Fallback directo sobre las tablas logistica.* y transporte.*
        const usuLogin = String(user?.usuario_login || "sistema").slice(0, 20);
        const nowIso = new Date().toISOString();

        // 1. Asegurar que el chofer exista en transporte.conductor
        await supabase
          .schema("transporte")
          .from("conductor")
          .upsert(
            {
              legajo: selectedLegajoConductor,
              estado: "A",
              usu_alta: usuLogin,
            },
            { onConflict: "legajo" }
          );

        let idHoja = editingHoja?.id_hoja_ruta ?? null;
        let nroHoja = editingHoja?.nro_hoja_ruta ?? "";

        if (!idHoja) {
          const { data: insHoja, error: errInsHoja } = await supabase
            .schema("logistica")
            .from("hoja_ruta")
            .insert({
              fecha_hoja_ruta:
                fechaHojaInput || new Date().toISOString().slice(0, 10),
              observaciones: observacionesHoja.trim() || null,
              estado: "A",
              estado_hoja_ruta: "P",
              usu_alta: usuLogin,
            })
            .select("id_hoja_ruta, nro_hoja_ruta")
            .single();

          if (errInsHoja || !insHoja) {
            toast.error(
              error.message ||
                errInsHoja?.message ||
                "No se pudo guardar la hoja de ruta"
            );
            return;
          }
          idHoja = insHoja.id_hoja_ruta;
          nroHoja = insHoja.nro_hoja_ruta;
        } else {
          const { error: errUpdHoja } = await supabase
            .schema("logistica")
            .from("hoja_ruta")
            .update({
              fecha_hoja_ruta:
                fechaHojaInput || new Date().toISOString().slice(0, 10),
              observaciones: observacionesHoja.trim() || null,
              estado_hoja_ruta: "P",
              usu_mod: usuLogin,
              fec_mod: nowIso,
            })
            .eq("id_hoja_ruta", idHoja);

          if (errUpdHoja) {
            toast.error(
              error.message ||
                errUpdHoja.message ||
                "No se pudo actualizar la hoja de ruta"
            );
            return;
          }

          // Limpiar paradas y detalles previos para reconstruir el orden de recorrido
          const { data: oldParadas } = await supabase
            .schema("logistica")
            .from("parada_hoja_ruta")
            .select("id_parada")
            .eq("id_hoja_ruta", idHoja);

          for (const op of oldParadas || []) {
            await supabase
              .schema("transporte")
              .from("entrega")
              .delete()
              .eq("id_parada", op.id_parada);
          }

          await supabase
            .schema("logistica")
            .from("parada_hoja_ruta")
            .delete()
            .eq("id_hoja_ruta", idHoja);

          await supabase
            .schema("logistica")
            .from("detalle_hoja_ruta")
            .delete()
            .eq("id_hoja_ruta", idHoja);
        }

        // 2. Asignación de transporte (vehículo + chofer)
        // Si existen en la BD los índices únicos parciales (WHERE estado = 'A') de migración 62,
        // pasamos a 'I' las asignaciones de otras fechas de ese vehículo/chofer para permitir fechas distintas
        // manteniendo intacto el vínculo en cada hoja de ruta.
        await supabase
          .schema("logistica")
          .from("asignacion_transporte")
          .update({
            estado: "I",
            usu_mod: usuLogin,
            fec_mod: nowIso,
          })
          .eq("id_vehiculo", Number(selectedVehiculoId))
          .eq("estado", "A")
          .neq("id_hoja_ruta", idHoja);

        await supabase
          .schema("logistica")
          .from("asignacion_transporte")
          .update({
            estado: "I",
            usu_mod: usuLogin,
            fec_mod: nowIso,
          })
          .eq("legajo_conductor", selectedLegajoConductor)
          .eq("estado", "A")
          .neq("id_hoja_ruta", idHoja);

        const { data: exAsig } = await supabase
          .schema("logistica")
          .from("asignacion_transporte")
          .select("id_asignacion_transporte")
          .eq("id_hoja_ruta", idHoja)
          .in("estado", ["A", "I"])
          .order("id_asignacion_transporte", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (exAsig?.id_asignacion_transporte) {
          const { error: errAsig } = await supabase
            .schema("logistica")
            .from("asignacion_transporte")
            .update({
              id_vehiculo: Number(selectedVehiculoId),
              legajo_conductor: selectedLegajoConductor,
              observaciones: observacionesHoja.trim() || null,
              estado: "A",
              usu_mod: usuLogin,
              fec_mod: nowIso,
            })
            .eq("id_asignacion_transporte", exAsig.id_asignacion_transporte);

          if (errAsig) {
            toast.error(errAsig.message || "Error al actualizar vehículo/chofer");
            return;
          }
        } else {
          const { error: errAsig } = await supabase
            .schema("logistica")
            .from("asignacion_transporte")
            .insert({
              id_hoja_ruta: idHoja,
              id_vehiculo: Number(selectedVehiculoId),
              legajo_conductor: selectedLegajoConductor,
              observaciones: observacionesHoja.trim() || null,
              estado: "A",
              usu_alta: usuLogin,
            });

          if (errAsig) {
            toast.error(errAsig.message || "Error al asignar vehículo/chofer");
            return;
          }
        }

        // 3. Insertar detalles y paradas en orden
        for (const par of paradasPayload) {
          const { data: detRow, error: errDet } = await supabase
            .schema("logistica")
            .from("detalle_hoja_ruta")
            .insert({
              id_hoja_ruta: idHoja,
              id_pedido: par.id_pedido,
              observaciones: par.observaciones || null,
              estado: "A",
              usu_alta: usuLogin,
            })
            .select("id_detalle_hoja_ruta")
            .single();

          if (errDet || !detRow) {
            toast.error(
              errDet?.message ||
                `No se pudo agregar el pedido #${par.id_pedido} a la hoja de ruta`
            );
            return;
          }

          const { data: parRow, error: errPar } = await supabase
            .schema("logistica")
            .from("parada_hoja_ruta")
            .insert({
              id_hoja_ruta: idHoja,
              id_detalle_hoja_ruta: detRow.id_detalle_hoja_ruta,
              orden_parada: par.orden_parada,
              domicilio: par.domicilio || null,
              localidad: par.localidad || null,
              provincia: par.provincia || null,
              observaciones: par.observaciones || null,
              estado: "A",
              usu_alta: usuLogin,
            })
            .select("id_parada")
            .single();

          if (!errPar && parRow?.id_parada) {
            await supabase
              .schema("transporte")
              .from("entrega")
              .insert({
                id_parada: parRow.id_parada,
                estado_entrega: "P",
                estado: "A",
                usu_alta: usuLogin,
              });
          }
        }

        toast.success(
          editingHoja
            ? `Hoja de ruta ${nroHoja} actualizada en estado Pendiente (P)`
            : `Hoja de ruta ${nroHoja} guardada en estado Pendiente (P)`
        );
      } else {
        const nroResult =
          data?.nro_hoja_ruta || editingHoja?.nro_hoja_ruta || "HR";
        toast.success(
          editingHoja
            ? `Hoja de ruta ${nroResult} actualizada en estado Pendiente (P)`
            : `Hoja de ruta ${nroResult} guardada en estado Pendiente (P)`
        );
      }

      setModalOpen(false);
      setEditingHoja(null);
      await cargarDatos();
    } catch (err) {
      console.error("Error inesperado al guardar hoja de ruta:", err);
      toast.error("Ocurrió un error al guardar la hoja de ruta");
    } finally {
      setSavingHoja(false);
    }
  };

  // Ejecutar "Despachar pedido" -> estado_hoja_ruta = 'D' y pedidos a estado = 'D' en administracion.pedido
  const handleConfirmarDespacho = async () => {
    if (!token || !despacharDialogHoja) return;

    const idHoja = despacharDialogHoja.id_hoja_ruta;
    const nroHoja = despacharDialogHoja.nro_hoja_ruta;
    const paradasHoja = Array.isArray(despacharDialogHoja.paradas)
      ? despacharDialogHoja.paradas
      : [];

    setDespachandoId(idHoja);
    try {
      const { error } = await supabase
        .schema("usuarios")
        .rpc("despachar_hoja_ruta_expedicion", {
          p_token: token,
          p_id_hoja_ruta: idHoja,
        });

      if (error) {
        // Fallback directo sobre administracion.pedido y logistica.hoja_ruta
        const usuLogin = String(user?.usuario_login || "sistema").slice(0, 20);
        const nowIso = new Date().toISOString();

        for (const par of paradasHoja) {
          await supabase
            .schema("administracion")
            .from("pedido")
            .update({
              estado: "D",
              usu_despacho: usuLogin,
              fec_despacho: nowIso,
              usu_mod: usuLogin,
              fec_mod: nowIso,
            })
            .eq("id_pedido", par.id_pedido);

          if (par.id_parada) {
            await supabase
              .schema("transporte")
              .from("entrega")
              .update({
                estado_entrega: "E",
                fecha_entrega: nowIso,
                usu_mod: usuLogin,
                fec_mod: nowIso,
              })
              .eq("id_parada", par.id_parada);
          }
        }

        const { error: errHoja } = await supabase
          .schema("logistica")
          .from("hoja_ruta")
          .update({
            estado_hoja_ruta: "D",
            usu_mod: usuLogin,
            fec_mod: nowIso,
          })
          .eq("id_hoja_ruta", idHoja);

        if (errHoja) {
          toast.error(
            error.message ||
              errHoja.message ||
              "No se pudo despachar la hoja de ruta"
          );
          return;
        }

        await supabase
          .schema("logistica")
          .from("asignacion_transporte")
          .update({
            estado: "I",
            usu_mod: usuLogin,
            fec_mod: nowIso,
          })
          .eq("id_hoja_ruta", idHoja)
          .eq("estado", "A");
      }

      toast.success(
        `Hoja de ruta ${nroHoja} despachada (Estado D). Los ${paradasHoja.length} pedido(s) pasaron a estado Despachado (D).`
      );
      fakeAction?.(`Hoja de ruta ${nroHoja} despachada`);
      setDespacharDialogHoja(null);
      await cargarDatos();
    } catch (err) {
      console.error("Error al despachar hoja de ruta:", err);
      toast.error("Ocurrió un error al despachar la hoja de ruta");
    } finally {
      setDespachandoId(null);
    }
  };

  // Eliminar Hoja de Ruta (Solo hojas en estado_hoja_ruta = 'P', libera pedidos en 'L', vehículo y chofer)
  const handleConfirmarEliminarHoja = async () => {
    if (!token || !eliminarDialogHoja) return;

    const idHoja = eliminarDialogHoja.id_hoja_ruta;
    const nroHoja = eliminarDialogHoja.nro_hoja_ruta;
    const paradasHoja = Array.isArray(eliminarDialogHoja.paradas)
      ? eliminarDialogHoja.paradas
      : [];

    setEliminandoId(idHoja);
    try {
      const { error } = await supabase
        .schema("usuarios")
        .rpc("eliminar_hoja_ruta_expedicion", {
          p_token: token,
          p_id_hoja_ruta: idHoja,
        });

      if (error) {
        // Fallback directo sobre esquemas transporte y logistica
        const usuLogin = String(user?.usuario_login || "sistema").slice(0, 20);
        const nowIso = new Date().toISOString();

        const paradaIds = paradasHoja
          .map((p) => p.id_parada)
          .filter(Boolean);

        if (paradaIds.length > 0) {
          await supabase
            .schema("transporte")
            .from("entrega")
            .delete()
            .in("id_parada", paradaIds);
        }

        await supabase
          .schema("logistica")
          .from("parada_hoja_ruta")
          .delete()
          .eq("id_hoja_ruta", idHoja);

        await supabase
          .schema("logistica")
          .from("detalle_hoja_ruta")
          .delete()
          .eq("id_hoja_ruta", idHoja);

        await supabase
          .schema("logistica")
          .from("asignacion_transporte")
          .update({
            estado: "E",
            usu_mod: usuLogin,
            fec_mod: nowIso,
          })
          .eq("id_hoja_ruta", idHoja);

        const { error: errHoja } = await supabase
          .schema("logistica")
          .from("hoja_ruta")
          .update({
            estado: "E",
            usu_mod: usuLogin,
            fec_mod: nowIso,
          })
          .eq("id_hoja_ruta", idHoja);

        if (errHoja) {
          toast.error(
            error.message ||
              errHoja.message ||
              "No se pudo eliminar la hoja de ruta"
          );
          return;
        }
      }

      toast.success(
        `Hoja de ruta ${nroHoja} eliminada. Los pedidos volvieron a quedar disponibles en estado L.`
      );
      fakeAction?.(`Hoja de ruta ${nroHoja} eliminada`);
      if (expandedHojaId === idHoja) {
        setExpandedHojaId(null);
      }
      setEliminarDialogHoja(null);
      await cargarDatos();
    } catch (err) {
      console.error("Error al eliminar hoja de ruta:", err);
      toast.error("Ocurrió un error al eliminar la hoja de ruta");
    } finally {
      setEliminandoId(null);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setEstadoFilter("ALL");
    setFechaDesde("");
    setFechaHasta("");
  };

  return (
    <div>
      {/* CABECERA COMPACTA + 4 CUADROS PEQUEÑOS A LA DERECHA */}
      <div className="mb-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5e6f77]">
            04 · EXPEDICIÓN Y LOGÍSTICA DE TRANSPORTE
          </div>
          <h2 className="m-0 font-barlow text-[24px] leading-tight tracking-[0.01em] text-[#163946]">
            Expedición y Hojas de Ruta
          </h2>
          <p className="mt-0.5 text-[12px] text-[#6b7d85]">
            Planificación de hojas de ruta para pedidos verificados (L), asignación de orden de recorrido, vehículo, chofer y despacho final.
          </p>
        </div>

        {/* 4 KPIs */}
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="min-w-31.25 rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Hojas de ruta
              </span>
              <Badge tone="blue">Generadas</Badge>
            </div>
            <div className="mt-0.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metrics.total}
              </span>
            </div>
          </div>

          <div className="min-w-31.25 rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Pendientes (P)
              </span>
              <Badge tone="amber">En playa</Badge>
            </div>
            <div className="mt-0.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metrics.pendientes}
              </span>
            </div>
          </div>

          <div className="min-w-31.25 rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Despachadas (D)
              </span>
              <Badge tone="green">En camino</Badge>
            </div>
            <div className="mt-0.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metrics.despachadas}
              </span>
            </div>
          </div>

          <div className="min-w-31.25 rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Pedidos Listos
              </span>
              <Badge tone="blue">Sin ruta</Badge>
            </div>
            <div className="mt-0.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metrics.pedidosSinRuta}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL PRINCIPAL */}
      <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
          <div>
            <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
              LOGÍSTICA · RECORRIDO DE ENTREGAS · CONTROL DE DESPACHO
            </div>
            <h3 className="m-0 font-barlow text-[22px] text-[#173d4b]">
              Hojas de ruta generadas
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {navigate && (
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("dispatch-params-vehiculos")}
                className="h-9 border-[#d5e1e5] px-3 text-[11px] text-[#214451]"
              >
                <Truck size={13} className="mr-1.5" />
                Parámetros · Vehículos
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={cargarDatos}
              className="h-9 border-[#d5e1e5] px-3 text-[11px] text-[#214451]"
            >
              <RefreshCcw size={13} className="mr-1.5" />
              Actualizar
            </Button>

            <Button
              type="button"
              onClick={handleOpenNuevaHoja}
              className="h-9 bg-brand px-3.5 text-[11px] font-semibold text-white hover:bg-[#114c5f]"
            >
              <Plus size={14} className="mr-1.5" />
              Nueva Hoja de Ruta
            </Button>
          </div>
        </div>

        {/* Barra de filtros en una sola fila */}
        <div className="mb-3.5 flex flex-wrap items-center gap-2 md:flex-nowrap">
          <div className="relative min-w-50 flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#82979e]"
            />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por Nº Hoja (HR-...), Nº pedido, cliente, patente o chofer..."
              className="h-9 w-full rounded-md border border-[#d8e2e5] bg-[#f8fafb] pl-8 pr-3 text-[12px] text-[#173d4b] outline-none transition-colors focus:border-brand focus:bg-white"
            />
          </div>

          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            title="Fecha desde"
            className="h-9 w-36 shrink-0 rounded-md border border-[#d8e2e5] bg-white px-2.5 text-[11.5px] text-[#173d4b] outline-none focus:border-brand"
          />

          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            title="Fecha hasta"
            className="h-9 w-36 shrink-0 rounded-md border border-[#d8e2e5] bg-white px-2.5 text-[11.5px] text-[#173d4b] outline-none focus:border-brand"
          />

          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="h-9 w-48 shrink-0 rounded-md border border-[#d8e2e5] bg-white px-2.5 text-[12px] text-[#173d4b] outline-none focus:border-brand"
          >
            <option value="ALL">Estado: Todas</option>
            <option value="P">P · Pendiente de salida</option>
            <option value="D">D · Despachada</option>
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

        {/* Tabla de Hojas de Ruta */}
        <div className="overflow-x-auto rounded-lg border border-[#e3eaec]">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#e3eaec] bg-[#f4f8f9] text-[10px] font-bold uppercase tracking-widest text-[#697e86]">
                <th className="whitespace-nowrap px-3 py-2.5">Nº Hoja / Fecha</th>
                <th className="whitespace-nowrap px-3 py-2.5">Vehículo Asignado</th>
                <th className="whitespace-nowrap px-3 py-2.5">Chofer</th>
                <th className="whitespace-nowrap px-3 py-2.5">Recorrido / Pedidos</th>
                <th className="whitespace-nowrap px-3 py-2.5">Estado Hoja</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2f4]">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-[12px] text-[#758990]"
                  >
                    Cargando hojas de ruta...
                  </td>
                </tr>
              ) : paginatedHojas.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-[12px] text-[#758990]"
                  >
                    No hay hojas de ruta generadas que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedHojas.map((hr) => {
                  const estHoja = String(hr.estado_hoja_ruta || "P").trim();
                  const estMeta = ESTADO_HOJA_META[estHoja] ?? {
                    label: estHoja,
                    tone: "slate",
                  };
                  const isExpanded = expandedHojaId === hr.id_hoja_ruta;
                  const paradas = Array.isArray(hr.paradas) ? hr.paradas : [];

                  return (
                    <Fragment key={hr.id_hoja_ruta}>
                      <tr
                        className={`transition-colors ${
                          isExpanded ? "bg-[#f2f7f9]" : "hover:bg-[#f8fbfc]"
                        }`}
                      >
                        {/* Nº Hoja / Fecha */}
                        <td className="px-3 py-2.5 align-middle">
                          <div className="font-mono text-[12.5px] font-bold text-brand">
                            {hr.nro_hoja_ruta}
                          </div>
                          <div className="text-[10.5px] text-[#6d8088]">
                            Fecha: {formatDateOnly(hr.fecha_hoja_ruta)}
                          </div>
                        </td>

                        {/* Vehículo */}
                        <td className="px-3 py-2.5 align-middle">
                          {hr.vehiculo_patente ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="rounded border border-[#cbdce2] bg-[#eef5f8] px-1.5 py-0.5 font-mono text-[11px] font-bold text-brand">
                                  {hr.vehiculo_patente}
                                </span>
                                <span className="font-medium text-[#173d4b]">
                                  {[hr.vehiculo_marca, hr.vehiculo_modelo]
                                    .filter(Boolean)
                                    .join(" ")}
                                </span>
                              </div>
                              {hr.vehiculo_capacidad && (
                                <div className="mt-0.5 text-[10px] text-[#73878f]">
                                  Capacidad: {formatQty(hr.vehiculo_capacidad)} kg
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#82979e]">Sin vehículo</span>
                          )}
                        </td>

                        {/* Chofer */}
                        <td className="px-3 py-2.5 align-middle">
                          {hr.legajo_conductor ? (
                            <div>
                              <div className="font-semibold text-[#173d4b]">
                                {[hr.conductor_apellido, hr.conductor_nombre]
                                  .filter(Boolean)
                                  .join(", ") || hr.legajo_conductor}
                              </div>
                              <div className="font-mono text-[10.5px] text-[#73878f]">
                                Legajo {hr.legajo_conductor}
                                {hr.conductor_dni
                                  ? ` · DNI ${hr.conductor_dni}`
                                  : ""}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[#82979e]">Sin chofer</span>
                          )}
                        </td>

                        {/* Recorrido / Pedidos */}
                        <td className="max-w-64 px-3 py-2.5 align-middle">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-[#cfe0e6] bg-[#e8f2f6] px-2 py-0.5 font-mono text-[11px] font-bold text-brand">
                              {paradas.length}{" "}
                              {paradas.length === 1 ? "parada" : "paradas"}
                            </span>
                            <span className="whitespace-nowrap font-mono text-[11.5px] font-semibold text-[#173d4b]">
                              {formatQty(hr.total_unidades)} un.
                            </span>
                            <span className="text-[#b8c9cf]">·</span>
                            <span className="whitespace-nowrap font-mono text-[11px] text-[#5f737b]">
                              $ {formatMoney(hr.total_importe)}
                            </span>
                          </div>
                          {paradas.length > 0 && (
                            <div className="mt-1.5 flex max-w-60 flex-wrap items-center gap-1.5 text-[10.5px] text-[#6d8088]">
                              {paradas.slice(0, 2).map((p, i) => (
                                <span
                                  key={p.id_pedido}
                                  className="inline-flex max-w-52 items-center gap-1 whitespace-nowrap rounded-md border border-[#dce6e9] bg-[#f8fbfc] px-2 py-0.5"
                                >
                                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand font-mono text-[9.5px] font-bold text-white">
                                    {p.orden_parada ?? i + 1}
                                  </span>
                                  <strong className="shrink-0 font-mono text-[#173d4b]">
                                    {formatNroPedido(p.id_pedido)}
                                  </strong>
                                  <span className="truncate text-[#6d8088]">
                                    · {p.localidad || p.cliente_nombre}
                                  </span>
                                </span>
                              ))}
                              {paradas.length > 2 && (
                                <span
                                  className="whitespace-nowrap rounded bg-[#eef5f8] px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-brand"
                                  title={`${paradas.length - 2} parada(s) adicional(es)`}
                                >
                                  ...
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Estado Hoja */}
                        <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                          <Badge tone={estMeta.tone}>
                            {estHoja} · {estMeta.label}
                          </Badge>
                        </td>

                        {/* Acciones */}
                        <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle">
                          <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                            {estHoja === "P" && (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleOpenEditarHoja(hr)}
                                  className="h-7 shrink-0 border-[#cfe0e6] bg-white px-2.5 text-[11px] font-semibold text-brand hover:bg-[#eef5f7]"
                                  title="Editar hoja de ruta pendiente"
                                >
                                  <FileEdit size={12} className="mr-1" />
                                  Editar
                                </Button>

                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setEliminarDialogHoja(hr)}
                                  disabled={eliminandoId === hr.id_hoja_ruta}
                                  className="h-7 shrink-0 border-[#f1cfcb] bg-[#fbe9e7] px-2.5 text-[11px] font-semibold text-[#ba584d] hover:bg-[#f5d5d1]"
                                  title="Eliminar hoja de ruta pendiente"
                                >
                                  <Trash2 size={12} className="mr-1" />
                                  {eliminandoId === hr.id_hoja_ruta
                                    ? "Eliminando..."
                                    : "Eliminar"}
                                </Button>

                                <Button
                                  type="button"
                                  onClick={() => setDespacharDialogHoja(hr)}
                                  disabled={despachandoId === hr.id_hoja_ruta}
                                  className="h-7 shrink-0 bg-[#2e8b62] px-2.5 text-[11px] font-semibold text-white hover:bg-[#246e4d]"
                                  title="Despachar hoja de ruta y pasar pedidos a estado D"
                                >
                                  <Send size={12} className="mr-1" />
                                  {despachandoId === hr.id_hoja_ruta
                                    ? "Despachando..."
                                    : "Despachar pedido"}
                                </Button>
                              </>
                            )}

                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                setExpandedHojaId((prev) =>
                                  prev === hr.id_hoja_ruta
                                    ? null
                                    : hr.id_hoja_ruta
                                )
                              }
                              className={`h-7 shrink-0 px-2.5 text-[11px] font-semibold ${
                                isExpanded
                                  ? "border-brand bg-brand text-white hover:bg-[#114c5f]"
                                  : "border-[#cfe0e6] bg-[#f4f9fb] text-brand hover:bg-[#e6f2f6]"
                              }`}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp size={13} className="mr-1" />
                                  Ocultar ruta
                                </>
                              ) : (
                                <>
                                  <ChevronDown size={13} className="mr-1" />
                                  Ver recorrido
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* FILA DESPLEGABLE CON EL DETALLE DE PARADAS Y ORDEN DE RUTA */}
                      {isExpanded && (
                        <tr className="bg-[#f4f8f9]/65">
                          <td colSpan={6} className="p-3.5">
                            <div className="overflow-hidden rounded-lg border border-[#dce6e9] bg-white shadow-2xs">
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8eff1] bg-[#f6fafb] px-4 py-2.5">
                                <div className="flex flex-wrap items-center gap-3">
                                  <div className="flex items-center gap-2">
                                    <Route size={16} className="text-brand" />
                                    <span className="font-semibold text-[#173d4b]">
                                      Hoja de Ruta {hr.nro_hoja_ruta} · Orden de Recorrido
                                    </span>
                                  </div>
                                  {hr.observaciones && (
                                    <span className="rounded bg-[#eef3f5] px-2 py-0.5 text-[11px] text-[#5f737b]">
                                      Obs: {hr.observaciones}
                                    </span>
                                  )}
                                </div>

                                <div className="text-[11px] text-[#6d8088]">
                                  Creada por{" "}
                                  <strong className="font-mono text-[#173d4b]">
                                    {hr.usu_alta || "—"}
                                  </strong>{" "}
                                  ({formatDateTime(hr.fec_alta)})
                                </div>
                              </div>

                              <div className="p-3">
                                {paradas.length === 0 ? (
                                  <div className="py-4 text-center text-[11.5px] text-[#758990]">
                                    Esta hoja de ruta no tiene paradas registradas.
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto rounded border border-[#e6eef0]">
                                    <table className="w-full border-collapse text-left text-[11.5px]">
                                      <thead>
                                        <tr className="border-b border-[#e6eef0] bg-[#f9fbfc] text-[9.5px] font-bold uppercase text-[#6d8088]">
                                          <th className="px-3 py-2 text-center">
                                            Orden Ruta
                                          </th>
                                          <th className="px-3 py-2">Nº Pedido</th>
                                          <th className="px-3 py-2">Cliente</th>
                                          <th className="px-3 py-2">
                                            Dirección de Entrega (Parada)
                                          </th>
                                          <th className="px-3 py-2 text-right">
                                            Unidades / Importe
                                          </th>
                                          <th className="px-3 py-2">
                                            Estado Pedido
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-[#eef3f5]">
                                        {paradas.map((par, idx) => {
                                          const estPed = String(
                                            par.estado_pedido || "L"
                                          ).trim();
                                          return (
                                            <tr
                                              key={
                                                par.id_detalle_hoja_ruta ??
                                                par.id_pedido
                                              }
                                              className="hover:bg-[#f8fbfc]"
                                            >
                                              <td className="px-3 py-2 text-center align-middle">
                                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand font-mono text-[11px] font-bold text-white">
                                                  {par.orden_parada ?? idx + 1}
                                                </span>
                                              </td>
                                              <td className="px-3 py-2 align-middle">
                                                <div className="font-mono font-bold text-brand">
                                                  {formatNroPedido(par.id_pedido)}
                                                </div>
                                                <div className="text-[10px] text-[#6d8088]">
                                                  {formatDateTime(par.fecha_pedido)}
                                                </div>
                                              </td>
                                              <td className="px-3 py-2 align-middle">
                                                <div className="font-semibold text-[#173d4b]">
                                                  {par.cliente_nombre}
                                                </div>
                                                {par.cliente_cuit && (
                                                  <div className="font-mono text-[10px] text-[#73878f]">
                                                    CUIT {par.cliente_cuit}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="px-3 py-2 align-middle">
                                                <div className="flex items-start gap-1.5 text-[#173d4b]">
                                                  <MapPin
                                                    size={13}
                                                    className="mt-0.5 shrink-0 text-brand"
                                                  />
                                                  <div>
                                                    <div className="font-medium">
                                                      {[
                                                        par.domicilio,
                                                        par.localidad,
                                                        par.provincia,
                                                      ]
                                                        .filter(Boolean)
                                                        .join(", ") ||
                                                        "Retira en planta / Sin domicilio"}
                                                    </div>
                                                    <div className="text-[10px] text-[#6d8088]">
                                                      Modalidad:{" "}
                                                      {MODALIDAD_META[
                                                        par.modalidad_entrega
                                                      ] || par.modalidad_entrega}
                                                      {par.observaciones
                                                        ? ` · Nota: ${par.observaciones}`
                                                        : ""}
                                                    </div>
                                                  </div>
                                                </div>
                                              </td>
                                              <td className="px-3 py-2 text-right align-middle font-mono">
                                                <div className="font-semibold text-[#173d4b]">
                                                  {formatQty(par.cantidad_productos)}{" "}
                                                  un.
                                                </div>
                                                <div className="text-[10.5px] text-[#5f737b]">
                                                  $ {formatMoney(par.importe_total)}
                                                </div>
                                              </td>
                                              <td className="px-3 py-2 align-middle">
                                                <Badge
                                                  tone={
                                                    estPed === "D"
                                                      ? "green"
                                                      : "blue"
                                                  }
                                                >
                                                  {estPed === "D"
                                                    ? "D · Despachado"
                                                    : `${estPed} · Listo para despacho`}
                                                </Badge>
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

        {/* Paginación */}
        <div className="mt-3 flex flex-col items-center justify-between gap-2 text-[11px] text-[#6d8088] sm:flex-row">
          <div>
            Mostrando{" "}
            <strong className="text-[#173d4b]">{paginatedHojas.length}</strong>{" "}
            de{" "}
            <strong className="text-[#173d4b]">{filteredHojas.length}</strong>{" "}
            hojas de ruta
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
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              className="h-7 border-[#d8e2e5] px-2 text-[11px]"
            >
              Siguiente
              <ChevronRight size={13} />
            </Button>
          </div>
        </div>
      </div>

      {/* MODAL CREAR / EDITAR HOJA DE RUTA */}
      <Dialog
        open={modalOpen}
        onOpenChange={(nextOpen) => {
          if (!savingHoja) setModalOpen(nextOpen);
        }}
      >
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-[96vw] max-w-4xl overflow-hidden rounded-xl border border-[#e1e8ea] bg-white p-0 shadow-card sm:max-w-4xl sm:p-0"
        >
          <div className="border-b border-[#e8eff1] bg-[#f6fafb] px-6 py-4 pr-10">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5e6f77]">
                PLANIFICACIÓN LOGÍSTICA · HOJA DE RUTA
              </span>
              <Badge tone="amber">Estado Hoja: P · Pendiente</Badge>
            </div>
            <DialogTitle className="font-barlow text-[22px] font-bold leading-tight text-[#163946]">
              {editingHoja
                ? `Editar Hoja de Ruta · ${editingHoja.nro_hoja_ruta}`
                : "Generar Nueva Hoja de Ruta"}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-[12px] text-[#6b7d85]">
              Seleccione el vehículo, el chofer habilitado (`id_rol = 17`), incorpore los pedidos en estado `L` y defina el orden del recorrido.
            </DialogDescription>
          </div>

          <form onSubmit={handleGuardarHojaRuta}>
            <div className="max-h-[75vh] space-y-4 overflow-y-auto px-6 py-4">
              {/* 1. Asignación de Vehículo, Chofer y Fecha */}
              <div className="rounded-lg border border-[#e1e8ea] bg-[#f8fafb] p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#214451]">
                    <Truck size={13} className="text-brand" />
                    1 · Datos de la Hoja de Ruta, Vehículo y Chofer
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-brand">
                    {editingHoja
                      ? editingHoja.nro_hoja_ruta
                      : "Nº autogenerado (HR-XXXXXX)"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {/* Fecha Hoja de Ruta */}
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                      Fecha de Hoja de Ruta *
                    </Label>
                    <Input
                      type="date"
                      required
                      value={fechaHojaInput}
                      onChange={(e) => setFechaHojaInput(e.target.value)}
                      className="h-9 border-[#dfe7e9] bg-white text-[12px] text-[#173d4b]"
                    />
                  </div>

                  {/* Vehículo */}
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                      Vehículo (`transporte.vehiculo`) *
                    </Label>
                    <select
                      required
                      value={selectedVehiculoId}
                      onChange={(e) => setSelectedVehiculoId(e.target.value)}
                      className="h-9 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[12px] text-[#173d4b] outline-none focus:border-brand"
                    >
                      <option value="">Seleccionar vehículo activo...</option>
                      {vehiculosActivos.map((v) => {
                        const hojaConflictoMismaFecha = hojasRuta.find(
                          (h) =>
                            String(h.estado_hoja_ruta || "P").trim() === "P" &&
                            String(h.fecha_hoja_ruta || "").slice(0, 10) ===
                              String(fechaHojaInput || "").slice(0, 10) &&
                            Number(h.id_vehiculo) === Number(v.id_vehiculo) &&
                            (!editingHoja ||
                              Number(h.id_hoja_ruta) !==
                                Number(editingHoja.id_hoja_ruta))
                        );
                        const ocupadoMismaFecha = Boolean(
                          hojaConflictoMismaFecha
                        );
                        return (
                          <option
                            key={v.id_vehiculo}
                            value={String(v.id_vehiculo)}
                            disabled={ocupadoMismaFecha}
                          >
                            {v.patente} —{" "}
                            {[v.marca, v.modelo].filter(Boolean).join(" ") ||
                              "Vehículo"}
                            {v.capacidad_kg
                              ? ` (${formatQty(v.capacidad_kg)} kg)`
                              : ""}
                            {ocupadoMismaFecha
                              ? ` [En ruta ${hojaConflictoMismaFecha.nro_hoja_ruta} en esta fecha]`
                              : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Chofer (id_rol = 17 en administracion.recursos_humanos) */}
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                      Chofer (RRHH `id_rol = 17`) *
                    </Label>
                    <select
                      required
                      value={selectedLegajoConductor}
                      onChange={(e) =>
                        setSelectedLegajoConductor(e.target.value)
                      }
                      className="h-9 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[12px] text-[#173d4b] outline-none focus:border-brand"
                    >
                      <option value="">Seleccionar chofer...</option>
                      {choferes.map((c) => {
                        const hojaConflictoMismaFecha = hojasRuta.find(
                          (h) =>
                            String(h.estado_hoja_ruta || "P").trim() === "P" &&
                            String(h.fecha_hoja_ruta || "").slice(0, 10) ===
                              String(fechaHojaInput || "").slice(0, 10) &&
                            String(h.legajo_conductor || "").trim() ===
                              String(c.legajo).trim() &&
                            (!editingHoja ||
                              Number(h.id_hoja_ruta) !==
                                Number(editingHoja.id_hoja_ruta))
                        );
                        const ocupadoMismaFecha = Boolean(
                          hojaConflictoMismaFecha
                        );
                        return (
                          <option
                            key={c.legajo}
                            value={String(c.legajo)}
                            disabled={ocupadoMismaFecha}
                          >
                            Leg. {c.legajo} · {c.apellido}, {c.nombre}
                            {c.dni ? ` (DNI ${c.dni})` : ""}
                            {ocupadoMismaFecha
                              ? ` [En ruta ${hojaConflictoMismaFecha.nro_hoja_ruta} en esta fecha]`
                              : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                    Observaciones generales de la hoja de ruta
                  </Label>
                  <Input
                    maxLength={1000}
                    value={observacionesHoja}
                    onChange={(e) => setObservacionesHoja(e.target.value)}
                    placeholder="Indicaciones de salida, horario programado, zona de reparto..."
                    className="h-9 border-[#dfe7e9] bg-white text-[12px] text-[#173d4b]"
                  />
                </div>
              </div>

              {/* 2. Selección de Pedidos en estado 'L' */}
              <div className="rounded-lg border border-[#e1e8ea] bg-white p-4">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#214451]">
                    <PackageCheck size={13} className="text-brand" />
                    2 · Pedidos en estado L disponibles para incorporar ({pedidosDisponiblesParaAgregar.length})
                  </div>

                  <div className="relative w-64">
                    <Search
                      size={13}
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#82979e]"
                    />
                    <input
                      type="search"
                      value={pedidoSearchModal}
                      onChange={(e) => setPedidoSearchModal(e.target.value)}
                      placeholder="Filtrar pedido o cliente..."
                      className="h-8 w-full rounded border border-[#d8e2e5] bg-[#f8fafb] pl-7 pr-2.5 text-[11px] text-[#173d4b] outline-none focus:border-brand focus:bg-white"
                    />
                  </div>
                </div>

                {pedidosDisponiblesParaAgregar.length === 0 ? (
                  <div className="rounded border border-dashed border-[#dce6e9] bg-[#fafcfd] py-3.5 text-center text-[11.5px] text-[#758990]">
                    No hay más pedidos en estado <strong>L (Listo para despacho)</strong> pendientes de asignar.
                  </div>
                ) : (
                  <div className="max-h-44 overflow-y-auto rounded border border-[#e6eef0]">
                    <table className="w-full border-collapse text-left text-[11.5px]">
                      <thead>
                        <tr className="border-b border-[#e6eef0] bg-[#f4f8f9] text-[9.5px] font-bold uppercase text-[#6d8088]">
                          <th className="px-2.5 py-1.5">Nº Pedido</th>
                          <th className="px-2.5 py-1.5">Cliente</th>
                          <th className="px-2.5 py-1.5">Destino / Localidad</th>
                          <th className="px-2.5 py-1.5 text-right">Unidades</th>
                          <th className="px-2.5 py-1.5 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#eef3f5]">
                        {pedidosDisponiblesParaAgregar.map((p) => (
                          <tr key={p.id_pedido} className="hover:bg-[#f8fbfc]">
                            <td className="px-2.5 py-1.5 font-mono font-bold text-brand">
                              {formatNroPedido(p.id_pedido)}
                            </td>
                            <td className="px-2.5 py-1.5 font-medium text-[#173d4b]">
                              {p.cliente_nombre}
                            </td>
                            <td className="px-2.5 py-1.5 text-[#5f737b]">
                              {[
                                p.domicilio_entrega,
                                p.localidad_entrega,
                                p.provincia_entrega,
                              ]
                                .filter(Boolean)
                                .join(", ") || "Retira en planta"}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono font-semibold text-[#173d4b]">
                              {formatQty(p.cantidad_productos)} un.
                            </td>
                            <td className="px-2.5 py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleAddPedidoAParadas(p)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded bg-brand px-2.5 py-1 text-[10.5px] font-semibold text-white hover:bg-[#114c5f]"
                              >
                                <Plus size={11} />
                                Agregar a ruta
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 3. Orden de Ruta / Recorrido Definido */}
              <div className="rounded-lg border border-[#e1e8ea] bg-white p-4">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#214451]">
                    <Route size={13} className="text-brand" />
                    3 · Orden de Ruta y Paradas del Recorrido ({paradasForm.length})
                  </div>
                  <span className="text-[11px] text-[#6d8088]">
                    Utilice las flechas o el número de orden para definir la secuencia de paradas
                  </span>
                </div>

                {paradasForm.length === 0 ? (
                  <div className="rounded border border-dashed border-[#dce6e9] bg-[#fafcfd] py-6 text-center text-[12px] text-[#758990]">
                    Aún no incorporó pedidos a esta hoja de ruta. Haga clic en <strong>«Agregar a ruta»</strong> en la lista superior.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded border border-[#e6eef0]">
                    <table className="w-full border-collapse text-left text-[11.5px]">
                      <thead>
                        <tr className="border-b border-[#e6eef0] bg-[#f4f8f9] text-[9.5px] font-bold uppercase text-[#6d8088]">
                          <th className="w-28 px-2.5 py-2 text-center">
                            Orden de Ruta
                          </th>
                          <th className="px-2.5 py-2">Pedido / Cliente</th>
                          <th className="px-2.5 py-2">Domicilio de Entrega</th>
                          <th className="px-2.5 py-2">Localidad / Provincia</th>
                          <th className="px-2.5 py-2 text-right">Unidades</th>
                          <th className="w-20 px-2.5 py-2 text-center">Quitar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#eef3f5]">
                        {paradasForm.map((par, idx) => (
                          <tr key={par.id_pedido} className="hover:bg-[#fafcfd]">
                            {/* Controles de Orden de Parada */}
                            <td className="px-2.5 py-2 align-middle">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  max={paradasForm.length}
                                  value={par.orden_parada}
                                  onChange={(e) =>
                                    handleChangeOrdenParadaInput(
                                      idx,
                                      e.target.value
                                    )
                                  }
                                  className="h-7 w-11 rounded border border-brand bg-[#eef5f8] text-center font-mono text-[11.5px] font-bold text-brand outline-none"
                                  title="Número de orden de parada"
                                />
                                <div className="flex flex-col gap-0.5">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => handleMoveParada(idx, -1)}
                                    className=" grid h-3.5 w-5 cursor-pointer place-items-center rounded border border-[#d8e2e5] bg-white text-[#214451] hover:bg-[#eef3f5] disabled:cursor-not-allowed disabled:opacity-35"
                                    title="Subir en el recorrido"
                                  >
                                    <ArrowUp size={10} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === paradasForm.length - 1}
                                    onClick={() => handleMoveParada(idx, 1)}
                                    className="grid h-3.5 w-5 cursor-pointer place-items-center rounded border border-[#d8e2e5] bg-white text-[#214451] hover:bg-[#eef3f5] disabled:cursor-not-allowed disabled:opacity-35"
                                    title="Bajar en el recorrido"
                                  >
                                    <ArrowDown size={10} />
                                  </button>
                                </div>
                              </div>
                            </td>

                            {/* Pedido / Cliente */}
                            <td className="px-2.5 py-2 align-middle">
                              <div className="font-mono font-bold text-brand">
                                {formatNroPedido(par.id_pedido)}
                              </div>
                              <div className="font-semibold text-[#173d4b]">
                                {par.cliente_nombre}
                              </div>
                            </td>

                            {/* Domicilio */}
                            <td className="px-2.5 py-2 align-middle">
                              <input
                                type="text"
                                value={par.domicilio}
                                onChange={(e) =>
                                  handleUpdateParadaField(
                                    par.id_pedido,
                                    "domicilio",
                                    e.target.value
                                  )
                                }
                                placeholder="Domicilio de parada..."
                                className="h-8 w-full rounded border border-[#d8e2e5] bg-white px-2 text-[11px] text-[#173d4b] outline-none focus:border-brand"
                              />
                            </td>

                            {/* Localidad / Provincia */}
                            <td className="px-2.5 py-2 align-middle">
                              <div className="grid grid-cols-2 gap-1.5">
                                <input
                                  type="text"
                                  value={par.localidad}
                                  onChange={(e) =>
                                    handleUpdateParadaField(
                                      par.id_pedido,
                                      "localidad",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Localidad"
                                  className="h-8 w-full rounded border border-[#d8e2e5] bg-white px-2 text-[11px] text-[#173d4b] outline-none focus:border-brand"
                                />
                                <input
                                  type="text"
                                  value={par.provincia}
                                  onChange={(e) =>
                                    handleUpdateParadaField(
                                      par.id_pedido,
                                      "provincia",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Provincia"
                                  className="h-8 w-full rounded border border-[#d8e2e5] bg-white px-2 text-[11px] text-[#173d4b] outline-none focus:border-brand"
                                />
                              </div>
                            </td>

                            {/* Unidades */}
                            <td className="px-2.5 py-2 text-right align-middle font-mono font-semibold text-[#173d4b]">
                              {formatQty(par.cantidad_productos)} un.
                            </td>

                            {/* Quitar */}
                            <td className="px-2.5 py-2 text-center align-middle">
                              <button
                                type="button"
                                onClick={() => handleRemoveParada(par.id_pedido)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#f1cfcb] bg-[#fbe9e7] px-2 py-1 text-[10px] font-semibold text-[#ba584d] hover:bg-[#f5d5d1]"
                                title="Quitar pedido de la hoja de ruta"
                              >
                                <Trash2 size={11} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2.5 border-t border-[#e8eff1] bg-[#fafcfd] px-6 py-3.5">
              <div className="text-[11px] text-[#5f737b]">
                Total paradas:{" "}
                <strong className="text-[#173d4b]">{paradasForm.length}</strong>{" "}
                · Total unidades:{" "}
                <strong className="text-[#173d4b]">
                  {formatQty(
                    paradasForm.reduce(
                      (acc, p) => acc + Number(p.cantidad_productos ?? 0),
                      0
                    )
                  )}
                </strong>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingHoja}
                  onClick={() => setModalOpen(false)}
                  className="h-9 border-[#d5e1e5] bg-white px-4 text-[12px] font-semibold text-[#214451]"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    savingHoja ||
                    !selectedVehiculoId ||
                    !selectedLegajoConductor ||
                    paradasForm.length === 0
                  }
                  className="h-9 bg-brand px-4 text-[12px] font-semibold text-white hover:bg-[#114c5f]"
                >
                  <CheckCircle2 size={14} className="mr-1.5" />
                  {savingHoja ? "Guardando..." : "Guardar hoja de Ruta"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL CONFIRMAR "DESPACHAR PEDIDO" (PASA HOJA A 'D' Y PEDIDOS A 'D') */}
      <Dialog
        open={Boolean(despacharDialogHoja)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !despachandoId) {
            setDespacharDialogHoja(null);
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-md overflow-hidden rounded-xl border border-[#e1e8ea] bg-white p-0 shadow-card sm:max-w-md sm:p-0">
          <div className="border-b border-[#e8eff1] bg-[#f6fafb] px-5 py-4 pr-10">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5e6f77]">
                CONFIRMAR SALIDA · {despacharDialogHoja?.nro_hoja_ruta}
              </span>
              <Badge tone="green">Despacho</Badge>
            </div>
            <DialogTitle className="font-barlow text-[20px] font-bold leading-tight text-[#163946]">
              Despachar Hoja de Ruta {despacharDialogHoja?.nro_hoja_ruta}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-[12px] text-[#6b7d85]">
              Vehículo: {despacharDialogHoja?.vehiculo_patente || "—"} · Chofer:{" "}
              {[
                despacharDialogHoja?.conductor_apellido,
                despacharDialogHoja?.conductor_nombre,
              ]
                .filter(Boolean)
                .join(", ") ||
                despacharDialogHoja?.legajo_conductor ||
                "—"}
            </DialogDescription>
          </div>

          <div className="space-y-3 px-5 py-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-[#b9dec9] bg-[#e7f4ed] p-3.5 text-[#1f563e]">
              <Send className="mt-0.5 h-4 w-4 shrink-0 text-[#256349]" />
              <div className="space-y-1 text-[12px] leading-relaxed">
                <p className="font-semibold">
                  ¿Confirmar el despacho de esta hoja de ruta?
                </p>
                <p className="text-[11px]">
                  La hoja de ruta pasará a estado{" "}
                  <strong>D · Despachada</strong> y los{" "}
                  <strong>
                    {despacharDialogHoja?.paradas?.length ?? 0} pedido(s)
                  </strong>{" "}
                  asignados pasarán a estado <strong>D · Despachado</strong> en{" "}
                  <code>administracion.pedido</code>.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-[#e8eff1] bg-[#fafcfd] px-5 py-3.5">
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(despachandoId)}
              onClick={() => setDespacharDialogHoja(null)}
              className="h-9 border-[#d5e1e5] bg-white px-4 text-[12px] font-semibold text-[#214451]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={Boolean(despachandoId)}
              onClick={handleConfirmarDespacho}
              className="h-9 bg-[#2e8b62] px-4 text-[12px] font-semibold text-white hover:bg-[#246e4d]"
            >
              <Send size={13} className="mr-1.5" />
              {despachandoId ? "Despachando..." : "Despachar pedido"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL CONFIRMAR ELIMINACIÓN DE HOJA DE RUTA */}
      <Dialog
        open={Boolean(eliminarDialogHoja)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !eliminandoId) {
            setEliminarDialogHoja(null);
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-md overflow-hidden rounded-xl border border-[#e1e8ea] bg-white p-0 shadow-card sm:max-w-md sm:p-0">
          <div className="border-b border-[#e8eff1] bg-[#f6fafb] px-5 py-4 pr-10">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5e6f77]">
                CONFIRMAR ELIMINACIÓN · {eliminarDialogHoja?.nro_hoja_ruta}
              </span>
              <Badge tone="red">Baja lógica</Badge>
            </div>
            <DialogTitle className="font-barlow text-[20px] font-bold leading-tight text-[#163946]">
              Eliminar Hoja de Ruta {eliminarDialogHoja?.nro_hoja_ruta}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-[12px] text-[#6b7d85]">
              Vehículo: {eliminarDialogHoja?.vehiculo_patente || "—"} · Chofer:{" "}
              {[
                eliminarDialogHoja?.conductor_apellido,
                eliminarDialogHoja?.conductor_nombre,
              ]
                .filter(Boolean)
                .join(", ") ||
                eliminarDialogHoja?.legajo_conductor ||
                "—"}
            </DialogDescription>
          </div>

          <div className="space-y-3 px-5 py-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-[#f1cfcb] bg-[#fbe9e7] p-3.5 text-[#8a3228]">
              <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-[#ba584d]" />
              <div className="space-y-1 text-[12px] leading-relaxed">
                <p className="font-semibold">
                  ¿Seguro desea eliminar la hoja de ruta{" "}
                  <span className="font-mono">
                    {eliminarDialogHoja?.nro_hoja_ruta}
                  </span>
                  ?
                </p>
                <p className="text-[11px]">
                  Esta a punto de eliminar esta hoja de ruta, al hacerlo el
                  vehículo y el chofer asignado quedarán liberados, y los{" "}
                  <strong>
                    {eliminarDialogHoja?.paradas?.length ?? 0} pedido(s)
                  </strong>{" "}
                  volverán a estar disponibles para asignarse a otra hoja de
                  ruta.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-[#e8eff1] bg-[#fafcfd] px-5 py-3.5">
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(eliminandoId)}
              onClick={() => setEliminarDialogHoja(null)}
              className="h-9 border-[#d5e1e5] bg-white px-4 text-[12px] font-semibold text-[#214451]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={Boolean(eliminandoId)}
              onClick={handleConfirmarEliminarHoja}
              className="h-9 bg-[#ba584d] px-4 text-[12px] font-semibold text-white hover:bg-[#9f463c]"
            >
              <Trash2 size={13} className="mr-1.5" />
              {eliminandoId ? "Eliminando..." : "Eliminar hoja de ruta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
