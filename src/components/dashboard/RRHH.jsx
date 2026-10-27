import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Plus,
    Search,
    Trash2,
    Users,
    UserCheck,
    UserMinus,
    UserX,
} from "lucide-react";
import { toast } from "sonner";

import SectionTitle from "@/components/common/SectionTitle";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import Kpi from "@/components/common/Kpi";
import ActionButton from "@/components/common/ActionButton";
import CreateEmpleadoModal from "./modals/CreateEmpleadoModal";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

const ESTADO_META = {
    A: { label: "Activo", tone: "green" },
    I: { label: "Inactivo", tone: "slate" },
    E: { label: "Eliminado", tone: "red" },
};

const formatDateDMY = (dateStr) => {
    if (!dateStr) return "—";
    const clean = String(dateStr).slice(0, 10);
    const parts = clean.split("-");
    if (parts.length !== 3) return clean;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

const formatCuil = (cuil = "") => {
    const d = String(cuil).replace(/\D/g, "");
    if (d.length !== 11) return cuil || "—";
    return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
};

export default function RRHH({ fakeAction }) {
    const { token } = useAuth();
    const [personal, setPersonal] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [estadoFilter, setEstadoFilter] = useState("ALL");

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEmpleado, setSelectedEmpleado] = useState(null);

    const fetchPersonal = useCallback(async () => {
        if (!token) {
            setPersonal([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .schema("usuarios")
                .rpc("listar_personal_rrhh", {
                    p_token: token,
                });

            if (error) {
                console.error("Error al cargar personal de RRHH:", error);
                toast.error("No se pudo cargar el padrón de personal");
                setPersonal([]);
                return;
            }

            // Ordenado por número de legajo
            const sorted = [...(data ?? [])].sort((a, b) =>
                String(a.legajo ?? "").localeCompare(
                    String(b.legajo ?? ""),
                    undefined,
                    { numeric: true }
                )
            );
            setPersonal(sorted);
        } catch (err) {
            console.error("Error inesperado en RRHH:", err);
            toast.error("Ocurrió un error al cargar el personal");
            setPersonal([]);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchPersonal();
    }, [fetchPersonal]);

    const handleNewEmpleado = () => {
        setSelectedEmpleado(null);
        setModalOpen(true);
    };

    const handleEditEmpleado = (emp) => {
        setSelectedEmpleado(emp);
        setModalOpen(true);
    };

    const handleQuickDelete = async (emp, e) => {
        e.stopPropagation();
        if (!emp.fecha_egreso) {
            toast.error(
                "Solo se puede eliminar un empleado que tenga fecha de egreso registrada."
            );
            return;
        }

        try {
            const { error } = await supabase
                .schema("usuarios")
                .rpc("eliminar_empleado_rrhh", {
                    p_token: token,
                    p_legajo: emp.legajo,
                });

            if (error) {
                toast.error(error.message || "No se pudo eliminar el empleado");
                return;
            }

            toast.success(`Legajo ${emp.legajo} marcado como Eliminado`);
            await fetchPersonal();
        } catch (err) {
            console.error("Error al eliminar empleado:", err);
            toast.error("Ocurrió un error al eliminar el empleado");
        }
    };

    const stats = useMemo(() => {
        const total = personal.length;
        const activos = personal.filter(
            (p) => p.estado === "A" && !p.fecha_egreso
        ).length;
        const conBaja = personal.filter((p) => Boolean(p.fecha_egreso)).length;
        const eliminados = personal.filter((p) => p.estado === "E").length;
        return { total, activos, conBaja, eliminados };
    }, [personal]);

    // Buscador por legajo, nombre, apellido o dni + filtro por estado
    const filteredPersonal = useMemo(() => {
        const q = search.trim().toLowerCase();
        return personal.filter((item) => {
            if (estadoFilter !== "ALL" && item.estado !== estadoFilter) {
                return false;
            }

            if (!q) return true;

            const searchable = [
                item.legajo,
                item.nombre,
                item.apellido,
                `${item.nombre ?? ""} ${item.apellido ?? ""}`,
                `${item.apellido ?? ""} ${item.nombre ?? ""}`,
                item.dni,
                item.cuil,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchable.includes(q);
        });
    }, [personal, search, estadoFilter]);

    const rows = filteredPersonal.map((item) => {
        const estadoInfo = ESTADO_META[item.estado] ?? {
            label: item.estado || "Inactivo",
            tone: "slate",
        };
        const tieneEgreso = Boolean(item.fecha_egreso);

        const clickableCell = (content) => (
            <button
                type="button"
                onClick={() => handleEditEmpleado(item)}
                className="block w-full cursor-pointer text-left"
                title={`Editar legajo ${item.legajo} (DNI ${item.dni})`}
            >
                {content}
            </button>
        );

        return [
            clickableCell(
                <span className="font-mono text-[11px] font-semibold text-[#145c73]">
                    {item.legajo}
                </span>
            ),
            clickableCell(
                <span className="font-medium text-[#214451]">
                    {item.nombre} {item.apellido}
                </span>
            ),
            clickableCell(
                <span className="font-mono text-[11px] text-[#49636c]">
                    {formatCuil(item.cuil)}
                </span>
            ),
            clickableCell(formatDateDMY(item.fecha_nacimiento)),
            clickableCell(
                <span className="text-[#49636c]">
                    {item.rol_nombre || "—"}
                </span>
            ),
            clickableCell(formatDateDMY(item.fecha_ingreso)),
            clickableCell(
                tieneEgreso ? (
                    <Badge tone="amber">
                        baja desde : {formatDateDMY(item.fecha_egreso)}
                    </Badge>
                ) : (
                    <span className="text-[#9aa8ad]">—</span>
                )
            ),
            <div
                key={`st-${item.legajo}`}
                className="flex items-center justify-between gap-2"
            >
                <button
                    type="button"
                    onClick={() => handleEditEmpleado(item)}
                    className="cursor-pointer"
                >
                    <Badge tone={estadoInfo.tone}>{estadoInfo.label}</Badge>
                </button>

                {tieneEgreso && item.estado !== "E" && (
                    <button
                        type="button"
                        onClick={(e) => handleQuickDelete(item, e)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#f1cfcb] bg-[#fbe9e7] px-2 py-0.5 text-[10px] font-semibold text-[#ba584d] hover:bg-[#f5d5d1]"
                        title="Eliminar empleado (tiene fecha de egreso)"
                    >
                        <Trash2 size={11} />
                        Eliminar
                    </button>
                )}
            </div>,
        ];
    });

    return (
        <>
            <SectionTitle
                eyebrow="08 · RECURSOS HUMANOS"
                title="Padrón de personal"
                description="Gestión de legajos, altas, modificaciones y bajas del personal de Brother Plast."
            />

            {/* Indicadores de RRHH */}
            <div className="mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                <Kpi
                    icon={Users}
                    label="Total legajos"
                    value={String(stats.total)}
                    trend="Padrón"
                    note="registrados en el sistema"
                    tone="blue"
                />
                <Kpi
                    icon={UserCheck}
                    label="Personal en actividad"
                    value={String(stats.activos)}
                    trend="Activos"
                    note="sin fecha de egreso"
                    tone="green"
                />
                <Kpi
                    icon={UserMinus}
                    label="Con baja registrada"
                    value={String(stats.conBaja)}
                    trend="Egresos"
                    note="poseen fecha de egreso"
                    tone="amber"
                />
                <Kpi
                    icon={UserX}
                    label="Legajos eliminados"
                    value={String(stats.eliminados)}
                    trend="Bajas"
                    note="dados de baja definitiva"
                    tone="red"
                />
            </div>

            <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
                <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                        <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
                            NÓMINA · ADMINISTRACIÓN
                        </div>

                        <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
                            Personal de la empresa
                        </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Filtro rápido por estado */}
                        <select
                            value={estadoFilter}
                            onChange={(e) => setEstadoFilter(e.target.value)}
                            aria-label="Filtrar por estado"
                            className="h-9 rounded-md border border-[#e1e8ea] bg-white px-2.5 text-[11px] font-medium text-[#49636c] outline-none focus:border-[#214451]"
                        >
                            <option value="ALL">Todos los estados</option>
                            <option value="A">Activos</option>
                            <option value="I">Inactivos</option>
                            <option value="E">Eliminados</option>
                        </select>

                        {/* Buscador por legajo, nombre, apellido o DNI */}
                        <div className="relative">
                            <Search
                                size={15}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#82979e]"
                            />

                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Legajo, nombre, apellido o DNI..."
                                aria-label="Buscar empleado"
                                className="h-9 w-full rounded-md border border-[#e1e8ea] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#214451] sm:w-64"
                            />
                        </div>

                        <ActionButton onClick={handleNewEmpleado}>
                            <Plus size={17} />
                            Nuevo empleado
                        </ActionButton>
                    </div>
                </div>

                {loading ? (
                    <p className="py-6 text-center text-[11px] text-muted-ink">
                        Cargando personal...
                    </p>
                ) : filteredPersonal.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-ink">
                        {personal.length === 0
                            ? "No hay empleados registrados en Recursos Humanos."
                            : "No se encontraron empleados con ese criterio de búsqueda."}
                    </p>
                ) : (
                    <Table
                        headers={[
                            "Legajo",
                            "Nombre y Apellido",
                            "CUIL",
                            "Fecha nacimiento",
                            "Puesto",
                            "Fecha ingreso",
                            "Fecha egreso",
                            "Estado",
                        ]}
                        rows={rows}
                        renderCell={(cell) => cell}
                    />
                )}
            </div>

            <CreateEmpleadoModal
                open={modalOpen}
                onOpenChange={(nextOpen) => {
                    setModalOpen(nextOpen);
                    if (!nextOpen) {
                        setSelectedEmpleado(null);
                    }
                }}
                onSaved={async () => {
                    await fetchPersonal();
                    if (!selectedEmpleado) {
                        fakeAction?.("Empleado registrado correctamente");
                    }
                }}
                empleado={selectedEmpleado}
                existingPersonal={personal}
            />
        </>
    );
}
