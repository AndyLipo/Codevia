import { useState, useEffect, useCallback } from "react";
import { Ban, AlertTriangle } from "lucide-react";
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
  "h-9 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[12px] text-ink-soft outline-none focus:border-[#ba584d]";

export default function AnularOrdenProduccionModal({
  open,
  onOpenChange,
  orden,
  onAnulada,
}) {
  const { token, user } = useAuth();
  const [motivos, setMotivos] = useState([]);
  const [loadingMotivos, setLoadingMotivos] = useState(false);
  const [idMotivoSeleccionado, setIdMotivoSeleccionado] = useState("");
  const [saving, setSaving] = useState(false);

  const cargarMotivos = useCallback(async () => {
    if (!open) return;
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
      console.error("Error al cargar motivos de estado:", err);
      setMotivos(MOTIVOS_FALLBACK);
    } finally {
      setLoadingMotivos(false);
    }
  }, [open, token]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIdMotivoSeleccionado("");
      cargarMotivos();
    }
  }, [open, cargarMotivos]);

  const motivoActual = motivos.find(
    (m) => String(m.id_motivo_estado) === String(idMotivoSeleccionado)
  );

  const handleConfirmarAnulacion = async (e) => {
    e.preventDefault();
    if (saving || !orden?.id_orden_produccion) return;

    const idMotivoNum = Number(idMotivoSeleccionado);
    if (!idMotivoSeleccionado || !Number.isFinite(idMotivoNum) || idMotivoNum <= 0) {
      toast.error("Debes seleccionar obligatoriamente un motivo de anulación.");
      return;
    }

    setSaving(true);
    try {
      const resRpc = await supabase.schema("usuarios").rpc("anular_orden_produccion", {
        p_token: token,
        p_id_orden_produccion: orden.id_orden_produccion,
        p_id_motivo_estado: idMotivoNum,
      });

      if (resRpc.error) {
        console.warn("RPC anular_orden_produccion falló, intentando directo:", resRpc.error);

        const { error: directError } = await supabase
          .schema("produccion")
          .from("orden_produccion")
          .update({
            estado_op: "A",
            id_motivo_estado: idMotivoNum,
            usu_mod: user?.usuario_login || "SISTEMA",
            fec_mod: new Date().toISOString(),
          })
          .eq("id_orden_produccion", orden.id_orden_produccion);

        if (directError) throw directError;
      }

      toast.success(`Orden ${orden.nro_orden} anulada correctamente.`);
      onAnulada?.(orden, motivoActual);
      onOpenChange(false);
    } catch (err) {
      console.error("Error al anular orden de producción:", err);
      toast.error(err.message || "No se pudo anular la orden de producción.");
    } finally {
      setSaving(false);
    }
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
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#fbe9e7] text-[#ba584d]">
              <Ban size={18} />
            </div>
            <div>
              <DialogTitle className="font-barlow text-[22px] font-bold text-[#173c4b]">
                Anular Orden {orden?.nro_orden}
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-ink">
                Esta acción cambiará el estado de la orden a Anulada (A).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleConfirmarAnulacion}>
          <div className="space-y-4 px-6 py-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-[#f5d0cc] bg-[#fdf5f4] p-3 text-[11.5px] text-[#8c3b32]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#ba584d]" />
              <div>
                <strong className="block font-semibold">Atención</strong>
                Para anular la orden de producción es obligatorio indicar el motivo correspondiente según el catálogo del sistema.
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className={labelCls}>Motivo de anulación *</Label>
              <select
                value={idMotivoSeleccionado}
                onChange={(e) => setIdMotivoSeleccionado(e.target.value)}
                disabled={loadingMotivos || saving}
                required
                className={selectCls}
              >
                <option value="">
                  {loadingMotivos
                    ? "Cargando motivos..."
                    : "Seleccionar motivo de estado..."}
                </option>
                {motivos.map((m) => (
                  <option key={m.id_motivo_estado} value={String(m.id_motivo_estado)}>
                    {m.nombre} ({m.codigo})
                  </option>
                ))}
              </select>
            </div>

            {motivoActual && (
              <div className="rounded-lg border border-[#e1e8ea] bg-[#f8fafb] p-3">
                <span className="block text-[9.5px] font-bold uppercase tracking-wider text-[#82979e]">
                  Descripción del motivo ({motivoActual.codigo})
                </span>
                <p className="mt-1 mb-0 text-[11.5px] text-[#214451]">
                  {motivoActual.descripcion || motivoActual.nombre}
                </p>
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
              disabled={saving || !idMotivoSeleccionado}
              className="h-9 cursor-pointer bg-[#ba584d] text-[11px] font-semibold text-white hover:bg-[#9f463c]"
            >
              {saving ? "Anulando orden..." : "Confirmar Anulación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
