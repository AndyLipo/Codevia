import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Building2,
    Clock3,
    FileEdit,
    History,
    Plus,
    RotateCcw,
    Search,
    Trash2,
    UserCheck,
    UserX,
} from "lucide-react";
import { toast } from "sonner";

import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import ActionButton from "@/components/common/ActionButton";
import CreateClienteModal from "./modals/CreateClienteModal";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

const ESTADO_META = {
    A: { label: "Activo", tone: "green" },
    I: { label: "Inactivo", tone: "slate" },
    E: { label: "Eliminado", tone: "red" },
};

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

const formatCuit = (cuit = "") => {
    const digits = String(cuit).replace(/\D/g, "");
    if (digits.length !== 11) return cuit || "";
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
};

const normalizeCatalogOption = (item, maxCodeLen = 3) => {
    if (!item || typeof item !== "object") return null;
    const rawCode = String(item.codigo ?? "").trim();
    const rawName = String(item.nombre ?? item.descripcion ?? "").trim();

    if (rawCode) {
        return {
            codigo: rawCode.slice(0, maxCodeLen),
            nombre: rawName || rawCode,
            descripcion: item.descripcion || rawName,
        };
    }

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
            descripcion: item.descripcion || rawName,
        };
    }

    return null;
};

export default function Clientes({ fakeAction }) {
    const { token } = useAuth();

    const [activeTab, setActiveTab] = useState("padron"); // "padron" | "historial"
    const [clientes, setClientes] = useState([]);
    const [tiposCliente, setTiposCliente] = useState([]);
    const [categoriasCliente, setCategoriasCliente] = useState([]);
    const [historialGlobal, setHistorialGlobal] = useState([]);

    const [loading, setLoading] = useState(true);
    const [loadingHistorial, setLoadingHistorial] = useState(false);

    // Filtros del padrón
    const [search, setSearch] = useState("");
    const [tipoFilter, setTipoFilter] = useState("ALL");
    const [categoriaFilter, setCategoriaFilter] = useState("ALL");
    const [estadoFilter, setEstadoFilter] = useState("ALL");

    // Filtros del historial
    const [searchHistorial, setSearchHistorial] = useState("");
    const [accionFilter, setAccionFilter] = useState("ALL");

    // Modal de alta / edición / ficha / historial individual
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedCliente, setSelectedCliente] = useState(null);
    const [modalInitialTab, setModalInitialTab] = useState("datos");

    const fetchCatalogosYClientes = useCallback(async () => {
        if (!token) {
            setClientes([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const [resTipos, resCategorias, resClientes] = await Promise.all([
                supabase
                    .schema("usuarios")
                    .rpc("listar_tipos_cliente", { p_token: token }),
                supabase
                    .schema("usuarios")
                    .rpc("listar_categorias_cliente", { p_token: token }),
                supabase
                    .schema("usuarios")
                    .rpc("listar_clientes", { p_token: token }),
            ]);

            if (resTipos.error) {
                console.error(
                    "Error al cargar administracion.tipo_cliente:",
                    resTipos.error
                );
            } else {
                setTiposCliente(
                    (resTipos.data ?? [])
                        .map((tc) => normalizeCatalogOption(tc, 1))
                        .filter(Boolean)
                );
            }

            if (resCategorias.error) {
                console.error(
                    "Error al cargar administracion.tipo_categoria_cliente:",
                    resCategorias.error
                );
            } else {
                setCategoriasCliente(
                    (resCategorias.data ?? [])
                        .map((cat) => normalizeCatalogOption(cat, 3))
                        .filter(Boolean)
                );
            }

            if (resClientes.error) {
                console.error("Error al cargar clientes:", resClientes.error);
                toast.error("No se pudo cargar el padrón de clientes");
                setClientes([]);
            } else {
                setClientes(resClientes.data ?? []);
            }
        } catch (err) {
            console.error("Error inesperado al cargar clientes:", err);
            toast.error("Ocurrió un error al cargar el módulo de clientes");
            setClientes([]);
        } finally {
            setLoading(false);
        }
    }, [token]);

    const fetchHistorialGlobal = useCallback(async () => {
        if (!token) {
            setHistorialGlobal([]);
            return;
        }

        setLoadingHistorial(true);
        try {
            const { data, error } = await supabase
                .schema("usuarios")
                .rpc("listar_historial_clientes", {
                    p_token: token,
                    p_id_cliente: null,
                });

            if (error) {
                console.error("Error al cargar historial de clientes:", error);
                toast.error("No se pudo cargar el historial de movimientos");
                setHistorialGlobal([]);
                return;
            }

            setHistorialGlobal(data ?? []);
        } catch (err) {
            console.error("Error inesperado al cargar historial:", err);
            setHistorialGlobal([]);
        } finally {
            setLoadingHistorial(false);
        }
    }, [token]);

    useEffect(() => {
        fetchCatalogosYClientes();
        fetchHistorialGlobal();
    }, [fetchCatalogosYClientes, fetchHistorialGlobal]);

    const handleNewCliente = () => {
        setSelectedCliente(null);
        setModalInitialTab("datos");
        setModalOpen(true);
    };

    const handleOpenCliente = (cli, tab = "datos") => {
        setSelectedCliente(cli);
        setModalInitialTab(tab);
        setModalOpen(true);
    };

    const handleQuickStateChange = async (cli, nuevoEstado, e) => {
        e?.stopPropagation();
        if (!token) return;

        try {
            const { error } = await supabase
                .schema("usuarios")
                .rpc("cambiar_estado_cliente", {
                    p_token: token,
                    p_id_cliente: cli.id_cliente,
                    p_estado: nuevoEstado,
                    p_motivo:
                        nuevoEstado === "E"
                            ? "Baja desde listado de clientes"
                            : nuevoEstado === "I"
                                ? "Inactivación desde listado de clientes"
                                : "Reactivación desde listado de clientes",
                });

            if (error) {
                toast.error(
                    error.message || "No se pudo cambiar el estado del cliente"
                );
                return;
            }

            const label = ESTADO_META[nuevoEstado]?.label ?? nuevoEstado;
            toast.success(
                `Cliente "${cli.nombre_razon_social}" marcado como ${label}`
            );
            await Promise.all([
                fetchCatalogosYClientes(),
                fetchHistorialGlobal(),
            ]);
        } catch (err) {
            console.error("Error al cambiar estado del cliente:", err);
            toast.error("Ocurrió un error al actualizar el estado del cliente");
        }
    };

    const stats = useMemo(() => {
        const total = clientes.length;
        const activos = clientes.filter((c) => c.estado === "A").length;
        const inactivos = clientes.filter((c) => c.estado === "I").length;
        const eliminados = clientes.filter((c) => c.estado === "E").length;
        return { total, activos, inactivos, eliminados };
    }, [clientes]);

    const filteredClientes = useMemo(() => {
        const q = search.trim().toLowerCase();
        return clientes.filter((c) => {
            if (
                tipoFilter !== "ALL" &&
                String(c.tipo_cliente ?? "").trim() !== tipoFilter
            ) {
                return false;
            }

            if (
                categoriaFilter !== "ALL" &&
                String(c.categoria_cliente ?? "").trim() !== categoriaFilter
            ) {
                return false;
            }

            if (estadoFilter !== "ALL" && c.estado !== estadoFilter) {
                return false;
            }

            if (!q) return true;

            const searchable = [
                c.id_cliente,
                `#${c.id_cliente}`,
                c.nombre_razon_social,
                c.tipo_cliente,
                c.tipo_cliente_nombre,
                c.categoria_cliente,
                c.categoria_cliente_nombre,
                c.cuit,
                String(c.cuit ?? "").replace(/\D/g, ""),
                c.tipo_documento,
                c.nro_documento,
                c.telefono,
                c.email,
                c.domicilio,
                c.localidad,
                c.provincia,
                c.codigo_postal,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchable.includes(q);
        });
    }, [clientes, search, tipoFilter, categoriaFilter, estadoFilter]);

    const filteredHistorial = useMemo(() => {
        const q = searchHistorial.trim().toLowerCase();
        return historialGlobal.filter((h) => {
            if (accionFilter !== "ALL" && h.accion !== accionFilter) {
                return false;
            }
            if (!q) return true;

            const searchable = [
                h.id_cliente,
                `#${h.id_cliente}`,
                h.nombre_razon_social,
                h.cuit,
                h.accion,
                h.detalle,
                h.usuario,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchable.includes(q);
        });
    }, [historialGlobal, searchHistorial, accionFilter]);

    const rowsPadron = filteredClientes.map((item) => {
        const estadoInfo = ESTADO_META[item.estado] ?? {
            label: item.estado || "Inactivo",
            tone: "slate",
        };

        const clickableCell = (content) => (
            <button
                type="button"
                onClick={() => handleOpenCliente(item, "datos")}
                className="block w-full cursor-pointer text-left"
                title={`Consultar o editar cliente #${item.id_cliente}`}
            >
                {content}
            </button>
        );

        const docText = [item.tipo_documento, item.nro_documento]
            .filter(Boolean)
            .join(" ");

        const ubicacionText = [item.localidad, item.provincia]
            .filter(Boolean)
            .join(", ");

        return [
            clickableCell(
                <strong className="block font-medium text-[#214451]">
                    {item.nombre_razon_social}
                </strong>
            ),
            clickableCell(
                <span className="inline-flex items-center gap-1 rounded bg-[#eef4f6] px-2 py-0.5 text-[10.5px] font-semibold text-[#174354]">
                    <span className="font-mono">{item.tipo_cliente}</span>
                    {item.tipo_cliente_nombre &&
                        item.tipo_cliente_nombre !== item.tipo_cliente && (
                            <span className="font-normal text-[#49636c]">
                                · {item.tipo_cliente_nombre}
                            </span>
                        )}
                </span>
            ),
            clickableCell(
                item.categoria_cliente ? (
                    <Badge tone="blue">
                        {item.categoria_cliente}
                        {item.categoria_cliente_nombre &&
                        item.categoria_cliente_nombre !==
                            item.categoria_cliente
                            ? ` · ${item.categoria_cliente_nombre}`
                            : ""}
                    </Badge>
                ) : (
                    <span className="text-[#9aa8ad]">—</span>
                )
            ),
            clickableCell(
                <div className="font-mono text-[11px] text-[#49636c]">
                    {item.cuit ? (
                        <span className="block font-semibold text-[#214451]">
                            {formatCuit(item.cuit)}
                        </span>
                    ) : null}
                    {docText ? (
                        <span className="block text-[10px] text-[#788b92]">
                            {docText}
                        </span>
                    ) : !item.cuit ? (
                        <span className="text-[#9aa8ad]">—</span>
                    ) : null}
                </div>
            ),
            clickableCell(
                <div className="text-[11px] text-[#49636c]">
                    {item.telefono && (
                        <span className="block">{item.telefono}</span>
                    )}
                    {item.email && (
                        <span className="block text-[10px] text-[#6d8289]">
                            {item.email}
                        </span>
                    )}
                    {!item.telefono && !item.email && (
                        <span className="text-[#9aa8ad]">—</span>
                    )}
                </div>
            ),
            clickableCell(
                <div className="text-[11px] text-[#49636c]">
                    {item.domicilio || ubicacionText ? (
                        <>
                            {item.domicilio && (
                                <span className="block font-medium text-[#214451]">
                                    {item.domicilio}
                                </span>
                            )}
                            {ubicacionText && (
                                <span className="block text-[10px] text-[#6d8289]">
                                    {ubicacionText}
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="text-[#9aa8ad]">—</span>
                    )}
                </div>
            ),
            clickableCell(
                item.codigo_postal ? (
                    <span className="font-mono text-[11px] font-medium text-[#49636c]">
                        {item.codigo_postal}
                    </span>
                ) : (
                    <span className="text-[#9aa8ad]">—</span>
                )
            ),
            clickableCell(
                <Badge tone={estadoInfo.tone}>{estadoInfo.label}</Badge>
            ),
            <div
                key={`act-${item.id_cliente}`}
                className="flex flex-wrap items-center gap-1.5"
            >
                <button
                    type="button"
                    onClick={() => handleOpenCliente(item, "datos")}
                    className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#dce5e8] bg-white px-2 py-1 text-[10px] font-semibold text-[#214451] hover:bg-[#f4f7f8]"
                    title="Consultar o modificar ficha del cliente"
                >
                    <FileEdit size={11} />
                    Editar
                </button>

                <button
                    type="button"
                    onClick={() => handleOpenCliente(item, "historial")}
                    className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#dce5e8] bg-white px-2 py-1 text-[10px] font-semibold text-[#145c73] hover:bg-[#f0f6f8]"
                    title="Ver historial de movimientos del cliente"
                >
                    <History size={11} />
                    Historial
                </button>

                {item.estado !== "E" ? (
                    <button
                        type="button"
                        onClick={(e) => handleQuickStateChange(item, "E", e)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#f1cfcb] bg-[#fbe9e7] px-2 py-1 text-[10px] font-semibold text-[#ba584d] hover:bg-[#f5d5d1]"
                        title="Dar de baja lógica al cliente"
                    >
                        <Trash2 size={11} />
                        Baja
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={(e) => handleQuickStateChange(item, "A", e)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#cce8da] bg-[#e7f4ed] px-2 py-1 text-[10px] font-semibold text-[#256349] hover:bg-[#d5ece0]"
                        title="Reactivar cliente"
                    >
                        <RotateCcw size={11} />
                        Reactivar
                    </button>
                )}
            </div>,
        ];
    });

    const rowsHistorial = filteredHistorial.map((h) => {
        const meta = ACCION_META[h.accion] ?? {
            label: h.accion,
            tone: "slate",
        };
        const cliObj = clientes.find((c) => c.id_cliente === h.id_cliente);

        const openHist = (content) => (
            <button
                type="button"
                onClick={() => {
                    if (cliObj) {
                        handleOpenCliente(cliObj, "historial");
                    }
                }}
                className="block w-full cursor-pointer text-left"
                title="Abrir ficha e historial de este cliente"
            >
                {content}
            </button>
        );

        return [
            openHist(
                <span className="font-mono text-[11px] text-[#49636c]">
                    {formatDateTime(h.fecha)}
                </span>
            ),
            openHist(
                <div>
                    <span className="font-mono text-[10.5px] font-semibold text-[#145c73]">
                        #{h.id_cliente}
                    </span>{" "}
                    <strong className="font-medium text-[#214451]">
                        {h.nombre_razon_social}
                    </strong>
                    {h.cuit && (
                        <span className="block font-mono text-[10px] text-[#7c9097]">
                            CUIT {formatCuit(h.cuit)}
                        </span>
                    )}
                </div>
            ),
            openHist(<Badge tone={meta.tone}>{meta.label}</Badge>),
            openHist(
                <span className="text-[11px] text-[#425b65]">
                    {h.detalle || "—"}
                </span>
            ),
            openHist(
                <span className="font-mono text-[11px] font-semibold text-[#145c73]">
                    {h.usuario || "—"}
                </span>
            ),
        ];
    });

    return (
        <>
            {/* Cabecera con título a la izquierda y 4 recuadros pequeños de KPIs a la derecha */}
            <div className="mb-3.5 flex flex-col justify-between gap-3.5 xl:flex-row xl:items-center">
                <div className="min-w-0">
                    <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
                        09 · ADMINISTRACIÓN Y COMERCIAL
                    </div>

                    <h1 className="m-0 font-barlow text-[34px] leading-[0.95] tracking-[-0.6px] text-[#173c4b]">
                        Gestión de clientes
                    </h1>

                    <p className="mt-1.5 mb-0 text-[12.5px] text-[#829298]">
                        Altas, modificaciones, bajas, consultas de ficha e historial de movimientos de la cartera de clientes.
                    </p>
                </div>

                {/* 4 recuadros pequeños a la derecha */}
                <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-card">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-[#5b727b]">
                                Total clientes
                            </span>
                            <span className="rounded bg-[#e8f2f6] px-1.5 py-0.5 text-[8.5px] font-bold uppercase text-[#145c73]">
                                Cartera
                            </span>
                        </div>
                        <div className="mt-0.5">
                            <strong className="font-barlow text-[22px] leading-none text-[#173c4b]">
                                {stats.total}
                            </strong>
                        </div>
                    </div>

                    <div className="rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-card">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-[#5b727b]">
                                Clientes activos
                            </span>
                            <span className="rounded bg-[#e7f4ed] px-1.5 py-0.5 text-[8.5px] font-bold uppercase text-[#256349]">
                                Operativos
                            </span>
                        </div>
                        <div className="mt-0.5">
                            <strong className="font-barlow text-[22px] leading-none text-[#256349]">
                                {stats.activos}
                            </strong>
                        </div>
                    </div>

                    <div className="rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-card">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-[#5b727b]">
                                Clientes inactivos
                            </span>
                            <span className="rounded bg-[#fff2d8] px-1.5 py-0.5 text-[8.5px] font-bold uppercase text-[#a76e1a]">
                                Pausados
                            </span>
                        </div>
                        <div className="mt-0.5">
                            <strong className="font-barlow text-[22px] leading-none text-[#a76e1a]">
                                {stats.inactivos}
                            </strong>
                        </div>
                    </div>

                    <div className="rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-card">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-[#5b727b]">
                                Bajas / Eliminados
                            </span>
                            <span className="rounded bg-[#fbe9e7] px-1.5 py-0.5 text-[8.5px] font-bold uppercase text-[#ba584d]">
                                Bajas
                            </span>
                        </div>
                        <div className="mt-0.5">
                            <strong className="font-barlow text-[22px] leading-none text-[#ba584d]">
                                {stats.eliminados}
                            </strong>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
                {/* Selector de pestaña: Padrón vs Historial */}
                <div className="mb-4 flex flex-col justify-between gap-3 border-b border-[#e8eef0] pb-4 lg:flex-row lg:items-center">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab("padron")}
                            className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-2 text-[12px] font-semibold transition-all ${
                                activeTab === "padron"
                                    ? "bg-[#145c73] text-white shadow-xs"
                                    : "bg-[#f4f7f8] text-[#587079] hover:bg-[#e8eff1] hover:text-[#214451]"
                            }`}
                        >
                            <Building2 size={14} />
                            <span>Padrón de clientes ({clientes.length})</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("historial")}
                            className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-2 text-[12px] font-semibold transition-all ${
                                activeTab === "historial"
                                    ? "bg-[#145c73] text-white shadow-xs"
                                    : "bg-[#f4f7f8] text-[#587079] hover:bg-[#e8eff1] hover:text-[#214451]"
                            }`}
                        >
                            <History size={14} />
                            <span>
                                Historial de movimientos (
                                {historialGlobal.length})
                            </span>
                        </button>
                    </div>

                    <ActionButton onClick={handleNewCliente}>
                        <Plus size={17} />
                        Nuevo cliente
                    </ActionButton>
                </div>

                {activeTab === "padron" ? (
                    <>
                        {/* Barra de filtros y búsqueda del Padrón */}
                        <div className="mb-4 flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
                            <div>
                                <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
                                    ADMINISTRACIÓN · CLIENTES
                                </div>
                                <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
                                    Listado general de clientes
                                </h3>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {/* Filtro por Tipo de Cliente */}
                                <select
                                    value={tipoFilter}
                                    onChange={(e) =>
                                        setTipoFilter(e.target.value)
                                    }
                                    aria-label="Filtrar por tipo de cliente"
                                    className="h-9 rounded-md border border-[#e1e8ea] bg-white px-2.5 text-[11px] font-medium text-[#49636c] outline-none focus:border-[#214451]"
                                >
                                    <option value="ALL">
                                        Todos los tipos
                                    </option>
                                    {tiposCliente.map((tc) => (
                                        <option
                                            key={tc.codigo}
                                            value={tc.codigo}
                                        >
                                            Tipo {tc.codigo} · {tc.nombre}
                                        </option>
                                    ))}
                                </select>

                                {/* Filtro por Categoría de Cliente */}
                                <select
                                    value={categoriaFilter}
                                    onChange={(e) =>
                                        setCategoriaFilter(e.target.value)
                                    }
                                    aria-label="Filtrar por categoría de cliente"
                                    className="h-9 rounded-md border border-[#e1e8ea] bg-white px-2.5 text-[11px] font-medium text-[#49636c] outline-none focus:border-[#214451]"
                                >
                                    <option value="ALL">
                                        Todas las categorías
                                    </option>
                                    {categoriasCliente.map((cat) => (
                                        <option
                                            key={cat.codigo}
                                            value={cat.codigo}
                                        >
                                            Cat. {cat.codigo} · {cat.nombre}
                                        </option>
                                    ))}
                                </select>

                                {/* Filtro por Estado */}
                                <select
                                    value={estadoFilter}
                                    onChange={(e) =>
                                        setEstadoFilter(e.target.value)
                                    }
                                    aria-label="Filtrar por estado"
                                    className="h-9 rounded-md border border-[#e1e8ea] bg-white px-2.5 text-[11px] font-medium text-[#49636c] outline-none focus:border-[#214451]"
                                >
                                    <option value="ALL">
                                        Todos los estados
                                    </option>
                                    <option value="A">Activos</option>
                                    <option value="I">Inactivos</option>
                                    <option value="E">
                                        Eliminados / Bajas
                                    </option>
                                </select>

                                {/* Buscador */}
                                <div className="relative">
                                    <Search
                                        size={15}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#82979e]"
                                    />
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(e) =>
                                            setSearch(e.target.value)
                                        }
                                        placeholder="Razón social, CUIT, doc, localidad..."
                                        aria-label="Buscar cliente"
                                        className="h-9 w-full rounded-md border border-[#e1e8ea] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#214451] sm:w-64"
                                    />
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <p className="py-6 text-center text-[11px] text-muted-ink">
                                Cargando clientes...
                            </p>
                        ) : filteredClientes.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-ink">
                                {clientes.length === 0
                                    ? "No hay clientes registrados todavía. Hacé clic en «Nuevo cliente» para dar el primer alta."
                                    : "No se encontraron clientes con los filtros seleccionados."}
                            </p>
                        ) : (
                            <Table
                                headers={[
                                    "Nombre / Razón Social",
                                    "Tipo",
                                    "Categoría",
                                    "CUIT / Documento",
                                    "Contacto",
                                    "Domicilio / localidad",
                                    "C.P",
                                    "Estado",
                                    "Acciones",
                                ]}
                                rows={rowsPadron}
                                renderCell={(cell) => cell}
                            />
                        )}
                    </>
                ) : (
                    <>
                        {/* Vista de Historial Global de Clientes */}
                        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                            <div>
                                <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
                                    AUDITORÍA · MOVIMIENTOS DE CLIENTES
                                </div>
                                <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
                                    Historial de altas, modificaciones y bajas
                                </h3>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={accionFilter}
                                    onChange={(e) =>
                                        setAccionFilter(e.target.value)
                                    }
                                    aria-label="Filtrar por tipo de movimiento"
                                    className="h-9 rounded-md border border-[#e1e8ea] bg-white px-2.5 text-[11px] font-medium text-[#49636c] outline-none focus:border-[#214451]"
                                >
                                    <option value="ALL">
                                        Todos los movimientos
                                    </option>
                                    <option value="ALTA">Altas</option>
                                    <option value="MODIFICACION">
                                        Modificaciones
                                    </option>
                                    <option value="BAJA">Bajas</option>
                                    <option value="INACTIVACION">
                                        Inactivaciones
                                    </option>
                                    <option value="REACTIVACION">
                                        Reactivaciones
                                    </option>
                                </select>

                                <div className="relative">
                                    <Search
                                        size={15}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#82979e]"
                                    />
                                    <input
                                        type="search"
                                        value={searchHistorial}
                                        onChange={(e) =>
                                            setSearchHistorial(e.target.value)
                                        }
                                        placeholder="Cliente, CUIT, usuario o detalle..."
                                        aria-label="Buscar en el historial"
                                        className="h-9 w-full rounded-md border border-[#e1e8ea] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#214451] sm:w-64"
                                    />
                                </div>
                            </div>
                        </div>

                        {loadingHistorial ? (
                            <p className="py-6 text-center text-[11px] text-muted-ink">
                                Cargando historial de clientes...
                            </p>
                        ) : filteredHistorial.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-ink">
                                No se encontraron movimientos en el historial.
                            </p>
                        ) : (
                            <Table
                                headers={[
                                    "Fecha y Hora",
                                    "Cliente",
                                    "Movimiento",
                                    "Detalle de cambios",
                                    "Usuario",
                                ]}
                                rows={rowsHistorial}
                                renderCell={(cell) => cell}
                            />
                        )}
                    </>
                )}
            </div>

            <CreateClienteModal
                open={modalOpen}
                onOpenChange={(nextOpen) => {
                    setModalOpen(nextOpen);
                    if (!nextOpen) {
                        setSelectedCliente(null);
                    }
                }}
                onSaved={async () => {
                    await Promise.all([
                        fetchCatalogosYClientes(),
                        fetchHistorialGlobal(),
                    ]);
                    if (!selectedCliente) {
                        fakeAction?.("Cliente dado de alta correctamente");
                    }
                }}
                cliente={selectedCliente}
                initialTab={modalInitialTab}
                tiposCliente={tiposCliente}
                categoriasCliente={categoriasCliente}
                existingClientes={clientes}
            />
        </>
    );
}
