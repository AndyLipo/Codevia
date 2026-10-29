import { useState, useEffect, useMemo, useCallback } from "react";
import {
    Building2,
    Clock,
    FileText,
    History,
    MapPin,
    Phone,
    RotateCcw,
    Trash2,
    UserCheck,
} from "lucide-react";
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
import Badge from "@/components/common/Badge";

import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

const TIPOS_DOCUMENTO = ["DNI", "CUIT", "CUIL", "PAS", "LE", "LC", "OTRO"];

const PROVINCIAS_SUGERIDAS = [
    "Buenos Aires",
    "CABA",
    "Catamarca",
    "Chaco",
    "Chubut",
    "Córdoba",
    "Corrientes",
    "Entre Ríos",
    "Formosa",
    "Jujuy",
    "La Pampa",
    "La Rioja",
    "Mendoza",
    "Misiones",
    "Neuquén",
    "Río Negro",
    "Salta",
    "San Juan",
    "San Luis",
    "Santa Cruz",
    "Santa Fe",
    "Santiago del Estero",
    "Tierra del Fuego",
    "Tucumán",
];

const ACCION_META = {
    ALTA: { label: "Alta", tone: "green" },
    MODIFICACION: { label: "Modificación", tone: "blue" },
    BAJA: { label: "Baja", tone: "red" },
    INACTIVACION: { label: "Inactivación", tone: "amber" },
    REACTIVACION: { label: "Reactivación", tone: "green" },
};

const formatDateTime = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(
        d.getHours()
    )}:${pad(d.getMinutes())}hs`;
};

const formatCuitInput = (value = "") => {
    const digits = String(value ?? "")
        .replace(/\D/g, "")
        .slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10, 11)}`;
};

// Normaliza una fila de tipo_cliente o tipo_categoria_cliente aunque la RPC aún
// tenga la versión anterior en Supabase.
const normalizeOption = (item, maxCodeLen = 3) => {
    if (!item || typeof item !== "object") return null;
    const rawCode = String(item.codigo ?? "").trim();
    const rawName = String(item.nombre ?? item.descripcion ?? "").trim();

    if (rawCode) {
        return {
            codigo: rawCode.slice(0, maxCodeLen),
            nombre: rawName || rawCode,
        };
    }

    // Fallback seguro si codigo vino null por la versión previa de la función SQL:
    // deduce la letra inicial (ej: "Persona Física" -> "F", "Persona Jurídica" -> "J")
    if (rawName) {
        const lower = rawName.toLowerCase();
        let fallbackCode = rawName.slice(0, maxCodeLen).toUpperCase();
        if (maxCodeLen === 1) {
            if (lower.includes("fisica") || lower.includes("física")) {
                fallbackCode = "F";
            } else if (
                lower.includes("juridica") ||
                lower.includes("jurídica")
            ) {
                fallbackCode = "J";
            } else {
                fallbackCode = rawName[0].toUpperCase();
            }
        }
        return {
            codigo: fallbackCode,
            nombre: rawName,
        };
    }

    return null;
};

const initialForm = {
    tipo_cliente: "",
    categoria_cliente: "",
    nombre_razon_social: "",
    tipo_documento: "",
    nro_documento: "",
    cuit: "",
    telefono: "",
    email: "",
    domicilio: "",
    localidad: "",
    provincia: "",
    codigo_postal: "",
    observaciones: "",
    estado: "A",
};

export default function CreateClienteModal({
    open,
    onOpenChange,
    onSaved,
    cliente,
    initialTab = "datos",
    tiposCliente = [],
    categoriasCliente = [],
    existingClientes = [],
}) {
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState("datos");
    const [form, setForm] = useState(initialForm);
    const [loading, setLoading] = useState(false);
    const [changingState, setChangingState] = useState(false);

    const [historial, setHistorial] = useState([]);
    const [loadingHistorial, setLoadingHistorial] = useState(false);

    const safeTiposCliente = useMemo(
        () =>
            (tiposCliente ?? [])
                .map((tc) => normalizeOption(tc, 1))
                .filter(Boolean),
        [tiposCliente]
    );

    const safeCategoriasCliente = useMemo(
        () =>
            (categoriasCliente ?? [])
                .map((cat) => normalizeOption(cat, 3))
                .filter(Boolean),
        [categoriasCliente]
    );

    const loadHistorialCliente = useCallback(
        async (idCliente) => {
            if (!token || !idCliente) {
                setHistorial([]);
                return;
            }
            setLoadingHistorial(true);
            try {
                const { data, error } = await supabase
                    .schema("usuarios")
                    .rpc("listar_historial_clientes", {
                        p_token: token,
                        p_id_cliente: idCliente,
                    });

                if (error) {
                    console.error(
                        "Error al cargar historial del cliente:",
                        error
                    );
                    setHistorial([]);
                    return;
                }
                setHistorial(data ?? []);
            } catch (err) {
                console.error(
                    "Error inesperado en historial del cliente:",
                    err
                );
                setHistorial([]);
            } finally {
                setLoadingHistorial(false);
            }
        },
        [token]
    );

    useEffect(() => {
        if (!open) return;

        setActiveTab(cliente ? initialTab : "datos");

        if (cliente) {
            setForm({
                tipo_cliente: String(cliente.tipo_cliente ?? "").trim(),
                categoria_cliente: String(
                    cliente.categoria_cliente ?? ""
                ).trim(),
                nombre_razon_social: String(
                    cliente.nombre_razon_social ?? ""
                ),
                tipo_documento: String(cliente.tipo_documento ?? "").trim(),
                nro_documento: String(cliente.nro_documento ?? ""),
                cuit: formatCuitInput(cliente.cuit || ""),
                telefono: String(cliente.telefono ?? ""),
                email: String(cliente.email ?? ""),
                domicilio: String(cliente.domicilio ?? ""),
                localidad: String(cliente.localidad ?? ""),
                provincia: String(cliente.provincia ?? ""),
                codigo_postal: String(cliente.codigo_postal ?? ""),
                observaciones: String(cliente.observaciones ?? ""),
                estado: String(cliente.estado ?? "A").trim() || "A",
            });
            loadHistorialCliente(cliente.id_cliente);
        } else {
            setForm({
                ...initialForm,
                tipo_cliente: safeTiposCliente[0]?.codigo ?? "",
            });
            setHistorial([]);
        }
    }, [open, cliente, initialTab, safeTiposCliente, loadHistorialCliente]);

    const cleanCuitDigits = useMemo(
        () => String(form.cuit ?? "").replace(/\D/g, ""),
        [form.cuit]
    );

    const cuitConflict = useMemo(() => {
        if (!cleanCuitDigits) return null;
        return (
            existingClientes.find(
                (c) =>
                    String(c.cuit ?? "").replace(/\D/g, "") ===
                        cleanCuitDigits &&
                    c.id_cliente !== cliente?.id_cliente
            ) ?? null
        );
    }, [cleanCuitDigits, existingClientes, cliente]);

    const docConflict = useMemo(() => {
        const doc = String(form.nro_documento ?? "")
            .trim()
            .toUpperCase();
        if (!doc) return null;
        const tipo = String(form.tipo_documento ?? "")
            .trim()
            .toUpperCase();
        return (
            existingClientes.find(
                (c) =>
                    String(c.nro_documento ?? "")
                        .trim()
                        .toUpperCase() === doc &&
                    String(c.tipo_documento ?? "")
                        .trim()
                        .toUpperCase() === tipo &&
                    c.id_cliente !== cliente?.id_cliente
            ) ?? null
        );
    }, [form.nro_documento, form.tipo_documento, existingClientes, cliente]);

    const cuitLengthInvalid =
        cleanCuitDigits.length > 0 && cleanCuitDigits.length !== 11;

    const tipoClienteVal = String(form.tipo_cliente ?? "").trim();
    const nombreRazonVal = String(form.nombre_razon_social ?? "").trim();

    const handleQuickState = async (nuevoEstado) => {
        if (!cliente || !token) return;

        setChangingState(true);
        try {
            const { error } = await supabase
                .schema("usuarios")
                .rpc("cambiar_estado_cliente", {
                    p_token: token,
                    p_id_cliente: cliente.id_cliente,
                    p_estado: nuevoEstado,
                    p_motivo:
                        nuevoEstado === "E"
                            ? "Baja desde ficha del cliente"
                            : nuevoEstado === "A"
                                ? "Reactivación desde ficha del cliente"
                                : "Cambio de estado desde ficha del cliente",
                });

            if (error) {
                console.error("Error al cambiar estado del cliente:", error);
                toast.error(
                    error.message ||
                        "No se pudo actualizar el estado del cliente"
                );
                return;
            }

            const msg =
                nuevoEstado === "E"
                    ? `Cliente #${cliente.id_cliente} dado de baja (Eliminado)`
                    : nuevoEstado === "I"
                        ? `Cliente #${cliente.id_cliente} marcado como Inactivo`
                        : `Cliente #${cliente.id_cliente} reactivado correctamente`;

            toast.success(msg);
            await onSaved?.();
            onOpenChange(false);
        } catch (err) {
            console.error("Error inesperado al cambiar estado:", err);
            toast.error("Ocurrió un error al cambiar el estado del cliente");
        } finally {
            setChangingState(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!token) return;

        if (!tipoClienteVal) {
            toast.error("Seleccioná el tipo de cliente.");
            return;
        }

        if (!nombreRazonVal) {
            toast.error("El nombre o razón social es obligatorio.");
            return;
        }

        if (cuitLengthInvalid) {
            toast.error("El CUIT debe tener exactamente 11 dígitos numéricos.");
            return;
        }

        if (cuitConflict) {
            toast.error(
                `Ese CUIT ya está registrado en el cliente #${cuitConflict.id_cliente} (${cuitConflict.nombre_razon_social}).`
            );
            return;
        }

        if (docConflict) {
            toast.error(
                `Ese documento ya está registrado en el cliente #${docConflict.id_cliente} (${docConflict.nombre_razon_social}).`
            );
            return;
        }

        setLoading(true);
        try {
            const payload = {
                p_token: token,
                p_tipo_cliente: tipoClienteVal,
                p_nombre_razon_social: nombreRazonVal,
                p_tipo_documento:
                    String(form.tipo_documento ?? "").trim() || null,
                p_nro_documento:
                    String(form.nro_documento ?? "").trim() || null,
                p_cuit: String(form.cuit ?? "").trim() || null,
                p_telefono: String(form.telefono ?? "").trim() || null,
                p_email: String(form.email ?? "").trim() || null,
                p_domicilio: String(form.domicilio ?? "").trim() || null,
                p_localidad: String(form.localidad ?? "").trim() || null,
                p_provincia: String(form.provincia ?? "").trim() || null,
                p_codigo_postal:
                    String(form.codigo_postal ?? "").trim() || null,
                p_observaciones:
                    String(form.observaciones ?? "").trim() || null,
                p_categoria_cliente:
                    String(form.categoria_cliente ?? "").trim() || null,
                p_estado: String(form.estado ?? "A").trim() || "A",
            };

            const { data, error } = cliente
                ? await supabase
                    .schema("usuarios")
                    .rpc("actualizar_cliente", {
                        ...payload,
                        p_id_cliente: cliente.id_cliente,
                    })
                : await supabase
                    .schema("usuarios")
                    .rpc("crear_cliente", payload);

            if (error) {
                console.error("Error al guardar cliente:", error);
                toast.error(error.message || "No se pudo guardar el cliente");
                return;
            }

            if (cliente) {
                toast.success(
                    `Cliente #${cliente.id_cliente} actualizado correctamente`
                );
            } else {
                toast.success(
                    `Cliente registrado correctamente (#${data ?? ""})`
                );
            }

            await onSaved?.();
            onOpenChange(false);
        } catch (err) {
            console.error("Error inesperado al guardar cliente:", err);
            toast.error("Ocurrió un error al guardar el cliente");
        } finally {
            setLoading(false);
        }
    };

    const labelCls =
        "text-[10px] font-bold uppercase tracking-widest text-muted-ink";
    const inputCls = "h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft";
    const selectNativeCls =
        "h-9 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[11px] text-ink-soft outline-none focus:border-[#214451]";

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!loading && !changingState) {
                    onOpenChange(nextOpen);
                }
            }}
        >
            <DialogContent className="max-w-185 border border-[#e1e8ea] bg-white p-0 shadow-card">
                <DialogHeader className="border-b border-slate-soft bg-white px-6 pt-5 pb-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
                        <div>
                            <DialogTitle className="font-barlow text-[25px] font-normal text-ink">
                                {cliente
                                    ? `Cliente #${cliente.id_cliente} · ${cliente.nombre_razon_social}`
                                    : "Alta de nuevo cliente"}
                            </DialogTitle>

                            <DialogDescription className="text-[12px] text-muted-ink">
                                {cliente
                                    ? "Consultá o modificá los datos comerciales, fiscales, ubicación e historial del cliente."
                                    : "Completá los datos fiscales, de contacto y clasificación para dar de alta al cliente."}
                            </DialogDescription>
                        </div>

                        {cliente && (
                            <div className="flex rounded-md border border-[#dce5e8] bg-[#f4f7f8] p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("datos")}
                                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                        activeTab === "datos"
                                            ? "bg-white text-[#145c73] shadow-xs"
                                            : "text-[#667b83] hover:text-[#214451]"
                                    }`}
                                >
                                    <FileText size={12} />
                                    Ficha de datos
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActiveTab("historial")}
                                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                        activeTab === "historial"
                                            ? "bg-white text-[#145c73] shadow-xs"
                                            : "text-[#667b83] hover:text-[#214451]"
                                    }`}
                                >
                                    <History size={12} />
                                    Historial ({historial.length})
                                </button>
                            </div>
                        )}
                    </div>
                </DialogHeader>

                {activeTab === "historial" && cliente ? (
                    <div className="max-h-[72vh] space-y-3 overflow-y-auto bg-white px-6 py-5">
                        {/* Resumen de auditoría en cabecera de historial */}
                        <div className="grid grid-cols-1 gap-2.5 rounded-md border border-[#e1e8ea] bg-[#f8fafb] p-3.5 sm:grid-cols-2">
                            <div className="flex items-center gap-2.5 text-[11px]">
                                <Clock size={15} className="text-[#145c73]" />
                                <div>
                                    <span className="block text-[9.5px] font-bold uppercase tracking-wider text-[#82979e]">
                                        Alta inicial
                                    </span>
                                    <strong className="text-[#214451]">
                                        {cliente.usu_alta || "—"}
                                    </strong>{" "}
                                    <span className="text-[#6f8087]">
                                        · {formatDateTime(cliente.fec_alta)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 text-[11px]">
                                <History size={15} className="text-[#145c73]" />
                                <div>
                                    <span className="block text-[9.5px] font-bold uppercase tracking-wider text-[#82979e]">
                                        Última modificación
                                    </span>
                                    <strong className="text-[#214451]">
                                        {cliente.usu_mod || "Sin modificaciones"}
                                    </strong>{" "}
                                    {cliente.fec_mod && (
                                        <span className="text-[#6f8087]">
                                            · {formatDateTime(cliente.fec_mod)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {loadingHistorial ? (
                            <p className="py-10 text-center text-[11px] text-muted-ink">
                                Cargando historial del cliente...
                            </p>
                        ) : historial.length === 0 ? (
                            <p className="py-10 text-center text-[12px] text-muted-ink">
                                No hay movimientos registrados para este cliente.
                            </p>
                        ) : (
                            <div className="space-y-2.5">
                                {historial.map((item) => {
                                    const meta = ACCION_META[item.accion] ?? {
                                        label: item.accion,
                                        tone: "slate",
                                    };
                                    return (
                                        <div
                                            key={item.id_historial}
                                            className="rounded-md border border-[#e3ebed] bg-white p-3.5 shadow-2xs"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Badge tone={meta.tone}>
                                                        {meta.label}
                                                    </Badge>
                                                    <span className="text-[11px] font-semibold text-[#214451]">
                                                        Usuario:{" "}
                                                        <span className="font-mono text-[#145c73]">
                                                            {item.usuario}
                                                        </span>
                                                    </span>
                                                </div>

                                                <span className="font-mono text-[10.5px] text-[#788b92]">
                                                    {formatDateTime(item.fecha)}
                                                </span>
                                            </div>

                                            <p className="mt-1.5 mb-0 text-[11.5px] text-[#425b65]">
                                                {item.detalle ||
                                                    "Movimiento registrado"}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex justify-end border-t border-slate-soft pt-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setActiveTab("datos")}
                                className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft hover:bg-slate-soft"
                            >
                                Volver a la ficha
                            </Button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="max-h-[72vh] space-y-4 overflow-y-auto bg-white px-6 py-5">
                            {/* Bloque 1: Clasificación y Estado */}
                            <div className="rounded-md border border-[#e1e8ea] bg-[#f8fafb] p-3.5">
                                <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#145c73]">
                                    <Building2 size={12} />
                                    <span>Clasificación comercial y estado</span>
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    {/* Tipo de cliente (administracion.tipo_cliente) */}
                                    <div className="space-y-1.5">
                                        <Label className={labelCls}>
                                            Tipo de cliente *
                                        </Label>
                                        <select
                                            value={form.tipo_cliente}
                                            onChange={(e) =>
                                                setForm((p) => ({
                                                    ...p,
                                                    tipo_cliente:
                                                        e.target.value,
                                                }))
                                            }
                                            className={selectNativeCls}
                                            required
                                        >
                                            <option value="" disabled>
                                                Seleccionar tipo...
                                            </option>
                                            {safeTiposCliente.map(
                                                (tc, idx) => (
                                                    <option
                                                        key={`${tc.codigo}-${idx}`}
                                                        value={tc.codigo}
                                                    >
                                                        {tc.codigo} ·{" "}
                                                        {tc.nombre}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </div>

                                    {/* Categoría de cliente (administracion.tipo_categoria_cliente) */}
                                    <div className="space-y-1.5">
                                        <Label className={labelCls}>
                                            Categoría de cliente
                                        </Label>
                                        <select
                                            value={form.categoria_cliente}
                                            onChange={(e) =>
                                                setForm((p) => ({
                                                    ...p,
                                                    categoria_cliente:
                                                        e.target.value,
                                                }))
                                            }
                                            className={selectNativeCls}
                                        >
                                            <option value="">
                                                Sin categoría asignada
                                            </option>
                                            {safeCategoriasCliente.map(
                                                (cat, idx) => (
                                                    <option
                                                        key={`${cat.codigo}-${idx}`}
                                                        value={cat.codigo}
                                                    >
                                                        {cat.codigo} ·{" "}
                                                        {cat.nombre}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </div>

                                    {/* Estado (A / I / E) */}
                                    <div className="space-y-1.5">
                                        <Label className={labelCls}>
                                            Estado *
                                        </Label>
                                        <select
                                            value={form.estado}
                                            onChange={(e) =>
                                                setForm((p) => ({
                                                    ...p,
                                                    estado: e.target.value,
                                                }))
                                            }
                                            className={selectNativeCls}
                                        >
                                            <option value="A">
                                                Activo (A)
                                            </option>
                                            <option value="I">
                                                Inactivo (I)
                                            </option>
                                            <option value="E">
                                                Eliminado / Baja (E)
                                            </option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Bloque 2: Nombre / Razón Social e Identificación Fiscal */}
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label className={labelCls}>
                                        Nombre o Razón Social *
                                    </Label>
                                    <Input
                                        placeholder="Ej: Plásticos del Sur S.R.L. o Juan Pérez"
                                        maxLength={150}
                                        value={form.nombre_razon_social}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                nombre_razon_social:
                                                    e.target.value,
                                            }))
                                        }
                                        className={inputCls}
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div className="space-y-1.5">
                                        <Label className={labelCls}>
                                            CUIT (11 dígitos)
                                        </Label>
                                        <Input
                                            placeholder="30-71234567-9"
                                            maxLength={13}
                                            value={form.cuit}
                                            onChange={(e) =>
                                                setForm((p) => ({
                                                    ...p,
                                                    cuit: formatCuitInput(
                                                        e.target.value
                                                    ),
                                                }))
                                            }
                                            className={inputCls}
                                        />
                                        {cuitConflict ? (
                                            <p className="text-[10px] font-medium text-[#ba584d]">
                                                CUIT ya registrado en #
                                                {cuitConflict.id_cliente} (
                                                {
                                                    cuitConflict.nombre_razon_social
                                                }
                                                ).
                                            </p>
                                        ) : cuitLengthInvalid ? (
                                            <p className="text-[10px] font-medium text-[#ba584d]">
                                                Completá los 11 dígitos del CUIT.
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className={labelCls}>
                                            Tipo de documento
                                        </Label>
                                        <select
                                            value={form.tipo_documento}
                                            onChange={(e) =>
                                                setForm((p) => ({
                                                    ...p,
                                                    tipo_documento:
                                                        e.target.value,
                                                }))
                                            }
                                            className={selectNativeCls}
                                        >
                                            <option value="">
                                                Sin especificar
                                            </option>
                                            {TIPOS_DOCUMENTO.map((td) => (
                                                <option key={td} value={td}>
                                                    {td}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className={labelCls}>
                                            Nro. de documento
                                        </Label>
                                        <Input
                                            placeholder="Ej: 30123456"
                                            maxLength={20}
                                            value={form.nro_documento}
                                            onChange={(e) =>
                                                setForm((p) => ({
                                                    ...p,
                                                    nro_documento:
                                                        e.target.value,
                                                }))
                                            }
                                            className={inputCls}
                                        />
                                        {docConflict && (
                                            <p className="text-[10px] font-medium text-[#ba584d]">
                                                Documento ya registrado en #
                                                {docConflict.id_cliente}.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Bloque 3: Contacto */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label className={labelCls}>
                                        <span className="inline-flex items-center gap-1">
                                            <Phone size={11} />
                                            Teléfono
                                        </span>
                                    </Label>
                                    <Input
                                        placeholder="Ej: 011 4555-8900"
                                        maxLength={30}
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
                                        Email de contacto
                                    </Label>
                                    <Input
                                        type="email"
                                        placeholder="compras@empresa.com.ar"
                                        maxLength={150}
                                        value={form.email}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                email: e.target.value,
                                            }))
                                        }
                                        className={inputCls}
                                    />
                                </div>
                            </div>

                            {/* Bloque 4: Ubicación y Domicilio */}
                            <div className="rounded-md border border-[#e1e8ea] bg-[#f8fafb] p-3.5">
                                <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#145c73]">
                                    <MapPin size={12} />
                                    <span>Domicilio y localidad</span>
                                </div>

                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label className={labelCls}>
                                            Domicilio (Calle, número, piso,
                                            parque industrial)
                                        </Label>
                                        <Input
                                            placeholder="Ej: Av. Hipólito Yrigoyen 4520"
                                            maxLength={200}
                                            value={form.domicilio}
                                            onChange={(e) =>
                                                setForm((p) => ({
                                                    ...p,
                                                    domicilio: e.target.value,
                                                }))
                                            }
                                            className={inputCls}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        <div className="space-y-1.5">
                                            <Label className={labelCls}>
                                                Localidad
                                            </Label>
                                            <Input
                                                placeholder="Ej: Lanús / Pilar"
                                                maxLength={100}
                                                value={form.localidad}
                                                onChange={(e) =>
                                                    setForm((p) => ({
                                                        ...p,
                                                        localidad:
                                                            e.target.value,
                                                    }))
                                                }
                                                className={inputCls}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className={labelCls}>
                                                Provincia
                                            </Label>
                                            <Input
                                                list="provincias-ar-list"
                                                placeholder="Ej: Buenos Aires"
                                                maxLength={100}
                                                value={form.provincia}
                                                onChange={(e) =>
                                                    setForm((p) => ({
                                                        ...p,
                                                        provincia:
                                                            e.target.value,
                                                    }))
                                                }
                                                className={inputCls}
                                            />
                                            <datalist id="provincias-ar-list">
                                                {PROVINCIAS_SUGERIDAS.map(
                                                    (prov) => (
                                                        <option
                                                            key={prov}
                                                            value={prov}
                                                        />
                                                    )
                                                )}
                                            </datalist>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className={labelCls}>
                                                Código postal
                                            </Label>
                                            <Input
                                                placeholder="Ej: B1824"
                                                maxLength={15}
                                                value={form.codigo_postal}
                                                onChange={(e) =>
                                                    setForm((p) => ({
                                                        ...p,
                                                        codigo_postal:
                                                            e.target.value,
                                                    }))
                                                }
                                                className={inputCls}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bloque 5: Observaciones */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className={labelCls}>
                                        Observaciones comerciales / operativas
                                    </Label>
                                    <span className="text-[10px] text-[#82979e]">
                                        {String(form.observaciones ?? "").length}{" "}
                                        / 500
                                    </span>
                                </div>
                                <Textarea
                                    placeholder="Horarios de recepción, condiciones comerciales, referencias de entrega..."
                                    rows={2}
                                    maxLength={500}
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

                            {/* Bloque 6: Auditoría y Baja/Reactivación en modo edición */}
                            {cliente && (
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#e1e8ea] bg-[#f8fafb] px-3.5 py-2.5">
                                    <div className="text-[10.5px] text-[#687e86]">
                                        <div>
                                            <strong className="text-[#214451]">
                                                Alta:
                                            </strong>{" "}
                                            {cliente.usu_alta || "—"} (
                                            {formatDateTime(cliente.fec_alta)})
                                        </div>
                                        {cliente.fec_mod && (
                                            <div>
                                                <strong className="text-[#214451]">
                                                    Última mod.:
                                                </strong>{" "}
                                                {cliente.usu_mod || "—"} (
                                                {formatDateTime(
                                                    cliente.fec_mod
                                                )}
                                                )
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {cliente.estado !== "A" && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                disabled={
                                                    loading || changingState
                                                }
                                                onClick={() =>
                                                    handleQuickState("A")
                                                }
                                                className="h-8 border-[#cce8da] bg-[#e7f4ed] text-[11px] text-[#256349] hover:bg-[#d5ece0]"
                                            >
                                                <RotateCcw
                                                    size={12}
                                                    className="mr-1.5"
                                                />
                                                Reactivar cliente
                                            </Button>
                                        )}

                                        {cliente.estado !== "E" && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                disabled={
                                                    loading || changingState
                                                }
                                                onClick={() =>
                                                    handleQuickState("E")
                                                }
                                                className="h-8 border-[#f1cfcb] bg-[#fbe9e7] text-[11px] text-[#ba584d] hover:bg-[#f5d5d1]"
                                            >
                                                <Trash2
                                                    size={12}
                                                    className="mr-1.5"
                                                />
                                                Dar de baja (Eliminar)
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="border-t border-slate-soft bg-white px-6 py-4">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={loading || changingState}
                                onClick={() => onOpenChange(false)}
                                className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft hover:bg-slate-soft"
                            >
                                Cancelar
                            </Button>

                            <Button
                                type="submit"
                                disabled={
                                    loading ||
                                    changingState ||
                                    !tipoClienteVal ||
                                    !nombreRazonVal ||
                                    cuitLengthInvalid ||
                                    Boolean(cuitConflict) ||
                                    Boolean(docConflict)
                                }
                                className="h-9 bg-green text-[11px] text-white hover:bg-[#328160]"
                            >
                                <UserCheck size={14} className="mr-1.5" />
                                {loading
                                    ? "Guardando..."
                                    : cliente
                                        ? "Guardar cambios"
                                        : "Dar de alta cliente"}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
