
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

const trucks = [
    {
        id: "CAM-12",
        label: "CAM-12",
    },
    {
        id: "CAM-07",
        label: "CAM-07",
    },
    {
        id: "CAM-03",
        label: "CAM-03",
    },
];

const drivers = [
    {
        id: "DRV-001",
        name: "C. Núñez",
    },
    {
        id: "DRV-002",
        name: "M. Rojas",
    },
    {
        id: "DRV-003",
        name: "L. Sosa",
    },
];

const pickingStates = [
    {
        value: "P",
        label: "Pendiente",
    },
    {
        value: "E",
        label: "En proceso",
    },
    {
        value: "C",
        label: "Listo",
    },
];

export default function CreateRouteSheetModal({
    open,
    onOpenChange,
    onCreate,
}) {
    const [form, setForm] = useState({
        clientId: "",
        truckId: "",
        driverId: "",
        picking: "P",
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        const newRouteSheet = {
            numero: "HR-00001",
            idCliente: form.clientId,
            idCamion: form.truckId,
            idChofer: form.driverId,
            estadoPicking: form.picking,
            estado: "A",
        };

        onCreate?.(newRouteSheet);

        setForm({
            clientId: "",
            truckId: "",
            driverId: "",
            picking: "P",
        });

        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[500px] border border-[#e1e8ea] bg-white p-0 shadow-card">
                <DialogHeader className="border-b border-[#edf1f2] bg-white px-6 py-5">
                    <DialogTitle className="font-barlow text-[25px] font-normal text-ink">
                        Nueva hoja de ruta
                    </DialogTitle>

                    <DialogDescription className="text-[12px] text-muted-ink">
                        Asigná el cliente, vehículo y responsable de la entrega.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-5 bg-white px-6 py-5">
                        {/* Número */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-ink">
                                Hoja
                            </Label>

                            <div className="flex h-9 items-center rounded-md border border-[#e1e8ea] bg-slate-soft px-3 font-barlow text-[15px] text-ink-soft">
                                HR-00001
                            </div>

                            <p className="text-[10px] text-[#98a6aa]">
                                Generada automáticamente por el sistema.
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

                        {/* Camión + Chofer */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-ink">
                                    Camión
                                </Label>

                                <Select
                                    value={form.truckId}
                                    onValueChange={(value) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            truckId: value,
                                        }))
                                    }
                                >
                                    <SelectTrigger className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                        <SelectValue placeholder="Seleccionar" />
                                    </SelectTrigger>

                                    <SelectContent>
                                        {trucks.map((truck) => (
                                            <SelectItem
                                                key={truck.id}
                                                value={truck.id}
                                                className="text-[11px]"
                                            >
                                                {truck.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-ink">
                                    Chofer
                                </Label>

                                <Select
                                    value={form.driverId}
                                    onValueChange={(value) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            driverId: value,
                                        }))
                                    }
                                >
                                    <SelectTrigger className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                        <SelectValue placeholder="Seleccionar" />
                                    </SelectTrigger>

                                    <SelectContent>
                                        {drivers.map((driver) => (
                                            <SelectItem
                                                key={driver.id}
                                                value={driver.id}
                                                className="text-[11px]"
                                            >
                                                {driver.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Picking */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-ink">
                                Picking
                            </Label>

                            <Select
                                value={form.picking}
                                onValueChange={(value) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        picking: value,
                                    }))
                                }
                            >
                                <SelectTrigger className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                    <SelectValue />
                                </SelectTrigger>

                                <SelectContent>
                                    {pickingStates.map((state) => (
                                        <SelectItem
                                            key={state.value}
                                            value={state.value}
                                            className="text-[11px]"
                                        >
                                            {state.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
                                !form.truckId ||
                                !form.driverId
                            }
                        >
                            Crear hoja de ruta
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
