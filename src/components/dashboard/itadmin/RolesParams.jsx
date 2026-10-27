import { useState, useEffect, useCallback } from "react";
import { Lock, Plus, Search } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import ActionButton from "@/components/common/ActionButton";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

const ESTADO_META = {
    A: { label: "Activo", tone: "green" },
    I: { label: "Inactivo", tone: "slate" },
    E: { label: "Eliminado", tone: "red" },
};

const ESTADOS_OPTIONS = [
    { id: "A", name: "Activo" },
    { id: "I", name: "Inactivo" },
    { id: "E", name: "Eliminar" },
];

const initialForm = {
    nombre: "",
    descripcion: "",
    estado: "A",
};

export default function RolesParams({ fakeAction }) {
    const { token } = useAuth();
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState(null);
    const [form, setForm] = useState(initialForm);
    const [saving, setSaving] = useState(false);

    const fetchRoles = useCallback(async () => {
        if (!token) {
            setRoles([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .schema("usuarios")
                .rpc("listar_roles_gestion", {
                    p_token: token,
                });

            if (error) {
                console.error("Error al traer roles:", error);
                toast.error("No se pudieron cargar los roles");
                setRoles([]);
                return;
            }

            setRoles(data ?? []);
        } catch (err) {
            console.error("Error inesperado al traer roles:", err);
            toast.error("Ocurrió un error al cargar los roles");
            setRoles([]);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchRoles();
    }, [fetchRoles]);

    const handleNewRole = () => {
        setSelectedRole(null);
        setForm({ ...initialForm });
        setModalOpen(true);
    };

    const handleEditRole = (rol) => {
        if (Number(rol.id_rol) === 1) {
            toast.info("El rol Administrador (ID 1) está protegido y no puede modificarse.");
            return;
        }
        setSelectedRole(rol);
        setForm({
            nombre: rol.nombre || "",
            descripcion: rol.descripcion || "",
            estado: rol.estado || "A",
        });
        setModalOpen(true);
    };

    const handleQuickStateChange = async (rol, nextEstado) => {
        if (Number(rol.id_rol) === 1) {
            toast.error("El rol Administrador (ID 1) no puede ser modificado ni eliminado.");
            return;
        }

        try {
            const { error } = await supabase
                .schema("usuarios")
                .rpc("actualizar_rol_autorizado", {
                    p_token: token,
                    p_id_rol: rol.id_rol,
                    p_nombre: rol.nombre,
                    p_descripcion: rol.descripcion || "",
                    p_estado: nextEstado,
                });

            if (error) {
                toast.error(error.message || "No se pudo cambiar el estado del rol");
                return;
            }

            const label = ESTADO_META[nextEstado]?.label ?? nextEstado;
            toast.success(`Rol "${rol.nombre}" marcado como ${label}`);
            await fetchRoles();
        } catch (err) {
            console.error("Error al cambiar estado del rol:", err);
            toast.error("Ocurrió un error al cambiar el estado del rol");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!token) return;

        if (selectedRole && Number(selectedRole.id_rol) === 1) {
            toast.error("El rol Administrador (ID 1) no puede modificarse.");
            return;
        }

        setSaving(true);
        try {
            const { error } = selectedRole
                ? await supabase
                    .schema("usuarios")
                    .rpc("actualizar_rol_autorizado", {
                        p_token: token,
                        p_id_rol: selectedRole.id_rol,
                        p_nombre: form.nombre.trim(),
                        p_descripcion: form.descripcion.trim(),
                        p_estado: form.estado,
                    })
                : await supabase
                    .schema("usuarios")
                    .rpc("crear_rol_autorizado", {
                        p_token: token,
                        p_nombre: form.nombre.trim(),
                        p_descripcion: form.descripcion.trim(),
                        p_estado: form.estado,
                    });

            if (error) {
                console.error("Error al guardar rol:", error);
                toast.error(error.message || "No se pudo guardar el rol");
                return;
            }

            toast.success(
                selectedRole
                    ? "Rol actualizado correctamente"
                    : "Rol creado correctamente"
            );
            if (!selectedRole) {
                fakeAction?.("Rol creado correctamente");
            }

            setModalOpen(false);
            setSelectedRole(null);
            await fetchRoles();
        } catch (err) {
            console.error("Error inesperado al guardar rol:", err);
            toast.error("Ocurrió un error al guardar el rol");
        } finally {
            setSaving(false);
        }
    };

    const filteredRoles = roles.filter((r) => {
        const estadoInfo = ESTADO_META[r.estado] ?? ESTADO_META.I;
        const text = [
            r.id_rol,
            r.nombre,
            r.descripcion,
            r.usu_alta,
            r.usu_mod,
            estadoInfo.label,
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return text.includes(search.toLowerCase().trim());
    });

    const rows = filteredRoles.map((item) => {
        const isProtected = Number(item.id_rol) === 1;
        const estadoInfo = ESTADO_META[item.estado] ?? {
            label: item.estado || "Inactivo",
            tone: "slate",
        };

        const clickableCell = (content) =>
            isProtected ? (
                <div
                    className="flex items-center gap-1.5 text-left"
                    title="El rol ID 1 está protegido y no se puede modificar ni eliminar"
                >
                    {content}
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => handleEditRole(item)}
                    className="block w-full cursor-pointer text-left"
                    title="Hacé clic para editar este rol"
                >
                    {content}
                </button>
            );

        return [
            clickableCell(
                <span className="font-mono text-[11px] font-semibold text-[#145c73]">
                    #{item.id_rol}
                </span>
            ),
            clickableCell(
                <span className="inline-flex items-center gap-1.5 font-medium text-[#214451]">
                    {item.nombre}
                    {isProtected && (
                        <Lock
                            size={12}
                            className="text-[#82979e]"
                            title="Protegido"
                        />
                    )}
                </span>
            ),
            clickableCell(
                <span className="text-[#49636c]">
                    {item.descripcion || "—"}
                </span>
            ),
            clickableCell(
                <span className="text-[11px] text-[#67808a]">
                    {item.cantidad_usuarios ?? 0} usuario(s)
                </span>
            ),
            clickableCell(
                <Badge tone={estadoInfo.tone}>{estadoInfo.label}</Badge>
            ),
            isProtected ? (
                <span className="text-[10px] font-medium text-[#82979e]">
                    Protegido
                </span>
            ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => handleEditRole(item)}
                        className="cursor-pointer rounded border border-[#dce5e8] bg-white px-2 py-1 text-[10px] font-semibold text-[#214451] hover:bg-[#f4f7f8]"
                    >
                        Editar
                    </button>

                    {item.estado !== "A" && (
                        <button
                            type="button"
                            onClick={() => handleQuickStateChange(item, "A")}
                            className="cursor-pointer rounded border border-[#cce8da] bg-[#e7f4ed] px-2 py-1 text-[10px] font-semibold text-[#328160] hover:opacity-90"
                        >
                            Activar
                        </button>
                    )}

                    {item.estado !== "I" && (
                        <button
                            type="button"
                            onClick={() => handleQuickStateChange(item, "I")}
                            className="cursor-pointer rounded border border-[#dce5e8] bg-[#edf1f2] px-2 py-1 text-[10px] font-semibold text-[#6f8087] hover:opacity-90"
                        >
                            Inactivar
                        </button>
                    )}

                    {item.estado !== "E" && (
                        <button
                            type="button"
                            onClick={() => handleQuickStateChange(item, "E")}
                            className="cursor-pointer rounded border border-[#f1cfcb] bg-[#fbe9e7] px-2 py-1 text-[10px] font-semibold text-[#ba584d] hover:opacity-90"
                        >
                            Eliminar
                        </button>
                    )}
                </div>
            ),
        ];
    });

    return (
        <>
            <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
                <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                        <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
                            PARÁMETROS · ROLES
                        </div>

                        <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
                            Roles del sistema
                        </h3>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <div className="relative">
                            <Search
                                size={15}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#82979e]"
                            />

                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar rol..."
                                aria-label="Buscar rol"
                                className="h-9 w-full rounded-md border border-[#e1e8ea] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#214451] sm:w-48"
                            />
                        </div>

                        <ActionButton onClick={handleNewRole}>
                            <Plus size={17} />
                            Nuevo rol
                        </ActionButton>
                    </div>
                </div>

                {loading ? (
                    <p className="py-6 text-center text-[11px] text-muted-ink">
                        Cargando roles...
                    </p>
                ) : filteredRoles.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-ink">
                        {roles.length === 0
                            ? "No hay roles registrados."
                            : "No se encontraron roles con esa búsqueda."}
                    </p>
                ) : (
                    <Table
                        headers={[
                            "ID",
                            "Nombre",
                            "Descripción",
                            "Usuarios",
                            "Estado",
                            "Acciones",
                        ]}
                        rows={rows}
                        renderCell={(cell) => cell}
                    />
                )}
            </div>

            <Dialog
                open={modalOpen}
                onOpenChange={(nextOpen) => {
                    if (!saving) {
                        setModalOpen(nextOpen);
                        if (!nextOpen) setSelectedRole(null);
                    }
                }}
            >
                <DialogContent className="max-w-115 border border-[#e1e8ea] bg-white p-0 shadow-card">
                    <DialogHeader className="border-b border-slate-soft bg-white px-6 py-5">
                        <DialogTitle className="font-barlow text-[25px] font-normal text-ink">
                            {selectedRole
                                ? `Editar rol #${selectedRole.id_rol}`
                                : "Nuevo rol"}
                        </DialogTitle>

                        <DialogDescription className="text-[12px] text-muted-ink">
                            {selectedRole
                                ? "Modificá el nombre, descripción o estado del rol."
                                : "Definí un nuevo rol para asignar a los usuarios del sistema."}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit}>
                        <div className="space-y-4 bg-white px-6 py-5">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Nombre del rol
                                </Label>

                                <Input
                                    placeholder="Ej: Supervisor de Planta"
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
                                    Descripción
                                </Label>

                                <Textarea
                                    placeholder="Alcance y responsabilidades del rol..."
                                    value={form.descripcion}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            descripcion: e.target.value,
                                        }))
                                    }
                                    rows={3}
                                    className="border-[#dfe7e9] bg-white text-[11px] text-ink-soft"
                                />
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
                                        {ESTADOS_OPTIONS.map((est) => (
                                            <SelectItem
                                                key={est.id}
                                                value={est.id}
                                                className="bg-white text-[11px]"
                                            >
                                                {est.name}
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
                                disabled={saving}
                                onClick={() => setModalOpen(false)}
                                className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft hover:bg-slate-soft"
                            >
                                Cancelar
                            </Button>

                            <Button
                                type="submit"
                                disabled={saving || !form.nombre.trim()}
                                className="h-9 bg-green text-[11px] text-white hover:bg-[#328160]"
                            >
                                {saving
                                    ? "Guardando..."
                                    : selectedRole
                                        ? "Guardar cambios"
                                        : "Crear rol"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
