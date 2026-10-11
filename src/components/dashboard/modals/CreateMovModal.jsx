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

const ubicFisic = [
    { id: "Sector B · Rack 04 · P02", name: "Sector B · Rack 04 · P02" },
    { id: "Sector A · Rack 02 · P07", name: "Sector A · Rack 02 · P07" },
    { id: "Sector A · Rack 02 · P08", name: "Sector A · Rack 02 · P08" },
];

const units = [
    { value: "KG", label: "Kg" },
    { value: "TN", label: "Tonelada" },
    { value: "UN", label: "Unidad" },
    { value: "M2", label: "m²" },
];
const levels = [
    { value: "Critico", label: "Critico" },
    { value: "Normal", label: "Normal" },
    { value: "Atencion", label: "Atencion" },
];

export default function CreateMovModal({ open, onOpenChange, onCreate }) {
    const [productos, setProductos] = useState([]);
    const [materiales, setMateriales] = useState([]);

    const [form, setForm] = useState({
        productoId: "",
        materialId: "",
        ubicFisic: "",
        volume: "",
        unit: "",
        level: "",
        deliveryDate: "",
    });

    // Traemos productos y materiales reales desde Supabase al abrir el modal
    useEffect(() => {
        if (!open) return;

        const fetchOptions = async () => {
            const [{ data: productosData, error: productosError }, { data: materialesData, error: materialesError }] =
                await Promise.all([
                    supabase
                        .schema("produccion")
                        .from("producto")
                        .select("id_producto, codigo, nombre, id_unidad_medida, unidad_medida(nombre, codigo)")
                        .eq("estado", "A"),
                    supabase
                        .schema("produccion")
                        .from("material")
                        .select("id_material, codigo, nombre")
                        .eq("estado", "A"),
                ]);

            if (productosError) console.error("Error al traer productos:", productosError.message);
            else setProductos(productosData || []);

            if (materialesError) console.error("Error al traer materiales:", materialesError.message);
            else setMateriales(materialesData || []);
        };

        fetchOptions();
    }, [open]);

    const resetForm = () => {
        setForm({
            productoId: "",
            materialId: "",
            ubicFisic: "",
            volume: "",
            unit: "",
            level: "",
            deliveryDate: "",
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const producto = productos.find((p) => String(p.id_producto) === form.productoId);

        const newOrder = {
            numero: producto?.codigo,
            idProducto: form.productoId,
            idMaterial: form.materialId,
            ubicacionFisica: form.ubicFisic,
            volumen: Number(form.volume),
            unidad: form.unit,
            nivel: form.level,
            fechaEntrega: form.deliveryDate,
            estado: "A",
        };

        onCreate?.(newOrder);
        resetForm();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-125 border border-[#e1e8ea] bg-white p-0 shadow-card">
                <DialogHeader className="border-b border-slate-soft bg-white px-6 py-5">
                    <DialogTitle className="font-barlow text-[25px] font-normal text-ink">
                        Nuevo Stock
                    </DialogTitle>

                    <DialogDescription className="text-[12px] text-muted-ink">
                        Cargá los datos del pedido de Brother Plast.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-5 bg-white px-6 py-5">
                        {/* Producto */}
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

                        {/* Material + Ubicación física */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Material
                                </Label>

                                <Select
                                    value={form.materialId}
                                    onValueChange={(value) =>
                                        setForm((prev) => ({ ...prev, materialId: value }))
                                    }
                                >
                                    <SelectTrigger className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                        <SelectValue placeholder="Seleccionar material" />
                                    </SelectTrigger>

                                    <SelectContent>
                                        {materiales.map((m) => (
                                            <SelectItem
                                                key={m.id_material}
                                                value={String(m.id_material)}
                                                className="text-[11px] bg-white"
                                            >
                                                {m.codigo} — {m.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Ubicación física
                                </Label>

                                <Select
                                    value={form.ubicFisic}
                                    onValueChange={(value) =>
                                        setForm((prev) => ({ ...prev, ubicFisic: value }))
                                    }
                                >
                                    <SelectTrigger className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                        <SelectValue placeholder="Seleccionar ubicación" />
                                    </SelectTrigger>

                                    <SelectContent>
                                        {ubicFisic.map((ubicFisics) => (
                                            <SelectItem
                                                key={ubicFisics.id}
                                                value={ubicFisics.id}
                                                className="text-[11px] bg-white"
                                            >
                                                {ubicFisics.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Stock y unidad */}
                        <div className="grid grid-cols-[1fr_150px] gap-3">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="volume"
                                    className="text-[10px] font-bold uppercase tracking-widest text-muted-ink"
                                >
                                    Stock
                                </Label>

                                <Input
                                    id="volume"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Ej. 1200"
                                    value={form.volume}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, volume: e.target.value }))
                                    }
                                    className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Unidad
                                </Label>

                                <Select
                                    value={form.unit}
                                    onValueChange={(value) =>
                                        setForm((prev) => ({ ...prev, unit: value }))
                                    }
                                >
                                    <SelectTrigger className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                        <SelectValue placeholder="Unidad" />
                                    </SelectTrigger>

                                    <SelectContent>
                                        {units.map((unit) => (
                                            <SelectItem
                                                key={unit.value}
                                                value={unit.value}
                                                className="text-[11px]"
                                            >
                                                {unit.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                Nivel
                            </Label>

                            <Select
                                value={form.level}
                                onValueChange={(value) =>
                                    setForm((prev) => ({ ...prev, level: value }))
                                }
                            >
                                <SelectTrigger className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                    <SelectValue placeholder="Nivel" />
                                </SelectTrigger>

                                <SelectContent>
                                    {levels.map((level) => (
                                        <SelectItem
                                            key={level.value}
                                            value={level.value}
                                            className="text-[11px]"
                                        >
                                            {level.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Fecha */}
                        <div className="space-y-2">
                            <Label
                                htmlFor="deliveryDate"
                                className="text-[10px] font-bold uppercase tracking-widest text-muted-ink"
                            >
                                Fecha de entrega
                            </Label>

                            <Input
                                id="deliveryDate"
                                type="date"
                                value={form.deliveryDate}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, deliveryDate: e.target.value }))
                                }
                                className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft"
                            />
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
                            className="h-9 bg-green text-[11px] text-white hover:bg-[#328160]"
                            disabled={
                                !form.productoId ||
                                !form.materialId ||
                                !form.volume ||
                                !form.unit ||
                                !form.deliveryDate
                            }
                        >
                            Crear pedido
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}