import { useState, useEffect, useMemo } from "react";
import { KeyRound, Search, UserCheck } from "lucide-react";

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
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const EMAIL_DOMAIN = "@brotherplast.com";

const estados = [
    { id: "A", name: "Activo" },
    { id: "I", name: "Inactivo" },
    { id: "E", name: "Eliminar" },
];

const initialForm = {
    nombre: "",
    apellido: "",
    dni: "",
    email: "",
    rolId: "",
    estado: "A",
};

const stripDefaultDomain = (email = "") => {
    const trimmed = String(email ?? "").trim();
    if (!trimmed) return "";
    if (trimmed.toLowerCase().endsWith(EMAIL_DOMAIN)) {
        return trimmed.slice(0, trimmed.length - EMAIL_DOMAIN.length);
    }
    return trimmed;
};

const buildFinalEmail = (rawInput = "") => {
    const trimmed = rawInput.trim().toLowerCase();
    if (!trimmed) return "";
    if (trimmed.includes("@")) return trimmed;
    return `${trimmed}${EMAIL_DOMAIN}`;
};

export default function CreateUsuarioModal({
    open,
    onOpenChange,
    onCreate,
    usuario,
    existingUsers = [],
}) {
    const { token, user: currentUser } = useAuth();
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [resettingPassword, setResettingPassword] = useState(false);
    const [form, setForm] = useState(initialForm);
    const [creado, setCreado] = useState(null);

    // Buscador RRHH
    const [rrhhQuery, setRrhhQuery] = useState("");
    const [rrhhResults, setRrhhResults] = useState([]);
    const [rrhhLoading, setRrhhLoading] = useState(false);
    const [selectedLegajo, setSelectedLegajo] = useState(null);

    const isActorAdmin = Number(currentUser?.id_rol) === 1;
    const isTargetAdmin = Number(usuario?.id_rol) === 1;
    const isReadOnlyTarget = Boolean(usuario && isTargetAdmin && !isActorAdmin);

    useEffect(() => {
        if (!open) return;

        setCreado(null);
        setRrhhQuery("");
        setRrhhResults([]);
        setSelectedLegajo(null);

        if (usuario) {
            setForm({
                nombre: usuario.nombre || "",
                apellido: usuario.apellido || "",
                dni: String(usuario.dni ?? ""),
                email: stripDefaultDomain(usuario.email),
                rolId: String(usuario.id_rol ?? ""),
                estado: usuario.estado || "A",
            });
        } else {
            setForm({ ...initialForm });
        }

        const loadModalData = async () => {
            if (!token) {
                toast.error("No se pudieron validar tus credenciales.");
                return;
            }

            const { data, error } = await supabase
                .schema("usuarios")
                .rpc("listar_roles_autorizados", {
                    p_token: token,
                });

            if (error) {
                console.error("Error al traer roles:", error);
                toast.error("No se pudieron cargar los roles autorizados");
                return;
            }

            // Defensa adicional en cliente: solo id_rol 1 puede ver/asignar id_rol 1
            const disponibles = (data ?? []).filter(
                (r) => isActorAdmin || Number(r.id_rol) !== 1
            );

            setRoles(disponibles);
        };

        loadModalData();
    }, [open, usuario, token, isActorAdmin]);

    // Búsqueda en administracion.recursos_humanos por nombre, apellido o DNI
    useEffect(() => {
        if (!open || !token) return;

        const q = rrhhQuery.trim();
        if (q.length < 2) {
            setRrhhResults([]);
            setRrhhLoading(false);
            return;
        }

        let cancelled = false;
        setRrhhLoading(true);

        const timer = setTimeout(async () => {
            const { data, error } = await supabase
                .schema("usuarios")
                .rpc("buscar_personas_rrhh", {
                    p_token: token,
                    p_busqueda: q,
                });

            if (cancelled) return;
            setRrhhLoading(false);

            if (error) {
                console.error("Error al buscar en RRHH:", error);
                setRrhhResults([]);
                return;
            }

            setRrhhResults(data ?? []);
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [rrhhQuery, open, token]);

    const handleSelectPersona = (persona) => {
        const dniClean = String(persona.dni ?? "").replace(/\D/g, "");

        setSelectedLegajo(persona.legajo);
        setRrhhQuery("");
        setRrhhResults([]);

        setForm((prev) => ({
            ...prev,
            nombre: persona.nombre?.trim() || prev.nombre,
            apellido: persona.apellido?.trim() || prev.apellido,
            dni: dniClean || prev.dni,
        }));
    };

    const resolvedEmail = useMemo(
        () => buildFinalEmail(form.email),
        [form.email]
    );

    // Validación en vivo de email duplicado
    const emailConflictUser = useMemo(() => {
        if (!resolvedEmail) return null;

        return (
            existingUsers.find(
                (u) =>
                    u.email?.trim().toLowerCase() === resolvedEmail &&
                    u.id_usuario !== usuario?.id_usuario
            ) ?? null
        );
    }, [resolvedEmail, existingUsers, usuario]);

    const dniConflictUser = useMemo(() => {
        const cleanDni = form.dni.replace(/\D/g, "");
        if (!cleanDni) return null;

        return (
            existingUsers.find(
                (u) =>
                    String(u.dni ?? "").replace(/\D/g, "") === cleanDni &&
                    u.id_usuario !== usuario?.id_usuario
            ) ?? null
        );
    }, [form.dni, existingUsers, usuario]);

    const isEmailComplete = Boolean(resolvedEmail);

    const cleanDni = form.dni.replace(/\D/g, "");
    const previewLogin = cleanDni ? `BP${cleanDni}` : "BP + DNI";

    const handleBlanquearClave = async () => {
        if (!usuario || !token) return;

        setResettingPassword(true);
        try {
            const { data, error } = await supabase
                .schema("usuarios")
                .rpc("blanquear_clave_usuario", {
                    p_token: token,
                    p_id_usuario: usuario.id_usuario,
                });

            if (error) {
                console.error("Error al blanquear clave:", error);
                toast.error(error.message || "No se pudo blanquear la clave");
                return;
            }

            const nuevaClave = data || `BP${cleanDni}`;
            toast.success(
                `Clave blanqueada. Nueva clave inicial: ${nuevaClave}`
            );
            await onCreate?.();
        } catch (err) {
            console.error("Error inesperado al blanquear clave:", err);
            toast.error("Ocurrió un error al blanquear la clave");
        } finally {
            setResettingPassword(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!token) {
            toast.error("No se pudieron validar tus credenciales.");
            return;
        }

        if (emailConflictUser) {
            toast.error("Ese email ya está asignado a otro usuario.");
            return;
        }

        if (dniConflictUser) {
            toast.error("Ese DNI ya está asignado a otro usuario.");
            return;
        }

        if (!isActorAdmin && Number(form.rolId) === 1) {
            toast.error(
                "Solo un Administrador puede asignar el rol Administrador."
            );
            return;
        }

        setLoading(true);

        try {
            const datos = {
                p_token: token,
                p_nombre: form.nombre.trim(),
                p_apellido: form.apellido.trim(),
                p_dni: cleanDni,
                p_email: resolvedEmail,
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

            if (usuario) {
                toast.success("Usuario actualizado correctamente");
                await onCreate?.();
                onOpenChange(false);
            } else {
                const loginCreado =
                    typeof data === "string" ? data : `BP${cleanDni}`;
                toast.success("Usuario creado correctamente");
                setCreado({
                    login: loginCreado,
                    nombre: `${form.nombre.trim()} ${form.apellido.trim()}`,
                });
            }
        } catch (error) {
            console.error("Error inesperado al guardar usuario:", error);
            toast.error("Ocurrió un error al guardar el usuario");
        } finally {
            setLoading(false);
        }
    };

    const handleFinishCreate = async () => {
        setCreado(null);
        await onCreate?.();
        onOpenChange(false);
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!loading && !resettingPassword) {
                    if (!nextOpen && creado) {
                        handleFinishCreate();
                        return;
                    }
                    onOpenChange(nextOpen);
                }
            }}
        >
            <DialogContent className="max-w-125 border border-[#e1e8ea] bg-white p-0 shadow-card">
                <DialogHeader className="border-b border-slate-soft bg-white px-6 py-5">
                    <DialogTitle className="font-barlow text-[25px] font-normal text-ink">
                        {creado
                            ? "Usuario creado"
                            : usuario
                                ? "Editar usuario"
                                : "Nuevo usuario"}
                    </DialogTitle>

                    <DialogDescription className="text-[12px] text-muted-ink">
                        {creado
                            ? "Compartí estas credenciales iniciales con la persona."
                            : usuario
                                ? "Modificá los datos de la cuenta seleccionada."
                                : "Buscá al empleado en RRHH o completá sus datos."}
                    </DialogDescription>
                </DialogHeader>

                {creado ? (
                    <>
                        <div className="space-y-4 bg-white px-6 py-5">
                            <p className="text-[12px] text-ink-soft">
                                <strong>{creado.nombre}</strong> ya puede ingresar al sistema.
                                En su primer acceso deberá cambiar esta clave inicial por una propia.
                            </p>

                            <div className="rounded-md border border-[#e1e8ea] bg-slate-soft px-4 py-3">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Usuario
                                </div>
                                <div className="font-barlow text-[18px] text-ink">
                                    {creado.login}
                                </div>

                                <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Contraseña inicial
                                </div>
                                <div className="font-barlow text-[18px] text-ink">
                                    {creado.login}
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="border-t border-slate-soft bg-white px-6 py-4">
                            <Button
                                type="button"
                                onClick={handleFinishCreate}
                                className="h-9 bg-green text-[11px] text-white hover:bg-[#328160]"
                            >
                                Listo
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="max-h-[72vh] space-y-4 overflow-y-auto bg-white px-6 py-5">
                            {isReadOnlyTarget && (
                                <p className="rounded-md border border-[#f6e2bc] bg-[#fff7e9] px-3 py-2 text-[11px] text-[#8a5812]">
                                    Esta cuenta tiene rol Administrador. Solo otro Administrador puede modificarla.
                                </p>
                            )}

                            {/* Buscador de personas en administracion.recursos_humanos */}
                            <div className="space-y-1.5 rounded-md border border-[#e1e8ea] bg-[#f8fafb] p-3">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                    Buscar en Recursos Humanos (nombre, apellido o DNI)
                                </Label>

                                <div className="relative">
                                    <Search
                                        size={14}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#82979e]"
                                    />
                                    <Input
                                        type="search"
                                        placeholder="Ej: Pérez, Juan o 38636078..."
                                        value={rrhhQuery}
                                        disabled={isReadOnlyTarget}
                                        onChange={(e) => setRrhhQuery(e.target.value)}
                                        className="h-9 border-[#dfe7e9] bg-white pl-8 text-[11px] text-ink-soft"
                                    />
                                </div>

                                {selectedLegajo && (
                                    <div className="flex items-center gap-1.5 pt-1 text-[11px] text-[#328160]">
                                        <UserCheck size={13} />
                                        <span>
                                            Datos cargados desde legajo <strong>{selectedLegajo}</strong>
                                        </span>
                                    </div>
                                )}

                                {rrhhLoading && (
                                    <p className="pt-1 text-[11px] text-muted-ink">
                                        Buscando en Recursos Humanos...
                                    </p>
                                )}

                                {!rrhhLoading &&
                                    rrhhQuery.trim().length >= 2 &&
                                    rrhhResults.length === 0 && (
                                        <p className="pt-1 text-[11px] text-muted-ink">
                                            No se encontraron personas en RRHH con ese criterio.
                                        </p>
                                    )}

                                {rrhhResults.length > 0 && (
                                    <div className="mt-1.5 max-h-40 divide-y divide-[#e9eff1] overflow-y-auto rounded-md border border-[#dfe7e9] bg-white">
                                        {rrhhResults.map((p) => (
                                            <button
                                                key={p.legajo}
                                                type="button"
                                                onClick={() => handleSelectPersona(p)}
                                                className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-[11px] hover:bg-[#f1f6f8]"
                                            >
                                                <div>
                                                    <div className="font-semibold text-[#214451]">
                                                        {p.apellido}, {p.nombre}
                                                    </div>
                                                    <div className="text-[10px] text-[#7c9097]">
                                                        DNI {p.dni} · Legajo {p.legajo}
                                                    </div>
                                                </div>

                                                {p.ya_tiene_usuario && (
                                                    <span className="rounded bg-[#fff2d8] px-1.5 py-0.5 text-[9px] font-semibold text-[#a76e1a]">
                                                        Ya tiene usuario
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                        Nombre
                                    </Label>

                                    <Input
                                        placeholder="Nombre"
                                        value={form.nombre}
                                        disabled={isReadOnlyTarget}
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
                                        disabled={isReadOnlyTarget}
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
                                        inputMode="numeric"
                                        value={form.dni}
                                        disabled={isReadOnlyTarget}
                                        onChange={(e) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                dni: e.target.value.replace(/\D/g, ""),
                                            }))
                                        }
                                        className="h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft"
                                        required
                                    />

                                    {dniConflictUser ? (
                                        <p className="text-[10px] font-medium text-[#ba584d]">
                                            DNI ya asignado a {dniConflictUser.nombre}{" "}
                                            {dniConflictUser.apellido}.
                                        </p>
                                    ) : (
                                        <p className="text-[10px] text-[#7c9097]">
                                            Usuario y clave inicial: <strong>{previewLogin}</strong>
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                        Email corporativo
                                    </Label>

                                    <Input
                                        type="text"
                                        placeholder="nombre.apellido"
                                        value={form.email}
                                        disabled={isReadOnlyTarget}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setForm((prev) => ({
                                                ...prev,
                                                email: val,
                                            }));
                                        }}
                                        className={`h-9 bg-white text-[11px] text-ink-soft ${
                                            emailConflictUser
                                                ? "border-[#ba584d] focus-visible:ring-[#ba584d]"
                                                : "border-[#dfe7e9]"
                                        }`}
                                        required
                                    />

                                    {emailConflictUser ? (
                                        <p className="text-[10px] font-medium text-[#ba584d]">
                                            Este mail ({resolvedEmail}) ya está asignado a{" "}
                                            {emailConflictUser.nombre} {emailConflictUser.apellido}.
                                        </p>
                                    ) : (
                                        <p className="text-[10px] text-[#7c9097]">
                                            Por defecto se agrega <strong>{EMAIL_DOMAIN}</strong>
                                            {resolvedEmail ? ` (${resolvedEmail})` : ""}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                                        Rol
                                    </Label>

                                    <Select
                                        value={form.rolId}
                                        disabled={isReadOnlyTarget}
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
                                        disabled={isReadOnlyTarget}
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

                            {/* Blanqueo de clave en edición */}
                            {usuario && !isReadOnlyTarget && (
                                <div className="flex items-center justify-between gap-3 rounded-md border border-[#e1e8ea] bg-[#f8fafb] px-3.5 py-2.5">
                                    <div>
                                        <div className="text-[11px] font-semibold text-[#214451]">
                                            Blanquear clave de acceso
                                        </div>
                                        <div className="text-[10px] text-[#7c9097]">
                                            Restablece la clave a <strong>{previewLogin}</strong> y pedirá cambiarla al ingresar.
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={resettingPassword || loading || !cleanDni}
                                        onClick={handleBlanquearClave}
                                        className="h-8 shrink-0 border-[#dce5e8] bg-white text-[11px] text-[#214451] hover:bg-slate-soft"
                                    >
                                        <KeyRound size={13} className="mr-1.5" />
                                        {resettingPassword ? "Blanqueando..." : "Blanquear clave"}
                                    </Button>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="border-t border-slate-soft bg-white px-6 py-4">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={loading || resettingPassword}
                                onClick={() => onOpenChange(false)}
                                className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft hover:bg-slate-soft"
                            >
                                Cancelar
                            </Button>

                            <Button
                                type="submit"
                                disabled={
                                    loading ||
                                    resettingPassword ||
                                    isReadOnlyTarget ||
                                    !form.nombre.trim() ||
                                    !form.apellido.trim() ||
                                    !cleanDni ||
                                    !isEmailComplete ||
                                    Boolean(emailConflictUser) ||
                                    Boolean(dniConflictUser) ||
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
                )}
            </DialogContent>
        </Dialog>
    );
}
