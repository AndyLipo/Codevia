
import { useEffect, useState } from "react";
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

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { supabase } from "@/lib/supabaseClient";

const initialForm = {
    productoId: "",
    cantidad: "",
    unidad: "",
    fechaLimite: "",
    solicitanteId: "",
};

export default function CreateOrderModal({
    open,
    onOpenChange,
    onCreate,
    orden,
    detalle,
}) {
    const [productos, setProductos] = useState([]);
    const [solicitantes, setSolicitantes] = useState([]);
    const [unidades, setUnidades] = useState([]);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState(initialForm);

    useEffect(() => {
        if (!open) return;

        const fetchOptions = async () => {
            const [
                { data: productosData, error: productosError },
                { data: usuariosData, error: usuariosError },
                { data: unidadesData, error: unidadesError },
            ] = await Promise.all([
                supabase
                    .schema("produccion")
                    .from("producto")
                    .select("id_producto, codigo, nombre, id_unidad_medida")
                    .eq("estado", "A"),

                supabase
                    .schema("usuarios")
                    .from("usuarios")
                    .select("id_usuario, nombre, apellido, usuario_login")
                    .eq("estado", "A"),

                supabase
                    .schema("produccion")
                    .from("unidad_medida")
                    .select("id_unidad_medida, codigo, nombre")
                    .eq("estado", "A"),
            ]);

            if (productosError) {
                console.error("Error al traer productos:", productosError.message);
            } else {
                setProductos(productosData || []);
            }

            if (usuariosError) {
                console.error("Error al traer solicitantes:", usuariosError.message);
            } else {
                setSolicitantes(usuariosData || []);
            }

            if (unidadesError) {
                console.error("Error al traer unidades:", unidadesError.message);
            } else {
                setUnidades(unidadesData || []);
            }
        };

        fetchOptions().catch((error) => {
            console.error("Error al cargar las opciones:", error);
            toast.error("No se pudieron cargar todas las opciones");
        });

        if (orden && detalle) {
            setForm({
                productoId: String(detalle.id_producto ?? ""),
                cantidad: String(detalle.cantidad_solicitada ?? ""),
                unidad: String(detalle.id_unidad_medida ?? ""),
                fechaLimite: detalle.fecha_limite || "",
                solicitanteId: String(orden.id_solicitante ?? ""),
            });
        } else {
            setForm({ ...initialForm });
        }
    }, [open, orden, detalle]);

    const resetForm = () => {
        setForm({ ...initialForm });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (
            !form.productoId ||
            !form.cantidad ||
            Number(form.cantidad) <= 0 ||
            !form.unidad ||
            !form.fechaLimite ||
            !form.solicitanteId
        ) {
            toast.error("Completá todos los campos correctamente");
            return;
        }

        setLoading(true);

        try {
            const solicitante = solicitantes.find(
                (user) => String(user.id_usuario) === form.solicitanteId
            );

            if (!solicitante) {
                toast.error("No se encontró el solicitante seleccionado");
                return;
            }

            const now = new Date().toISOString();

            if (orden && detalle) {
                // Actualizar la cabecera de la orden.
                const { error: orderError } = await supabase
                    .schema("produccion")
                    .from("orden_produccion")
                    .update({
                        id_solicitante: Number(form.solicitanteId),
                        usu_mod: solicitante.usuario_login,
                        fec_mod: now,
                    })
                    .eq("id_orden_produccion", orden.id_orden_produccion);

                if (orderError) {
                    console.error("Error al actualizar la orden:", orderError.message);
                    toast.error("No se pudo actualizar la orden");
                    return;
                }

                // Actualizar el detalle seleccionado.
                const { error: detailError } = await supabase
                    .schema("produccion")
                    .from("detalle_orden_produccion")
                    .update({
                        id_producto: Number(form.productoId),
                        id_unidad_medida: Number(form.unidad),
                        cantidad_solicitada: Number(form.cantidad),
                        fecha_limite: form.fechaLimite,
                        usu_mod: solicitante.usuario_login,
                        fec_mod: now,
                    })
                    .eq("id_detalle_orden", detalle.id_detalle_orden);

                if (detailError) {
                    console.error(
                        "Error al actualizar el detalle:",
                        detailError.message
                    );
                    toast.error(
                        "No se pudo actualizar el detalle de la orden"
                    );
                    return;
                }

                toast.success("Orden actualizada correctamente");
            } else {
                // Crear una orden nueva.
                const { data: orderData, error: orderError } = await supabase
                    .schema("produccion")
                    .from("orden_produccion")
                    .insert({
                        fecha_orden: now,
                        id_solicitante: Number(form.solicitanteId),
                        estado_op: "P",
                        estado: "A",
                        usu_alta: solicitante.usuario_login,
                        fec_alta: now,
                    })
                    .select()
                    .single();

                if (orderError) {
                    console.error("Error al crear la orden:", orderError.message);
                    toast.error("No se pudo crear la orden");
                    return;
                }

                const { error: detailError } = await supabase
                    .schema("produccion")
                    .from("detalle_orden_produccion")
                    .insert({
                        id_orden_produccion: orderData.id_orden_produccion,
                        id_producto: Number(form.productoId),
                        id_unidad_medida: Number(form.unidad),
                        cantidad_solicitada: Number(form.cantidad),
                        cantidad_producida: 0,
                        fecha_limite: form.fechaLimite,
                        estado_detalle: "P",
                        estado: "A",
                        usu_alta: solicitante.usuario_login,
                        fec_alta: now,
                    });

                if (detailError) {
                    console.error(
                        "Error al crear el detalle:",
                        detailError.message
                    );
                    toast.error(
                        "La orden se creó, pero no se pudo guardar su detalle"
                    );
                    return;
                }

                toast.success("Orden creada correctamente");
            }

            await onCreate?.();
            resetForm();
            onOpenChange(false);
        } catch (error) {
            console.error("Error inesperado al guardar la orden:", error);
            toast.error("Ocurrió un error al guardar la orden");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!loading) onOpenChange(nextOpen);
            }}
        >
            <DialogContent className="w-[calc(100vw-2rem)] max-w-[500px] min-w-0 border border-[#e1e8ea] bg-white p-0 shadow-card sm:w-[calc(100vw-3rem)]">
                <DialogHeader className="border-b border-slate-soft bg-white px-4 py-4 sm:px-6 sm:py-5">
                    <DialogTitle className="font-barlow text-[22px] font-normal text-ink sm:text-[25px]">
                        {orden && detalle
                            ? "Editar orden de producción"
                            : "Nueva orden de producción"}
                    </DialogTitle>

                    <DialogDescription className="text-[12px] text-muted-ink">
                        {orden && detalle
                            ? "Modificá los datos del producto solicitado."
                            : "Solicitá la fabricación de un producto para Brother Plast."}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="min-w-0">
                    <div className="space-y-4 bg-white px-4 py-4 sm:space-y-5 sm:px-6 sm:py-5">
                        <div className="min-w-0 space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                Producto
                            </Label>

                            <Select
                                value={form.productoId}
                                onValueChange={(value) => {
                                    const product = productos.find(
                                        (item) => String(item.id_producto) === value
                                    );

                                    setForm((prev) => ({
                                        ...prev,
                                        productoId: value,
                                        unidad: product?.id_unidad_medida
                                            ? String(product.id_unidad_medida)
                                            : prev.unidad,
                                    }));
                                }}
                            >
                                <SelectTrigger className="h-10 w-full min-w-0 border-[#dfe7e9] bg-white text-[12px] text-ink-soft sm:h-9 sm:text-[11px]">
                                    <SelectValue placeholder="Seleccionar producto" />
                                </SelectTrigger>

                                <SelectContent>
                                    {productos.map((product) => (
                                        <SelectItem
                                            key={product.id_producto}
                                            value={String(product.id_producto)}
                                            className="bg-white text-[11px]"
                                        >
                                            {product.codigo} — {product.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_140px] sm:gap-3">
                            <div className="min-w-0 space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Cantidad solicitada
                                </Label>

                                <Input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    placeholder="Ej. 1200"
                                    value={form.cantidad}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            cantidad: e.target.value,
                                        }))
                                    }
                                    className="h-10 border-[#dfe7e9] bg-white text-[12px] text-ink-soft sm:h-9 sm:text-[11px]"
                                    required
                                />
                            </div>

                            <div className="min-w-0 space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Unidad
                                </Label>

                                <Select
                                    value={form.unidad}
                                    onValueChange={(value) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            unidad: value,
                                        }))
                                    }
                                >
                                    <SelectTrigger className="h-10 w-full min-w-0 border-[#dfe7e9] bg-white text-[12px] text-ink-soft sm:h-9 sm:text-[11px]">
                                        <SelectValue placeholder="Seleccionar unidad" />
                                    </SelectTrigger>

                                    <SelectContent>
                                        {unidades.map((unit) => (
                                            <SelectItem
                                                key={unit.id_unidad_medida}
                                                value={String(unit.id_unidad_medida)}
                                                className="bg-white text-[11px]"
                                            >
                                                {unit.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_140px] sm:gap-3">
                            <div className="min-w-0 space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Solicitante
                                </Label>

                                <Select
                                    value={form.solicitanteId}
                                    onValueChange={(value) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            solicitanteId: value,
                                        }))
                                    }
                                >
                                    <SelectTrigger className="h-10 w-full min-w-0 border-[#dfe7e9] bg-white text-[12px] text-ink-soft sm:h-9 sm:text-[11px]">
                                        <SelectValue placeholder="Seleccionar solicitante" />
                                    </SelectTrigger>

                                    <SelectContent>
                                        {solicitantes.map((user) => (
                                            <SelectItem
                                                key={user.id_usuario}
                                                value={String(user.id_usuario)}
                                                className="bg-white text-[11px]"
                                            >
                                                {user.nombre} {user.apellido}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="min-w-0 space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Fecha límite
                                </Label>

                                <Input
                                    type="date"
                                    value={form.fechaLimite}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            fechaLimite: e.target.value,
                                        }))
                                    }
                                    className="h-10 w-full min-w-0 border-[#dfe7e9] bg-white text-[12px] text-ink-soft sm:h-9 sm:text-[11px]"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex-col-reverse gap-2 border-t border-slate-soft bg-white px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={loading}
                            onClick={() => onOpenChange(false)}
                            className="h-10 w-full border-[#dce5e8] bg-white text-[12px] text-ink-soft hover:bg-slate-soft sm:h-9 sm:w-auto sm:text-[11px]"
                        >
                            Cancelar
                        </Button>

                        <Button
                            type="submit"
                            disabled={
                                loading ||
                                !form.productoId ||
                                !form.cantidad ||
                                Number(form.cantidad) <= 0 ||
                                !form.unidad ||
                                !form.fechaLimite ||
                                !form.solicitanteId
                            }
                            className="h-10 w-full bg-green text-[12px] text-white hover:bg-[#328160] sm:h-9 sm:w-auto sm:text-[11px]"
                        >
                            {loading
                                ? "Guardando..."
                                : orden && detalle
                                    ? "Guardar cambios"
                                    : "Crear orden"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
