
import { useEffect, useMemo, useState } from "react";
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

const formInicial = {
    productoId: "",
    produccionId: "",
    volume: "",
    fechaFabricacion: "",
    fechaVencimiento: "",
};

function obtenerProductoDeProduccion(produccion) {
    const detalle = produccion?.detalle_orden_produccion;

    if (Array.isArray(detalle)) {
        return detalle[0]?.id_producto ?? null;
    }

    return detalle?.id_producto ?? null;
}

export default function CreateMovModal({
    open,
    onOpenChange,
    onCreate,
    usuarioActual,
}) {
    const [productos, setProductos] = useState([]);
    const [producciones, setProducciones] = useState([]);
    const [produccionesConLote, setProduccionesConLote] = useState(
        new Set()
    );
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState(formInicial);

    const productoSeleccionado = useMemo(
        () =>
            productos.find(
                (producto) =>
                    String(producto.id_producto) === form.productoId
            ),
        [productos, form.productoId]
    );

    // Solo producciones completadas que todavía no tienen un lote.
    const produccionesDisponibles = useMemo(
        () =>
            producciones.filter(
                (produccion) =>
                    String(obtenerProductoDeProduccion(produccion)) ===
                    form.productoId &&
                    produccion.estado_produccion === "C" &&
                    produccion.fecha_fin &&
                    !produccionesConLote.has(
                        Number(produccion.id_produccion)
                    )
            ),
        [producciones, form.productoId, produccionesConLote]
    );

    useEffect(() => {
        if (!open) return;

        let cancelado = false;

        async function cargarOpciones() {
            setLoadingOptions(true);

            try {
                const [
                    { data: productosData, error: productosError },
                    { data: produccionesData, error: produccionesError },
                    { data: lotesData, error: lotesError },
                ] = await Promise.all([
                    supabase
                        .schema("produccion")
                        .from("producto")
                        .select(`
                            id_producto,
                            codigo,
                            nombre,
                            id_unidad_medida,
                            unidad_medida (
                                codigo,
                                nombre
                            )
                        `)
                        .eq("estado", "A")
                        .order("nombre", { ascending: true }),

                    supabase
                        .schema("produccion")
                        .from("produccion")
                        .select(`
                            id_produccion,
                            id_detalle_orden,
                            cantidad_producida,
                            estado,
                            estado_produccion,
                            fecha_fin,
                            detalle_orden_produccion (
                                id_producto
                            )
                        `)
                        .eq("estado", "A")
                        .order("id_produccion", { ascending: false }),

                    supabase
                        .schema("produccion")
                        .from("lote_producto")
                        .select("id_produccion"),
                ]);

                if (productosError) throw productosError;
                if (produccionesError) throw produccionesError;
                if (lotesError) throw lotesError;

                if (cancelado) return;

                setProductos(productosData ?? []);
                setProducciones(produccionesData ?? []);

                setProduccionesConLote(
                    new Set(
                        (lotesData ?? []).map((lote) =>
                            Number(lote.id_produccion)
                        )
                    )
                );
            } catch (error) {
                console.error(
                    "Error cargando opciones del lote:",
                    error
                );

                if (!cancelado) {
                    toast.error(
                        `No se pudieron cargar los datos: ${error.message || "Error desconocido"
                        }`
                    );
                }
            } finally {
                if (!cancelado) setLoadingOptions(false);
            }
        }

        cargarOpciones();

        return () => {
            cancelado = true;
        };
    }, [open]);

    useEffect(() => {
        if (!open) {
            setForm(formInicial);
        }
    }, [open]);

    const handleProductoChange = (productoId) => {
        setForm((prev) => ({
            ...prev,
            productoId,
            produccionId: "",
            volume: "",
        }));
    };

    const handleProduccionChange = (produccionId) => {
        const produccion = produccionesDisponibles.find(
            (item) =>
                String(item.id_produccion) === produccionId
        );

        setForm((prev) => ({
            ...prev,
            produccionId,
            // La cantidad del lote debe coincidir con la producción.
            volume: produccion
                ? String(produccion.cantidad_producida)
                : "",
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (loading) return;

        if (!usuarioActual?.usuario_login) {
            toast.error(
                "No hay un usuario válido seleccionado para registrar el lote."
            );
            return;
        }

        if (!form.productoId || !form.produccionId) {
            toast.error("Seleccioná un producto y una producción.");
            return;
        }

        if (
            !form.volume ||
            !Number.isFinite(Number(form.volume)) ||
            Number(form.volume) <= 0
        ) {
            toast.error("La cantidad debe ser mayor que cero.");
            return;
        }

        if (!form.fechaFabricacion) {
            toast.error("Ingresá la fecha de fabricación.");
            return;
        }

        if (
            form.fechaVencimiento &&
            form.fechaVencimiento < form.fechaFabricacion
        ) {
            toast.error(
                "La fecha de vencimiento no puede ser anterior a la fabricación."
            );
            return;
        }

        const produccionSeleccionada =
            produccionesDisponibles.find(
                (produccion) =>
                    String(produccion.id_produccion) ===
                    form.produccionId
            );

        if (!produccionSeleccionada) {
            toast.error(
                "La producción ya tiene un lote o no está disponible. Actualizá la ventana e intentá nuevamente."
            );
            return;
        }

        if (
            produccionSeleccionada.estado_produccion !== "C" ||
            !produccionSeleccionada.fecha_fin
        ) {
            toast.error(
                "Solo se pueden registrar lotes de producciones completadas."
            );
            return;
        }

        const idProductoProduccion =
            obtenerProductoDeProduccion(produccionSeleccionada);

        if (
            Number(idProductoProduccion) !==
            Number(form.productoId)
        ) {
            toast.error(
                "El producto no coincide con el detalle de la producción."
            );
            return;
        }

        const cantidadProducida = Number(
            produccionSeleccionada.cantidad_producida
        );

        if (
            Math.abs(Number(form.volume) - cantidadProducida) >
            0.0005
        ) {
            toast.error(
                `La cantidad del lote debe coincidir con la producción: ${cantidadProducida}.`
            );
            return;
        }

        setLoading(true);

        try {
            // Segunda comprobación: evita intentar insertar un lote
            // si otra operación ya lo registró.
            const { data: loteExistente, error: consultaError } =
                await supabase
                    .schema("produccion")
                    .from("lote_producto")
                    .select("id_lote_producto, nro_lote")
                    .eq(
                        "id_produccion",
                        Number(produccionSeleccionada.id_produccion)
                    )
                    .maybeSingle();

            if (consultaError) throw consultaError;

            if (loteExistente) {
                setProduccionesConLote((prev) => {
                    const actualizadas = new Set(prev);
                    actualizadas.add(
                        Number(produccionSeleccionada.id_produccion)
                    );
                    return actualizadas;
                });

                setForm((prev) => ({
                    ...prev,
                    produccionId: "",
                    volume: "",
                }));

                toast.error(
                    `Esta producción ya tiene el lote ${loteExistente.nro_lote ||
                    loteExistente.id_lote_producto
                    }. Seleccioná otra producción.`
                );
                return;
            }

            const nuevoLote = {
                id_produccion: Number(
                    produccionSeleccionada.id_produccion
                ),
                id_producto: Number(form.productoId),
                fecha_fabricacion: `${form.fechaFabricacion}T12:00:00`,
                fecha_vencimiento: form.fechaVencimiento || null,
                cantidad_total: Number(form.volume),
                usu_alta: usuarioActual.usuario_login,
            };

            const { data, error } = await supabase
                .schema("produccion")
                .from("lote_producto")
                .insert(nuevoLote)
                .select()
                .single();

            if (error) {
                console.error("Error detallado al crear lote:", {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint,
                    status: error.status,
                });

                if (error.code === "23505") {
                    setProduccionesConLote((prev) => {
                        const actualizadas = new Set(prev);
                        actualizadas.add(
                            Number(
                                produccionSeleccionada.id_produccion
                            )
                        );
                        return actualizadas;
                    });

                    setForm((prev) => ({
                        ...prev,
                        produccionId: "",
                        volume: "",
                    }));

                    toast.error(
                        "Esta producción ya tiene un lote registrado. Seleccioná otra producción."
                    );
                    return;
                }

                throw error;
            }

            setProduccionesConLote((prev) => {
                const actualizadas = new Set(prev);
                actualizadas.add(Number(data.id_produccion));
                return actualizadas;
            });

            await onCreate?.(data);

            toast.success(
                `Lote ${data.nro_lote || data.id_lote_producto
                } creado correctamente.`
            );

            setForm(formInicial);
            onOpenChange(false);
        } catch (error) {
            console.error("Error inesperado creando lote:", error);

            toast.error(
                `No se pudo crear el lote: ${error.message || "Error desconocido"
                }`
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90dvh] max-w-125 overflow-y-auto border border-[#e1e8ea] bg-white p-0 shadow-card">
                <DialogHeader className="border-b border-slate-soft bg-white px-6 py-5">
                    <DialogTitle className="font-barlow text-[25px] font-normal text-ink">
                        Nuevo lote de stock
                    </DialogTitle>

                    <DialogDescription className="text-[12px] text-muted-ink">
                        Registrá un lote asociado a una producción existente.
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
                                onValueChange={handleProductoChange}
                                disabled={loadingOptions || loading}
                            >
                                <SelectTrigger className="h-9 w-full border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                    <SelectValue
                                        placeholder={
                                            loadingOptions
                                                ? "Cargando productos..."
                                                : "Seleccionar producto"
                                        }
                                    />
                                </SelectTrigger>

                                <SelectContent>
                                    {productos.map((producto) => (
                                        <SelectItem
                                            key={producto.id_producto}
                                            value={String(producto.id_producto)}
                                            className="bg-white text-[11px]"
                                        >
                                            {producto.codigo} — {producto.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                Producción asociada
                            </Label>

                            <Select
                                value={form.produccionId}
                                onValueChange={handleProduccionChange}
                                disabled={
                                    loadingOptions ||
                                    loading ||
                                    !form.productoId ||
                                    produccionesDisponibles.length === 0
                                }
                            >
                                <SelectTrigger className="h-9 w-full border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                    <SelectValue placeholder="Seleccionar producción" />
                                </SelectTrigger>

                                <SelectContent>
                                    {produccionesDisponibles.map(
                                        (produccion) => (
                                            <SelectItem
                                                key={produccion.id_produccion}
                                                value={String(
                                                    produccion.id_produccion
                                                )}
                                                className="bg-white text-[11px]"
                                            >
                                                Producción #
                                                {produccion.id_produccion}
                                                {" — "}
                                                Cantidad:{" "}
                                                {produccion.cantidad_producida}
                                            </SelectItem>
                                        )
                                    )}
                                </SelectContent>
                            </Select>

                            {form.productoId &&
                                produccionesDisponibles.length === 0 &&
                                !loadingOptions && (
                                    <p className="text-xs text-amber-700">
                                        No hay producciones completadas sin
                                        lote asociadas a este producto.
                                    </p>
                                )}
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="cantidadLote"
                                    className="text-[10px] font-bold uppercase tracking-widest text-muted-ink"
                                >
                                    Cantidad total
                                </Label>

                                <Input
                                    id="cantidadLote"
                                    type="number"
                                    min="0.001"
                                    step="0.001"
                                    placeholder="Ej. 1200"
                                    value={form.volume}
                                    onChange={(event) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            volume: event.target.value,
                                        }))
                                    }
                                    disabled={loading}
                                    required
                                    className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Unidad del producto
                                </Label>

                                <div className="flex h-9 items-center rounded-md border border-[#dfe7e9] bg-[#f8fafb] px-3 text-[11px] text-ink-soft">
                                    {productoSeleccionado
                                        ? productoSeleccionado.unidad_medida?.nombre ||
                                        productoSeleccionado.unidad_medida?.codigo ||
                                        "Unidad no configurada"
                                        : "Seleccioná un producto"}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label
                                htmlFor="fechaFabricacion"
                                className="text-[10px] font-bold uppercase tracking-widest text-muted-ink"
                            >
                                Fecha de fabricación
                            </Label>

                            <Input
                                id="fechaFabricacion"
                                type="date"
                                value={form.fechaFabricacion}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        fechaFabricacion: event.target.value,
                                    }))
                                }
                                disabled={loading}
                                required
                                className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label
                                htmlFor="fechaVencimiento"
                                className="text-[10px] font-bold uppercase tracking-widest text-muted-ink"
                            >
                                Fecha de vencimiento (opcional)
                            </Label>

                            <Input
                                id="fechaVencimiento"
                                type="date"
                                min={form.fechaFabricacion || undefined}
                                value={form.fechaVencimiento}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        fechaVencimiento: event.target.value,
                                    }))
                                }
                                disabled={loading}
                                className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft"
                            />
                        </div>

                        <p className="text-[11px] leading-relaxed text-muted-ink">
                            El número de lote lo genera automáticamente la
                            base de datos. La ubicación física se asignará
                            cuando se conecte el módulo de posiciones del
                            depósito.
                        </p>
                    </div>

                    <DialogFooter className="border-t border-slate-soft bg-white px-6 py-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                            className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft hover:bg-slate-soft"
                        >
                            Cancelar
                        </Button>

                        <Button
                            type="submit"
                            disabled={
                                loading ||
                                loadingOptions ||
                                !usuarioActual?.usuario_login ||
                                !form.productoId ||
                                !form.produccionId ||
                                !form.volume ||
                                Number(form.volume) <= 0 ||
                                !form.fechaFabricacion
                            }
                            className="h-9 bg-green text-[11px] text-white hover:bg-[#328160]"
                        >
                            {loading ? "Guardando..." : "Crear lote"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
