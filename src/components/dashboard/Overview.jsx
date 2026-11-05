import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardList,
  Clock3,
  RefreshCw,
  Truck,
} from "lucide-react";

import { toast } from "sonner";

import SectionTitle from "@/components/common/SectionTitle";
import Kpi from "@/components/common/Kpi";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import ActionButton from "@/components/common/ActionButton";

import YardRow from "./YardRow";

import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { dispatchRows } from "@/data/mockData";

const ESTADO_PEDIDO_META = {
  P: { label: "Pendiente", tone: "amber" },
  C: { label: "Confirmado", tone: "blue" },
  M: { label: "Modificado", tone: "amber" },
  E: { label: "En preparación", tone: "blue" },
  L: { label: "Listo para entregar", tone: "green" },
  D: { label: "Despachado", tone: "green" },
  A: { label: "Anulado", tone: "red" },
};

const ESTADOS_LOTE_PERMITIDOS = new Set(["P", "R", "U", "B", "A"]);

const formatearFecha = (fecha) => {
  if (!fecha) return "—";

  return new Date(fecha).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatearCantidad = (cantidad) =>
  Number(cantidad ?? 0).toLocaleString("es-AR");

const obtenerSituacionVencimiento = (fecha) => {
  if (!fecha) return "Normal";

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const vencimiento = new Date(
    `${String(fecha).slice(0, 10)}T00:00:00`
  );

  if (Number.isNaN(vencimiento.getTime())) return "Normal";

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

const obtenerClaveFecha = (fecha) => {
  const d = new Date(fecha);

  if (Number.isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const crearDiasSemana = () => {
  const dias = [];
  const hoy = new Date();

  for (let i = 6; i >= 0; i--) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() - i);

    dias.push({
      clave: obtenerClaveFecha(fecha),
      etiqueta: fecha.toLocaleDateString("es-AR", {
        weekday: "short",
      }).replace(".", ""),
      cantidad: 0,
    });
  }

  return dias;
};

// dispatchRows utiliza filas con esta estructura:
// [hoja, cliente, camión, chofer, picking, estado]
const obtenerEstadoCamion = (fila) => {
  if (Array.isArray(fila)) {
    return String(fila[5] ?? "").trim().toLowerCase();
  }

  return String(fila?.estado ?? "").trim().toLowerCase();
};

export default function Overview({ fakeAction, navigate }) {
  const { token } = useAuth();

  const [pedidos, setPedidos] = useState([]);
  const [producciones, setProducciones] = useState([]);
  const [inventarioCritico, setInventarioCritico] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargarDatos = useCallback(async () => {
    if (!token) {
      setPedidos([]);
      setProducciones([]);
      setInventarioCritico([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [
        resPedidos,
        resProduccion,
        resInventarioCritico,
      ] = await Promise.all([
        supabase
          .schema("usuarios")
          .rpc("listar_pedidos_gestion", {
            p_token: token,
          }),

        supabase
          .schema("produccion")
          .from("produccion")
          .select(
            "id_produccion, fecha_inicio, fecha_fin, cantidad_producida, estado_produccion"
          ),

        supabase
          .schema("usuarios")
          .rpc("listar_inventario_critico_deposito", {
            p_token: token,
          }),
      ]);

      if (resPedidos.error) {
        throw resPedidos.error;
      }

      if (resProduccion.error) {
        console.error(
          "Error al cargar producción:",
          resProduccion.error.message
        );
      }

      if (resInventarioCritico.error) {
        console.error(
          "Error al cargar inventario crítico:",
          resInventarioCritico.error.message
        );
      }

      setPedidos(
        Array.isArray(resPedidos.data) ? resPedidos.data : []
      );

      setProducciones(
        !resProduccion.error && Array.isArray(resProduccion.data)
          ? resProduccion.data
          : []
      );

      setInventarioCritico(
        !resInventarioCritico.error &&
          Array.isArray(resInventarioCritico.data)
          ? resInventarioCritico.data
          : []
      );
    } catch (error) {
      console.error("Error al cargar el Overview:", error);
      toast.error("No se pudo actualizar el tablero.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // PEDIDOS

  const pedidosPendientes = useMemo(
    () =>
      pedidos.filter((pedido) =>
        ["P", "M"].includes(String(pedido.estado ?? "").toUpperCase())
      ).length,
    [pedidos]
  );

  const pedidosConfirmados = useMemo(
    () =>
      pedidos.filter(
        (pedido) =>
          String(pedido.estado ?? "").toUpperCase() === "C"
      ).length,
    [pedidos]
  );

  const pedidosEnPreparacion = useMemo(
    () =>
      pedidos.filter(
        (pedido) =>
          String(pedido.estado ?? "").toUpperCase() === "E"
      ).length,
    [pedidos]
  );

  const pedidosParaPreparar = useMemo(
    () =>
      pedidos
        .filter((pedido) =>
          ["C", "E"].includes(
            String(pedido.estado ?? "").toUpperCase()
          )
        )
        .sort(
          (a, b) =>
            new Date(b.fecha_pedido ?? 0) -
            new Date(a.fecha_pedido ?? 0)
        )
        .slice(0, 5),
    [pedidos]
  );

  const filasPedidos = useMemo(
    () =>
      pedidosParaPreparar.map((pedido) => {
        const estado =
          ESTADO_PEDIDO_META[
          String(pedido.estado ?? "").toUpperCase()
          ];

        return [
          <strong
            key={`pedido-${pedido.id_pedido}`}
            className="font-mono text-[#173c4b]"
          >
            #{pedido.id_pedido}
          </strong>,

          pedido.cliente_nombre || "Sin cliente",

          formatearFecha(pedido.fecha_pedido),

          formatearCantidad(pedido.cantidad_productos),

          <Badge
            key={`estado-${pedido.id_pedido}`}
            tone={estado?.tone || "slate"}
          >
            {estado?.label || pedido.estado || "Sin estado"}
          </Badge>,
        ];
      }),
    [pedidosParaPreparar]
  );

  // ALERTAS DE VENCIMIENTO DEL DEPÓSITO

  const lotesConAlertas = useMemo(() => {
    return inventarioCritico
      .filter((lote) => {
        const estado = String(
          lote.codigo_estado_lote ?? ""
        )
          .trim()
          .toUpperCase();

        return (
          Boolean(lote.es_biodegradable) &&
          ESTADOS_LOTE_PERMITIDOS.has(estado)
        );
      })
      .map((lote) => ({
        ...lote,
        situacion: obtenerSituacionVencimiento(
          lote.fecha_vencimiento
        ),
      }))
      .filter(
        (lote) =>
          lote.situacion === "Vencido" ||
          lote.situacion === "Próximo a vencer"
      );
  }, [inventarioCritico]);

  const totalVencidos = lotesConAlertas.filter(
    (lote) => lote.situacion === "Vencido"
  ).length;

  const totalProximosAVencer = lotesConAlertas.filter(
    (lote) => lote.situacion === "Próximo a vencer"
  ).length;

  const totalAlertasVencimiento = lotesConAlertas.length;

  // CAMIONES EN PLAYA: reutiliza los registros de Dispatch.jsx

  const camionesEnPlaya = useMemo(
    () =>
      dispatchRows.filter((fila) => {
        const estado = obtenerEstadoCamion(fila);

        return estado === "en playa" || estado === "cargando";
      }).length,
    []
  );

  const camionesCargando = useMemo(
    () =>
      dispatchRows.filter(
        (fila) => obtenerEstadoCamion(fila) === "cargando"
      ).length,
    []
  );

  // PRODUCCIÓN DE LOS ÚLTIMOS SIETE DÍAS

  const produccionSemanal = useMemo(() => {
    const dias = crearDiasSemana();

    const diasMap = new Map(
      dias.map((dia) => [dia.clave, dia])
    );

    producciones.forEach((produccion) => {
      const fecha =
        produccion.fecha_fin || produccion.fecha_inicio;

      if (!fecha) return;

      const clave = obtenerClaveFecha(fecha);
      const dia = diasMap.get(clave);

      if (dia) {
        dia.cantidad += Number(
          produccion.cantidad_producida ?? 0
        );
      }
    });

    return dias;
  }, [producciones]);

  const maxProduccion = Math.max(
    ...produccionSemanal.map((dia) => dia.cantidad),
    1
  );

  const handleActualizar = async () => {
    await cargarDatos();
    fakeAction?.("Vista actualizada");
  };

  return (
    <>
      <SectionTitle
        eyebrow="01 · CONTROL TOWER"
        title="Buen día, equipo."
        description="Resumen general de la operación y actividad de planta."
      />

      {/* ALERTA GENERAL */}

      <div className="mb-3.5 flex items-center gap-3 rounded-lg border border-[#f0e1c3] bg-[#fffaf0] px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#fff0d5]">
          <AlertTriangle size={17} className="text-amber" />
        </div>

        <div className="min-w-0 flex-1">
          <strong className="block text-[11px] text-[#765c30]">
            Seguimiento de inventario
          </strong>
          <span className="block text-[10px] text-[#9a835b]">
            {loading
              ? "Consultando información del depósito..."
              : totalAlertasVencimiento > 0
                ? `Hay ${totalAlertasVencimiento} lote(s) que requieren atención por vencimiento.`
                : "No se registran lotes vencidos ni próximos a vencer."}
          </span>
        </div>

        <button
          type="button"
          onClick={handleActualizar}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#ead9b9] bg-white px-2.5 py-2 text-[10px] font-semibold text-[#765c30] hover:bg-[#fff6e7]"
        >
          <RefreshCw size={12} />
          Actualizar
        </button>
      </div>

      {/* INDICADORES KPI */}

      <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Pedidos pendientes"
          value={loading ? "—" : pedidosPendientes}
          note="Pendientes de confirmar o revisar"
          icon={ClipboardList}
          tone="amber"
        />

        <Kpi
          label="Tiempo medio de carga"
          value="—"
          note="Sin información de tiempos registrada"
          icon={Clock3}
          tone="blue"
        />

        <Kpi
          label="Alertas de vencimiento"
          value={loading ? "—" : totalAlertasVencimiento}
          note={
            loading
              ? "Consultando inventario..."
              : `${totalVencidos} vencidos · ${totalProximosAVencer} próximos a vencer`
          }
          icon={AlertTriangle}
          tone={
            totalVencidos > 0
              ? "red"
              : totalProximosAVencer > 0
                ? "amber"
                : "green"
          }
        />

        <Kpi
          label="Camiones en playa"
          value={camionesEnPlaya}
          note={`${camionesCargando} cargando · según hojas de ruta`}
          icon={Truck}
          tone="blue"
        />
      </div>

      {/* PRODUCCIÓN Y EXPEDICIÓN */}

      <div className="mb-3.5 grid grid-cols-[1.45fr_0.7fr] gap-3.5 max-[1100px]:grid-cols-1">

        {/* PRODUCCIÓN */}

        <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
                FLUJO OPERATIVO
              </div>

              <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
                Producción semanal
              </h3>
            </div>

            <ActionButton
              variant="secondary"
              onClick={() => fakeAction?.("Módulo de producción abierto")}
            >
              Ver módulo <ArrowUpRight size={15} />
            </ActionButton>
          </div>

          <div className="mb-3 text-[10px] text-[#82979e]">
            Cantidad producida por día · últimos siete días
          </div>

          <div className="flex h-[175px] items-end justify-between gap-2 border-b border-[#e8eef0] pb-2">
            {produccionSemanal.map((dia) => {
              const altura =
                dia.cantidad > 0
                  ? Math.max(
                    (dia.cantidad / maxProduccion) * 100,
                    5
                  )
                  : 2;

              return (
                <div
                  key={dia.clave}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                >
                  <div
                    className="w-full flex-1 flex items-end justify-center"
                  >
                    <div
                      className={`w-full max-w-[34px] rounded-t-sm transition-all ${dia.cantidad > 0
                        ? "bg-brand"
                        : "bg-[#e8eef0]"
                        }`}
                      style={{ height: `${altura}%` }}
                      title={`${dia.etiqueta}: ${formatearCantidad(
                        dia.cantidad
                      )}`}
                    />
                  </div>

                  <span className="text-[9px] font-semibold uppercase text-[#82979e]">
                    {dia.etiqueta}
                  </span>
                </div>
              );
            })}
          </div>

          {loading && (
            <p className="mt-3 text-center text-[10px] text-[#91a0a4]">
              Cargando información de producción...
            </p>
          )}
        </div>

        {/* EXPEDICIÓN */}

        <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
                EXPEDICIÓN
              </div>

              <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
                Actividad en playa
              </h3>
            </div>

            <Truck size={18} className="text-brand" />
          </div>

          <div className="space-y-1">
            <YardRow
              code="CAM-12"
              client="Plásticos del Sur"
              status="Cargando"
              tone="blue"
              progress={60}
            />

            <YardRow
              code="CAM-07"
              client="Mayorista Centro"
              status="En playa"
              tone="amber"
              progress={18}
            />

            <YardRow
              code="CAM-03"
              client="Distribuidora Norte"
              status="Listo"
              tone="green"
              progress={100}
            />
          </div>

          <div className="mt-3 border-t border-[#e8eef0] pt-3">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#82979e]">
                Camiones activos en playa
              </span>

              <strong className="font-barlow text-[18px] text-[#214451]">
                {camionesEnPlaya}
              </strong>
            </div>

            <button
              type="button"
              onClick={() =>
                fakeAction?.("Módulo de expedición abierto")
              }
              className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#dce5e8] py-2 text-[10px] font-semibold text-[#214451] hover:bg-[#f4f7f8]"
            >
              Ir a expedición <ArrowUpRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* PEDIDOS PARA PREPARAR */}

      <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
              ÚLTIMOS MOVIMIENTOS
            </div>

            <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
              Pedidos para preparar
            </h3>
          </div>

          <ActionButton
            variant="secondary"
            onClick={() => navigate?.("orders")}
          >
            Ver pedidos <ArrowUpRight size={15} />
          </ActionButton>
        </div>

        {loading ? (
          <p className="py-5 text-center text-[11px] text-[#91a0a4]">
            Cargando pedidos...
          </p>
        ) : (
          <>
            <Table
              headers={[
                "Pedido",
                "Cliente",
                "Fecha",
                "Cantidad",
                "Estado",
              ]}
              rows={filasPedidos}
              renderCell={(cell) => cell}
            />

            {filasPedidos.length === 0 && (
              <p className="py-5 text-center text-[11px] text-[#91a0a4]">
                No hay pedidos confirmados o en preparación.
              </p>
            )}
          </>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#e8eef0] pt-3">
          <span className="text-[10px] text-[#82979e]">
            Resumen de pedidos
          </span>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] text-[#5c727a]">
              Confirmados:{" "}
              <strong className="text-[#214451]">
                {loading ? "—" : pedidosConfirmados}
              </strong>
            </span>

            <span className="text-[10px] text-[#5c727a]">
              En preparación:{" "}
              <strong className="text-[#214451]">
                {loading ? "—" : pedidosEnPreparacion}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}