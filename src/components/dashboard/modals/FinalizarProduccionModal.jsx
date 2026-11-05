import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, AlertCircle, Ban, AlertTriangle } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

const MOTIVOS_FALLBACK = [
  {
    id_motivo_estado: 1,
    codigo: "FALTA_MATERIA_PRIMA",
    nombre: "Falta de materia prima",
    descripcion: "No existe materia prima suficiente para continuar la producción.",
  },
  {
    id_motivo_estado: 2,
    codigo: "FALLA_MAQUINARIA",
    nombre: "Falla de maquinaria",
    descripcion: "Una máquina o equipo impide continuar con la producción.",
  },
  {
    id_motivo_estado: 3,
    codigo: "FALTA_PERSONAL",
    nombre: "Falta de personal",
    descripcion: "No existe personal disponible para continuar la producción.",
  },
  {
    id_motivo_estado: 4,
    codigo: "IMPOSIBILIDAD_TECNICA",
    nombre: "Imposibilidad técnica",
    descripcion: "No es técnicamente posible continuar con la fabricación.",
  },
  {
    id_motivo_estado: 5,
    codigo: "SOLICITUD_ADMINISTRACION",
    nombre: "Solicitud de Administración",
    descripcion: "Administración solicita finalizar la producción u orden sin completar.",
  },
  {
    id_motivo_estado: 6,
    codigo: "OTRO",
    nombre: "Otro",
    descripcion: "Otro motivo no contemplado anteriormente.",
  },
];

const labelCls = "text-[10px] font-bold uppercase tracking-widest text-muted-ink";
const selectCls =
  "h-9 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[12px] text-ink-soft outline-none focus:border-[#214451]";

export default function FinalizarProduccionModal({
  open,
  onOpenChange,
  produccion,
  modo, // "C" (Finalizar) | "I" (Finalizar Incompleta) | "A" (Anular)
  producto,
  faltanteMaximo = 0,
  onProcesado,
}) {
  const { token, user } = useAuth();
  const [cantidadInput, setCantidadInput] = useState("");
  const [motivos, setMotivos] = useState([]);
  const [idMotivoSeleccionado, setIdMotivoSeleccionado] = useState("");
  const [loadingMotivos, setLoadingMotivos] = useState(false);
  const [saving, setSaving] = useState(false);

  const esAnulacion = modo === "A";
  const esIncompleta = modo === "I";
  const requiereMotivo = esAnulacion || esIncompleta;

  const cargarMotivos = useCallback(async () => {
    if (!open || !requiereMotivo) return;
    setLoadingMotivos(true);
    try {
      const resRpc = await supabase
        .schema("usuarios")
        .rpc("listar_motivos_estado", { p_token: token ?? null });

      if (!resRpc.error && Array.isArray(resRpc.data) && resRpc.data.length > 0) {
        setMotivos(resRpc.data);
      } else {
        const { data: directData, error: directError } = await supabase
          .schema("sistema")
          .from("motivo_estado")
          .select("id_motivo_estado, codigo, nombre, descripcion")
          .eq("estado", "A")
          .order("id_motivo_estado", { ascending: true });

        if (!directError && Array.isArray(directData) && directData.length > 0) {
          setMotivos(directData);
        } else {
          setMotivos(MOTIVOS_FALLBACK);
        }
      }
    } catch (err) {
      console.error("Error al cargar motivos:", err);
      setMotivos(MOTIVOS_FALLBACK);
    } finally {
      setLoadingMotivos(false);
    }
  }, [open, requiereMotivo, token]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCantidadInput(esAnulacion ? "" : String(faltanteMaximo || ""));
      setIdMotivoSeleccionado("");
      cargarMotivos();
    }
  }, [open, esAnulacion, faltanteMaximo, cargarMotivos]);

  const motivoSeleccionado = motivos.find(
    (m) => String(m.id_motivo_estado) === String(idMotivoSeleccionado)
  );

  const handleConfirmar = async (e) => {
    e.preventDefault();
    if (saving || !produccion?.id_produccion) return;

    let cantNum = null;
    if (!esAnulacion) {
      cantNum = Number(cantidadInput);
      if (!Number.isFinite(cantNum) || cantNum <= 0) {
        toast.error("La cantidad producida debe ser un número mayor a cero.");
        return;
      }
      if (cantNum > faltanteMaximo) {
        toast.error(
          `La cantidad no puede superar el faltante máximo requerido (${faltanteMaximo.toLocaleString("es-AR")}).`
        );
        return;
      }
    }

    if (requiereMotivo) {
      const idMot = Number(idMotivoSeleccionado);
      if (!idMotivoSeleccionado || !Number.isFinite(idMot) || idMot <= 0) {
        toast.error("Debes seleccionar obligatoriamente un motivo del catálogo.");
        return;
      }
    }

    setSaving(true);
    try {
      if (modo === "C") {
        // FINALIZAR COMPLETA
        const resRpc = await supabase.schema("usuarios").rpc("finalizar_produccion", {
          p_token: token,
          p_id_produccion: produccion.id_produccion,
          p_cantidad_producida: cantNum,
        });

        if (resRpc.error) {
          console.warn("RPC finalizar_produccion falló, intentando directo:", resRpc.error);
          const { error: directErr } = await supabase
            .schema("produccion")
            .from("produccion")
            .update({
              fecha_fin: new Date().toISOString(),
              cantidad_producida: cantNum,
              estado_produccion: "C",
              usu_mod: user?.usuario_login || "SISTEMA",
              fec_mod: new Date().toISOString(),
            })
            .eq("id_produccion", produccion.id_produccion);

          if (directErr) throw directErr;
        }

        toast.success("Producción finalizada exitosamente.");
      } else if (modo === "I") {
        // FINALIZAR INCOMPLETA
        const resRpc = await supabase
          .schema("usuarios")
          .rpc("finalizar_incompleta_produccion", {
            p_token: token,
            p_id_produccion: produccion.id_produccion,
            p_cantidad_producida: cantNum,
            p_id_motivo_estado: Number(idMotivoSeleccionado),
          });

        if (resRpc.error) {
          console.warn(
            "RPC finalizar_incompleta_produccion falló, intentando directo:",
            resRpc.error
          );
          const { error: directErr } = await supabase
            .schema("produccion")
            .from("produccion")
            .update({
              fecha_fin: new Date().toISOString(),
              cantidad_producida: cantNum,
              estado_produccion: "I",
              id_motivo_estado: Number(idMotivoSeleccionado),
              usu_mod: user?.usuario_login || "SISTEMA",
              fec_mod: new Date().toISOString(),
            })
            .eq("id_produccion", produccion.id_produccion);

          if (directErr) throw directErr;
        }

        toast.success("Producción registrada como finalizada incompleta.");
      } else if (modo === "A") {
        // ANULAR PRODUCCIÓN
        const resRpc = await supabase.schema("usuarios").rpc("anular_produccion", {
          p_token: token,
          p_id_produccion: produccion.id_produccion,
          p_id_motivo_estado: Number(idMotivoSeleccionado),
        });

        if (resRpc.error) {
          console.warn("RPC anular_produccion falló, intentando directo:", resRpc.error);
          const { error: directErr } = await supabase
            .schema("produccion")
            .from("produccion")
            .update({
              fecha_fin: new Date().toISOString(),
              cantidad_producida: null,
              estado_produccion: "A",
              id_motivo_estado: Number(idMotivoSeleccionado),
              usu_mod: user?.usuario_login || "SISTEMA",
              fec_mod: new Date().toISOString(),
            })
            .eq("id_produccion", produccion.id_produccion);

          if (directErr) throw directErr;
        }

        toast.success("Producción anulada correctamente.");
      }

      onProcesado?.();
      onOpenChange(false);
    } catch (err) {
      console.error("Error al procesar acción de producción:", err);
      toast.error(err.message || "Ocurrió un error al procesar la producción.");
    } finally {
      setSaving(false);
    }
  };

  const configModal = {
    C: {
      titulo: "Finalizar Producción",
      descripcion: "Confirmar cantidad producida para completar la fabricación.",
      icono: <CheckCircle2 size={18} className="text-[#256349]" />,
      bgIcon: "bg-[#eaf5ef]",
      btnCls: "bg-green hover:bg-[#1f523d] text-white",
      btnTexto: "Finalizar Producción",
    },
    I: {
      titulo: "Finalizar Producción Incompleta",
      descripcion: "Indicar cantidad fabricada hasta el momento y el motivo de la interrupción.",
      icono: <AlertCircle size={18} className="text-[#a76e1a]" />,
      bgIcon: "bg-[#fff2d8]",
      btnCls: "bg-[#a76e1a] hover:bg-[#8d5b13] text-white",
      btnTexto: "Finalizar Incompleta",
    },
    A: {
      titulo: "Anular Producción",
      descripcion: "Anula este registro de producción e indica el motivo de la anulación.",
      icono: <Ban size={18} className="text-[#ba584d]" />,
      bgIcon: "bg-[#fbe9e7]",
      btnCls: "bg-[#ba584d] hover:bg-[#9f463c] text-white",
      btnTexto: "Confirmar Anulación",
    },
  }[modo] || {
    titulo: "Procesar Producción",
    descripcion: "",
    icono: null,
    bgIcon: "bg-slate-100",
    btnCls: "bg-[#145c73]",
    btnTexto: "Aceptar",
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!saving) onOpenChange(val);
      }}
    >
      <DialogContent className="max-w-md border border-[#e1e8ea] bg-white p-0 shadow-card">
        <DialogHeader className="border-b border-slate-soft bg-white px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div
              className={`grid h-9 w-9 place-items-center rounded-lg ${configModal.bgIcon}`}
            >
              {configModal.icono}
            </div>
            <div>
              <DialogTitle className="font-barlow text-[22px] font-bold text-[#173c4b]">
                {configModal.titulo}
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-ink">
                {configModal.descripcion}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleConfirmar}>
          <div className="space-y-4 px-6 py-4">
            {/* Info producto */}
            <div className="rounded-lg border border-[#e1e8ea] bg-[#f8fafb] p-3 text-[11.5px]">
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold text-[#145c73]">
                  {producto?.codigo || "—"}
                </span>
                <span className="text-[#657d85] font-medium">
                  {producto?.unidad_codigo || "UN"}
                </span>
              </div>
              <strong className="mt-0.5 block text-[13px] text-[#214451]">
                {producto?.nombre || "Producto"}
              </strong>
              {!esAnulacion && (
                <div className="mt-1.5 flex items-center justify-between border-t border-[#edf1f2] pt-1.5 text-[11px]">
                  <span className="text-[#657d85]">Faltante a producir:</span>
                  <strong className="font-mono text-[#a76e1a]">
                    {faltanteMaximo.toLocaleString("es-AR")} {producto?.unidad_codigo || "UN"}
                  </strong>
                </div>
              )}
            </div>

            {/* Aviso especial cuando se finaliza incompleta */}
            {esIncompleta && (
              <div className="flex items-start gap-2.5 rounded-lg border border-[#edd29f] bg-[#fff9ed] p-3 text-[11.5px] text-[#8f5d13]">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#a76e1a]" />
                <div>
                  <strong className="block font-semibold">Aviso</strong>
                  Usted está por finalizar la producción sin completar la cuota material, si lo hace no podrá retomar la producción del producto. ¿Desea continuar?
                </div>
              </div>
            )}

            {/* Campo cantidad producida (si no es anulación) */}
            {!esAnulacion && (
              <div className="space-y-1.5">
                <Label className={labelCls}>
                  Cantidad Producida ({producto?.unidad_codigo || "UN"}) *
                </Label>
                <Input
                  type="number"
                  min="0.001"
                  max={faltanteMaximo}
                  step="any"
                  value={cantidadInput}
                  onChange={(e) => setCantidadInput(e.target.value)}
                  placeholder={`Máximo: ${faltanteMaximo}`}
                  required
                  className="h-9 border-[#dfe7e9] bg-white font-mono text-[13px] font-bold text-[#173c4b]"
                />
                <span className="block text-[10px] text-[#71858c]">
                  Límite máximo permitido según faltante del pedido: {faltanteMaximo.toLocaleString("es-AR")}.
                </span>
              </div>
            )}

            {/* Selector de motivo de estado obligatorio si es Incompleta o Anulación */}
            {requiereMotivo && (
              <div className="space-y-1.5">
                <Label className={labelCls}>
                  Motivo {esAnulacion ? "de anulación" : "de interrupción"} *
                </Label>
                <select
                  value={idMotivoSeleccionado}
                  onChange={(e) => setIdMotivoSeleccionado(e.target.value)}
                  disabled={loadingMotivos || saving}
                  required
                  className={selectCls}
                >
                  <option value="">
                    {loadingMotivos
                      ? "Cargando catálogo de motivos..."
                      : "Seleccionar motivo de estado..."}
                  </option>
                  {motivos.map((m) => (
                    <option key={m.id_motivo_estado} value={String(m.id_motivo_estado)}>
                      {m.nombre} ({m.codigo})
                    </option>
                  ))}
                </select>

                {motivoSeleccionado && (
                  <p className="mt-1 rounded bg-[#f8fafb] p-2 text-[11px] text-[#4a636c]">
                    {motivoSeleccionado.descripcion || motivoSeleccionado.nombre}
                  </p>
                )}
              </div>
            )}

            {esAnulacion && (
              <div className="flex items-start gap-2 rounded-lg border border-[#f5d0cc] bg-[#fdf5f4] p-3 text-[11px] text-[#8c3b32]">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#ba584d]" />
                <div>
                  Al anular la producción, la cantidad producida pasará a valor nulo y no se computará en el avance del producto.
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-slate-soft bg-white px-6 py-3.5">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
              className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                saving ||
                (!esAnulacion && (!cantidadInput || Number(cantidadInput) <= 0)) ||
                (requiereMotivo && !idMotivoSeleccionado)
              }
              className={`h-9 cursor-pointer text-[11px] font-semibold ${configModal.btnCls}`}
            >
              {saving ? "Procesando..." : configModal.btnTexto}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
