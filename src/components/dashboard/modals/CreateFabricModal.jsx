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

// Hardcodeados por ahora
const sector = [
    { id: "Sect-001", name: "Pasillo A" },
    { id: "Sect-002", name: "Pasillo B" },
    { id: "Sect-003", name: "Pasillo C" },
];

const turnos = [
    { value: "Mañana", label: "Mañana" },
    { value: "Tarde", label: "Tarde" },
    { value: "Noche", label: "Noche" },
];

const levels = [
    { value: "En Proceso", label: "En Proceso" },
    { value: "Control de Calidad", label: "Control de Calidad" },
    { value: "Liberado", label: "Liberado" },
    { value: "Pendiente", label: "Pendiente" },
];

export default function CreateFabricModal({ open, onOpenChange, onCreate }) {
    const [productos, setProductos] = useState([]);
    const [materiales, setMateriales] = useState([]);
    const [unidades, setUnidades] = useState([]);

    const [form, setForm] = useState({
        productoId: "",
        materialId: "",
        sectorId: "",
        turno: "",
        level: "",
        stock: "",
        unit: "",
    });

    // Traemos producto, material y unidad desde Supabase al abrir el modal
    useEffect(() => {
        if (!open) return;

        const fetchOptions = async () => {
            const [
                { data: productosData, error: productosError },
                { data: materialesData, error: materialesError },
                { data: unidadesData, error: unidadesError },
            ] = await Promise.all([
                supabase
                    .schema("produccion")
                    .from("producto")
                    .select("id_producto, codigo, nombre, id_material, id_unidad_medida")
                    .eq("estado", "A"),
                supabase
                    .schema("produccion")
                    .from("material")
                    .select("id_material, codigo, nombre")
                    .eq("estado", "A"),
                supabase
                    .schema("produccion")
                    .from("unidad_medida")
                    .select("id_unidad_medida, codigo, nombre")
                    .eq("estado", "A"),
            ]);

            if (productosError) console.error("Error al traer productos:", productosError.message);
            else setProductos(productosData || []);

            if (materialesError) console.error("Error al traer materiales:", materialesError.message);
            else setMateriales(materialesData || []);

            if (unidadesError) console.error("Error al traer unidades:", unidadesError.message);
            else setUnidades(unidadesData || []);
        };

        fetchOptions().catch((error) => {
            console.error("Error al cargar las opciones:", error);
        });
    }, [open]);

    const resetForm = () => {
        setForm({
            productoId: "",
            materialId: "",
            sectorId: "",
            turno: "",
            level: "",
            stock: "",
            unit: "",
        });
    };

    // Al elegir un producto, sugerimos su material y su unidad (se pueden cambiar)
    const handleProductoChange = (value) => {
        const prod = productos.find((p) => String(p.id_producto) === value);

        setForm((prev) => ({
            ...prev,
            productoId: value,
            materialId: prod?.id_material ? String(prod.id_material) : prev.materialId,
            unit: prod?.id_unidad_medida ? String(prod.id_unidad_medida) : prev.unit,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const newFabric = {
            idProducto: Number(form.productoId),
            idMaterial: Number(form.materialId),
            linea: form.sectorId,
            turno: form.turno,
            estado: form.level,
            stock: Number(form.stock),
            idUnidadMedida: Number(form.unit),
        };

        onCreate?.(newFabric);
        resetForm();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-2rem)] max-w-[500px] min-w-0 border border-[#e1e8ea] bg-white p-0 shadow-card sm:w-[calc(100vw-3rem)]">
                <DialogHeader className="border-b border-slate-soft bg-white px-6 py-5">
                    <DialogTitle className="font-barlow text-[25px] font-normal text-ink">
                        Registrar Fabricacion
                    </DialogTitle>

                    <DialogDescription className="text-[12px] text-muted-ink">
                        Cargá los datos de la fabricación de Brother Plast.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-5 bg-white px-6 py-5">
                        {/* Producto */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                Producto
                            </Label>

                            <Select value={form.productoId} onValueChange={handleProductoChange}>
                                <SelectTrigger className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
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

                        {/* Material + Línea */}
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
                                                className="bg-white text-[11px]"
                                            >
                                                {m.codigo} — {m.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Linea
                                </Label>

                                <Select
                                    value={form.sectorId}
                                    onValueChange={(value) =>
                                        setForm((prev) => ({ ...prev, sectorId: value }))
                                    }
                                >
                                    <SelectTrigger className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                        <SelectValue placeholder="Seleccionar línea" />
                                    </SelectTrigger>

                                    <SelectContent>
                                        {sector.map((s) => (
                                            <SelectItem
                                                key={s.id}
                                                value={s.id}
                                                className="bg-white text-[11px]"
                                            >
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Turno y estado */}
                        <div className="grid grid-cols-[1fr_150px] gap-3">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Turno
                                </Label>

                                <Select
                                    value={form.turno}
                                    onValueChange={(value) =>
                                        setForm((prev) => ({ ...prev, turno: value }))
                                    }
                                >
                                    <SelectTrigger className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                        <SelectValue placeholder="Turno" />
                                    </SelectTrigger>

                                    <SelectContent>
                                        {turnos.map((turno) => (
                                            <SelectItem
                                                key={turno.value}
                                                value={turno.value}
                                                className="bg-white text-[11px]"
                                            >
                                                {turno.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Estado
                                </Label>

                                <Select
                                    value={form.level}
                                    onValueChange={(value) =>
                                        setForm((prev) => ({ ...prev, level: value }))
                                    }
                                >
                                    <SelectTrigger className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                        <SelectValue placeholder="Estado" />
                                    </SelectTrigger>

                                    <SelectContent>
                                        {levels.map((level) => (
                                            <SelectItem
                                                key={level.value}
                                                value={level.value}
                                                className="bg-white text-[11px]"
                                            >
                                                {level.label}
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
                                    htmlFor="stock"
                                    className="text-[10px] font-bold uppercase tracking-widest text-muted-ink"
                                >
                                    Stock
                                </Label>

                                <Input
                                    id="stock"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Ej. 1200"
                                    value={form.stock}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, stock: e.target.value }))
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
                                        {unidades.map((u) => (
                                            <SelectItem
                                                key={u.id_unidad_medida}
                                                value={String(u.id_unidad_medida)}
                                                className="bg-white text-[11px]"
                                            >
                                                {u.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
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
                                !form.stock ||
                                !form.unit
                            }
                        >
                            Registrar fabricación
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}