import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Check,
    CheckSquare,
    Lock,
    RotateCcw,
    Save,
    Search,
    ShieldCheck,
    Square,
    Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import Badge from "@/components/common/Badge";
import { modules } from "@/data/mockData";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

const ESTADO_META = {
    A: { label: "Activo", tone: "green" },
    I: { label: "Inactivo", tone: "slate" },
    E: { label: "Eliminado", tone: "red" },
};

const MODULE_DESCRIPTIONS = {
    overview: "Panel general de indicadores operativos, alertas y actividad de planta.",
    production: "Control de extrusión, órdenes de producción, lotes y calidad.",
    warehouse: "Gestión de stock, sectores, posiciones y movimientos de depósito.",
    dispatch: "Playa de carga, hojas de ruta y seguimiento de despachos.",
    orders: "Cartera de pedidos de clientes y estado de entregas.",
    reports: "Reportes de cumplimiento y métricas semanales.",
    "it-admin": "Administración de usuarios, roles, permisos y auditoría del sistema.",
    rrhh: "Padrón de personal, legajos, altas, modificaciones y bajas.",
};

const getDefaultModulesForRole = (idRol) => {
    const num = Number(idRol);
    if (num === 1) return modules.map((m) => m.id);
    if (num === 7) return ["overview", "it-admin"];
    if (num === 11 || num === 15) return ["overview", "rrhh"];
    return [
        "overview",
        "production",
        "warehouse",
        "dispatch",
        "orders",
        "reports",
    ];
};

export default function PermisosParams({ fakeAction }) {
    const { token, user, refreshSession } = useAuth();
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchRole, setSearchRole] = useState("");
    const [selectedRoleId, setSelectedRoleId] = useState(null);
    const [checkedModules, setCheckedModules] = useState([]);
    const [saving, setSaving] = useState(false);

    const allModuleIds = useMemo(() => modules.map((m) => m.id), []);

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
                console.error("Error al traer roles para permisos:", error);
                toast.error("No se pudieron cargar los roles");
                setRoles([]);
                return;
            }

            const list = (data ?? []).map((r) => ({
                ...r,
                modulos:
                    Number(r.id_rol) === 1
                        ? allModuleIds
                        : Array.isArray(r.modulos) && r.modulos.length > 0
                            ? r.modulos
                            : getDefaultModulesForRole(r.id_rol),
            }));

            setRoles(list);

            setSelectedRoleId((prev) => {
                if (prev && list.some((r) => r.id_rol === prev)) return prev;
                const firstEditable = list.find((r) => Number(r.id_rol) !== 1);
                return firstEditable?.id_rol ?? list[0]?.id_rol ?? null;
            });
        } catch (err) {
            console.error("Error inesperado al cargar permisos:", err);
            toast.error("Ocurrió un error al cargar los permisos");
            setRoles([]);
        } finally {
            setLoading(false);
        }
    }, [token, allModuleIds]);

    useEffect(() => {
        fetchRoles();
    }, [fetchRoles]);

    const selectedRole = useMemo(
        () => roles.find((r) => r.id_rol === selectedRoleId) ?? null,
        [roles, selectedRoleId]
    );

    useEffect(() => {
        if (!selectedRole) {
            setCheckedModules([]);
            return;
        }
        if (Number(selectedRole.id_rol) === 1) {
            setCheckedModules(allModuleIds);
            return;
        }
        setCheckedModules(selectedRole.modulos ?? []);
    }, [selectedRole, allModuleIds]);

    const isProtectedAdmin = Number(selectedRole?.id_rol) === 1;

    const hasChanges = useMemo(() => {
        if (!selectedRole || isProtectedAdmin) return false;
        const original = new Set(selectedRole.modulos ?? []);
        if (original.size !== checkedModules.length) return true;
        return checkedModules.some((id) => !original.has(id));
    }, [selectedRole, isProtectedAdmin, checkedModules]);

    const toggleModule = (moduleId) => {
        if (isProtectedAdmin) return;
        setCheckedModules((prev) =>
            prev.includes(moduleId)
                ? prev.filter((id) => id !== moduleId)
                : [...prev, moduleId]
        );
    };

    const handleSelectAll = () => {
        if (isProtectedAdmin) return;
        setCheckedModules(allModuleIds);
    };

    const handleSelectOnlyOverview = () => {
        if (isProtectedAdmin) return;
        setCheckedModules(["overview"]);
    };

    const handleResetChanges = () => {
        if (!selectedRole || isProtectedAdmin) return;
        setCheckedModules(selectedRole.modulos ?? []);
    };

    const handleSavePermisos = async () => {
        if (!selectedRole || isProtectedAdmin || !token) return;

        if (checkedModules.length === 0) {
            toast.error("Seleccioná al menos un módulo para el rol.");
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .schema("usuarios")
                .rpc("actualizar_modulos_rol", {
                    p_token: token,
                    p_id_rol: selectedRole.id_rol,
                    p_modulos: checkedModules,
                });

            if (error) {
                console.error("Error al guardar permisos del rol:", error);
                toast.error(
                    error.message || "No se pudieron guardar los permisos"
                );
                return;
            }

            toast.success(
                `Permisos del rol "${selectedRole.nombre}" actualizados correctamente`
            );
            fakeAction?.("Permisos actualizados");

            await fetchRoles();

            // Si el usuario logueado tiene este mismo rol, refrescamos su sesión en vivo
            if (Number(user?.id_rol) === Number(selectedRole.id_rol)) {
                await refreshSession?.();
            }
        } catch (err) {
            console.error("Error inesperado al guardar permisos:", err);
            toast.error("Ocurrió un error al guardar los permisos");
        } finally {
            setSaving(false);
        }
    };

    const filteredRoles = useMemo(() => {
        const q = searchRole.trim().toLowerCase();
        if (!q) return roles;
        return roles.filter((r) =>
            [r.id_rol, r.nombre, r.descripcion]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(q)
        );
    }, [roles, searchRole]);

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[310px_1fr]">
            {/* PANEL IZQUIERDO: Selector de Rol */}
            <div className="flex flex-col rounded-lg border border-[#e1e8ea] bg-white p-4 shadow-card">
                <div className="mb-3">
                    <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
                        1 · SELECCIONAR ROL
                    </div>
                    <h3 className="m-0 font-barlow text-[20px] text-[#214451]">
                        Roles del sistema
                    </h3>
                </div>

                <div className="relative mb-3">
                    <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#82979e]"
                    />
                    <input
                        type="search"
                        value={searchRole}
                        onChange={(e) => setSearchRole(e.target.value)}
                        placeholder="Filtrar rol..."
                        className="h-9 w-full rounded-md border border-[#e1e8ea] bg-[#f8fafb] pl-8 pr-3 text-[12px] outline-none focus:border-[#214451] focus:bg-white"
                    />
                </div>

                {loading ? (
                    <p className="py-8 text-center text-[11px] text-muted-ink">
                        Cargando roles...
                    </p>
                ) : filteredRoles.length === 0 ? (
                    <p className="py-8 text-center text-[11px] text-muted-ink">
                        No se encontraron roles.
                    </p>
                ) : (
                    <div className="flex max-h-[540px] flex-col gap-1.5 overflow-y-auto pr-1">
                        {filteredRoles.map((rol) => {
                            const isSelected = rol.id_rol === selectedRoleId;
                            const isAdminRole = Number(rol.id_rol) === 1;
                            const estadoInfo =
                                ESTADO_META[rol.estado] ?? ESTADO_META.I;
                            const countMods = isAdminRole
                                ? allModuleIds.length
                                : (rol.modulos?.length ?? 0);

                            return (
                                <button
                                    key={rol.id_rol}
                                    type="button"
                                    onClick={() => setSelectedRoleId(rol.id_rol)}
                                    className={`flex w-full cursor-pointer flex-col gap-1.5 rounded-md border p-3 text-left transition-all ${
                                        isSelected
                                            ? "border-[#145c73] bg-brand-soft/60 shadow-[inset_3px_0_0_#145c73]"
                                            : "border-[#e6ecee] bg-white hover:border-[#bdd2d9] hover:bg-[#f8fafb]"
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#173d4b]">
                                            <span className="font-mono text-[10px] text-[#145c73]">
                                                #{rol.id_rol}
                                            </span>
                                            <span className="capitalize">
                                                {rol.nombre}
                                            </span>
                                            {isAdminRole && (
                                                <Lock
                                                    size={11}
                                                    className="text-[#82979e]"
                                                />
                                            )}
                                        </span>

                                        <Badge tone={estadoInfo.tone}>
                                            {estadoInfo.label}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] text-[#6f8087]">
                                        <span className="inline-flex items-center gap-1">
                                            <Users size={11} />
                                            {rol.cantidad_usuarios ?? 0} usuario(s)
                                        </span>

                                        <span className="font-semibold text-[#145c73]">
                                            {countMods} / {allModuleIds.length} módulos
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* PANEL DERECHO: Matriz de Módulos con Checkboxes */}
            <div className="flex flex-col rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
                {!selectedRole ? (
                    <div className="grid flex-1 place-items-center py-16 text-center text-sm text-muted-ink">
                        Seleccioná un rol de la lista izquierda para configurar sus módulos habilitados.
                    </div>
                ) : (
                    <>
                        {/* Cabecera del rol seleccionado */}
                        <div className="flex flex-col justify-between gap-3 border-b border-[#e6ecee] pb-4 sm:flex-row sm:items-center">
                            <div>
                                <div className="mb-1 flex items-center gap-2">
                                    <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
                                        2 · MÓDULOS HABILITADOS
                                    </span>
                                    <span className="rounded bg-[#e9f2f5] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#145c73]">
                                        Rol #{selectedRole.id_rol}
                                    </span>
                                </div>

                                <h3 className="m-0 font-barlow text-[23px] capitalize text-[#173d4b]">
                                    {selectedRole.nombre}
                                </h3>

                                <p className="mt-0.5 text-[11px] text-[#778b92]">
                                    {selectedRole.descripcion ||
                                        "Marcá qué módulos del menú lateral puede ver y utilizar este rol."}
                                </p>
                            </div>

                            {!isProtectedAdmin && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleSelectAll}
                                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#dce5e8] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#214451] hover:bg-[#f4f7f8]"
                                    >
                                        <CheckSquare size={13} />
                                        Marcar todos
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleSelectOnlyOverview}
                                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#dce5e8] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#214451] hover:bg-[#f4f7f8]"
                                    >
                                        <Square size={13} />
                                        Solo vista general
                                    </button>

                                    {hasChanges && (
                                        <button
                                            type="button"
                                            onClick={handleResetChanges}
                                            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#dce5e8] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#6f8087] hover:bg-[#f4f7f8]"
                                            title="Deshacer cambios sin guardar"
                                        >
                                            <RotateCcw size={13} />
                                            Deshacer
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {isProtectedAdmin && (
                            <div className="mt-4 flex items-center gap-2.5 rounded-md border border-[#cce8da] bg-[#e7f4ed] px-3.5 py-2.5 text-[11px] text-[#256349]">
                                <ShieldCheck size={16} className="shrink-0" />
                                <span>
                                    El rol <strong>Administrador (#1)</strong> posee acceso total a todos los módulos del sistema (incluyendo cualquier módulo que se agregue en el futuro) y no puede ser restringido.
                                </span>
                            </div>
                        )}

                        {/* Grilla de tarjetas de módulos */}
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {modules.map((mod) => {
                                const Icon = mod.icon;
                                const isChecked =
                                    isProtectedAdmin ||
                                    checkedModules.includes(mod.id);
                                const description =
                                    MODULE_DESCRIPTIONS[mod.id] ||
                                    `Acceso al módulo ${mod.label} en el menú principal.`;

                                return (
                                    <label
                                        key={mod.id}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            toggleModule(mod.id);
                                        }}
                                        className={`group flex items-start gap-3.5 rounded-lg border p-3.5 transition-all select-none ${
                                            isProtectedAdmin
                                                ? "cursor-default border-[#cce8da] bg-[#f6fbf8]"
                                                : isChecked
                                                    ? "cursor-pointer border-[#145c73] bg-[#f2f8fa] shadow-[0_2px_8px_rgba(20,92,115,0.06)]"
                                                    : "cursor-pointer border-[#e1e8ea] bg-white hover:border-[#b8ced6] hover:bg-[#fafcfd]"
                                        }`}
                                    >
                                        {/* Checkbox visual personalizado */}
                                        <div
                                            className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border transition-colors ${
                                                isChecked
                                                    ? "border-[#145c73] bg-[#145c73] text-white"
                                                    : "border-[#c4d3d8] bg-white text-transparent group-hover:border-[#145c73]"
                                            }`}
                                        >
                                            <Check size={13} strokeWidth={3} />
                                        </div>

                                        {/* Ícono del módulo */}
                                        <div
                                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${
                                                isChecked
                                                    ? "bg-[#145c73] text-white"
                                                    : "bg-[#eef3f5] text-[#667b83]"
                                            }`}
                                        >
                                            {Icon && <Icon size={17} />}
                                        </div>

                                        {/* Texto del módulo */}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[13px] font-semibold text-[#173d4b]">
                                                    {mod.label}
                                                </span>

                                                <span className="font-mono text-[9.5px] text-[#82979e]">
                                                    {mod.id}
                                                </span>
                                            </div>

                                            <p className="mt-0.5 text-[11px] leading-snug text-[#6f8087]">
                                                {description}
                                            </p>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>

                        {/* Pie con contador y botón Guardar */}
                        <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-[#e6ecee] pt-4 sm:flex-row">
                            <div className="text-[11px] text-[#6f8087]">
                                Módulos seleccionados:{" "}
                                <strong className="text-[#173d4b]">
                                    {isProtectedAdmin
                                        ? allModuleIds.length
                                        : checkedModules.length}{" "}
                                    de {allModuleIds.length}
                                </strong>
                                {hasChanges && (
                                    <span className="ml-2 rounded bg-[#fff2d8] px-2 py-0.5 text-[10px] font-semibold text-[#a76e1a]">
                                        Cambios sin guardar
                                    </span>
                                )}
                            </div>

                            {!isProtectedAdmin && (
                                <Button
                                    type="button"
                                    disabled={
                                        saving ||
                                        !hasChanges ||
                                        checkedModules.length === 0
                                    }
                                    onClick={handleSavePermisos}
                                    className="h-9 bg-green px-4 text-[11px] font-semibold text-white hover:bg-[#328160] disabled:opacity-50"
                                >
                                    <Save size={14} className="mr-1.5" />
                                    {saving
                                        ? "Guardando permisos..."
                                        : "Guardar permisos"}
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
