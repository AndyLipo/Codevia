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

const estados = [
    { id: "A", name: "Activo" },
    { id: "I", name: "Inactivo" },
];

export default function CreateUsuarioModal({ open, onOpenChange, onCreate }) {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        nombre: "",
        apellido: "",
        dni: "",
        email: "",
        rolId: "",
        estado: "A",
    });

    // Traemos los roles reales desde Supabase al abrir el modal
    useEffect(() => {
        if (!open) return;

        const fetchRoles = async () => {
            const { data, error } = await supabase
                .schema("usuarios")
                .from("roles")
                .select("id_rol, nombre");

            if (error) {
                console.error("Error al traer roles:", error.message);
                return;
            }
            setRoles(data || []);
        };

        fetchRoles();
    }, [open]);

    const resetForm = () => {
        setForm({
            nombre: "",
            apellido: "",
            dni: "",
            email: "",
            rolId: "",
            estado: "A",
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        // Generamos usuario_login siguiendo el patrón que ya usás: "BP" + DNI
        const usuarioLogin = `BP${form.dni}`;

        // Usuario que está realizando el alta (temporal)
        const usuarioAlta = "BP30000000";

        // Placeholder temporal
        const passwordHash = "$2b$12$ejemplo_hash_de_prueba";

        const { data, error } = await supabase
            .schema("usuarios")
            .from("usuarios")
            .insert([
                {
                    nombre: form.nombre,
                    apellido: form.apellido,
                    dni: form.dni,
                    email: form.email,
                    id_rol: Number(form.rolId),
                    estado: form.estado,
                    usuario_login: usuarioLogin,
                    password_hash: passwordHash,
                    usu_alta: usuarioAlta,
                },
            ])
            .select();

        setLoading(false);

        if (error) {
            console.error("Error al crear usuario:", error.message);
            return;
        }

        onCreate?.(data?.[0]);
        resetForm();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-125 border border-[#e1e8ea] bg-white p-0 shadow-card">
                <DialogHeader className="border-b border-slate-soft bg-white px-6 py-5">
                    <DialogTitle className="font-barlow text-[25px] font-normal text-ink">
                        Nuevo usuario
                    </DialogTitle>
                    <DialogDescription className="text-[12px] text-muted-ink">
                        Asigná un nuevo usuario/rol al sistema.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-5 bg-white px-6 py-5">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Nombre
                                </Label>
                                <Input
                                    placeholder="Nombre"
                                    value={form.nombre}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, nombre: e.target.value }))
                                    }
                                    className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Apellido
                                </Label>
                                <Input
                                    placeholder="Apellido"
                                    value={form.apellido}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, apellido: e.target.value }))
                                    }
                                    className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    DNI
                                </Label>
                                <Input
                                    placeholder="38636078"
                                    value={form.dni}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, dni: e.target.value }))
                                    }
                                    className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Email
                                </Label>
                                <Input
                                    type="email"
                                    placeholder="nombre@brotherplast.com"
                                    value={form.email}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, email: e.target.value }))
                                    }
                                    className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                Rol
                            </Label>
                            <Select
                                value={form.rolId}
                                onValueChange={(value) =>
                                    setForm((prev) => ({ ...prev, rolId: value }))
                                }
                            >
                                <SelectTrigger className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                    <SelectValue placeholder="Seleccionar rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map((rol) => (
                                        <SelectItem
                                            key={rol.id_rol}
                                            value={String(rol.id_rol)}
                                            className="text-[11px] bg-white"
                                        >
                                            {rol.nombre}
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
                                value={form.estado}
                                onValueChange={(value) =>
                                    setForm((prev) => ({ ...prev, estado: value }))
                                }
                            >
                                <SelectTrigger className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                    <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                                <SelectContent>
                                    {estados.map((estado) => (
                                        <SelectItem
                                            key={estado.id}
                                            value={estado.id}
                                            className="text-[11px] bg-white"
                                        >
                                            {estado.name}
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
                                !form.nombre ||
                                !form.apellido ||
                                !form.dni ||
                                !form.email ||
                                !form.rolId
                            }
                            className="h-9 bg-green text-[11px] text-white hover:bg-[#328160]"
                        >
                            {loading ? "Creando..." : "Crear usuario"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}