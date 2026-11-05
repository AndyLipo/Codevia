import { useState, useEffect, useCallback } from "react";
import { Play, Ban, Pencil, AlertTriangle, UserCheck, RotateCcw } from "lucide-react";
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

const ESTADO_DETALLE_META = {
  P: { label: "Pendiente", tone: "amber" },
  E: { label: "En proceso", tone: "blue" },
  I: { label: "Incompleto", tone: "slate" },
  C: { label: "Completo", tone: "green" },
  A: { label: "Anulado", tone: "red" },
};

const MOTIVOS_CATALOGO = {
  1: {
    codigo: "FALTA_MATERIA_PRIMA",
    nombre: "Falta de materia prima",
    descripcion: "No existe materia prima suficiente para continuar la producción.",
  },
  2: {
    codigo: "FALLA_MAQUINARIA",
    nombre: "Falla de maquinaria",
    descripcion: "Una máquina o equipo impide continuar con la producción.",
  },
  3: {
    codigo: "FALTA_PERSONAL",
    nombre: "Falta de personal",
    descripcion: "No existe personal disponible para continuar la producción.",
  },
  4: {
    codigo: "IMPOSIBILIDAD_TECNICA",
    nombre: "Imposibilidad técnica",
    descripcion: "No es técnicamente posible continuar con la fabricación.",
  },
  5: {
    codigo: "SOLICITUD_ADMINISTRACION",
    nombre: "Solicitud de Administración",
    descripcion: "Administración solicita finalizar la producción u orden sin completar.",
  },
  6: {
    codigo: "OTRO",
    nombre: "Otro",
    descripcion: "Otro motivo no contemplado anteriormente.",
  },
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

export default function DetalleOrdenProduccionModal({
  open,
  onOpenChange,
  orden,
  onTomarOrden,
  onModificarOrden,
  onAnularOrden,
}) {
  const { token } = useAuth();
  const [detalles, setDetalles] = useState([]);
  const [motivoExtra, setMotivoExtra] = useState(null);
  const [usuarioModNombreExtra, setUsuarioModNombreExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [tomando, setTomando] = useState(false);

  const idOrdenProduccion = orden?.id_orden_produccion;
  const idMotivoOrden = orden?.id_motivo_estado;
  const motivoNombreOrden = orden?.motivo_nombre;
  const usuModOrden = orden?.usu_mod;
  const usuModNombreOrden = orden?.usu_mod_nombre;

  const cargarDetalles = useCallback(async () => {
    if (!open || !idOrdenProduccion) return;
    setLoading(true);
    try {
      const resRpc = await supabase
        .schema("usuarios")
        .rpc("obtener_detalle_orden_produccion", {
          p_token: token,
          p_id_orden_produccion: idOrdenProduccion,
        });

      if (!resRpc.error && Array.isArray(resRpc.data)) {
        setDetalles(resRpc.data);
      } else {
        // Fallback directo
        const { data: directData, error: directError } = await supabase
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
            estado,
            usu_alta,
            fec_alta,
            producto:id_producto (
              codigo,
              nombre,
              id_material,
              material:id_material (nombre),
              id_unidad_medida,
              unidad:id_unidad_medida (codigo, nombre)
            )
          `)
          .eq("id_orden_produccion", idOrdenProduccion)
          .neq("estado", "E")
          .order("id_detalle_orden", { ascending: true });

        if (directError) throw directError;

        setDetalles(
          (directData || []).map((d) => ({
            id_detalle_orden: d.id_detalle_orden,
            id_orden_produccion: d.id_orden_produccion,
            id_producto: d.id_producto,
            producto_codigo: d.producto?.codigo || "—",
            producto_nombre: d.producto?.nombre || "—",
            material_nombre: d.producto?.material?.nombre || "—",
            unidad_codigo: d.producto?.unidad?.codigo || "",
            unidad_nombre: d.producto?.unidad?.nombre || "",
            cantidad_solicitada: d.cantidad_solicitada,
            cantidad_producida: d.cantidad_producida,
            fecha_limite: d.fecha_limite,
            estado_detalle: d.estado_detalle,
            estado_detalle_nombre:
              ESTADO_DETALLE_META[d.estado_detalle]?.label || d.estado_detalle,
          }))
        );
      }

      // Si tiene id_motivo_estado pero no vino el texto del motivo, buscarlo
      if (idMotivoOrden && !motivoNombreOrden) {
        const { data: motData } = await supabase
          .schema("sistema")
          .from("motivo_estado")
          .select("id_motivo_estado, codigo, nombre, descripcion")
          .eq("id_motivo_estado", idMotivoOrden)
          .maybeSingle();

        if (motData) {
          setMotivoExtra(motData);
        } else if (MOTIVOS_CATALOGO[idMotivoOrden]) {
          setMotivoExtra(MOTIVOS_CATALOGO[idMotivoOrden]);
        }
      } else {
        setMotivoExtra(null);
      }

      // Resolver nombre completo de usu_mod si no vino en la consulta principal
      if (usuModOrden && !usuModNombreOrden) {
        const { data: usrData } = await supabase
          .schema("usuarios")
          .from("usuarios")
          .select("nombre, apellido")
          .ilike("usuario_login", usuModOrden)
          .maybeSingle();

        if (usrData) {
          setUsuarioModNombreExtra(
            `${usrData.nombre || ""} ${usrData.apellido || ""}`.trim()
          );
        } else {
          setUsuarioModNombreExtra("");
        }
      } else {
        setUsuarioModNombreExtra("");
      }
    } catch (err) {
      console.error("Error al cargar detalles de la orden:", err);
      toast.error("No se pudo cargar el detalle de la orden");
      setDetalles([]);
    } finally {
      setLoading(false);
    }
  }, [
    open,
    idOrdenProduccion,
    idMotivoOrden,
    motivoNombreOrden,
    usuModOrden,
    usuModNombreOrden,
    token,
  ]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarDetalles();
    }
  }, [open, cargarDetalles]);

  const handleTomar = async () => {
    if (tomando || !orden) return;
    setTomando(true);
    try {
      await onTomarOrden?.(orden);
      onOpenChange(false);
    } finally {
      setTomando(false);
    }
  };

  const estActual = String(orden?.estado_op || "").trim();
  const estadoInfo = ESTADO_OP_META[estActual] || {
    label: orden?.estado_op_nombre || estActual || "Pendiente",
    tone: "slate",
  };

  const nombreUsuarioAccion =
    orden?.usu_mod_nombre ||
    usuarioModNombreExtra ||
    orden?.usu_mod ||
    orden?.solicitante_nombre ||
    orden?.solicitante_login ||
    "—";

  const loginUsuarioAccion = orden?.usu_mod || orden?.usu_alta || "";

  // Resolver datos del motivo de anulación / estado
  const motivoResuelto = (() => {
    if (orden?.motivo_nombre) {
      return {
        codigo: orden.motivo_codigo,
        nombre: orden.motivo_nombre,
        descripcion: orden.motivo_descripcion,
      };
    }
    if (motivoExtra) return motivoExtra;
    if (orden?.id_motivo_estado && MOTIVOS_CATALOGO[orden.id_motivo_estado]) {
      return MOTIVOS_CATALOGO[orden.id_motivo_estado];
    }
    return null;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border border-[#e1e8ea] bg-white p-0 shadow-card">
        <DialogHeader className="border-b border-slate-soft bg-white px-6 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="font-barlow text-[24px] font-bold text-[#173c4b]">
                  Orden de Producción {orden?.nro_orden}
                </DialogTitle>
                <Badge tone={estadoInfo.tone}>{estadoInfo.label}</Badge>
              </div>
              <DialogDescription className="text-[12px] text-muted-ink">
                Consulta de productos solicitados, avance de producción y fechas de entrega.
              </DialogDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(estActual === "P" || estActual === "D") && onModificarOrden && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onModificarOrden(orden);
                  }}
                  className="h-8.5 cursor-pointer border-[#dce5e8] bg-white px-3 text-[11px] font-semibold text-[#145c73] hover:bg-[#f0f6f8]"
                >
                  <Pencil size={12} className="mr-1.5" />
                  Modificar
                </Button>
              )}

              {(estActual === "P" || estActual === "D") && (
                <Button
                  type="button"
                  onClick={handleTomar}
                  disabled={tomando}
                  className="h-8.5 cursor-pointer bg-[#145c73] px-3.5 text-[11px] font-semibold text-white hover:bg-[#10485b]"
                >
                  <Play size={13} className="mr-1.5 fill-current" />
                  {tomando ? "Tomando orden..." : "Tomar Orden"}
                </Button>
              )}

              {["P", "D"].includes(estActual) && onAnularOrden && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onAnularOrden(orden);
                  }}
                  className="h-8.5 cursor-pointer border-[#f2c4be] bg-[#fbe9e7] px-3 text-[11px] font-semibold text-[#ba584d] hover:bg-[#f7d8d4]"
                >
                  <Ban size={12} className="mr-1.5" />
                  Anular
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4">
          {/* Bloque destacado cuando la orden está Tomada (T) */}
          {estActual === "T" && (
            <div className="flex items-start gap-3 rounded-lg border border-[#bdd8e4] bg-[#eef6fa] p-3.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#d9ecf5] text-[#145c73]">
                <UserCheck size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#145c73]">
                  Orden Tomada por
                </span>
                <strong className="mt-0.5 block text-[13.5px] text-[#173c4b]">
                  {nombreUsuarioAccion}
                </strong>
                <span className="mt-0.5 block font-mono text-[10.5px] text-[#4a6b78]">
                  {loginUsuarioAccion ? `Usuario: ${loginUsuarioAccion}` : ""}
                  {orden?.fec_mod ? ` · Fecha: ${formatFechaHora(orden.fec_mod)}` : ""}
                </span>
              </div>
            </div>
          )}

          {/* Bloque destacado cuando la orden está Devuelta (D) */}
          {estActual === "D" && (
            <div className="flex items-start gap-3 rounded-lg border border-[#edd29f] bg-[#fff9ec] p-3.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#fff0cf] text-[#a76e1a]">
                <RotateCcw size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#a76e1a]">
                  Orden Devuelta por
                </span>
                <strong className="mt-0.5 block text-[13.5px] text-[#6e460b]">
                  {nombreUsuarioAccion}
                </strong>
                <span className="mt-0.5 block font-mono text-[10.5px] text-[#8f631f]">
                  {loginUsuarioAccion ? `Usuario: ${loginUsuarioAccion}` : ""}
                  {orden?.fec_mod ? ` · Fecha: ${formatFechaHora(orden.fec_mod)}` : ""}
                </span>
              </div>
            </div>
          )}

          {/* Bloque destacado de Motivo de Anulación cuando la orden está Anulada (A) */}
          {(estActual === "A" || motivoResuelto) && (
            <div className="flex items-start gap-3 rounded-lg border border-[#f2c4be] bg-[#fdf4f3] p-3.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#fbe9e7] text-[#ba584d]">
                <AlertTriangle size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#ba584d]">
                    {estActual === "A" ? "Motivo de Anulación" : "Motivo de Estado"}
                  </span>
                  {motivoResuelto?.codigo && (
                    <span className="rounded bg-[#fbe9e7] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-[#9f463c]">
                      {motivoResuelto.codigo}
                    </span>
                  )}
                </div>
                <strong className="mt-0.5 block text-[13px] text-[#7a2e25]">
                  {motivoResuelto?.nombre || "Orden anulada"}
                </strong>
                {motivoResuelto?.descripcion && (
                  <p className="mt-0.5 mb-0 text-[11.5px] text-[#8c3b32]">
                    {motivoResuelto.descripcion}
                  </p>
                )}
                {(orden?.usu_mod || orden?.fec_mod) && (
                  <span className="mt-1.5 block font-mono text-[10px] text-[#a35a52]">
                    Registrado por: {orden?.usu_mod || "—"}
                    {orden?.fec_mod ? ` · ${formatFechaHora(orden.fec_mod)}` : ""}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Tarjeta de datos de cabecera */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-[#e1e8ea] bg-[#f8fafb] p-3.5 sm:grid-cols-4">
            <div>
              <span className="block text-[9px] font-bold uppercase tracking-wider text-[#82979e]">
                Solicitante
              </span>
              <strong className="block text-[12px] text-[#214451]">
                {orden?.solicitante_nombre || orden?.solicitante_login || "—"}
              </strong>
              {orden?.solicitante_login && (
                <span className="font-mono text-[10px] text-[#71858c]">
                  {orden.solicitante_login}
                </span>
              )}
            </div>

            <div>
              <span className="block text-[9px] font-bold uppercase tracking-wider text-[#82979e]">
                Fecha de Emisión
              </span>
              <span className="font-mono text-[11.5px] font-semibold text-[#214451]">
                {formatFechaHora(orden?.fecha_orden)}
              </span>
            </div>

            <div>
              <span className="block text-[9px] font-bold uppercase tracking-wider text-[#82979e]">
                Productos / Líneas
              </span>
              <strong className="font-barlow text-[18px] text-[#145c73]">
                {detalles.length} ítem{detalles.length === 1 ? "" : "s"}
              </strong>
            </div>

            <div>
              <span className="block text-[9px] font-bold uppercase tracking-wider text-[#82979e]">
                {estActual === "T"
                  ? "Tomada por"
                  : estActual === "D"
                    ? "Devuelta por"
                    : "Estado del Proceso"}
              </span>
              <span className="block text-[12px] font-semibold text-[#214451]">
                {estActual === "T" || estActual === "D"
                  ? nombreUsuarioAccion
                  : estadoInfo.label}
              </span>
              {(estActual === "T" || estActual === "D") && loginUsuarioAccion && (
                <span className="font-mono text-[10px] text-[#71858c]">
                  {loginUsuarioAccion}
                </span>
              )}
            </div>
          </div>

          {/* Tabla de detalle de productos */}
          <div className="space-y-2">
            <h4 className="m-0 text-[11px] font-bold uppercase tracking-wider text-[#145c73]">
              Detalle de productos solicitados
            </h4>

            {loading ? (
              <p className="py-6 text-center text-[11px] text-[#91a0a4]">
                Cargando productos de la orden...
              </p>
            ) : detalles.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-[#91a0a4]">
                Esta orden no posee productos asignados.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[#e1e8ea]">
                <table className="w-full text-left">
                  <thead className="border-b border-[#e1e8ea] bg-[#f8fafb] text-[9.5px] font-bold uppercase tracking-wider text-[#82979e]">
                    <tr>
                      <th className="px-3 py-2.5">Código</th>
                      <th className="px-3 py-2.5">Producto</th>
                      <th className="px-3 py-2.5">Material</th>
                      <th className="px-3 py-2.5 text-right">Solicitado</th>
                      <th className="px-3 py-2.5 text-right">Producido</th>
                      <th className="px-3 py-2.5">Unidad</th>
                      <th className="px-3 py-2.5">Fecha límite</th>
                      <th className="px-3 py-2.5">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1f2] text-[11px]">
                    {detalles.map((d) => {
                      const detMeta = ESTADO_DETALLE_META[d.estado_detalle] || {
                        label: d.estado_detalle_nombre || d.estado_detalle,
                        tone: "slate",
                      };
                      return (
                        <tr key={d.id_detalle_orden} className="hover:bg-[#fbfcfc]">
                          <td className="px-3 py-2.5 font-mono font-semibold text-[#145c73]">
                            {d.producto_codigo}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-[#214451]">
                            {d.producto_nombre}
                          </td>
                          <td className="px-3 py-2.5 text-[#5f7881]">
                            {d.material_nombre}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-[#173c4b]">
                            {Number(d.cantidad_solicitada).toLocaleString("es-AR")}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-[#256349]">
                            {Number(d.cantidad_producida).toLocaleString("es-AR")}
                          </td>
                          <td className="px-3 py-2.5 text-[#657d85]">
                            {d.unidad_codigo || "UN"}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[#49656e]">
                            {formatFecha(d.fecha_limite)}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge tone={detMeta.tone}>{detMeta.label}</Badge>
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
  );
}
