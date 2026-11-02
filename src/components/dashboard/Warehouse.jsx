import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock3,
  RefreshCw,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import SectionTitle from "@/components/common/SectionTitle";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import IconBox from "@/components/common/IconBox";
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

const formatoFecha = (fecha) => {
  if (!fecha) return "—";

  const [year, month, day] = String(fecha).slice(0, 10).split("-");
  return `${day} ${new Date(Number(year), Number(month) - 1, Number(day))
    .toLocaleString("es-AR", { month: "short" })
    .replace(".", "")} ${year}`;
};

const ESTADOS_LOTE_PERMITIDOS = new Set(["P", "R", "U", "B", "A"]);

const ETIQUETA_ESTADO_LOTE = {
  P: "Pendiente",
  R: "Recibido",
  U: "Ubicado",
  B: "Bloqueado",
  A: "Agotado",
};

const obtenerSituacion = (fecha) => {
  if (!fecha) return "Normal";

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const vencimiento = new Date(`${String(fecha).slice(0, 10)}T00:00:00`);
  if (hoy.getTime() > vencimiento.getTime()) {
    return "Vencido";
  }

  const limiteUnMes = new Date(hoy);
  limiteUnMes.setMonth(limiteUnMes.getMonth() + 1);

  if (vencimiento.getTime() <= limiteUnMes.getTime()) {
    return "Próximo a vencer";
  }

  return "Normal";
};

const diasHastaVencimiento = (fecha) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const vencimiento = new Date(`${String(fecha).slice(0, 10)}T00:00:00`);

  return Math.ceil(
    (vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
  );
};

const formatPct = (val) =>
  Number(val ?? 0).toLocaleString("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });

const formatInt = (val) => Number(val ?? 0).toLocaleString("es-AR");

const initialConfigForm = {
  idDeposito: "",
  codigoZona: "",
  cantidadPasillos: "1",
  posicionesPorPasillo: "112",
  cantidadNiveles: "4",
  capacidadKg: "",
  capacidadM3: "",
};

export default function Warehouse({ fakeAction, usuarioActual }) {
  const { token, user } = useAuth();
  const auditUser =
    user?.usuario_login || usuarioActual?.usuario_login || "";

  const [lotes, setLotes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [inventarioCriticoRpc, setInventarioCriticoRpc] = useState(null);
  const [stocksMap, setStocksMap] = useState(new Map());
  const [ubicacionesMap, setUbicacionesMap] = useState(new Map());
  const [depositos, setDepositos] = useState([]);
  const [zonasRaw, setZonasRaw] = useState([]);
  const [ocupacionZonas, setOcupacionZonas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal: Configurar y generar nueva zona
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configForm, setConfigForm] = useState(initialConfigForm);
  const [savingZona, setSavingZona] = useState(false);

  // Modal: Eliminar zona
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [delDepositoId, setDelDepositoId] = useState("");
  const [delCodigoZona, setDelCodigoZona] = useState("");
  const [deletingZona, setDeletingZona] = useState(false);

  // Cálculo directo de respaldo en caso de que aún no se haya ejecutado el RPC 56
  const calcularOcupacionFallback = useCallback(async (zonasActivas) => {
    try {
      if (!Array.isArray(zonasActivas) || zonasActivas.length === 0) {
        return [];
      }

      const [resPasillos, resModulos, resNiveles, resPosiciones] =
        await Promise.all([
          supabase
            .schema("deposito")
            .from("pasillo")
            .select("id_pasillo, id_zona, estado")
            .eq("estado", "A")
            .range(0, 4999),
          supabase
            .schema("deposito")
            .from("modulo")
            .select("id_modulo, id_pasillo, estado")
            .eq("estado", "A")
            .range(0, 9999),
          supabase
            .schema("deposito")
            .from("nivel")
            .select("id_nivel, id_modulo, estado")
            .eq("estado", "A")
            .range(0, 19999),
          supabase
            .schema("deposito")
            .from("posicion")
            .select("id_posicion, id_nivel, estado, estado_posicion")
            .range(0, 49999),
        ]);

      const pasillos = resPasillos.data ?? [];
      const modulos = resModulos.data ?? [];
      const niveles = resNiveles.data ?? [];
      const posiciones = resPosiciones.data ?? [];

      const pasilloToZona = new Map(
        pasillos.map((pa) => [Number(pa.id_pasillo), Number(pa.id_zona)])
      );
      const moduloToZona = new Map();
      for (const m of modulos) {
        const idZ = pasilloToZona.get(Number(m.id_pasillo));
        if (idZ != null) moduloToZona.set(Number(m.id_modulo), idZ);
      }
      const nivelToZona = new Map();
      for (const n of niveles) {
        const idZ = moduloToZona.get(Number(n.id_modulo));
        if (idZ != null) nivelToZona.set(Number(n.id_nivel), idZ);
      }

      const statsByZona = new Map();
      for (const z of zonasActivas) {
        statsByZona.set(Number(z.id_zona), {
          id_zona: Number(z.id_zona),
          id_deposito: Number(z.id_deposito),
          codigo_zona: String(z.codigo ?? "").trim(),
          nombre_zona: z.nombre,
          pasillosSet: new Set(),
          posiciones_totales: 0,
          posiciones_activas: 0,
          posiciones_ocupadas: 0,
          posiciones_disponibles: 0,
        });
      }

      for (const pa of pasillos) {
        const st = statsByZona.get(Number(pa.id_zona));
        if (st) st.pasillosSet.add(Number(pa.id_pasillo));
      }

      for (const pos of posiciones) {
        const idZ = nivelToZona.get(Number(pos.id_nivel));
        if (idZ == null) continue;
        const st = statsByZona.get(idZ);
        if (!st) continue;

        st.posiciones_totales += 1;
        const estAdmin = String(pos.estado ?? "").trim();
        const estPos = String(pos.estado_posicion ?? "").trim();
        if (estAdmin === "A") {
          st.posiciones_activas += 1;
          if (estPos === "O") st.posiciones_ocupadas += 1;
          if (estPos === "D") st.posiciones_disponibles += 1;
        }
      }

      return Array.from(statsByZona.values())
        .sort((a, b) =>
          String(a.codigo_zona).localeCompare(String(b.codigo_zona), "es")
        )
        .map((st) => ({
          id_zona: st.id_zona,
          id_deposito: st.id_deposito,
          codigo_zona: st.codigo_zona,
          nombre_zona: st.nombre_zona,
          cantidad_pasillos: st.pasillosSet.size,
          posiciones_totales: st.posiciones_totales,
          posiciones_ocupadas: st.posiciones_ocupadas,
          posiciones_disponibles: st.posiciones_disponibles,
          porcentaje_ocupacion:
            st.posiciones_activas > 0
              ? Math.round(
                  (100.0 * st.posiciones_ocupadas * 100) /
                    st.posiciones_activas
                ) / 100
              : 0,
        }));
    } catch (err) {
      console.error("Error en fallback de ocupación por zonas:", err);
      return [];
    }
  }, []);

  const cargarDeposito = useCallback(async () => {
    setLoading(true);

    try {
      const [
        { data: lotesData, error: lotesError },
        { data: productosData, error: productosError },
        { data: materialesData, error: materialesError },
        { data: unidadesData, error: unidadesError },
        resDepUsuarios,
        resZonasUsuarios,
        resOcupUsuarios,
        resInvCriticoUsuarios,
      ] = await Promise.all([
        supabase
          .schema("produccion")
          .from("lote_producto")
          .select(
            "id_lote_producto, id_produccion, id_producto, nro_lote, fecha_fabricacion, fecha_vencimiento, cantidad_total, estado_lote, estado"
          )
          .eq("estado", "A")
          .order("id_lote_producto", { ascending: false }),

        supabase
          .schema("produccion")
          .from("producto")
          .select(
            "id_producto, codigo, nombre, id_material, id_unidad_medida, es_biodegradable, estado"
          )
          .eq("estado", "A"),

        supabase
          .schema("produccion")
          .from("material")
          .select("id_material, codigo, nombre")
          .eq("estado", "A"),

        supabase
          .schema("produccion")
          .from("unidad_medida")
          .select("id_unidad_medida, codigo, nombre")
          .eq("estado", "A"),

        supabase
          .schema("usuarios")
          .rpc("listar_depositos_activos", { p_token: token ?? null }),

        supabase
          .schema("usuarios")
          .rpc("listar_zonas_activas", { p_token: token ?? null }),

        supabase
          .schema("usuarios")
          .rpc("obtener_ocupacion_deposito_zonas", { p_token: token ?? null }),

        supabase
          .schema("usuarios")
          .rpc("listar_inventario_critico_deposito", { p_token: token ?? null }),
      ]);

      if (lotesError) throw lotesError;
      if (productosError) throw productosError;

      if (materialesError) {
        console.error("Error al cargar materiales:", materialesError.message);
      }
      if (unidadesError) {
        console.error("Error al cargar unidades:", unidadesError.message);
      }

      setLotes(lotesData || []);
      setProductos(productosData || []);
      setMateriales(materialesData || []);
      setUnidades(unidadesData || []);

      if (
        !resInvCriticoUsuarios.error &&
        Array.isArray(resInvCriticoUsuarios.data)
      ) {
        setInventarioCriticoRpc(resInvCriticoUsuarios.data);
      } else {
        setInventarioCriticoRpc(null);
        try {
          const [resStocks, resLotePos, resPos] = await Promise.all([
            supabase
              .schema("deposito")
              .from("stock")
              .select(
                "id_lote_producto, cantidad_reservada, cantidad_consumida, estado"
              )
              .eq("estado", "A"),
            supabase
              .schema("deposito")
              .from("lote_posicion")
              .select("id_lote_producto, id_posicion, estado")
              .eq("estado", "A"),
            supabase
              .schema("deposito")
              .from("posicion")
              .select("id_posicion, codigo, estado")
              .eq("estado", "A"),
          ]);

          const mapStk = new Map();
          for (const st of resStocks.data || []) {
            mapStk.set(Number(st.id_lote_producto), st);
          }
          setStocksMap(mapStk);

          const posCodigoById = new Map();
          for (const p of resPos.data || []) {
            posCodigoById.set(Number(p.id_posicion), p.codigo);
          }

          const mapUbic = new Map();
          for (const lp of resLotePos.data || []) {
            const cod = posCodigoById.get(Number(lp.id_posicion));
            if (cod) mapUbic.set(Number(lp.id_lote_producto), cod);
          }
          setUbicacionesMap(mapUbic);
        } catch {
          // Si el esquema deposito no está expuesto directamente, se usa el fallback local
        }
      }

      // 1. Depósitos (deposito.deposito)
      let listaDepositos = [];
      if (!resDepUsuarios.error && Array.isArray(resDepUsuarios.data)) {
        listaDepositos = resDepUsuarios.data;
      } else {
        const { data: depDirect } = await supabase
          .schema("deposito")
          .from("deposito")
          .select("id_deposito, codigo, nombre, descripcion, estado")
          .eq("estado", "A")
          .order("id_deposito", { ascending: true });
        listaDepositos = depDirect || [];
      }
      setDepositos(listaDepositos);

      // 2. Zonas (deposito.zona)
      let listaZonas = [];
      if (!resZonasUsuarios.error && Array.isArray(resZonasUsuarios.data)) {
        listaZonas = resZonasUsuarios.data;
      } else {
        const { data: zonasDirect } = await supabase
          .schema("deposito")
          .from("zona")
          .select("id_zona, id_deposito, codigo, nombre, descripcion, estado")
          .eq("estado", "A")
          .order("codigo", { ascending: true });
        listaZonas = zonasDirect || [];
      }
      setZonasRaw(listaZonas);

      // 3. Ocupación del depósito por zonas
      if (!resOcupUsuarios.error && Array.isArray(resOcupUsuarios.data)) {
        setOcupacionZonas(resOcupUsuarios.data);
      } else {
        const resOcupDep = await supabase
          .schema("deposito")
          .rpc("fn_ocupacion_deposito_por_zonas");

        if (!resOcupDep.error && Array.isArray(resOcupDep.data)) {
          setOcupacionZonas(resOcupDep.data);
        } else {
          const fallbackOcup = await calcularOcupacionFallback(listaZonas);
          setOcupacionZonas(fallbackOcup);
        }
      }
    } catch (error) {
      console.error("Error al cargar el depósito:", error.message);
      fakeAction?.(`Error al cargar el depósito: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [fakeAction, token, calcularOcupacionFallback]);

  useEffect(() => {
    cargarDeposito();
  }, [cargarDeposito]);

  // Totales generales de ocupación del depósito
  const resumenOcupacionGeneral = useMemo(() => {
    const totales = ocupacionZonas.reduce(
      (acc, z) => {
        const tot = Number(z.posiciones_totales ?? 0);
        const ocu = Number(z.posiciones_ocupadas ?? 0);
        const disp = Number(z.posiciones_disponibles ?? 0);
        return {
          posicionesTotales: acc.posicionesTotales + tot,
          posicionesOcupadas: acc.posicionesOcupadas + ocu,
          posicionesDisponibles: acc.posicionesDisponibles + disp,
        };
      },
      {
        posicionesTotales: 0,
        posicionesOcupadas: 0,
        posicionesDisponibles: 0,
      }
    );

    const baseActiva =
      totales.posicionesOcupadas + totales.posicionesDisponibles ||
      totales.posicionesTotales;
    const porcentajeGeneral =
      baseActiva > 0
        ? Math.round((100.0 * totales.posicionesOcupadas * 100) / baseActiva) /
          100
        : 0;

    return {
      ...totales,
      porcentajeGeneral,
    };
  }, [ocupacionZonas]);

  // Validación en vivo del código de zona en el modal de Configurar Zona
  const codigosExistentesEnDepositoConfig = useMemo(() => {
    const depId = Number(configForm.idDeposito);
    if (!depId) return new Set();
    return new Set(
      zonasRaw
        .filter((z) => Number(z.id_deposito) === depId)
        .map((z) => String(z.codigo ?? "").trim().toUpperCase())
    );
  }, [zonasRaw, configForm.idDeposito]);

  const codigoZonaNormalizado = configForm.codigoZona.trim().toUpperCase();
  const codigoZonaDuplicado =
    codigoZonaNormalizado.length > 0 &&
    codigosExistentesEnDepositoConfig.has(codigoZonaNormalizado);
  const codigoZonaFormatoValido = /^[A-Z]$/.test(codigoZonaNormalizado);

  // Zonas filtradas por el depósito elegido en el modal de Eliminar Zona
  const zonasDelDepositoEliminar = useMemo(() => {
    const depId = Number(delDepositoId);
    if (!depId) return [];
    return zonasRaw.filter((z) => Number(z.id_deposito) === depId);
  }, [zonasRaw, delDepositoId]);

  const handleOpenConfigModal = () => {
    const defaultDepId =
      depositos[0]?.id_deposito != null
        ? String(depositos[0].id_deposito)
        : "";
    setConfigForm({
      ...initialConfigForm,
      idDeposito: defaultDepId,
    });
    setConfigModalOpen(true);
  };

  const handleOpenDeleteModal = () => {
    const defaultDepId =
      depositos[0]?.id_deposito != null
        ? String(depositos[0].id_deposito)
        : "";
    setDelDepositoId(defaultDepId);
    const primeraZona = zonasRaw.find(
      (z) => Number(z.id_deposito) === Number(defaultDepId)
    );
    setDelCodigoZona(
      primeraZona ? String(primeraZona.codigo).trim().toUpperCase() : ""
    );
    setDeleteModalOpen(true);
  };

  const handleSubmitConfigurarZona = async (e) => {
    e.preventDefault();
    if (savingZona) return;

    if (!auditUser && !token) {
      toast.error(
        "No se identificó el usuario en sesión para registrar la operación."
      );
      return;
    }

    const idDep = Number(configForm.idDeposito);
    if (!Number.isInteger(idDep) || idDep <= 0) {
      toast.error("Seleccioná un depósito válido.");
      return;
    }

    if (!codigoZonaFormatoValido) {
      toast.error("El código de zona debe ser una única letra entre A y Z.");
      return;
    }

    if (codigoZonaDuplicado) {
      toast.error(
        `Ya existe la Zona ${codigoZonaNormalizado} en el depósito seleccionado.`
      );
      return;
    }

    const cantPasillos = Number(configForm.cantidadPasillos);
    const posPorPasillo = Number(configForm.posicionesPorPasillo);
    const cantNiveles = Number(configForm.cantidadNiveles);

    if (!Number.isInteger(cantPasillos) || cantPasillos <= 0) {
      toast.error(
        "La cantidad de pasillos debe ser un número entero mayor a 0."
      );
      return;
    }
    if (!Number.isInteger(posPorPasillo) || posPorPasillo <= 0) {
      toast.error(
        "Las posiciones por pasillo deben ser un número entero mayor a 0."
      );
      return;
    }
    if (!Number.isInteger(cantNiveles) || cantNiveles <= 0) {
      toast.error(
        "La cantidad de niveles debe ser un número entero mayor a 0."
      );
      return;
    }

    const capKg =
      configForm.capacidadKg.trim() === ""
        ? null
        : Number(configForm.capacidadKg);
    const capM3 =
      configForm.capacidadM3.trim() === ""
        ? null
        : Number(configForm.capacidadM3);

    if (capKg !== null && (!Number.isFinite(capKg) || capKg <= 0)) {
      toast.error("La capacidad en kg debe ser mayor a 0 o dejarse vacía.");
      return;
    }
    if (capM3 !== null && (!Number.isFinite(capM3) || capM3 <= 0)) {
      toast.error("La capacidad en m³ debe ser mayor a 0 o dejarse vacía.");
      return;
    }

    setSavingZona(true);
    try {
      let idConfigCreada = null;
      const resUsuarios = await supabase
        .schema("usuarios")
        .rpc("configurar_y_generar_zona_deposito", {
          p_token: token ?? null,
          p_id_deposito: idDep,
          p_codigo_zona: codigoZonaNormalizado,
          p_cantidad_pasillos: cantPasillos,
          p_posiciones_por_pasillo: posPorPasillo,
          p_cantidad_niveles: cantNiveles,
          p_capacidad_kg: capKg,
          p_capacidad_m3: capM3,
          p_usuario: auditUser,
        });

      if (!resUsuarios.error) {
        idConfigCreada = resUsuarios.data;
      } else {
        const resDeposito = await supabase
          .schema("deposito")
          .rpc("fn_configurar_y_generar_zona", {
            p_id_deposito: idDep,
            p_codigo_zona: codigoZonaNormalizado,
            p_cantidad_pasillos: cantPasillos,
            p_posiciones_por_pasillo: posPorPasillo,
            p_cantidad_niveles: cantNiveles,
            p_capacidad_kg: capKg,
            p_capacidad_m3: capM3,
            p_usuario: auditUser,
          });

        if (resDeposito.error) {
          console.error(
            "Error al configurar y generar zona:",
            resDeposito.error
          );
          toast.error(
            resDeposito.error.message ||
              resUsuarios.error.message ||
              "No se pudo configurar y generar la zona"
          );
          return;
        }
        idConfigCreada = resDeposito.data;
      }

      toast.success(
        `Zona ${codigoZonaNormalizado} configurada y generada correctamente${
          idConfigCreada ? ` (Config. #${idConfigCreada})` : ""
        }`
      );
      fakeAction?.(`Zona ${codigoZonaNormalizado} generada`);
      setConfigModalOpen(false);
      await cargarDeposito();
    } catch (err) {
      console.error("Error inesperado al generar zona:", err);
      toast.error("Ocurrió un error al generar la zona");
    } finally {
      setSavingZona(false);
    }
  };

  const handleSubmitEliminarZona = async (e) => {
    e.preventDefault();
    if (deletingZona) return;

    if (!auditUser && !token) {
      toast.error(
        "No se identificó el usuario en sesión para registrar la operación."
      );
      return;
    }

    const idDep = Number(delDepositoId);
    const codZona = delCodigoZona.trim().toUpperCase();

    if (!Number.isInteger(idDep) || idDep <= 0) {
      toast.error("Seleccioná un depósito válido.");
      return;
    }
    if (!codZona) {
      toast.error("Seleccioná la zona que deseás eliminar.");
      return;
    }

    const zonaOcupacion = ocupacionZonas.find(
      (z) =>
        Number(z.id_deposito) === idDep &&
        String(z.codigo_zona ?? "").trim().toUpperCase() === codZona
    );
    const ocupadasZona = Number(zonaOcupacion?.posiciones_ocupadas ?? 0);
    if (ocupadasZona > 0) {
      toast.error(
        `No se puede eliminar la Zona ${codZona}: tiene ${formatInt(
          ocupadasZona
        )} posición(es) ocupada(s) con productos.`
      );
      return;
    }

    setDeletingZona(true);
    try {
      const resUsuarios = await supabase
        .schema("usuarios")
        .rpc("eliminar_zona_deposito", {
          p_token: token ?? null,
          p_id_deposito: idDep,
          p_codigo_zona: codZona,
          p_usuario: auditUser,
        });

      if (resUsuarios.error) {
        const resDeposito = await supabase
          .schema("deposito")
          .rpc("fn_eliminar_zona", {
            p_id_deposito: idDep,
            p_codigo_zona: codZona,
            p_usuario: auditUser,
          });

        if (resDeposito.error) {
          console.error("Error al eliminar zona:", resDeposito.error);
          toast.error(
            resDeposito.error.message ||
              resUsuarios.error.message ||
              "No se pudo eliminar la zona"
          );
          return;
        }
      }

      toast.success(`Zona ${codZona} eliminada correctamente`);
      fakeAction?.(`Zona ${codZona} eliminada`);
      setDeleteModalOpen(false);
      await cargarDeposito();
    } catch (err) {
      console.error("Error inesperado al eliminar zona:", err);
      toast.error("Ocurrió un error al eliminar la zona");
    } finally {
      setDeletingZona(false);
    }
  };

  const buscarProducto = useCallback(
    (idProducto) =>
      productos.find((producto) => producto.id_producto === idProducto),
    [productos]
  );

  const buscarMaterial = useCallback(
    (idMaterial) =>
      materiales.find((material) => material.id_material === idMaterial),
    [materiales]
  );

  const buscarUnidad = useCallback(
    (idUnidad) =>
      unidades.find((unidad) => unidad.id_unidad_medida === idUnidad),
    [unidades]
  );

  // Lotes del Inventario Crítico: productos con es_biodegradable = true y estado_lote en (P, R, U, B, A)
  const inventarioCriticoItems = useMemo(() => {
    if (Array.isArray(inventarioCriticoRpc)) {
      return inventarioCriticoRpc
        .filter((row) => {
          const codEst = String(row.codigo_estado_lote ?? "").trim().toUpperCase();
          return Boolean(row.es_biodegradable) && ESTADOS_LOTE_PERMITIDOS.has(codEst);
        })
        .map((row) => {
          const codEst = String(row.codigo_estado_lote ?? "").trim().toUpperCase();
          const situacion = obtenerSituacion(row.fecha_vencimiento);
          return {
            id_lote_producto: row.id_lote_producto,
            codigo_lote:
              row.codigo_lote || `Lote ${row.id_lote_producto}`,
            material_nombre:
              row.material_nombre || row.producto_nombre || "—",
            producto_nombre: row.producto_nombre || "Producto",
            es_biodegradable: Boolean(row.es_biodegradable),
            ubicacion_fisica: row.ubicacion_fisica || "—",
            stock_disponible: Number(row.stock_disponible ?? 0),
            cantidad_total: Number(row.cantidad_total ?? 0),
            unidad_codigo: row.unidad_codigo || "",
            fecha_vencimiento: row.fecha_vencimiento,
            codigo_estado_lote: codEst,
            estado_lote_nombre:
              row.estado_lote_nombre ||
              ETIQUETA_ESTADO_LOTE[codEst] ||
              codEst,
            situacion,
          };
        });
    }

    return lotes
      .filter((lote) => {
        const producto = buscarProducto(lote.id_producto);
        const codEst = String(lote.estado_lote ?? "").trim().toUpperCase();
        return (
          Boolean(producto?.es_biodegradable) &&
          ESTADOS_LOTE_PERMITIDOS.has(codEst)
        );
      })
      .map((lote) => {
        const producto = buscarProducto(lote.id_producto);
        const material = producto ? buscarMaterial(producto.id_material) : null;
        const unidad = producto ? buscarUnidad(producto.id_unidad_medida) : null;
        const codEst = String(lote.estado_lote ?? "").trim().toUpperCase();
        const stk = stocksMap.get(Number(lote.id_lote_producto));
        const cantTotal = Number(lote.cantidad_total ?? 0);
        const cantRes = Number(stk?.cantidad_reservada ?? 0);
        const cantCons = Number(stk?.cantidad_consumida ?? 0);
        const stockDisp =
          codEst === "A"
            ? 0
            : Math.max(cantTotal - cantRes - cantCons, 0);
        const ubicacion =
          ubicacionesMap.get(Number(lote.id_lote_producto)) || "—";

        return {
          id_lote_producto: lote.id_lote_producto,
          codigo_lote: lote.nro_lote || `Lote ${lote.id_lote_producto}`,
          material_nombre: material?.nombre || producto?.nombre || "—",
          producto_nombre: producto?.nombre || "Producto",
          es_biodegradable: true,
          ubicacion_fisica: ubicacion,
          stock_disponible: stockDisp,
          cantidad_total: cantTotal,
          unidad_codigo: unidad?.codigo || "",
          fecha_vencimiento: lote.fecha_vencimiento,
          codigo_estado_lote: codEst,
          estado_lote_nombre: ETIQUETA_ESTADO_LOTE[codEst] || codEst,
          situacion: obtenerSituacion(lote.fecha_vencimiento),
        };
      });
  }, [
    inventarioCriticoRpc,
    lotes,
    buscarProducto,
    buscarMaterial,
    buscarUnidad,
    stocksMap,
    ubicacionesMap,
  ]);

  const stockRows = useMemo(
    () =>
      inventarioCriticoItems.map((item) => [
        <strong key={`cod-${item.id_lote_producto}`} className="text-[#173c4b]">
          {item.codigo_lote}
        </strong>,
        item.material_nombre,
        <Badge key={`bio-${item.id_lote_producto}`} tone="green">
          Sí
        </Badge>,
        <span key={`ubi-${item.id_lote_producto}`} className="font-mono">
          {item.ubicacion_fisica}
        </span>,
        <span
          key={`stk-${item.id_lote_producto}`}
          className="font-mono font-semibold text-[#173c4b]"
        >
          {`${Number(item.stock_disponible).toLocaleString("es-AR")} ${
            item.unidad_codigo || ""
          }`.trim()}
        </span>,
        <span
          key={`ven-${item.id_lote_producto}`}
          className={
            item.situacion === "Vencido"
              ? "font-bold text-red"
              : item.situacion === "Próximo a vencer"
                ? "font-semibold text-amber"
                : ""
          }
        >
          {formatoFecha(item.fecha_vencimiento)}
        </span>,
        <Badge
          key={`est-${item.id_lote_producto}`}
          tone={
            item.codigo_estado_lote === "U"
              ? "blue"
              : item.codigo_estado_lote === "B"
                ? "red"
                : item.codigo_estado_lote === "A"
                  ? "slate"
                  : "amber"
          }
        >
          {item.estado_lote_nombre}
        </Badge>,
        <Badge
          key={`sit-${item.id_lote_producto}`}
          tone={
            item.situacion === "Vencido"
              ? "red"
              : item.situacion === "Próximo a vencer"
                ? "amber"
                : "green"
          }
        >
          {item.situacion}
        </Badge>,
      ]),
    [inventarioCriticoItems]
  );

  const lotesConVencimiento = useMemo(
    () =>
      inventarioCriticoItems
        .filter(
          (item) =>
            item.fecha_vencimiento &&
            (item.situacion === "Vencido" ||
              item.situacion === "Próximo a vencer")
        )
        .map((item) => ({
          ...item,
          diasRestantes: diasHastaVencimiento(item.fecha_vencimiento),
        }))
        .sort((a, b) => a.diasRestantes - b.diasRestantes),
    [inventarioCriticoItems]
  );

  const totalLotes = inventarioCriticoItems.length;

  const lotesCriticos = inventarioCriticoItems.filter(
    (item) => item.situacion === "Vencido"
  ).length;

  const lotesAtencion = inventarioCriticoItems.filter(
    (item) => item.situacion === "Próximo a vencer"
  ).length;

  const labelCls =
    "text-[10px] font-bold uppercase tracking-widest text-muted-ink";
  const selectNativeCls =
    "h-9 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[11px] text-ink-soft outline-none focus:border-[#214451]";

  return (
    <>
      <SectionTitle
        eyebrow="03 · DEPÓSITO"
        title="Detalle General del Depósito"
        description="Ubicaciones físicas, ocupación por zonas, mínimos operativos y vencimientos próximos."
      />

      {/* PANEL: OCUPACIÓN DEL DEPÓSITO POR ZONAS */}
      <div className="mb-3.5 rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
              CAPACIDAD FÍSICA · POSICIONES OCUPADAS Y DISPONIBLES
            </div>
            <h3 className="m-0 font-barlow text-[22px] text-[#214451]">
              Ocupación del depósito por zonas
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={cargarDeposito}
              className="inline-flex h-8.5 cursor-pointer items-center gap-1.5 rounded-md border border-[#dce5e8] bg-white px-3 text-[11px] font-semibold text-[#214451] hover:bg-[#f4f7f8]"
            >
              <RefreshCw size={13} />
              Actualizar
            </button>

            <button
              type="button"
              onClick={handleOpenConfigModal}
              className="inline-flex h-8.5 cursor-pointer items-center gap-1.5 rounded-md bg-[#145c73] px-3 text-[11px] font-semibold text-white hover:bg-[#10485b]"
            >
              <Settings2 size={14} />
              Configurar y generar zona
            </button>

            <button
              type="button"
              onClick={handleOpenDeleteModal}
              className="inline-flex h-8.5 cursor-pointer items-center gap-1.5 rounded-md border border-[#f1cfcb] bg-[#fbe9e7] px-3 text-[11px] font-semibold text-[#ba584d] hover:bg-[#f5d5d1]"
            >
              <Trash2 size={13} />
              Eliminar zona
            </button>
          </div>
        </div>

        {/* Resumen visual de tarjetas por zona + Total del depósito */}
        {loading ? (
          <p className="py-4 text-center text-[11px] text-[#91a0a4]">
            Calculando ocupación por zonas...
          </p>
        ) : ocupacionZonas.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-[#91a0a4]">
            No hay zonas activas configuradas en el depósito.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ocupacionZonas.map((z) => {
              const pct = Number(z.porcentaje_ocupacion ?? 0);
              const ocupadas = Number(z.posiciones_ocupadas ?? 0);
              const disponibles = Number(z.posiciones_disponibles ?? 0);

              return (
                <div
                  key={z.id_zona ?? z.nombre_zona}
                  className="rounded-lg border border-[#e1e8ea] bg-[#f8fbfc] p-3.5"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <strong className="font-barlow text-[19px] text-[#173c4b]">
                      {z.nombre_zona}
                    </strong>
                    <span className="font-barlow text-[22px] font-bold text-brand">
                      {formatPct(pct)}%
                    </span>
                  </div>

                  <div className="my-2 h-2 overflow-hidden rounded-full bg-[#e3ecef]">
                    <div
                      className="h-full rounded-full bg-brand transition-all"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#5c727a]">
                    <span>
                      <strong className="text-[#173c4b]">
                        {formatInt(ocupadas)}
                      </strong>{" "}
                      ocupadas |{" "}
                      <strong className="text-[#256349]">
                        {formatInt(disponibles)}
                      </strong>{" "}
                      disponibles
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Cuadro resumen: Total del depósito */}
            <div className="rounded-lg border border-[#145c73] bg-[#eef6f8] p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <strong className="font-barlow text-[19px] text-[#145c73]">
                  Total del depósito
                </strong>
                <span className="font-barlow text-[22px] font-bold text-[#145c73]">
                  {formatPct(resumenOcupacionGeneral.porcentajeGeneral)}%
                </span>
              </div>

              <div className="my-2 h-2 overflow-hidden rounded-full bg-[#cfe2e8]">
                <div
                  className="h-full rounded-full bg-[#145c73] transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      resumenOcupacionGeneral.porcentajeGeneral
                    )}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#214451]">
                <span>
                  <strong className="text-[#145c73]">
                    {formatInt(resumenOcupacionGeneral.posicionesOcupadas)} /{" "}
                    {formatInt(resumenOcupacionGeneral.posicionesTotales)}
                  </strong>{" "}
                  ocupadas
                </span>
                <span className="text-[10.5px] text-[#5c727a]">
                  ({formatInt(resumenOcupacionGeneral.posicionesDisponibles)} disp.)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
        <div className="mb-4.5 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
              UBICACIONES Y ALERTAS · {totalLotes} LOTES BIODEGRADABLES
            </div>
            <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
              Inventario crítico
            </h3>
          </div>
        </div>

        <Table
          headers={[
            "Código",
            "Material",
            "Biodegradable",
            "Ubicación física",
            "Stock Disponible",
            "Vencimiento",
            "Estado",
            "Situación",
          ]}
          rows={stockRows}
          renderCell={(cell) => cell}
        />

        {!loading && stockRows.length === 0 && (
          <p className="py-4 text-center text-[11px] text-[#91a0a4]">
            No hay lotes de productos biodegradables registrados.
          </p>
        )}
      </div>

      <div className="mt-3.5 rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
        <div className="mb-4.5 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
              ALERTAS DE VENCIMIENTO
            </div>
            <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
              Acciones sugeridas
            </h3>
          </div>

          <AlertTriangle size={18} className="text-amber" />
        </div>

        {lotesConVencimiento.length > 0 ? (
          lotesConVencimiento.map((lote, index) => (
            <div
              key={lote.id_lote_producto}
              className={`flex items-center gap-2.5 py-2.75 ${
                index > 0 ? "border-t border-slate-soft" : ""
              }`}
            >
              <IconBox
                icon={index === 0 ? AlertTriangle : Clock3}
                tone={index === 0 ? "amber" : "slate"}
              />

              <div className="flex-1">
                <strong className="block text-[11px] text-[#49656e]">
                  {lote.codigo_lote} ·{" "}
                  {lote.diasRestantes < 0
                    ? `vencido hace ${Math.abs(lote.diasRestantes)} días`
                    : `vence en ${lote.diasRestantes} días`}
                </strong>

                <span className="mt-1 block text-[9px] text-[#91a0a4]">
                  {Number(lote.stock_disponible).toLocaleString("es-AR")}{" "}
                  {lote.unidad_codigo || ""} · {lote.producto_nombre}
                </span>
              </div>

              <button
                className="rounded border border-[#e1e8ea] px-1.75 py-1.25 text-[9px] font-bold text-brand"
                onClick={() =>
                  fakeAction?.(
                    `Prioridad aplicada al lote ${lote.codigo_lote}`
                  )
                }
              >
                Priorizar
              </button>
            </div>
          ))
        ) : (
          <div className="flex items-center gap-2.5 py-2.75">
            <IconBox icon={Clock3} tone="slate" />
            <div className="flex-1">
              <strong className="block text-[11px] text-[#49656e]">
                {loading
                  ? "Consultando vencimientos..."
                  : "Sin vencimientos próximos"}
              </strong>
              <span className="mt-1 block text-[9px] text-[#91a0a4]">
                {loading
                  ? "Cargando información del inventario"
                  : "No hay lotes vencidos o próximos a vencer"}
              </span>
            </div>
          </div>
        )}

        {!loading && (lotesCriticos > 0 || lotesAtencion > 0) && (
          <p className="mt-2 border-t border-slate-soft pt-3 text-[10px] text-[#82979e]">
            {lotesCriticos} vencidos · {lotesAtencion} próximos a vencer
          </p>
        )}
      </div>

      {/* MODAL: CONFIGURAR Y GENERAR NUEVA ZONA */}
      <Dialog
        open={configModalOpen}
        onOpenChange={(open) => {
          if (!savingZona) setConfigModalOpen(open);
        }}
      >
        <DialogContent className="max-w-135 border border-[#e1e8ea] bg-white p-0 shadow-card">
          <DialogHeader className="border-b border-slate-soft bg-white px-6 py-4">
            <DialogTitle className="font-barlow text-[22px] font-normal text-ink">
              Configurar y generar nueva zona
            </DialogTitle>
            <DialogDescription className="text-[12px] text-muted-ink">
              Crea la configuración de zona y genera automáticamente sus
              pasillos, módulos, niveles y posiciones en el depósito.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitConfigurarZona}>
            <div className="space-y-3.5 bg-white px-6 py-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className={labelCls}>Depósito *</Label>
                  <select
                    value={configForm.idDeposito}
                    onChange={(e) =>
                      setConfigForm((prev) => ({
                        ...prev,
                        idDeposito: e.target.value,
                      }))
                    }
                    className={selectNativeCls}
                    required
                  >
                    <option value="">Seleccionar depósito...</option>
                    {depositos.map((dep) => (
                      <option
                        key={dep.id_deposito}
                        value={String(dep.id_deposito)}
                      >
                        {dep.nombre} ({dep.codigo})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className={labelCls}>
                    Código de zona (Letra A-Z) *
                  </Label>
                  <Input
                    maxLength={1}
                    value={configForm.codigoZona}
                    onChange={(e) =>
                      setConfigForm((prev) => ({
                        ...prev,
                        codigoZona: e.target.value
                          .replace(/[^a-zA-Z]/g, "")
                          .toUpperCase(),
                      }))
                    }
                    placeholder="Ej: C"
                    className={`h-9 border text-[12px] font-bold uppercase ${
                      codigoZonaDuplicado
                        ? "border-[#ba584d] bg-[#fbe9e7] text-[#ba584d]"
                        : "border-[#dfe7e9] bg-white"
                    }`}
                    required
                  />
                  {codigoZonaDuplicado && (
                    <span className="block text-[10px] font-semibold text-[#ba584d]">
                      Ya existe la Zona {codigoZonaNormalizado} en este
                      depósito.
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className={labelCls}>Cantidad de pasillos *</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={configForm.cantidadPasillos}
                    onChange={(e) =>
                      setConfigForm((prev) => ({
                        ...prev,
                        cantidadPasillos: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                    placeholder="Ej: 1"
                    className="h-9 border-[#dfe7e9] bg-white text-[11px]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className={labelCls}>Posiciones por pasillo *</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={configForm.posicionesPorPasillo}
                    onChange={(e) =>
                      setConfigForm((prev) => ({
                        ...prev,
                        posicionesPorPasillo: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                    placeholder="Ej: 112"
                    className="h-9 border-[#dfe7e9] bg-white text-[11px]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className={labelCls}>Cantidad de niveles *</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={configForm.cantidadNiveles}
                    onChange={(e) =>
                      setConfigForm((prev) => ({
                        ...prev,
                        cantidadNiveles: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                    placeholder="Ej: 4"
                    className="h-9 border-[#dfe7e9] bg-white text-[11px]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className={labelCls}>
                    Capacidad en kg (Opcional)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={configForm.capacidadKg}
                    onChange={(e) =>
                      setConfigForm((prev) => ({
                        ...prev,
                        capacidadKg: e.target.value,
                      }))
                    }
                    placeholder="Vacío = NULL"
                    className="h-9 border-[#dfe7e9] bg-white text-[11px]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className={labelCls}>
                    Capacidad en m³ (Opcional)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={configForm.capacidadM3}
                    onChange={(e) =>
                      setConfigForm((prev) => ({
                        ...prev,
                        capacidadM3: e.target.value,
                      }))
                    }
                    placeholder="Vacío = NULL"
                    className="h-9 border-[#dfe7e9] bg-white text-[11px]"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-slate-soft bg-white px-6 py-3.5">
              <Button
                type="button"
                variant="outline"
                disabled={savingZona}
                onClick={() => setConfigModalOpen(false)}
                className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  savingZona ||
                  !configForm.idDeposito ||
                  !codigoZonaFormatoValido ||
                  codigoZonaDuplicado
                }
                className="h-9 bg-green text-[11px] font-semibold text-white hover:bg-[#328160]"
              >
                {savingZona ? "Generando estructura..." : "Configurar y generar zona"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: ELIMINAR ZONA */}
      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          if (!deletingZona) setDeleteModalOpen(open);
        }}
      >
        <DialogContent className="max-w-120 border border-[#e1e8ea] bg-white p-0 shadow-card">
          <DialogHeader className="border-b border-slate-soft bg-white px-6 py-4">
            <DialogTitle className="font-barlow text-[22px] font-normal text-ink">
              Eliminar zona de depósito
            </DialogTitle>
            <DialogDescription className="text-[12px] text-muted-ink">
              Elimina una zona y su estructura física siempre que no posea lotes
              ubicados ni historial de movimientos asociados.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitEliminarZona}>
            <div className="space-y-3.5 bg-white px-6 py-4">
              <div className="space-y-1">
                <Label className={labelCls}>Depósito *</Label>
                <select
                  value={delDepositoId}
                  onChange={(e) => {
                    const nextDep = e.target.value;
                    setDelDepositoId(nextDep);
                    const zFirst = zonasRaw.find(
                      (z) => Number(z.id_deposito) === Number(nextDep)
                    );
                    setDelCodigoZona(
                      zFirst
                        ? String(zFirst.codigo).trim().toUpperCase()
                        : ""
                    );
                  }}
                  className={selectNativeCls}
                  required
                >
                  <option value="">Seleccionar depósito...</option>
                  {depositos.map((dep) => (
                    <option
                      key={dep.id_deposito}
                      value={String(dep.id_deposito)}
                    >
                      {dep.nombre} ({dep.codigo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className={labelCls}>Zona a eliminar *</Label>
                <select
                  value={delCodigoZona}
                  onChange={(e) => setDelCodigoZona(e.target.value)}
                  className={selectNativeCls}
                  required
                >
                  <option value="">Seleccionar zona...</option>
                  {zonasDelDepositoEliminar.map((z) => {
                    const cod = String(z.codigo ?? "").trim().toUpperCase();
                    return (
                      <option key={z.id_zona} value={cod}>
                        {z.nombre} (Código: {cod})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <DialogFooter className="border-t border-slate-soft bg-white px-6 py-3.5">
              <Button
                type="button"
                variant="outline"
                disabled={deletingZona}
                onClick={() => setDeleteModalOpen(false)}
                className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={deletingZona || !delDepositoId || !delCodigoZona}
                className="h-9 bg-[#ba584d] text-[11px] font-semibold text-white hover:bg-[#9f463c]"
              >
                {deletingZona ? "Eliminando zona..." : "Eliminar zona"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
