import { useState, useEffect } from "react";
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

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { supabase } from "@/lib/supabaseClient";

export default function CreateOrderModal({ open, onOpenChange, onCreate }) {
    const [productos, setProductos] = useState([]);
    const [solicitantes, setSolicitantes] = useState([]);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        productoId: "",
        cantidad: "",
        fechaLimite: "",
        solicitanteId: "",
    });

    useEffect(() => {
        if (!open) return;

        const fetchOptions = async () => {
            const [{ data: productosData, error: productosError }, { data: usuariosData, error: usuariosError }] =
                await Promise.all([
                    supabase
                        .schema("produccion")
                        .from("producto")
                        .select("id_producto, codigo, nombre")
                        .eq("estado", "A"),
                    supabase
                        .schema("usuarios")
                        .from("usuarios")
                        .select("id_usuario, nombre, apellido, usuario_login")
                        .eq("estado", "A"),
                ]);

            if (productosError) console.error("Error al traer productos:", productosError.message);
            else setProductos(productosData || []);

            if (usuariosError) console.error("Error al traer solicitantes:", usuariosError.message);
            else setSolicitantes(usuariosData || []);
        };

        fetchOptions();
    }, [open]);

    const resetForm = () => {
        setForm({
            productoId: "",
            cantidad: "",
            fechaLimite: "",
            solicitanteId: "",
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const solicitante = solicitantes.find(
            (u) => String(u.id_usuario) === form.solicitanteId
        );

        // ⚠️ nro_orden generado acá como placeholder simple. Lo ideal sería
        // que exista una secuencia/función en la base (como la que ya armaron
        // para los códigos de lote) que lo genere automáticamente.

        const now = new Date().toISOString();

        // 1) Insertar la cabecera (orden_produccion)
        const { data: ordenData, error: ordenError } = await supabase
            .schema("produccion")
            .from("orden_produccion")
            .insert([
                {
                    fecha_orden: now,
                    id_solicitante: Number(form.solicitanteId),
                    estado_op: "P",
                    estado: "A",
                    usu_alta: solicitante?.usuario_login,
                    fec_alta: now,
                },
            ])
            .select();

        if (ordenError) {
            console.error("Error al crear orden de producción:", ordenError.message);
            setLoading(false);
            return;
        }

        const idOrdenProduccion = ordenData?.[0]?.id_orden_produccion;

        // 2) Insertar el detalle (detalle_orden_produccion)
        const { data: detalleData, error: detalleError } = await supabase
            .schema("produccion")
            .from("detalle_orden_produccion")
            .insert([
                {
                    id_orden_produccion: idOrdenProduccion,
                    id_producto: Number(form.productoId),
                    cantidad_solicitada: Number(form.cantidad),
                    cantidad_producida: 0,
                    fecha_limite: form.fechaLimite,
                    estado_detalle: "P",
                    estado: "A",
                    usu_alta: solicitante?.usuario_login,
                    fec_alta: now,
                },
            ])
            .select();

        setLoading(false);

        if (detalleError) {
            console.error("Error al crear el detalle de la orden:", detalleError.message);
            return;
        }

        onCreate?.({ ...ordenData?.[0], detalle: detalleData?.[0] });
        resetForm();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-125 border border-[#e1e8ea] bg-white p-0 shadow-card">
                <DialogHeader className="border-b border-slate-soft bg-white px-6 py-5">
                    <DialogTitle className="font-barlow text-[25px] font-normal text-ink">
                        Nueva orden de producción
                    </DialogTitle>
                    <DialogDescription className="text-[12px] text-muted-ink">
                        Solicitá la fabricación de un producto para Brother Plast.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-5 bg-white px-6 py-5">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                Producto
                            </Label>
                            <Select
                                value={form.productoId}
                                onValueChange={(value) =>
                                    setForm((prev) => ({ ...prev, productoId: value }))
                                }
                            >
                                <SelectTrigger className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                    <SelectValue placeholder="Seleccionar producto" />
                                </SelectTrigger>
                                <SelectContent>
                                    {productos.map((p) => (
                                        <SelectItem
                                            key={p.id_producto}
                                            value={String(p.id_producto)}
                                            className="text-[11px] bg-white"
                                        >
                                            {p.codigo} — {p.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-[1fr_150px] gap-3">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Cantidad solicitada
                                </Label>
                                <Input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    placeholder="Ej. 1200"
                                    value={form.cantidad}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, cantidad: e.target.value }))
                                    }
                                    className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Fecha límite
                                </Label>
                                <Input
                                    type="date"
                                    value={form.fechaLimite}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, fechaLimite: e.target.value }))
                                    }
                                    className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                Solicitante
                            </Label>
                            <Select
                                value={form.solicitanteId}
                                onValueChange={(value) =>
                                    setForm((prev) => ({ ...prev, solicitanteId: value }))
                                }
                            >
                                <SelectTrigger className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                    <SelectValue placeholder="Seleccionar solicitante" />
                                </SelectTrigger>
                                <SelectContent>
                                    {solicitantes.map((u) => (
                                        <SelectItem
                                            key={u.id_usuario}
                                            value={String(u.id_usuario)}
                                            className="text-[11px] bg-white"
                                        >
                                            {u.nombre} {u.apellido}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter className="border-t border-slate-soft bg-white px-6 py-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft hover:bg-slate-soft"
                        >
                            Cancelar
                        </Button>

                        <Button
                            type="submit"
                            disabled={
                                loading ||
                                !form.productoId ||
                                !form.cantidad ||
                                !form.fechaLimite ||
                                !form.solicitanteId
                            }
                            className="h-9 bg-green text-[11px] text-white hover:bg-[#328160]"
                        >
                            {loading ? "Creando..." : "Crear orden"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}