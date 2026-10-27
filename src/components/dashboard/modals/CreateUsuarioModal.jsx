
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
import { toast } from "sonner";

const estados = [
    { id: "A", name: "Activo" },
    { id: "I", name: "Inactivo" },
];

const initialForm = {
    nombre: "",
    apellido: "",
    dni: "",
    email: "",
    rolId: "",
    estado: "A",
};

export default function CreateUsuarioModal({
    open,
    onOpenChange,
    onCreate,
    usuario,
    user,
    loginPassword,
}) {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState(initialForm);

    useEffect(() => {
        if (!open) return;

        const loadModalData = async () => {
            if (!user?.email || !loginPassword) {
                toast.error("No se pudieron validar tus credenciales.");
                return;
            }

            const { data, error } = await supabase
                .schema("usuarios")
                .rpc("listar_roles_autorizados", {
                    p_email: user.email,
                    p_password: loginPassword,
                });

            if (error) {
                console.error("Error al traer roles:", error);
                toast.error("No se pudieron cargar los roles autorizados");
                return;
            }

            setRoles(data ?? []);
        };

        loadModalData();

        if (usuario) {
            setForm({
                nombre: usuario.nombre || "",
                apellido: usuario.apellido || "",
                dni: String(usuario.dni ?? ""),
                email: usuario.email || "",
                rolId: String(usuario.id_rol ?? ""),
                estado: usuario.estado || "A",
            });
        } else {
            setForm({ ...initialForm });
        }
    }, [open, usuario]);

    const resetForm = () => {
        setForm({ ...initialForm });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!user?.email || !loginPassword) {
            toast.error("No se pudieron validar tus credenciales.");
            return;
        }

        setLoading(true);

        try {
            const datos = {
                p_email_actor: user.email,
                p_password_actor: loginPassword,
                p_nombre: form.nombre.trim(),
                p_apellido: form.apellido.trim(),
                p_dni: form.dni.trim(),
                p_email: form.email.trim(),
                p_id_rol: Number(form.rolId),
                p_estado: form.estado,
            };

            const { data, error } = usuario
                ? await supabase
                    .schema("usuarios")
                    .rpc("actualizar_usuario_autorizado", {
                        ...datos,
                        p_id_usuario: usuario.id_usuario,
                    })
                : await supabase
                    .schema("usuarios")
                    .rpc("crear_usuario_autorizado", datos);

            if (error) {
                console.error("Error al guardar usuario:", error);
                toast.error(
                    error.message || "No se pudo guardar el usuario"
                );
                return;
            }

            if (data === false || data == null) {
                toast.error("No se pudo confirmar la operación.");
                return;
            }

            toast.success(
                usuario
                    ? "Usuario actualizado correctamente"
                    : "Usuario creado correctamente"
            );

            await onCreate?.();
            resetForm();
            onOpenChange(false);
        } catch (error) {
            console.error("Error inesperado al guardar usuario:", error);
            toast.error("Ocurrió un error al guardar el usuario");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!loading) {
                    onOpenChange(nextOpen);
                }
            }}
        >
            <DialogContent className="max-w-125 border border-[#e1e8ea] bg-white p-0 shadow-card">
                <DialogHeader className="border-b border-slate-soft bg-white px-6 py-5">
                    <DialogTitle className="font-barlow text-[25px] font-normal text-ink">
                        {usuario ? "Editar usuario" : "Nuevo usuario"}
                    </DialogTitle>

                    <DialogDescription className="text-[12px] text-muted-ink">
                        {usuario
                            ? "Modificá los datos de la cuenta seleccionada."
                            : "Asigná un nuevo usuario/rol al sistema."}
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
                                        setForm((prev) => ({
                                            ...prev,
                                            nombre: e.target.value,
                                        }))
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
                                        setForm((prev) => ({
                                            ...prev,
                                            apellido: e.target.value,
                                        }))
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
                                        setForm((prev) => ({
                                            ...prev,
                                            dni: e.target.value,
                                        }))
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
                                        setForm((prev) => ({
                                            ...prev,
                                            email: e.target.value,
                                        }))
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
                                    setForm((prev) => ({
                                        ...prev,
                                        rolId: value,
                                    }))
                                }
                                required
                            >
                                <SelectTrigger className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                    <SelectValue placeholder="Seleccionar rol" />
                                </SelectTrigger>

                                <SelectContent>
                                    {roles.map((rol) => (
                                        <SelectItem
                                            key={rol.id_rol}
                                            value={String(rol.id_rol)}
                                            className="bg-white text-[11px]"
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
                                    setForm((prev) => ({
                                        ...prev,
                                        estado: value,
                                    }))
                                }
                            >
                                <SelectTrigger className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft">
                                    <SelectValue placeholder="Seleccionar estado" />
                                </SelectTrigger>

                                <SelectContent>
                                    {estados.map((estado) => (
                                        <SelectItem
                                            key={estado.id}
                                            value={estado.id}
                                            className="bg-white text-[11px]"
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
                            disabled={loading}
                            onClick={() => onOpenChange(false)}
                            className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft hover:bg-slate-soft"
                        >
                            Cancelar
                        </Button>

                        <Button
                            type="submit"
                            disabled={
                                loading ||
                                !form.nombre.trim() ||
                                !form.apellido.trim() ||
                                !form.dni.trim() ||
                                !form.email.trim() ||
                                !form.rolId
                            }
                            className="h-9 bg-green text-[11px] text-white hover:bg-[#328160]"
                        >
                            {loading
                                ? "Guardando..."
                                : usuario
                                    ? "Guardar cambios"
                                    : "Crear usuario"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
