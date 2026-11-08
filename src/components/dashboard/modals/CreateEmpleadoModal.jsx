
import { useState, useEffect, useMemo } from "react";
import { Calendar, Trash2, X } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const ESTADOS_CIVILES = [
    "Soltero/a",
    "Casado/a",
    "Unión convivencial",
    "Divorciado/a",
    "Viudo/a",
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const initialForm = {
    nombre: "",
    apellido: "",
    dni: "",
    cuil: "",
    telefono: "",
    direccion: "",
    mail_personal: "",
    estado_civil: "",
    fecha_nacimiento: "",
    fecha_ingreso: todayIso(),
    fecha_egreso: "",
    rolId: "",
    observaciones: "",
    estado: "A",
};

export default function CreateEmpleadoModal({
    open,
    onOpenChange,
    onSaved,
    empleado,
    existingPersonal = [],
}) {
    const { token } = useAuth();

    const [roles, setRoles] = useState([]);
    const [form, setForm] = useState(initialForm);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    useEffect(() => {
        if (!open) return;

        // Cargar datos del empleado cuando se edita
        if (empleado) {
            setForm({
                nombre: empleado.nombre || "",
                apellido: empleado.apellido || "",
                dni: String(empleado.dni ?? ""),
                cuil: String(empleado.cuil ?? ""),
                telefono: empleado.telefono || "",
                direccion: empleado.direccion || "",
                mail_personal: empleado.mail_personal || "",
                estado_civil: empleado.estado_civil || "",
                fecha_nacimiento: empleado.fecha_nacimiento
                    ? String(empleado.fecha_nacimiento).slice(0, 10)
                    : "",
                fecha_ingreso: empleado.fecha_ingreso
                    ? String(empleado.fecha_ingreso).slice(0, 10)
                    : todayIso(),
                fecha_egreso: empleado.fecha_egreso
                    ? String(empleado.fecha_egreso).slice(0, 10)
                    : "",
                rolId: empleado.id_rol
                    ? String(empleado.id_rol)
                    : "",
                observaciones: empleado.observaciones || "",
                estado: empleado.estado || "A",
            });
        } else {
            setForm({
                ...initialForm,
                fecha_ingreso: todayIso(),
            });
        }

        setConfirmDeleteOpen(false);

        const loadRoles = async () => {
            if (!token) return;

            const { data, error } = await supabase
                .schema("usuarios")
                .rpc("listar_roles_rrhh", {
                    p_token: token,
                });

            if (error) {
                console.error("Error al traer roles de RRHH:", error);
                return;
            }

            setRoles(
                (data ?? []).filter(
                    (r) => Number(r.id_rol) !== 1
                )
            );
        };

        loadRoles();
    }, [open, empleado, token]);

    const cleanDni = form.dni
        .replace(/\D/g, "")
        .slice(0, 8);

    const cleanCuil = form.cuil
        .replace(/\D/g, "")
        .slice(0, 11);

    // Validar DNI duplicado
    const dniConflict = useMemo(() => {
        if (!cleanDni) return null;

        return (
            existingPersonal.find(
                (p) =>
                    String(p.dni ?? "").replace(/\D/g, "") === cleanDni &&
                    p.legajo !== empleado?.legajo
            ) ?? null
        );
    }, [cleanDni, existingPersonal, empleado]);

    // Validar CUIL duplicado
    const cuilConflict = useMemo(() => {
        if (!cleanCuil) return null;

        return (
            existingPersonal.find(
                (p) =>
                    String(p.cuil ?? "").replace(/\D/g, "") === cleanCuil &&
                    p.legajo !== empleado?.legajo
            ) ?? null
        );
    }, [cleanCuil, existingPersonal, empleado]);

    // Validar que el CUIL contenga el DNI
    const cuilIncludesDni = useMemo(() => {
        if (cleanCuil.length !== 11 || cleanDni.length < 7) {
            return true;
        }

        return cleanCuil.includes(cleanDni);
    }, [cleanCuil, cleanDni]);

    // Validar fechas
    const egresoInvalid = Boolean(
        form.fecha_egreso &&
        form.fecha_ingreso &&
        form.fecha_egreso < form.fecha_ingreso
    );

    const canBeDeleted = Boolean(form.fecha_egreso);

    // Si se quita la fecha de egreso y el estado estaba en E,
    // se revierte automáticamente a Activo.
    useEffect(() => {
        if (!form.fecha_egreso && form.estado === "E") {
            setForm((prev) => ({
                ...prev,
                estado: "A",
            }));
        }
    }, [form.fecha_egreso, form.estado]);

    // Ejecutar la baja lógica del empleado
    const handleDeleteEmpleado = async () => {
        if (!empleado || !token) {
            toast.error("No se pudo identificar al empleado.");
            return;
        }

        if (!form.fecha_egreso && !empleado.fecha_egreso) {
            toast.error(
                "Solo se puede eliminar un empleado si tiene fecha de egreso registrada."
            );
            return;
        }

        setDeleting(true);

        try {
            const { error } = await supabase
                .schema("usuarios")
                .rpc("actualizar_empleado_rrhh", {
                    p_token: token,
                    p_legajo: empleado.legajo,
                    p_nombre: form.nombre.trim(),
                    p_apellido: form.apellido.trim(),
                    p_cuil: cleanCuil,
                    p_dni: cleanDni,
                    p_telefono: form.telefono.trim(),
                    p_direccion: form.direccion.trim(),
                    p_mail_personal: form.mail_personal.trim(),
                    p_estado_civil: form.estado_civil,
                    p_fecha_nacimiento: form.fecha_nacimiento || null,
                    p_fecha_ingreso: form.fecha_ingreso,
                    p_fecha_egreso:
                        form.fecha_egreso || empleado.fecha_egreso || null,
                    p_id_rol: Number(form.rolId),
                    p_observaciones: form.observaciones.trim(),
                    p_estado: "E",
                });

            if (error) {
                console.error("Error al eliminar empleado:", error);
                toast.error(
                    error.message || "No se pudo eliminar el empleado."
                );
                return;
            }

            toast.success(
                `Legajo ${empleado.legajo} marcado como Eliminado`
            );

            setConfirmDeleteOpen(false);

            await onSaved?.();
            onOpenChange(false);
        } catch (err) {
            console.error(
                "Error inesperado al eliminar empleado:",
                err
            );

            toast.error(
                "Ocurrió un error al eliminar el empleado."
            );
        } finally {
            setDeleting(false);
        }
    };

    // Guardar empleado
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!token) return;

        if (cleanDni.length < 7 || cleanDni.length > 8) {
            toast.error(
                "El DNI debe tener entre 7 y 8 dígitos."
            );
            return;
        }

        if (cleanCuil.length !== 11) {
            toast.error(
                "El CUIL debe tener exactamente 11 dígitos numéricos."
            );
            return;
        }

        if (!cuilIncludesDni) {
            toast.error(
                "El CUIL ingresado no coincide con el DNI."
            );
            return;
        }

        if (dniConflict) {
            toast.error(
                "Ese DNI ya pertenece a otro legajo."
            );
            return;
        }

        if (cuilConflict) {
            toast.error(
                "Ese CUIL ya pertenece a otro legajo."
            );
            return;
        }

        if (egresoInvalid) {
            toast.error(
                "La fecha de egreso no puede ser anterior a la fecha de ingreso."
            );
            return;
        }

        if (form.estado === "E" && !form.fecha_egreso) {
            toast.error(
                "Para eliminar al empleado primero debés indicar su fecha de egreso."
            );
            return;
        }

        if (Number(form.rolId) === 1) {
            toast.error(
                "El rol Administrador no puede seleccionarse como puesto en Recursos Humanos."
            );
            return;
        }

        setLoading(true);

        try {
            const payload = {
                p_token: token,
                p_nombre: form.nombre.trim(),
                p_apellido: form.apellido.trim(),
                p_cuil: cleanCuil,
                p_dni: cleanDni,
                p_telefono: form.telefono.trim(),
                p_direccion: form.direccion.trim(),
                p_mail_personal: form.mail_personal.trim(),
                p_estado_civil: form.estado_civil,
                p_fecha_nacimiento: form.fecha_nacimiento || null,
                p_fecha_ingreso: form.fecha_ingreso,
                p_fecha_egreso: form.fecha_egreso || null,
                p_id_rol: Number(form.rolId),
                p_observaciones: form.observaciones.trim(),
                p_estado: form.estado,
            };

            const { data, error } = empleado
                ? await supabase
                    .schema("usuarios")
                    .rpc("actualizar_empleado_rrhh", {
                        ...payload,
                        p_legajo: empleado.legajo,
                    })
                : await supabase
                    .schema("usuarios")
                    .rpc("crear_empleado_rrhh", payload);

            if (error) {
                console.error("Error al guardar empleado:", error);

                toast.error(
                    error.message || "No se pudo guardar el empleado."
                );

                return;
            }

            if (empleado) {
                toast.success(
                    `Legajo ${empleado.legajo} actualizado correctamente`
                );
            } else {
                toast.success(
                    `Empleado registrado con legajo ${data || ""}`.trim()
                );
            }

            await onSaved?.();
            onOpenChange(false);
        } catch (err) {
            console.error(
                "Error inesperado al guardar empleado:",
                err
            );

            toast.error(
                "Ocurrió un error al guardar el empleado."
            );
        } finally {
            setLoading(false);
        }
    };

    const labelCls =
        "text-[10px] font-bold uppercase tracking-widest text-muted-ink";

    const inputCls =
        "h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft";

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={(nextOpen) => {
                    if (!loading && !deleting) {
                        onOpenChange(nextOpen);
                    }
                }}
            >
                <DialogContent className="max-w-165 border border-[#e1e8ea] bg-white p-0 shadow-card">
                    <DialogHeader className="border-b border-slate-soft bg-white px-6 py-5">
                        <DialogTitle className="font-barlow text-[25px] font-normal text-ink">
                            {empleado
                                ? `Editar legajo ${empleado.legajo}`
                                : "Nuevo empleado"}
                        </DialogTitle>

                        <DialogDescription className="text-[12px] text-muted-ink">
                            {empleado
                                ? "Actualizá los datos personales, puesto, fechas o estado del empleado."
                                : "Completá los datos para dar de alta al empleado en el padrón de Recursos Humanos."}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit}>
                        <div className="max-h-[72vh] space-y-4 overflow-y-auto bg-white px-6 py-5">

                            {/* Nombre y Apellido */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label className={labelCls}>
                                        Nombre *
                                    </Label>

                                    <Input
                                        placeholder="Nombre"
                                        value={form.nombre}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                nombre: e.target.value.replace(/[0-9]/g, ""),
                                            }))
                                        }
                                        className={inputCls}
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className={labelCls}>
                                        Apellido *
                                    </Label>

                                    <Input
                                        placeholder="Apellido"
                                        value={form.apellido}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                apellido: e.target.value.replace(/[0-9]/g, ""),
                                            }))
                                        }
                                        className={inputCls}
                                        required
                                    />
                                </div>
                            </div>

                            {/* DNI y CUIL */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label className={labelCls}>
                                        DNI (8 dígitos) *
                                    </Label>

                                    <Input
                                        placeholder="38636078"
                                        inputMode="numeric"
                                        maxLength={8}
                                        value={cleanDni}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                dni: e.target.value
                                                    .replace(/\D/g, "")
                                                    .slice(0, 8),
                                            }))
                                        }
                                        className={inputCls}
                                        required
                                    />

                                    {dniConflict && (
                                        <p className="text-[10px] font-medium text-[#ba584d]">
                                            DNI ya registrado en legajo {dniConflict.legajo} (
                                            {dniConflict.apellido}, {dniConflict.nombre}).
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label className={labelCls}>
                                        CUIL (11 dígitos sin guiones) *
                                    </Label>

                                    <Input
                                        placeholder="20386360783"
                                        inputMode="numeric"
                                        maxLength={11}
                                        value={cleanCuil}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                cuil: e.target.value
                                                    .replace(/\D/g, "")
                                                    .slice(0, 11),
                                            }))
                                        }
                                        className={inputCls}
                                        required
                                    />

                                    {cuilConflict ? (
                                        <p className="text-[10px] font-medium text-[#ba584d]">
                                            CUIL ya registrado en legajo {cuilConflict.legajo}.
                                        </p>
                                    ) : !cuilIncludesDni ? (
                                        <p className="text-[10px] font-medium text-[#ba584d]">
                                            El CUIL no contiene el DNI ingresado.
                                        </p>
                                    ) : null}
                                </div>
                            </div>

                            {/* Fechas */}
                            <div className="grid grid-cols-1 gap-3 rounded-md border border-[#e1e8ea] bg-[#f8fafb] p-3 sm:grid-cols-3">
                                <div className="space-y-1.5">
                                    <Label className={labelCls}>
                                        <span className="inline-flex items-center gap-1">
                                            <Calendar size={11} />
                                            Fecha nacimiento
                                        </span>
                                    </Label>

                                    <input
                                        type="date"
                                        value={form.fecha_nacimiento}
                                        max={form.fecha_ingreso || todayIso()}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                fecha_nacimiento: e.target.value,
                                            }))
                                        }
                                        className="h-8.5 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[11px] text-ink-soft outline-none focus:border-[#214451]"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className={labelCls}>
                                        <span className="inline-flex items-center gap-1">
                                            <Calendar size={11} />
                                            Fecha ingreso *
                                        </span>
                                    </Label>

                                    <input
                                        type="date"
                                        value={form.fecha_ingreso}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                fecha_ingreso: e.target.value,
                                            }))
                                        }
                                        className="h-8.5 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[11px] text-ink-soft outline-none focus:border-[#214451]"
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className={labelCls}>
                                            <span className="inline-flex items-center gap-1">
                                                <Calendar size={11} />
                                                Fecha egreso
                                            </span>
                                        </Label>

                                        {form.fecha_egreso && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setForm((p) => ({
                                                        ...p,
                                                        fecha_egreso: "",
                                                    }))
                                                }
                                                className="inline-flex cursor-pointer items-center gap-0.5 text-[9.5px] text-[#ba584d] hover:underline"
                                                title="Quitar fecha de egreso"
                                            >
                                                <X size={10} />
                                                Quitar
                                            </button>
                                        )}
                                    </div>

                                    <input
                                        type="date"
                                        value={form.fecha_egreso}
                                        min={form.fecha_ingreso || undefined}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                fecha_egreso: e.target.value,
                                            }))
                                        }
                                        className="h-8.5 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[11px] text-ink-soft outline-none focus:border-[#214451]"
                                    />

                                    {egresoInvalid && (
                                        <p className="text-[10px] font-medium text-[#ba584d]">
                                            No puede ser anterior al ingreso.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Puesto, Estado civil y Estado */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="space-y-1.5">
                                    <Label className={labelCls}>
                                        Rol / Puesto *
                                    </Label>

                                    <Select
                                        value={form.rolId}
                                        onValueChange={(value) =>
                                            setForm((p) => ({
                                                ...p,
                                                rolId: value,
                                            }))
                                        }
                                        required
                                    >
                                        <SelectTrigger className={inputCls}>
                                            <SelectValue placeholder="Seleccionar rol" />
                                        </SelectTrigger>

                                        <SelectContent>
                                            {roles.map((r) => (
                                                <SelectItem
                                                    key={r.id_rol}
                                                    value={String(r.id_rol)}
                                                    className="bg-white text-[11px]"
                                                >
                                                    {r.nombre}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className={labelCls}>
                                        Estado civil
                                    </Label>

                                    <Select
                                        value={form.estado_civil || "none"}
                                        onValueChange={(value) =>
                                            setForm((p) => ({
                                                ...p,
                                                estado_civil:
                                                    value === "none" ? "" : value,
                                            }))
                                        }
                                    >
                                        <SelectTrigger className={inputCls}>
                                            <SelectValue placeholder="Sin especificar" />
                                        </SelectTrigger>

                                        <SelectContent>
                                            <SelectItem
                                                value="none"
                                                className="bg-white text-[11px]"
                                            >
                                                Sin especificar
                                            </SelectItem>

                                            {ESTADOS_CIVILES.map((ec) => (
                                                <SelectItem
                                                    key={ec}
                                                    value={ec}
                                                    className="bg-white text-[11px]"
                                                >
                                                    {ec}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className={labelCls}>
                                        Estado *
                                    </Label>

                                    <Select
                                        value={form.estado}
                                        onValueChange={(value) =>
                                            setForm((p) => ({
                                                ...p,
                                                estado: value,
                                            }))
                                        }
                                    >
                                        <SelectTrigger className={inputCls}>
                                            <SelectValue placeholder="Seleccionar estado" />
                                        </SelectTrigger>

                                        <SelectContent>
                                            <SelectItem
                                                value="A"
                                                className="bg-white text-[11px]"
                                            >
                                                Activo
                                            </SelectItem>

                                            <SelectItem
                                                value="I"
                                                className="bg-white text-[11px]"
                                            >
                                                Inactivo
                                            </SelectItem>

                                            <SelectItem
                                                value="E"
                                                disabled={!canBeDeleted}
                                                className="bg-white text-[11px]"
                                            >
                                                Eliminar{" "}
                                                {!canBeDeleted
                                                    ? "(requiere fecha de egreso)"
                                                    : ""}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Contacto */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label className={labelCls}>
                                        Teléfono
                                    </Label>

                                    <Input
                                        placeholder="Ej: 11 4555-1234"
                                        value={form.telefono}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                telefono: e.target.value,
                                            }))
                                        }
                                        className={inputCls}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className={labelCls}>
                                        Mail personal
                                    </Label>

                                    <Input
                                        type="email"
                                        placeholder="nombre@correo.com"
                                        value={form.mail_personal}
                                        onChange={(e) => {
                                            const value = e.target.value
                                                .replace(/\s/g, "")
                                                .replace(/[0-9]/g, (digit, offset, str) => {
                                                    return str.indexOf("@") !== -1 &&
                                                        offset > str.indexOf("@")
                                                        ? ""
                                                        : digit;
                                                });

                                            setForm((p) => ({
                                                ...p,
                                                mail_personal: value,
                                            }));
                                        }}
                                        className={inputCls}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className={labelCls}>
                                    Dirección
                                </Label>

                                <Input
                                    placeholder="Calle, número, localidad"
                                    value={form.direccion}
                                    onChange={(e) =>
                                        setForm((p) => ({
                                            ...p,
                                            direccion: e.target.value,
                                        }))
                                    }
                                    className={inputCls}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className={labelCls}>
                                    Observaciones
                                </Label>

                                <Textarea
                                    placeholder="Notas adicionales del legajo..."
                                    rows={2}
                                    value={form.observaciones}
                                    onChange={(e) =>
                                        setForm((p) => ({
                                            ...p,
                                            observaciones: e.target.value,
                                        }))
                                    }
                                    className="border-[#dfe7e9] bg-white text-[11px] text-ink-soft"
                                />
                            </div>

                            {/* Bloque de eliminación rápida */}
                            {empleado && (
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#e1e8ea] bg-[#f8fafb] px-3.5 py-2.5">
                                    <div>
                                        <div className="text-[11px] font-semibold text-[#214451]">
                                            Eliminar legajo del empleado
                                        </div>

                                        <div className="text-[10px] text-[#7c9097]">
                                            {canBeDeleted
                                                ? "El empleado tiene fecha de egreso y puede ser marcado como Eliminado."
                                                : "Para eliminar a este empleado primero debés seleccionar una Fecha de egreso."}
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={
                                            !canBeDeleted ||
                                            deleting ||
                                            loading ||
                                            empleado.estado === "E"
                                        }
                                        onClick={() =>
                                            setConfirmDeleteOpen(true)
                                        }
                                        className="h-8 border-[#f1cfcb] bg-[#fbe9e7] text-[11px] text-[#ba584d] hover:bg-[#f5d5d1] disabled:opacity-50"
                                    >
                                        <Trash2 size={13} className="mr-1.5" />

                                        {deleting
                                            ? "Eliminando..."
                                            : empleado.estado === "E"
                                                ? "Ya eliminado"
                                                : "Eliminar empleado"}
                                    </Button>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="border-t border-slate-soft bg-white px-6 py-4">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={loading || deleting}
                                onClick={() => onOpenChange(false)}
                                className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft hover:bg-slate-soft"
                            >
                                Cancelar
                            </Button>

                            <Button
                                type="submit"
                                disabled={
                                    loading ||
                                    deleting ||
                                    !form.nombre.trim() ||
                                    !form.apellido.trim() ||
                                    cleanDni.length < 7 ||
                                    cleanCuil.length !== 11 ||
                                    !cuilIncludesDni ||
                                    Boolean(dniConflict) ||
                                    Boolean(cuilConflict) ||
                                    !form.fecha_ingreso ||
                                    egresoInvalid ||
                                    !form.rolId
                                }
                                className="h-9 bg-green text-[11px] text-white hover:bg-[#328160]"
                            >
                                {loading
                                    ? "Guardando..."
                                    : empleado
                                        ? "Guardar cambios"
                                        : "Registrar empleado"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal de confirmación de eliminación */}
            <AlertDialog
                open={confirmDeleteOpen}
                onOpenChange={(nextOpen) => {
                    if (!deleting) {
                        setConfirmDeleteOpen(nextOpen);
                    }
                }}
            >
                <AlertDialogContent className="max-w-[400px] border border-[#e1e8ea] bg-white">
                    <AlertDialogHeader>
                        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#fbe9e7]">
                            <Trash2
                                size={19}
                                className="text-[#ba584d]"
                            />
                        </div>

                        <AlertDialogTitle className="font-barlow text-[21px] font-normal text-ink">
                            ¿Eliminar empleado?
                        </AlertDialogTitle>

                        <AlertDialogDescription className="text-[12px] leading-relaxed text-muted-ink">
                            Estás por marcar como eliminado al siguiente empleado:

                            <span className="mt-3 block font-semibold text-[#214451]">
                                {empleado?.apellido}, {empleado?.nombre}
                            </span>

                            <span className="block text-[11px] text-[#7c9097]">
                                Legajo: {empleado?.legajo}
                            </span>

                            <span className="mt-3 block">
                                Esta acción cambiará su estado a{" "}
                                <strong>Eliminado</strong>.
                                El registro no se borrará físicamente del sistema.
                            </span>

                            <span className="mt-2 block">
                                ¿Estás seguro de que querés continuar?
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter className="mt-2 gap-2">
                        <AlertDialogCancel
                            disabled={deleting}
                            className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft hover:bg-slate-soft"
                        >
                            Cancelar
                        </AlertDialogCancel>

                        <AlertDialogAction
                            disabled={deleting}
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteEmpleado();
                            }}
                            className="h-9 bg-[#ba584d] text-[11px] text-white hover:bg-[#a7463c]"
                        >
                            <Trash2 size={13} className="mr-1.5" />

                            {deleting
                                ? "Eliminando..."
                                : "Confirmar eliminación"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
