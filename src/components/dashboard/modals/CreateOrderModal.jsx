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
    const [unidades, setUnidades] = useState([]);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        productoId: "",
        cantidad: "",
        unidad: "",
        fechaLimite: "",
        solicitanteId: "",
    });

    // Derivados: van DESPUÉS de los useState de los que dependen
    const unidadSel = unidades.find(
        (u) => String(u.id_unidad_medida) === form.unidad
    );

    // Consultar las opciones desde Supabase al abrir el modal
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
        });
    }, [open]);

    const resetForm = () => {
        setForm({
            productoId: "",
            cantidad: "",
            unidad: "",
            fechaLimite: "",
            solicitanteId: "",
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (
            !form.productoId ||
            !form.cantidad ||
            !form.unidad ||
            !form.fechaLimite ||
            !form.solicitanteId
        ) {
            return;
        }

        setLoading(true);

        try {
            const solicitante = solicitantes.find(
                (u) => String(u.id_usuario) === form.solicitanteId
            );

            if (!solicitante) {
                console.error("No se encontró el solicitante.");
                return;
            }

            const now = new Date().toISOString();

            // 1. Cabecera de la orden
            const { data: ordenData, error: ordenError } = await supabase
                .schema("produccion")
                .from("orden_produccion")
                .insert([
                    {
                        fecha_orden: now,
                        id_solicitante: Number(form.solicitanteId),
                        estado_op: "P",
                        estado: "A",
                        usu_alta: solicitante.usuario_login,
                        fec_alta: now,
                    },
                ])
                .select()
                .single();

            if (ordenError) {
                console.error("Error al crear orden de producción:", ordenError.message);
                return;
            }

            // 2. Detalle de la orden
            const { data: detalleData, error: detalleError } = await supabase
                .schema("produccion")
                .from("detalle_orden_produccion")
                .insert([
                    {
                        id_orden_produccion: ordenData.id_orden_produccion,
                        id_producto: Number(form.productoId),
                        id_unidad_medida: Number(form.unidad),
                        cantidad_solicitada: Number(form.cantidad),
                        cantidad_producida: 0,
                        fecha_limite: form.fechaLimite,
                        estado_detalle: "P",
                        estado: "A",
                        usu_alta: solicitante.usuario_login,
                        fec_alta: now,
                    },
                ])
                .select()
                .single();

            if (detalleError) {
                console.error("Error al crear el detalle de la orden:", detalleError.message);
                return;
            }

            onCreate?.({ ...ordenData, detalle: detalleData });

            resetForm();
            onOpenChange(false);
        } catch (error) {
            console.error("Error inesperado al crear la orden:", error);
        } finally {
            setLoading(false);
        }
    };

    return (

        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-2rem)] max-w-[500px] min-w-0 border border-[#e1e8ea] bg-white p-0 shadow-card sm:w-[calc(100vw-3rem)]">

                {/* Encabezado */}
                <DialogHeader className="border-b border-slate-soft bg-white px-4 py-4 sm:px-6 sm:py-5">
                    <DialogTitle className="font-barlow text-[22px] font-normal text-ink sm:text-[25px]">
                        Nueva orden de producción
                    </DialogTitle>

                    <DialogDescription className="text-[12px] text-muted-ink">
                        Solicitá la fabricación de un producto para Brother Plast.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="min-w-0">
                    <div className="space-y-4 bg-white px-4 py-4 sm:space-y-5 sm:px-6 sm:py-5">

                        {/* Producto */}
                        <div className="min-w-0 space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                Producto
                            </Label>

                            <Select
                                value={form.productoId}
                                onValueChange={(value) => {
                                    const prod = productos.find(
                                        (p) => String(p.id_producto) === value
                                    );

                                    setForm((prev) => ({
                                        ...prev,
                                        productoId: value,
                                        unidad: prod?.id_unidad_medida
                                            ? String(prod.id_unidad_medida)
                                            : prev.unidad,
                                    }));
                                }}
                            >
                                <SelectTrigger className="h-10 w-full min-w-0 border-[#dfe7e9] bg-white text-[12px] text-ink-soft sm:h-9 sm:text-[11px]">
                                    <SelectValue placeholder="Seleccionar producto" />
                                </SelectTrigger>

                                <SelectContent>
                                    {productos.map((p) => (
                                        <SelectItem
                                            key={p.id_producto}
                                            value={String(p.id_producto)}
                                            className="bg-white text-[11px]"
                                        >
                                            {p.codigo} — {p.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Cantidad y unidad */}
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
                                        <SelectValue placeholder="Seleccionar" />
                                    </SelectTrigger>

                                    <SelectContent>
                                        {unidades.map((unidad) => (
                                            <SelectItem
                                                key={unidad.id_unidad_medida}
                                                value={String(unidad.id_unidad_medida)}
                                                className="bg-white text-[11px]"
                                            >
                                                {unidad.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Solicitante y fecha límite */}
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
                                        {solicitantes.map((u) => (
                                            <SelectItem
                                                key={u.id_usuario}
                                                value={String(u.id_usuario)}
                                                className="bg-white text-[11px]"
                                            >
                                                {u.nombre} {u.apellido}
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

                    {/* Acciones */}
                    <DialogFooter className="flex-col-reverse gap-2 border-t border-slate-soft bg-white px-4 py-4 sm:flex-row sm:justify-end sm:px-6">

                        <Button
                            type="button"
                            variant="outline"
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
                                !form.unidad ||
                                !form.fechaLimite ||
                                !form.solicitanteId
                            }
                            className="h-10 w-full bg-green text-[12px] text-white hover:bg-[#328160] sm:h-9 sm:w-auto sm:text-[11px]"
                        >
                            {loading ? "Creando..." : "Crear orden"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}