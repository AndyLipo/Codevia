
import { useState } from "react";
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

const clients = [
    {
        id: "CLI-001",
        name: "Plásticos del Sur",
    },
    {
        id: "CLI-002",
        name: "Mayorista Centro",
    },
    {
        id: "CLI-003",
        name: "Distribuidora Norte",
    },
];

const units = [
    {
        value: "KG",
        label: "Kg",
    },
    {
        value: "TN",
        label: "Tonelada",
    },
    {
        value: "UN",
        label: "Unidad",
    },
    {
        value: "M2",
        label: "m²",
    },
];

export default function CreateOrderModal({
    open,
    onOpenChange,
    onCreate,
}) {
    const [form, setForm] = useState({
        clientId: "",
        volume: "",
        unit: "",
        deliveryDate: "",
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        const newOrder = {
            numero: "PBP-00001",
            idCliente: form.clientId,
            volumen: Number(form.volume),
            unidad: form.unit,
            fechaEntrega: form.deliveryDate,
            estado: "A",
        };

        onCreate?.(newOrder);

        setForm({
            clientId: "",
            volume: "",
            unit: "",
            deliveryDate: "",
        });

        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[500px] border border-[#e1e8ea] bg-white p-0 shadow-card">
                <DialogHeader className="border-b border-[#edf1f2] bg-white px-6 py-5">
                    <DialogTitle className="font-barlow text-[25px] font-normal text-ink">
                        Nuevo pedido
                    </DialogTitle>

                    <DialogDescription className="text-[12px] text-muted-ink">
                        Cargá los datos del pedido de Brother Plast.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-5 bg-white px-6 py-5">
                        {/* Número de pedido */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-ink">
                                Pedido
                            </Label>

                            <div className="flex h-9 items-center rounded-md border border-[#e1e8ea] bg-slate-soft px-3 font-barlow text-[15px] text-ink-soft">
                                PBP-00001
                            </div>

                            <p className="text-[10px] text-[#98a6aa]">
                                Generado automáticamente por el sistema.
                            </p>
                        </div>

                        {/* Cliente */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-ink">
                                Cliente
                            </Label>

                            <Select
                                value={form.clientId}
                                onValueChange={(value) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        clientId: value,
                                    }))
                                }
                            >
                                <SelectTrigger className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                    <SelectValue placeholder="Seleccionar cliente" />
                                </SelectTrigger>

                                <SelectContent>
                                    {clients.map((client) => (
                                        <SelectItem
                                            key={client.id}
                                            value={client.id}
                                            className="text-[11px]"
                                        >
                                            {client.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Volumen + Unidad */}
                        <div className="grid grid-cols-[1fr_150px] gap-3">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="volume"
                                    className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-ink"
                                >
                                    Volumen
                                </Label>

                                <Input
                                    id="volume"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Ej. 1200"
                                    value={form.volume}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            volume: e.target.value,
                                        }))
                                    }
                                    className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-ink">
                                    Unidad
                                </Label>

                                <Select
                                    value={form.unit}
                                    onValueChange={(value) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            unit: value,
                                        }))
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

                        {/* Fecha */}
                        <div className="space-y-2">
                            <Label
                                htmlFor="deliveryDate"
                                className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-ink"
                            >
                                Fecha de entrega
                            </Label>

                            <Input
                                id="deliveryDate"
                                type="date"
                                value={form.deliveryDate}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        deliveryDate: e.target.value,
                                    }))
                                }
                                className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft"
                            />
                        </div>
                    </div>

                    <DialogFooter className="border-t border-[#edf1f2] bg-white px-6 py-4">
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
                                !form.clientId ||
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
