import { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
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

const formatNroPedido = (idPedido) => {
  if (!idPedido) return "—";
  return `#${String(idPedido).padStart(5, "0")}`;
};

export default function FinalizarVerificacionModal({
  isOpen,
  onClose,
  pedido,
  unverifiedCount,
  totalItems,
  onSuccess,
}) {
  const { token, user } = useAuth();
  const [step, setStep] = useState("confirm"); // "confirm" | "exception"
  const [observacion, setObservacion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const tieneSinVerificar = unverifiedCount > 0;

  const handleClose = () => {
    if (submitting) return;
    setStep("confirm");
    setObservacion("");
    onClose();
  };

  const handleContinuarConExcepcion = () => {
    setStep("exception");
  };

  const handleSubmit = async () => {
    if (!pedido?.id_pedido) return;

    if (tieneSinVerificar && !observacion.trim()) {
      toast.error("Debe redactar una observación de excepción para continuar");
      return;
    }

    setSubmitting(true);
    try {
      const { error: rpcError } = await supabase
        .schema("usuarios")
        .rpc("finalizar_verificacion_pedido", {
          p_token: token,
          p_id_pedido: pedido.id_pedido,
          p_observacion_excepcion: tieneSinVerificar ? observacion.trim() : null,
        });

      if (rpcError) {
        // Fallback directo si la migración 61 aún no fue corrida en Supabase
        const nowIso = new Date().toISOString();
        const usuLogin = user?.usuario_login || "admin";

        const { error: prepErr } = await supabase
          .schema("deposito")
          .from("preparacion_pedido")
          .update({
            estado: "V",
            finalizada_con_excepcion: tieneSinVerificar,
            observacion_excepcion: tieneSinVerificar ? observacion.trim() : null,
            usu_finalizacion: usuLogin,
            fec_finalizacion: nowIso,
            usu_mod: usuLogin,
            fec_mod: nowIso,
          })
          .eq("id_pedido", pedido.id_pedido);

        if (prepErr) {
          console.error("Error al finalizar verificación:", rpcError, prepErr);
          toast.error(rpcError.message || "No se pudo finalizar la verificación");
          return;
        }

        const { error: pedErr } = await supabase
          .schema("administracion")
          .from("pedido")
          .update({
            estado: "L",
            usu_mod: usuLogin,
            fec_mod: nowIso,
          })
          .eq("id_pedido", pedido.id_pedido);

        if (pedErr) {
          toast.error(pedErr.message || "Error al actualizar el estado del pedido");
          return;
        }
      }

      handleClose();
      onSuccess?.();
    } catch (err) {
      console.error("Error inesperado al finalizar verificación:", err);
      toast.error("Error al conectar con el servidor");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md border border-[#e1e8ea] bg-white p-0 sm:p-0 shadow-card">
        <DialogHeader className="border-b border-slate-soft bg-white px-6 py-4 text-left">
          <div className="flex items-center gap-2.5 pr-6">
            <div
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                step === "exception"
                  ? "bg-[#fbe9e7]"
                  : tieneSinVerificar
                  ? "bg-[#fff2d8]"
                  : "bg-[#eaf5ef]"
              }`}
            >
              {step === "exception" ? (
                <ShieldAlert size={18} className="text-[#ba584d]" />
              ) : tieneSinVerificar ? (
                <AlertTriangle size={18} className="text-[#a76e1a]" />
              ) : (
                <CheckCircle2 size={18} className="text-[#256349]" />
              )}
            </div>
            <div>
              <DialogTitle className="font-barlow text-[20px] font-bold text-[#173c4b]">
                {step === "confirm"
                  ? tieneSinVerificar
                    ? "Advertencia de Verificación Incompleta"
                    : "Finalizar Verificación"
                  : "Registrar Observación de Excepción"}
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-ink">
                Pedido {formatNroPedido(pedido?.id_pedido)}
                {pedido?.cliente_nombre ? ` · ${pedido.cliente_nombre}` : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === "confirm" && (
          <div>
            <div className="space-y-3.5 px-6 py-4">
              {/* Resumen del pedido */}
              <div className="rounded-lg border border-[#e1e8ea] bg-[#f8fafb] p-3 text-[11.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#657d85]">Total productos del pedido:</span>
                  <strong className="font-mono text-[#173c4b]">{totalItems}</strong>
                </div>
                <div className="mt-1.5 flex items-center justify-between border-t border-[#edf1f2] pt-1.5">
                  <span className="text-[#657d85]">Productos sin verificar:</span>
                  <strong
                    className={`font-mono ${
                      tieneSinVerificar ? "text-[#a76e1a]" : "text-[#256349]"
                    }`}
                  >
                    {unverifiedCount} de {totalItems}
                  </strong>
                </div>
              </div>

              {tieneSinVerificar ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-[#edd29f] bg-[#fff9ed] p-3.5 text-[12px] text-[#8f5d13]">
                  <AlertTriangle size={17} className="mt-0.5 shrink-0 text-[#a76e1a]" />
                  <div>
                    <strong className="mb-0.5 block font-semibold text-[#734808]">
                      Aviso de Control
                    </strong>
                    Esta a punto de finalizar la verificacion con productos que aun no han sido controlados. ¿Desea Continuar?
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-lg border border-[#b8dfc8] bg-[#edf8f2] p-3.5 text-[12px] text-[#256349]">
                  <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#2e8b62]" />
                  <div>
                    <strong className="mb-0.5 block font-semibold">
                      Verificación Completa
                    </strong>
                    Todos los productos han sido verificados. Al confirmar, la preparación pasará a estado <strong>V</strong> y el pedido pasará a <strong>L (Listo para despacho)</strong>.
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex items-center justify-end gap-2 border-t border-slate-soft bg-white px-6 py-3.5">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={submitting}
                className="h-9 min-w-20 cursor-pointer border-[#dce5e8] bg-white px-4 text-[11.5px] font-semibold text-[#214451] hover:bg-[#f4f7f8]"
              >
                NO
              </Button>
              {tieneSinVerificar ? (
                <Button
                  type="button"
                  onClick={handleContinuarConExcepcion}
                  disabled={submitting}
                  className="h-9 min-w-24 cursor-pointer bg-[#a76e1a] px-4 text-[11.5px] font-semibold text-white hover:bg-[#8d5b13]"
                >
                  SÍ
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="h-9 cursor-pointer bg-green px-4 text-[11.5px] font-semibold text-white hover:bg-[#1f523d]"
                >
                  {submitting ? "Procesando..." : "Confirmar Verificación"}
                </Button>
              )}
            </DialogFooter>
          </div>
        )}

        {step === "exception" && (
          <div>
            <div className="space-y-3.5 px-6 py-4">
              <div className="flex items-start gap-2 rounded-lg border border-[#f5d0cc] bg-[#fdf5f4] p-3 text-[11.5px] text-[#8c3b32]">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#ba584d]" />
                <div>
                  Por favor ingrese el motivo de la excepción.
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5e6f77]">
                  Observación de Excepción *
                </Label>
                <textarea
                  id="observacion_excepcion"
                  rows={4}
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Redacte el motivo u observación por el cual se finaliza la verificación con productos sin controlar..."
                  disabled={submitting}
                  className="w-full rounded-md border border-[#dfe7e9] bg-white p-2.5 text-[12px] text-[#173c4b] outline-none transition-colors focus:border-[#214451]"
                />
              </div>
            </div>

            <DialogFooter className="flex items-center justify-end gap-2 border-t border-slate-soft bg-white px-6 py-3.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("confirm")}
                disabled={submitting}
                className="h-9 cursor-pointer border-[#dce5e8] bg-white px-3.5 text-[11.5px] font-semibold text-[#214451] hover:bg-[#f4f7f8]"
              >
                Volver
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !observacion.trim()}
                className="h-9 cursor-pointer bg-[#145c73] px-4 text-[11.5px] font-semibold text-white hover:bg-[#114c5f]"
              >
                {submitting ? "Guardando..." : "Confirmar y Finalizar"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
