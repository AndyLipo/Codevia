import { useState, useEffect, useCallback, useMemo } from "react";
import {
    AlertCircle,
    CheckCircle2,
    ClipboardCheck,
    Eye,
    FileEdit,
    PackagePlus,
    Plus,
    RefreshCw,
    Save,
    Search,
    ShoppingCart,
    Trash2,
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
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import ActionButton from "@/components/common/ActionButton";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

export const ESTADO_PEDIDO_META = {
    P: {
        label: "Pendiente",
        tone: "amber",
        desc: "Pedido generado, todavía sin confirmar.",
    },
    C: {
        label: "Confirmado",
        tone: "blue",
        desc: "Pedido confirmado y stock reservado.",
    },
    M: {
        label: "Modificado",
        tone: "amber",
        desc: "Pedido editado que requiere nueva confirmación.",
    },
    E: {
        label: "En preparación",
        tone: "blue",
        desc: "El operario comenzó el picking.",
    },
    L: {
        label: "Listo para entregar",
        tone: "green",
        desc: "Preparación finalizada y verificada.",
    },
    D: {
        label: "Despachado",
        tone: "green",
        desc: "Pedido entregado y stock consumido.",
    },
    A: {
        label: "Anulado",
        tone: "red",
        desc: "Pedido cancelado.",
    },
};

export const MODALIDAD_ENTREGA_META = {
    P: "Envío propio (Brother Plast)",
    T: "Transporte / Expreso",
    R: "Retira cliente en planta",
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

const formatMoney = (val) =>
    Number(val ?? 0).toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const formatQty = (val) =>
    Number(val ?? 0).toLocaleString("es-AR", {
        maximumFractionDigits: 2,
    });

export default function GestionPedidos({ fakeAction }) {
    const { token, user } = useAuth();
    const idRol = Number(user?.id_rol);
    const canConfirmOrEdit = idRol === 1 || idRol === 16;

    // Sub-navegación: "listado" | "pendientes" | "nuevo"
    const [activeSection, setActiveSection] = useState("listado");

    const [pedidos, setPedidos] = useState([]);
    const [clientesActivos, setClientesActivos] = useState([]);
    const [productosCat, setProductosCat] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filtros del listado
    const [filterNro, setFilterNro] = useState("");
    const [filterCliente, setFilterCliente] = useState("");
    const [filterFechaDesde, setFilterFechaDesde] = useState("");
    const [filterFechaHasta, setFilterFechaHasta] = useState("");
    const [filterEstado, setFilterEstado] = useState("ALL");
    const [filterUsuario, setFilterUsuario] = useState("");

    // Paginación simple del listado
    const [page, setPage] = useState(1);
    const pageSize = 12;

    // Estado del formulario (Nuevo Pedido o Edición/Detalle en modal)
    const [formModalOpen, setFormModalOpen] = useState(false);
    const [editingPedido, setEditingPedido] = useState(null); // null = Nuevo pedido
    const [readOnlyMode, setReadOnlyMode] = useState(false);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [savingPedido, setSavingPedido] = useState(false);
    const [confirmingId, setConfirmingId] = useState(null);
    const [confirmDialogPedido, setConfirmDialogPedido] = useState(null);

    // Campos del formulario de pedido
    const [clienteSearch, setClienteSearch] = useState("");
    const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false);
    const [selectedClienteId, setSelectedClienteId] = useState("");
    const [modalidadEntrega, setModalidadEntrega] = useState("P");
    const [domicilioEntrega, setDomicilioEntrega] = useState("");
    const [localidadEntrega, setLocalidadEntrega] = useState("");
    const [provinciaEntrega, setProvinciaEntrega] = useState("");
    const [observaciones, setObservaciones] = useState("");
    const [lineas, setLineas] = useState([]);

    // Selector para agregar producto a la grilla
    const [prodSelectId, setProdSelectId] = useState("");
    const [prodCantidadInput, setProdCantidadInput] = useState("");

    const cargarProductosFallback = useCallback(async () => {
        try {
            const [
                resProd,
                resUnid,
                resPrecios,
                resLotes,
                resStock,
                resLotePos,
                resPos,
            ] = await Promise.all([
                supabase
                    .schema("produccion")
                    .from("producto")
                    .select(
                        "id_producto, codigo, nombre, id_unidad_medida, es_biodegradable, estado"
                    )
                    .eq("estado", "A")
                    .order("nombre", { ascending: true }),
                supabase
                    .schema("produccion")
                    .from("unidad_medida")
                    .select("id_unidad_medida, codigo, nombre"),
                supabase
                    .schema("administracion")
                    .from("precio_producto")
                    .select("*")
                    .eq("estado", "A")
                    .order("fecha_desde", { ascending: false })
                    .order("id_precio_producto", { ascending: false }),
                supabase
                    .schema("produccion")
                    .from("lote_producto")
                    .select(
                        "id_lote_producto, id_producto, cantidad_total, estado_lote, estado, fecha_vencimiento"
                    )
                    .eq("estado", "A"),
                supabase
                    .schema("deposito")
                    .from("stock")
                    .select(
                        "id_lote_producto, cantidad_reservada, cantidad_consumida, estado"
                    )
                    .eq("estado", "A"),
                supabase
                    .schema("deposito")
                    .from("lote_posicion")
                    .select("id_lote_producto, id_posicion, estado")
                    .eq("estado", "A"),
                supabase
                    .schema("deposito")
                    .from("posicion")
                    .select("id_posicion, estado_posicion, estado")
                    .eq("estado", "A"),
            ]);

            const prods = resProd.data ?? [];
            const unids = resUnid.data ?? [];
            const precios = resPrecios.data ?? [];
            const lotes = resLotes.data ?? [];
            const stocks = resStock.data ?? [];
            const lotePos = resLotePos.data ?? [];
            const posiciones = resPos.data ?? [];

            const hoyIso = new Date().toISOString().slice(0, 10);

            const unidMap = new Map(
                unids.map((u) => [Number(u.id_unidad_medida), u])
            );
            const stockByLote = new Map(
                stocks.map((s) => [Number(s.id_lote_producto), s])
            );
            const posOcupadasSet = new Set(
                posiciones
                    .filter(
                        (pos) =>
                            String(pos.estado).trim() === "A" &&
                            String(pos.estado_posicion).trim() === "O"
                    )
                    .map((pos) => Number(pos.id_posicion))
            );
            const lotesEnPosicionOcupada = new Set(
                lotePos
                    .filter(
                        (lp) =>
                            String(lp.estado).trim() === "A" &&
                            posOcupadasSet.has(Number(lp.id_posicion))
                    )
                    .map((lp) => Number(lp.id_lote_producto))
            );

            return prods.map((p) => {
                const idProd = Number(p.id_producto);
                const um = unidMap.get(Number(p.id_unidad_medida));

                // Precio vigente
                const preciosProd = precios.filter(
                    (pr) =>
                        Number(pr.id_producto) === idProd &&
                        String(pr.estado).trim() === "A"
                );
                const precioVigente =
                    preciosProd.find((pr) => {
                        const desde = pr.fecha_desde
                            ? String(pr.fecha_desde).slice(0, 10)
                            : "";
                        const hasta = pr.fecha_hasta
                            ? String(pr.fecha_hasta).slice(0, 10)
                            : null;
                        return (
                            (!desde || desde <= hoyIso) &&
                            (!hasta || hasta >= hoyIso)
                        );
                    }) ?? preciosProd[0];

                // Stock elegible (estado_lote = 'U', lote activo, stock activo, lote_posicion activo, posicion activa y 'O', no vencido)
                let dispTotal = 0;
                let cantLotes = 0;
                for (const l of lotes) {
                    if (Number(l.id_producto) !== idProd) continue;
                    if (String(l.estado).trim() !== "A") continue;
                    if (String(l.estado_lote).trim() !== "U") continue;
                    const vto = l.fecha_vencimiento
                        ? String(l.fecha_vencimiento).slice(0, 10)
                        : null;
                    if (vto && vto < hoyIso) continue;
                    const idLote = Number(l.id_lote_producto);
                    if (!lotesEnPosicionOcupada.has(idLote)) continue;
                    const st = stockByLote.get(idLote);
                    if (!st || String(st.estado).trim() !== "A") continue;
                    const disp =
                        Number(l.cantidad_total ?? 0) -
                        Number(st.cantidad_reservada ?? 0) -
                        Number(st.cantidad_consumida ?? 0);
                    if (disp > 0) {
                        dispTotal += disp;
                        cantLotes += 1;
                    }
                }

                return {
                    id_producto: idProd,
                    codigo: p.codigo,
                    nombre: p.nombre,
                    unidad_codigo: um?.codigo || "un.",
                    unidad_nombre: um?.nombre || "",
                    es_biodegradable: Boolean(p.es_biodegradable),
                    precio_unitario: Number(
                        precioVigente?.precio_unitario ?? 0
                    ),
                    moneda: precioVigente?.moneda
                        ? String(precioVigente.moneda).trim()
                        : "ARS",
                    fecha_precio_desde: precioVigente?.fecha_desde ?? null,
                    stock_disponible: dispTotal,
                    cantidad_lotes_elegibles: cantLotes,
                };
            });
        } catch (err) {
            console.error("Error en fallback de productos:", err);
            return [];
        }
    }, []);

    const cargarClientesFallback = useCallback(async () => {
        try {
            const { data: rpcCli, error: errRpcCli } = await supabase
                .schema("usuarios")
                .rpc("listar_clientes_gestion", { p_token: token });

            if (!errRpcCli && Array.isArray(rpcCli) && rpcCli.length > 0) {
                return rpcCli.filter(
                    (c) => String(c.estado).trim().toUpperCase() === "A"
                );
            }

            const { data: tblCli } = await supabase
                .schema("administracion")
                .from("cliente")
                .select("*")
                .eq("estado", "A")
                .order("nombre_razon_social", { ascending: true });

            return tblCli ?? [];
        } catch (err) {
            console.error("Error en fallback de clientes:", err);
            return [];
        }
    }, [token]);

    const cargarDatos = useCallback(async () => {
        if (!token) {
            setPedidos([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const [resPedidos, resClientes, resProductos] = await Promise.all([
                supabase
                    .schema("usuarios")
                    .rpc("listar_pedidos_gestion", { p_token: token }),
                supabase
                    .schema("usuarios")
                    .rpc("listar_clientes_activos_pedido", { p_token: token }),
                supabase
                    .schema("usuarios")
                    .rpc("listar_productos_disponibles_pedido", {
                        p_token: token,
                    }),
            ]);

            if (resPedidos.error) {
                console.error("Error al listar pedidos:", resPedidos.error);
                setPedidos([]);
            } else {
                setPedidos(resPedidos.data ?? []);
            }

            if (
                resClientes.error ||
                !Array.isArray(resClientes.data) ||
                resClientes.data.length === 0
            ) {
                const fallbackCli = await cargarClientesFallback();
                setClientesActivos(fallbackCli);
            } else {
                setClientesActivos(resClientes.data);
            }

            if (
                resProductos.error ||
                !Array.isArray(resProductos.data) ||
                resProductos.data.length === 0
            ) {
                const fallbackProd = await cargarProductosFallback();
                setProductosCat(fallbackProd);
            } else {
                setProductosCat(resProductos.data);
            }
        } catch (err) {
            console.error("Error inesperado en Gestión de Pedidos:", err);
            toast.error("Ocurrió un error al cargar Gestión de Pedidos");
        } finally {
            setLoading(false);
        }
    }, [token, cargarClientesFallback, cargarProductosFallback]);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    const resetFormulario = useCallback(() => {
        setEditingPedido(null);
        setReadOnlyMode(false);
        setClienteSearch("");
        setClienteDropdownOpen(false);
        setSelectedClienteId("");
        setModalidadEntrega("P");
        setDomicilioEntrega("");
        setLocalidadEntrega("");
        setProvinciaEntrega("");
        setObservaciones("");
        setLineas([]);
        setProdSelectId("");
        setProdCantidadInput("");
    }, []);

    const handleStartNuevoPedido = () => {
        resetFormulario();
        setFormModalOpen(true);
    };

    const selectedClienteObj = useMemo(
        () =>
            clientesActivos.find(
                (c) => String(c.id_cliente) === String(selectedClienteId)
            ) ?? null,
        [clientesActivos, selectedClienteId]
    );

    const handleSelectCliente = (idCli) => {
        setSelectedClienteId(String(idCli));
        const cli = clientesActivos.find(
            (c) => String(c.id_cliente) === String(idCli)
        );
        setClienteSearch(cli ? cli.nombre_razon_social : "");
        setClienteDropdownOpen(false);
        if (cli && !editingPedido && modalidadEntrega !== "R") {
            setDomicilioEntrega(cli.domicilio || "");
            setLocalidadEntrega(cli.localidad || "");
            setProvinciaEntrega(cli.provincia || "");
        }
    };

    const handleClearCliente = () => {
        setSelectedClienteId("");
        setClienteSearch("");
        setClienteDropdownOpen(true);
    };

    const filteredClientesSelector = useMemo(() => {
        const q = clienteSearch.trim().toLowerCase();
        if (!q) return clientesActivos;
        return clientesActivos.filter((c) =>
            [
                c.nombre_razon_social,
                c.cuit,
                c.nro_documento,
                c.localidad,
                c.provincia,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(q)
        );
    }, [clientesActivos, clienteSearch]);

    // Productos con disponibilidad elegible para reserva (> 0 y precio vigente > 0)
    const productosElegiblesSelector = useMemo(() => {
        return productosCat.filter((p) => {
            const yaEnGrilla = lineas.some(
                (l) => Number(l.id_producto) === Number(p.id_producto)
            );
            if (yaEnGrilla) return false;
            return (
                Number(p.stock_disponible) > 0 && Number(p.precio_unitario) > 0
            );
        });
    }, [productosCat, lineas]);

    const selectedProdForAdd = useMemo(
        () =>
            productosCat.find(
                (p) => String(p.id_producto) === String(prodSelectId)
            ) ?? null,
        [productosCat, prodSelectId]
    );

    const handleAddProductoLinea = () => {
        if (!selectedProdForAdd) {
            toast.error("Seleccioná un producto con stock elegible.");
            return;
        }
        const cant = Number(prodCantidadInput);
        if (!Number.isFinite(cant) || cant <= 0) {
            toast.error("Ingresá una cantidad mayor a cero.");
            return;
        }
        const maxDisponible = Number(selectedProdForAdd.stock_disponible ?? 0);
        if (cant > maxDisponible) {
            toast.error(
                `La cantidad solicitada (${formatQty(cant)}) supera el stock disponible (${formatQty(maxDisponible)}).`
            );
            return;
        }
        if (Number(selectedProdForAdd.precio_unitario ?? 0) <= 0) {
            toast.error(
                "El producto seleccionado no posee un precio vigente activo."
            );
            return;
        }

        setLineas((prev) => [
            ...prev,
            {
                id_producto: selectedProdForAdd.id_producto,
                codigo: selectedProdForAdd.codigo,
                nombre: selectedProdForAdd.nombre,
                unidad_codigo: selectedProdForAdd.unidad_codigo || "un.",
                stock_disponible: maxDisponible,
                cantidad_reservada_propia: 0,
                cantidad: cant,
                precio_unitario: Number(selectedProdForAdd.precio_unitario),
            },
        ]);
        setProdSelectId("");
        setProdCantidadInput("");
    };

    const handleUpdateLineaCantidad = (idProducto, rawVal) => {
        setLineas((prev) =>
            prev.map((l) => {
                if (Number(l.id_producto) !== Number(idProducto)) return l;
                const val = rawVal === "" ? "" : Number(rawVal);
                return {
                    ...l,
                    cantidad: val,
                };
            })
        );
    };

    const handleRemoveLinea = (idProducto) => {
        setLineas((prev) =>
            prev.filter((l) => Number(l.id_producto) !== Number(idProducto))
        );
    };

    const totalGeneralPedido = useMemo(() => {
        return lineas.reduce((acc, l) => {
            const c = Number(l.cantidad) || 0;
            const p = Number(l.precio_unitario) || 0;
            return acc + Math.round(c * p * 100) / 100;
        }, 0);
    }, [lineas]);

    const totalUnidadesPedido = useMemo(() => {
        return lineas.reduce((acc, l) => acc + (Number(l.cantidad) || 0), 0);
    }, [lineas]);

    const hayErrorCantidades = useMemo(() => {
        if (lineas.length === 0) return true;
        return lineas.some((l) => {
            const c = Number(l.cantidad);
            const maxPermitido =
                Number(l.stock_disponible ?? 0) +
                Number(l.cantidad_reservada_propia ?? 0);
            return !Number.isFinite(c) || c <= 0 || c > maxPermitido;
        });
    }, [lineas]);

    // Abrir pedido existente para consultar detalle o editar
    const handleOpenPedidoDetalle = async (pedidoRow, modoEdicion = false) => {
        if (!token) return;
        setLoadingDetalle(true);
        setFormModalOpen(true);

        try {
            const { data, error } = await supabase
                .schema("usuarios")
                .rpc("obtener_detalle_seguimiento_pedido", {
                    p_token: token,
                    p_id_pedido: pedidoRow.id_pedido,
                });

            if (error) {
                console.error("Error al obtener detalle del pedido:", error);
                toast.error(
                    error.message || "No se pudo cargar el detalle del pedido"
                );
                setFormModalOpen(false);
                return;
            }

            const cab = data?.pedido ?? pedidoRow;
            const detLineas = data?.lineas ?? [];

            const puedeEditarEstePedido =
                canConfirmOrEdit &&
                ["P", "C", "M"].includes(String(cab.estado).trim()) &&
                !pedidoRow.picking_iniciado;

            setEditingPedido({
                ...pedidoRow,
                ...cab,
            });
            setReadOnlyMode(!(modoEdicion && puedeEditarEstePedido));

            setSelectedClienteId(String(cab.id_cliente ?? ""));
            setModalidadEntrega(String(cab.modalidad_entrega ?? "P").trim());
            setDomicilioEntrega(cab.domicilio_entrega || "");
            setLocalidadEntrega(cab.localidad_entrega || "");
            setProvinciaEntrega(cab.provincia_entrega || "");
            setObservaciones(cab.observaciones || "");

            setLineas(
                detLineas.map((d) => ({
                    id_detalle_pedido: d.id_detalle_pedido,
                    id_producto: d.id_producto,
                    codigo: d.producto_codigo,
                    nombre: d.producto_nombre,
                    unidad_codigo: d.unidad_codigo || "un.",
                    stock_disponible: Number(d.stock_disponible_actual ?? 0),
                    cantidad_reservada_propia: Number(
                        d.cantidad_reservada ?? 0
                    ),
                    cantidad: Number(d.cantidad_solicitada ?? 0),
                    precio_unitario: Number(d.precio_unitario ?? 0),
                }))
            );
        } catch (err) {
            console.error("Error inesperado al abrir pedido:", err);
            toast.error("Ocurrió un error al consultar el pedido");
            setFormModalOpen(false);
        } finally {
            setLoadingDetalle(false);
        }
    };

    // Operación A: Generar Pedido (estado P) o Guardar Modificaciones (estado M)
    const handleGuardarPedido = async (confirmarInmediatamente = false) => {
        if (!token) return;

        if (!selectedClienteId) {
            toast.error("Seleccioná un cliente activo para el pedido.");
            return;
        }
        if (lineas.length === 0) {
            toast.error("Agregá al menos un producto al pedido.");
            return;
        }
        if (hayErrorCantidades) {
            toast.error(
                "Revisá las cantidades solicitadas: deben ser mayores a 0 y no superar el stock disponible."
            );
            return;
        }

        const itemsPayload = lineas.map((l) => ({
            id_producto: Number(l.id_producto),
            cantidad: Number(l.cantidad),
        }));

        setSavingPedido(true);
        try {
            if (editingPedido) {
                // Guardar edición de pedido existente -> pasa a estado M
                const { error } = await supabase
                    .schema("usuarios")
                    .rpc("modificar_pedido_autorizado", {
                        p_token: token,
                        p_id_cliente: Number(selectedClienteId),
                        p_id_pedido: editingPedido.id_pedido,
                        p_modalidad_entrega: modalidadEntrega,
                        p_domicilio_entrega: domicilioEntrega.trim() || null,
                        p_localidad_entrega: localidadEntrega.trim() || null,
                        p_provincia_entrega: provinciaEntrega.trim() || null,
                        p_observaciones: observaciones.trim() || null,
                        p_items: itemsPayload,
                    });

                if (error) {
                    console.error("Error al modificar pedido:", error);
                    toast.error(
                        error.message || "No se pudo modificar el pedido"
                    );
                    return;
                }

                toast.success(
                    `Pedido #${editingPedido.id_pedido} modificado (Estado M - requiere nueva confirmación)`
                );
                fakeAction?.(`Pedido #${editingPedido.id_pedido} actualizado`);
                setFormModalOpen(false);
                await cargarDatos();
                return;
            }

            // Generar nuevo pedido en estado P
            const { data: nuevoIdPedido, error: errCrear } = await supabase
                .schema("usuarios")
                .rpc("crear_pedido_cliente", {
                    p_token: token,
                    p_id_cliente: Number(selectedClienteId),
                    p_modalidad_entrega: modalidadEntrega,
                    p_domicilio_entrega: domicilioEntrega.trim() || null,
                    p_localidad_entrega: localidadEntrega.trim() || null,
                    p_provincia_entrega: provinciaEntrega.trim() || null,
                    p_observaciones: observaciones.trim() || null,
                    p_items: itemsPayload,
                });

            if (errCrear) {
                console.error("Error al generar pedido:", errCrear);
                toast.error(
                    errCrear.message || "No se pudo generar el pedido"
                );
                return;
            }

            if (confirmarInmediatamente && canConfirmOrEdit && nuevoIdPedido) {
                const { error: errConf } = await supabase
                    .schema("usuarios")
                    .rpc("confirmar_pedido_autorizado", {
                        p_token: token,
                        p_id_pedido: nuevoIdPedido,
                    });

                if (errConf) {
                    toast.warning(
                        `El pedido #${nuevoIdPedido} quedó generado en estado Pendiente (P), pero no pudo confirmarse automáticamente: ${errConf.message}`
                    );
                } else {
                    toast.success(
                        `Pedido #${nuevoIdPedido} generado y confirmado (stock reservado por FIFO)`
                    );
                    fakeAction?.(`Pedido #${nuevoIdPedido} confirmado`);
                }
            } else {
                toast.success(
                    `Pedido #${nuevoIdPedido} generado en estado Pendiente (P)`
                );
                fakeAction?.(`Pedido #${nuevoIdPedido} generado`);
            }

            setFormModalOpen(false);
            await cargarDatos();
        } catch (err) {
            console.error("Error inesperado al guardar pedido:", err);
            toast.error("Ocurrió un error al procesar el pedido");
        } finally {
            setSavingPedido(false);
        }
    };

    // Operación B: Confirmar Pedido (Exclusivo roles 1 y 16)
    const handleConfirmarPedido = async (pedidoObj) => {
        if (!token || !canConfirmOrEdit || !pedidoObj) return;

        setConfirmingId(pedidoObj.id_pedido);
        try {
            const { error } = await supabase
                .schema("usuarios")
                .rpc("confirmar_pedido_autorizado", {
                    p_token: token,
                    p_id_pedido: pedidoObj.id_pedido,
                });

            if (error) {
                console.error("Error al confirmar pedido:", error);
                toast.error(
                    error.message || "No se pudo confirmar el pedido"
                );
                return;
            }

            toast.success(
                `Pedido #${pedidoObj.id_pedido} confirmado exitosamente (Estado C · Stock reservado)`
            );
            fakeAction?.(`Pedido #${pedidoObj.id_pedido} confirmado`);
            setConfirmDialogPedido(null);
            setFormModalOpen(false);
            await cargarDatos();
        } catch (err) {
            console.error("Error inesperado al confirmar pedido:", err);
            toast.error("Ocurrió un error al confirmar el pedido");
        } finally {
            setConfirmingId(null);
        }
    };

    // KPIs compactos
    const stats = useMemo(() => {
        const total = pedidos.length;
        const pendientes = pedidos.filter(
            (p) => p.estado === "P" || p.estado === "M"
        ).length;
        const confirmados = pedidos.filter((p) => p.estado === "C").length;
        const operativos = pedidos.filter((p) =>
            ["E", "L", "D"].includes(p.estado)
        ).length;
        return { total, pendientes, confirmados, operativos };
    }, [pedidos]);

    // Filtrado del listado general
    const filteredPedidos = useMemo(() => {
        return pedidos.filter((p) => {
            if (activeSection === "pendientes") {
                if (p.estado !== "P" && p.estado !== "M") return false;
            } else if (
                filterEstado !== "ALL" &&
                p.estado !== filterEstado
            ) {
                return false;
            }

            if (filterNro.trim()) {
                const cleanNro = filterNro.replace(/\D/g, "");
                if (
                    cleanNro &&
                    !String(p.id_pedido).includes(cleanNro)
                ) {
                    return false;
                }
            }

            if (filterCliente.trim()) {
                const qCli = filterCliente.trim().toLowerCase();
                const matchCli = [p.cliente_nombre, p.cliente_cuit]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(qCli);
                if (!matchCli) return false;
            }

            if (filterUsuario.trim()) {
                const qUsu = filterUsuario.trim().toLowerCase();
                if (
                    !String(p.usu_alta ?? "")
                        .toLowerCase()
                        .includes(qUsu)
                ) {
                    return false;
                }
            }

            const fechaIso = p.fecha_pedido
                ? String(p.fecha_pedido).slice(0, 10)
                : "";
            if (filterFechaDesde && fechaIso && fechaIso < filterFechaDesde) {
                return false;
            }
            if (filterFechaHasta && fechaIso && fechaIso > filterFechaHasta) {
                return false;
            }

            return true;
        });
    }, [
        pedidos,
        activeSection,
        filterEstado,
        filterNro,
        filterCliente,
        filterUsuario,
        filterFechaDesde,
        filterFechaHasta,
    ]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredPedidos.length / pageSize)
    );
    const paginatedPedidos = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredPedidos.slice(start, start + pageSize);
    }, [filteredPedidos, page]);

    useEffect(() => {
        setPage(1);
    }, [
        activeSection,
        filterEstado,
        filterNro,
        filterCliente,
        filterUsuario,
        filterFechaDesde,
        filterFechaHasta,
    ]);

    const rowsPedidos = paginatedPedidos.map((item) => {
        const estadoInfo = ESTADO_PEDIDO_META[item.estado] ?? {
            label: item.estado,
            tone: "slate",
        };
        const puedeEditar =
            canConfirmOrEdit &&
            ["P", "C", "M"].includes(item.estado) &&
            !item.picking_iniciado;
        const puedeConfirmar =
            canConfirmOrEdit && ["P", "M"].includes(item.estado);

        const openDetailCell = (content) => (
            <button
                type="button"
                onClick={() => handleOpenPedidoDetalle(item, false)}
                className="block w-full cursor-pointer text-left"
                title={`Consultar detalle del pedido #${item.id_pedido}`}
            >
                {content}
            </button>
        );

        return [
            openDetailCell(
                <span className="font-mono text-[11.5px] font-bold text-[#145c73]">
                    #{String(item.id_pedido).padStart(5, "0")}
                </span>
            ),
            openDetailCell(
                <span className="font-mono text-[11px] text-[#49636c]">
                    {formatDateTime(item.fecha_pedido)}
                </span>
            ),
            openDetailCell(
                <div>
                    <strong className="block font-medium text-[#214451]">
                        {item.cliente_nombre}
                    </strong>
                    {item.cliente_cuit && (
                        <span className="block font-mono text-[10px] text-[#788b92]">
                            CUIT {item.cliente_cuit}
                        </span>
                    )}
                </div>
            ),
            openDetailCell(
                <span className="font-mono text-[11px] font-semibold text-[#214451]">
                    {formatQty(item.cantidad_productos)} un.
                </span>
            ),
            openDetailCell(
                <span className="text-[11px] text-[#49636c]">
                    {item.cantidad_lineas} línea(s)
                </span>
            ),
            openDetailCell(
                <span className="font-mono text-[11.5px] font-bold text-[#173c4b]">
                    $ {formatMoney(item.importe_total)}
                </span>
            ),
            openDetailCell(
                <span className="font-mono text-[11px] text-[#145c73]">
                    {item.usu_alta || "—"}
                </span>
            ),
            openDetailCell(
                <Badge tone={estadoInfo.tone}>
                    {item.estado} · {estadoInfo.label}
                </Badge>
            ),
            <div
                key={`act-ped-${item.id_pedido}`}
                className="flex flex-wrap items-center gap-1.5"
            >
                <button
                    type="button"
                    onClick={() => handleOpenPedidoDetalle(item, false)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#dce5e8] bg-white px-2 py-1 text-[10px] font-semibold text-[#214451] hover:bg-[#f4f7f8]"
                    title="Consultar detalle del pedido"
                >
                    <Eye size={11} />
                    Detalle
                </button>

                {puedeEditar && (
                    <button
                        type="button"
                        onClick={() => handleOpenPedidoDetalle(item, true)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#dce5e8] bg-white px-2 py-1 text-[10px] font-semibold text-[#145c73] hover:bg-[#eef5f7]"
                        title="Modificar pedido"
                    >
                        <FileEdit size={11} />
                        Editar
                    </button>
                )}

                {puedeConfirmar && (
                    <button
                        type="button"
                        disabled={confirmingId === item.id_pedido}
                        onClick={() => setConfirmDialogPedido(item)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#cce8da] bg-[#e7f4ed] px-2 py-1 text-[10px] font-semibold text-[#256349] hover:bg-[#d5ece0] disabled:opacity-50"
                        title="Confirmar pedido y reservar stock por FIFO"
                    >
                        <CheckCircle2 size={11} />
                        {confirmingId === item.id_pedido
                            ? "Confirmando..."
                            : "Confirmar"}
                    </button>
                )}
            </div>,
        ];
    });

    const labelCls =
        "text-[10px] font-bold uppercase tracking-widest text-muted-ink";
    const inputCls = "h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft";
    const selectNativeCls =
        "h-9 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[11px] text-ink-soft outline-none focus:border-[#214451]";

    const canEditCurrentModalPedido =
        !editingPedido ||
        (canConfirmOrEdit &&
            ["P", "C", "M"].includes(String(editingPedido.estado).trim()) &&
            !editingPedido.picking_iniciado);

    return (
        <>
            {/* Cabecera con título a la izquierda y 4 recuadros pequeños a la derecha */}
            <div className="mb-3.5 flex flex-col justify-between gap-3.5 xl:flex-row xl:items-center">
                <div className="min-w-0">
                    <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
                        10 · COMERCIAL Y VENTAS
                    </div>

                    <h1 className="m-0 font-barlow text-[34px] leading-[0.95] tracking-[-0.6px] text-[#173c4b]">
                        Gestión de pedidos
                    </h1>

                    <p className="mt-1.5 mb-0 text-[12.5px] text-[#829298]">
                        {canConfirmOrEdit
                            ? "Generación, consulta, modificación y confirmación de pedidos de clientes con reserva automática FIFO."
                            : "Generación de nuevos pedidos de clientes y consulta de tus pedidos registrados."}
                    </p>
                </div>

                {/* 4 recuadros pequeños a la derecha */}
                <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-card">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-[#5b727b]">
                                Total pedidos
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
                                Pendientes (P / M)
                            </span>
                            <span className="rounded bg-[#fff2d8] px-1.5 py-0.5 text-[8.5px] font-bold uppercase text-[#a76e1a]">
                                Por confirmar
                            </span>
                        </div>
                        <div className="mt-0.5">
                            <strong className="font-barlow text-[22px] leading-none text-[#a76e1a]">
                                {stats.pendientes}
                            </strong>
                        </div>
                    </div>

                    <div className="rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-card">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-[#5b727b]">
                                Confirmados (C)
                            </span>
                            <span className="rounded bg-[#e8f2f6] px-1.5 py-0.5 text-[8.5px] font-bold uppercase text-[#145c73]">
                                Reservados
                            </span>
                        </div>
                        <div className="mt-0.5">
                            <strong className="font-barlow text-[22px] leading-none text-[#145c73]">
                                {stats.confirmados}
                            </strong>
                        </div>
                    </div>

                    <div className="rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-card">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-[#5b727b]">
                                Prep. / Despacho
                            </span>
                            <span className="rounded bg-[#e7f4ed] px-1.5 py-0.5 text-[8.5px] font-bold uppercase text-[#256349]">
                                Operativos
                            </span>
                        </div>
                        <div className="mt-0.5">
                            <strong className="font-barlow text-[22px] leading-none text-[#256349]">
                                {stats.operativos}
                            </strong>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
                {/* Navegación interna del módulo */}
                <div className="mb-4 flex flex-col justify-between gap-3 border-b border-[#e8eef0] pb-4 lg:flex-row lg:items-center">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveSection("listado")}
                            className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-2 text-[12px] font-semibold transition-all ${
                                activeSection === "listado"
                                    ? "bg-[#145c73] text-white shadow-xs"
                                    : "bg-[#f4f7f8] text-[#587079] hover:bg-[#e8eff1] hover:text-[#214451]"
                            }`}
                        >
                            <ShoppingCart size={14} />
                            <span>Listado de Pedidos ({pedidos.length})</span>
                        </button>

                        {canConfirmOrEdit && (
                            <button
                                type="button"
                                onClick={() => setActiveSection("pendientes")}
                                className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-2 text-[12px] font-semibold transition-all ${
                                    activeSection === "pendientes"
                                        ? "bg-[#145c73] text-white shadow-xs"
                                        : "bg-[#f4f7f8] text-[#587079] hover:bg-[#e8eff1] hover:text-[#214451]"
                                }`}
                            >
                                <ClipboardCheck size={14} />
                                <span>
                                    Pedidos Pendientes de Confirmación (
                                    {stats.pendientes})
                                </span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <ActionButton
                            variant="secondary"
                            onClick={cargarDatos}
                        >
                            <RefreshCw size={15} />
                            Actualizar
                        </ActionButton>

                        <ActionButton onClick={handleStartNuevoPedido}>
                            <Plus size={17} />
                            Nuevo Pedido
                        </ActionButton>
                    </div>
                </div>

                {/* Filtros de búsqueda */}
                <div className="mb-4 grid grid-cols-1 gap-2.5 rounded-md border border-[#e6ecee] bg-[#f8fafb] p-3 sm:grid-cols-2 lg:grid-cols-6">
                    <div>
                        <label className="mb-1 block text-[9.5px] font-bold uppercase tracking-wider text-[#6e848c]">
                            Nro. Pedido
                        </label>
                        <input
                            type="search"
                            value={filterNro}
                            onChange={(e) => setFilterNro(e.target.value)}
                            placeholder="Ej: 15 o #00015"
                            className="h-8.5 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[11px] outline-none focus:border-[#214451]"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-[9.5px] font-bold uppercase tracking-wider text-[#6e848c]">
                            Cliente
                        </label>
                        <input
                            type="search"
                            value={filterCliente}
                            onChange={(e) => setFilterCliente(e.target.value)}
                            placeholder="Razón social o CUIT..."
                            className="h-8.5 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[11px] outline-none focus:border-[#214451]"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-[9.5px] font-bold uppercase tracking-wider text-[#6e848c]">
                            Fecha desde
                        </label>
                        <input
                            type="date"
                            value={filterFechaDesde}
                            onChange={(e) =>
                                setFilterFechaDesde(e.target.value)
                            }
                            className="h-8.5 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[11px] outline-none focus:border-[#214451]"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-[9.5px] font-bold uppercase tracking-wider text-[#6e848c]">
                            Fecha hasta
                        </label>
                        <input
                            type="date"
                            value={filterFechaHasta}
                            onChange={(e) =>
                                setFilterFechaHasta(e.target.value)
                            }
                            className="h-8.5 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[11px] outline-none focus:border-[#214451]"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-[9.5px] font-bold uppercase tracking-wider text-[#6e848c]">
                            Estado
                        </label>
                        <select
                            value={
                                activeSection === "pendientes"
                                    ? "PEND"
                                    : filterEstado
                            }
                            disabled={activeSection === "pendientes"}
                            onChange={(e) => setFilterEstado(e.target.value)}
                            className="h-8.5 w-full rounded-md border border-[#dfe7e9] bg-white px-2 text-[11px] outline-none focus:border-[#214451] disabled:bg-[#eef3f5]"
                        >
                            {activeSection === "pendientes" ? (
                                <option value="PEND">
                                    Pendientes / Modificados (P, M)
                                </option>
                            ) : (
                                <>
                                    <option value="ALL">
                                        Todos los estados
                                    </option>
                                    <option value="P">P · Pendiente</option>
                                    <option value="C">C · Confirmado</option>
                                    <option value="M">M · Modificado</option>
                                    <option value="E">
                                        E · En preparación
                                    </option>
                                    <option value="L">
                                        L · Listo para entregar
                                    </option>
                                    <option value="D">D · Despachado</option>
                                    <option value="A">A · Anulado</option>
                                </>
                            )}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-[9.5px] font-bold uppercase tracking-wider text-[#6e848c]">
                            Usuario generador
                        </label>
                        <input
                            type="search"
                            value={
                                canConfirmOrEdit
                                    ? filterUsuario
                                    : user?.usuario_login || ""
                            }
                            disabled={!canConfirmOrEdit}
                            onChange={(e) => setFilterUsuario(e.target.value)}
                            placeholder="Ej: BP38636078"
                            className="h-8.5 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[11px] outline-none focus:border-[#214451] disabled:bg-[#eef3f5]"
                        />
                    </div>
                </div>

                {/* Tabla de Pedidos */}
                {loading ? (
                    <p className="py-8 text-center text-[11px] text-muted-ink">
                        Cargando pedidos...
                    </p>
                ) : filteredPedidos.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-ink">
                        {pedidos.length === 0
                            ? "No hay pedidos registrados. Hacé clic en «Nuevo Pedido» para generar el primero."
                            : "No se encontraron pedidos con los filtros seleccionados."}
                    </p>
                ) : (
                    <>
                        <Table
                            headers={[
                                "Nro. Pedido",
                                "Fecha",
                                "Cliente",
                                "Cant. Productos",
                                "Cant. Líneas",
                                "Importe Total",
                                "Usuario Generador",
                                "Estado",
                                "Acciones",
                            ]}
                            rows={rowsPedidos}
                            renderCell={(cell) => cell}
                        />

                        {totalPages > 1 && (
                            <div className="mt-4 flex items-center justify-between border-t border-[#e8eef0] pt-3 text-[11px] text-[#6a7f87]">
                                <span>
                                    Mostrando página {page} de {totalPages} (
                                    {filteredPedidos.length} pedidos)
                                </span>
                                <div className="flex gap-1.5">
                                    <button
                                        type="button"
                                        disabled={page <= 1}
                                        onClick={() =>
                                            setPage((p) => Math.max(1, p - 1))
                                        }
                                        className="cursor-pointer rounded border border-[#dce5e8] bg-white px-2.5 py-1 font-semibold text-[#214451] hover:bg-[#f4f7f8] disabled:opacity-40"
                                    >
                                        Anterior
                                    </button>
                                    <button
                                        type="button"
                                        disabled={page >= totalPages}
                                        onClick={() =>
                                            setPage((p) =>
                                                Math.min(totalPages, p + 1)
                                            )
                                        }
                                        className="cursor-pointer rounded border border-[#dce5e8] bg-white px-2.5 py-1 font-semibold text-[#214451] hover:bg-[#f4f7f8] disabled:opacity-40"
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* MODAL: NUEVO PEDIDO / DETALLE / EDICIÓN DE PEDIDO */}
            <Dialog
                open={formModalOpen}
                onOpenChange={(nextOpen) => {
                    if (!savingPedido && !confirmingId) {
                        setFormModalOpen(nextOpen);
                    }
                }}
            >
                <DialogContent
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    className="max-w-235 border border-[#e1e8ea] bg-white p-0 shadow-card"
                >
                    <DialogHeader className="border-b border-slate-soft bg-white px-6 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
                            <div>
                                <DialogTitle className="font-barlow text-[24px] font-normal text-ink">
                                    {!editingPedido
                                        ? "Nuevo Pedido de Cliente"
                                        : readOnlyMode
                                            ? `Detalle del Pedido #${String(editingPedido.id_pedido).padStart(5, "0")}`
                                            : `Editar Pedido #${String(editingPedido.id_pedido).padStart(5, "0")}`}
                                </DialogTitle>
                                <DialogDescription className="text-[12px] text-muted-ink">
                                    {!editingPedido
                                        ? "Seleccioná el cliente activo y agregá los productos con stock disponible elegible. Los precios se obtienen automáticamente de la lista vigente."
                                        : `Generado por ${editingPedido.usu_alta} el ${formatDateTime(editingPedido.fecha_pedido)}`}
                                </DialogDescription>
                            </div>

                            {editingPedido && (
                                <div className="flex items-center gap-2">
                                    <Badge
                                        tone={
                                            ESTADO_PEDIDO_META[
                                                editingPedido.estado
                                            ]?.tone ?? "slate"
                                        }
                                    >
                                        {editingPedido.estado} ·{" "}
                                        {ESTADO_PEDIDO_META[
                                            editingPedido.estado
                                        ]?.label ?? editingPedido.estado}
                                    </Badge>

                                    {canEditCurrentModalPedido &&
                                        readOnlyMode && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setReadOnlyMode(false)
                                                }
                                                className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#145c73] bg-[#eef6f8] px-2.5 py-1 text-[11px] font-semibold text-[#145c73] hover:bg-[#dfeef3]"
                                            >
                                                <FileEdit size={12} />
                                                Habilitar edición
                                            </button>
                                        )}
                                </div>
                            )}
                        </div>
                    </DialogHeader>

                    {loadingDetalle ? (
                        <p className="py-12 text-center text-[12px] text-muted-ink">
                            Cargando información del pedido...
                        </p>
                    ) : (
                        <div className="max-h-[75vh] space-y-4 overflow-y-auto bg-white px-6 py-4">
                            {/* Aviso de restricciones de edición cuando el pedido no es editable */}
                            {editingPedido &&
                                !canEditCurrentModalPedido &&
                                canConfirmOrEdit && (
                                    <div className="flex items-center gap-2 rounded-md border border-[#f3d9a4] bg-[#fff8e8] px-3.5 py-2 text-[11px] text-[#8f5d10]">
                                        <AlertCircle size={15} />
                                        <span>
                                            Este pedido se encuentra en estado{" "}
                                            <strong>
                                                {editingPedido.estado}
                                            </strong>{" "}
                                            {editingPedido.picking_iniciado
                                                ? "(con preparación/picking ya iniciado)"
                                                : ""}{" "}
                                            y solo admite consulta.
                                        </span>
                                    </div>
                                )}

                            {/* 1. Selección e información del Cliente */}
                            <div className="rounded-md border border-[#e1e8ea] bg-[#f8fafb] p-3.5">
                                <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#145c73]">
                                    1 · Cliente y modalidad de entrega
                                </div>

                                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                                    <div className="relative space-y-1 lg:col-span-2">
                                        <Label className={labelCls}>
                                            Cliente activo (buscar por nombre, razón social o CUIT) *
                                        </Label>

                                        {readOnlyMode ? (
                                            <div className="flex h-9 items-center rounded-md border border-[#dfe7e9] bg-[#eef3f5] px-3 text-[11px] font-semibold text-[#173c4b]">
                                                {selectedClienteObj
                                                    ? `${selectedClienteObj.nombre_razon_social}${selectedClienteObj.cuit ? ` · CUIT ${selectedClienteObj.cuit}` : ""}`
                                                    : editingPedido?.cliente_nombre || "—"}
                                            </div>
                                        ) : selectedClienteObj && !clienteDropdownOpen ? (
                                            <div className="flex h-9 items-center justify-between gap-2 rounded-md border border-[#145c73] bg-white px-3 text-[11.5px] shadow-2xs">
                                                <div className="min-w-0 truncate">
                                                    <strong className="font-semibold text-[#173c4b]">
                                                        {selectedClienteObj.nombre_razon_social}
                                                    </strong>
                                                    {selectedClienteObj.cuit && (
                                                        <span className="ml-2 font-mono text-[10.5px] text-[#5e737b]">
                                                            CUIT {selectedClienteObj.cuit}
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleClearCliente}
                                                    className="shrink-0 cursor-pointer rounded border border-[#d6e2e6] bg-[#f4f8f9] px-2 py-0.5 text-[10px] font-semibold text-[#145c73] hover:bg-[#e5f0f4]"
                                                >
                                                    Cambiar cliente
                                                </button>
                                            </div>
                                        ) : (
                                            <div
                                                className="relative"
                                                onBlur={(e) => {
                                                    if (
                                                        !e.currentTarget.contains(
                                                            e.relatedTarget
                                                        )
                                                    ) {
                                                        setClienteDropdownOpen(
                                                            false
                                                        );
                                                    }
                                                }}
                                            >
                                                <Search
                                                    size={13}
                                                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#82979e]"
                                                />
                                                <Input
                                                    value={clienteSearch}
                                                    onClick={() =>
                                                        setClienteDropdownOpen(
                                                            true
                                                        )
                                                    }
                                                    onChange={(e) => {
                                                        setClienteSearch(
                                                            e.target.value
                                                        );
                                                        setClienteDropdownOpen(
                                                            true
                                                        );
                                                    }}
                                                    placeholder="Escribí nombre, razón social, CUIT o documento para buscar..."
                                                    className="h-9 border-[#dfe7e9] bg-white pl-8 pr-20 text-[11px]"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setClienteDropdownOpen(
                                                            (prev) => !prev
                                                        )
                                                    }
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-semibold text-[#6b7f86] hover:bg-[#eef3f5]"
                                                >
                                                    {clienteDropdownOpen
                                                        ? "Cerrar"
                                                        : "Ver todos"}
                                                </button>

                                                {clienteDropdownOpen && (
                                                    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-56 overflow-y-auto rounded-md border border-[#cfdce0] bg-white shadow-lg">
                                                        {filteredClientesSelector.length ===
                                                        0 ? (
                                                            <div className="px-3 py-3 text-center text-[11px] text-[#758990]">
                                                                No se encontraron
                                                                clientes activos
                                                                que coincidan
                                                                con «
                                                                {clienteSearch}
                                                                ».
                                                            </div>
                                                        ) : (
                                                            filteredClientesSelector.map(
                                                                (c) => (
                                                                    <button
                                                                        key={
                                                                            c.id_cliente
                                                                        }
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleSelectCliente(
                                                                                c.id_cliente
                                                                            )
                                                                        }
                                                                        className="flex w-full cursor-pointer items-center justify-between gap-2 border-b border-[#eef3f5] px-3 py-2 text-left text-[11px] transition-colors last:border-b-0 hover:bg-[#f0f7fa]"
                                                                    >
                                                                        <div>
                                                                            <div className="font-semibold text-[#173c4b]">
                                                                                {
                                                                                    c.nombre_razon_social
                                                                                }
                                                                            </div>
                                                                            <div className="text-[10px] text-[#6d8088]">
                                                                                {[
                                                                                    c.domicilio,
                                                                                    c.localidad,
                                                                                    c.provincia,
                                                                                ]
                                                                                    .filter(
                                                                                        Boolean
                                                                                    )
                                                                                    .join(
                                                                                        ", "
                                                                                    ) ||
                                                                                    "Sin domicilio registrado"}
                                                                            </div>
                                                                        </div>
                                                                        <div className="shrink-0 text-right font-mono text-[10.5px] text-[#145c73]">
                                                                            {c.cuit
                                                                                ? `CUIT ${c.cuit}`
                                                                                : c.nro_documento
                                                                                    ? `Doc. ${c.nro_documento}`
                                                                                    : `Tipo ${c.tipo_cliente || "—"}`}
                                                                        </div>
                                                                    </button>
                                                                )
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        <Label className={labelCls}>
                                            Modalidad de entrega *
                                        </Label>
                                        <select
                                            value={modalidadEntrega}
                                            disabled={readOnlyMode}
                                            onChange={(e) =>
                                                setModalidadEntrega(
                                                    e.target.value
                                                )
                                            }
                                            className={selectNativeCls}
                                        >
                                            <option value="P">
                                                P · Envío propio (Brother Plast)
                                            </option>
                                            <option value="T">
                                                T · Transporte / Expreso
                                            </option>
                                            <option value="R">
                                                R · Retira cliente en planta
                                            </option>
                                        </select>
                                    </div>
                                </div>

                                {/* Tarjeta informativa del cliente seleccionado */}
                                {selectedClienteObj && (
                                    <div className="mt-3 grid grid-cols-2 gap-2 rounded border border-[#dce6e9] bg-white px-3 py-2 text-[11px] sm:grid-cols-4">
                                        <div>
                                            <span className="block text-[9px] font-bold uppercase text-[#82979e]">
                                                Razón Social
                                            </span>
                                            <strong className="text-[#173c4b]">
                                                {
                                                    selectedClienteObj.nombre_razon_social
                                                }
                                            </strong>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] font-bold uppercase text-[#82979e]">
                                                CUIT / Tipo
                                            </span>
                                            <span className="font-mono text-[#214451]">
                                                {selectedClienteObj.cuit ||
                                                    selectedClienteObj.nro_documento ||
                                                    "—"}{" "}
                                                (Tipo{" "}
                                                {
                                                    selectedClienteObj.tipo_cliente
                                                }
                                                )
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] font-bold uppercase text-[#82979e]">
                                                Contacto
                                            </span>
                                            <span className="text-[#214451]">
                                                {selectedClienteObj.telefono ||
                                                    selectedClienteObj.email ||
                                                    "—"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] font-bold uppercase text-[#82979e]">
                                                Domicilio fiscal
                                            </span>
                                            <span className="text-[#214451]">
                                                {[
                                                    selectedClienteObj.domicilio,
                                                    selectedClienteObj.localidad,
                                                ]
                                                    .filter(Boolean)
                                                    .join(", ") || "—"}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Datos de entrega y observaciones */}
                                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div className="space-y-1">
                                        <Label className={labelCls}>
                                            Domicilio de entrega
                                        </Label>
                                        <Input
                                            disabled={readOnlyMode}
                                            value={domicilioEntrega}
                                            onChange={(e) =>
                                                setDomicilioEntrega(
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Calle y número de entrega..."
                                            className={inputCls}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <Label className={labelCls}>
                                            Localidad de entrega
                                        </Label>
                                        <Input
                                            disabled={readOnlyMode}
                                            value={localidadEntrega}
                                            onChange={(e) =>
                                                setLocalidadEntrega(
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Localidad..."
                                            className={inputCls}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <Label className={labelCls}>
                                            Provincia de entrega
                                        </Label>
                                        <Input
                                            disabled={readOnlyMode}
                                            value={provinciaEntrega}
                                            onChange={(e) =>
                                                setProvinciaEntrega(
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Provincia..."
                                            className={inputCls}
                                        />
                                    </div>
                                </div>

                                <div className="mt-2.5 space-y-1">
                                    <Label className={labelCls}>
                                        Observaciones del pedido
                                    </Label>
                                    <Textarea
                                        rows={2}
                                        disabled={readOnlyMode}
                                        value={observaciones}
                                        onChange={(e) =>
                                            setObservaciones(e.target.value)
                                        }
                                        placeholder="Instrucciones de entrega, referencias o notas del pedido..."
                                        className="border-[#dfe7e9] bg-white text-[11px] text-ink-soft"
                                    />
                                </div>
                            </div>

                            {/* 2. Grilla dinámica de Productos */}
                            <div className="rounded-md border border-[#e1e8ea] bg-white p-3.5">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#145c73]">
                                        2 · Productos del pedido
                                    </div>
                                </div>

                                {/* Barra para agregar producto cuando no es solo lectura */}
                                {!readOnlyMode && (
                                    <div className="mb-3.5 grid grid-cols-1 items-end gap-2.5 rounded-md border border-[#dce6e9] bg-[#f4f8fa] p-3 lg:grid-cols-[1fr_140px_140px_auto]">
                                        <div className="space-y-1">
                                            <Label className={labelCls}>
                                                Producto con disponibilidad
                                                elegible
                                            </Label>
                                            <select
                                                value={prodSelectId}
                                                onChange={(e) =>
                                                    setProdSelectId(
                                                        e.target.value
                                                    )
                                                }
                                                className={selectNativeCls}
                                            >
                                                <option value="">
                                                    Seleccionar producto...
                                                </option>
                                                {productosElegiblesSelector.map(
                                                    (p) => (
                                                        <option
                                                            key={p.id_producto}
                                                            value={String(
                                                                p.id_producto
                                                            )}
                                                        >
                                                            {p.codigo} ·{" "}
                                                            {p.nombre} — Disp:{" "}
                                                            {formatQty(
                                                                p.stock_disponible
                                                            )}{" "}
                                                            {p.unidad_codigo} —{" "}
                                                            {Number(
                                                                p.precio_unitario
                                                            ) > 0
                                                                ? `$ ${formatMoney(p.precio_unitario)}`
                                                                : "Sin precio vigente"}
                                                        </option>
                                                    )
                                                )}
                                            </select>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className={labelCls}>
                                                Precio vigente
                                            </Label>
                                            <div className="flex h-9 items-center rounded-md border border-[#dfe7e9] bg-[#eef3f5] px-2.5 font-mono text-[11px] font-semibold text-[#173c4b]">
                                                {selectedProdForAdd
                                                    ? `$ ${formatMoney(selectedProdForAdd.precio_unitario)}`
                                                    : "—"}
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className={labelCls}>
                                                Cantidad solicitada
                                            </Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                step="any"
                                                max={
                                                    selectedProdForAdd
                                                        ? Number(
                                                              selectedProdForAdd.stock_disponible
                                                          )
                                                        : undefined
                                                }
                                                value={prodCantidadInput}
                                                onChange={(e) =>
                                                    setProdCantidadInput(
                                                        e.target.value
                                                    )
                                                }
                                                placeholder={
                                                    selectedProdForAdd
                                                        ? `Máx ${formatQty(selectedProdForAdd.stock_disponible)}`
                                                        : "Cantidad"
                                                }
                                                className={inputCls}
                                            />
                                        </div>

                                        <Button
                                            type="button"
                                            onClick={handleAddProductoLinea}
                                            className="h-9 bg-[#145c73] px-3.5 text-[11px] font-semibold text-white hover:bg-[#10485b]"
                                        >
                                            <PackagePlus
                                                size={14}
                                                className="mr-1.5"
                                            />
                                            Agregar producto
                                        </Button>
                                    </div>
                                )}

                                {/* Tabla de líneas del pedido */}
                                {lineas.length === 0 ? (
                                    <p className="py-6 text-center text-[11.5px] text-muted-ink">
                                        Todavía no agregaste productos a este
                                        pedido.
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse text-left text-[11.5px]">
                                            <thead>
                                                <tr className="border-b border-[#e1e8ea] bg-[#f8fafb] text-[10px] font-bold uppercase tracking-wider text-[#6e848c]">
                                                    <th className="px-3 py-2">
                                                        Producto
                                                    </th>
                                                    <th className="px-3 py-2">
                                                        Código
                                                    </th>
                                                    <th className="px-3 py-2 text-right">
                                                        Stock disponible
                                                    </th>
                                                    <th className="px-3 py-2 text-right">
                                                        Cant. solicitada
                                                    </th>
                                                    <th className="px-3 py-2 text-right">
                                                        Precio unitario
                                                    </th>
                                                    <th className="px-3 py-2 text-right">
                                                        Importe
                                                    </th>
                                                    {!readOnlyMode && (
                                                        <th className="px-3 py-2 text-center">
                                                            Acción
                                                        </th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#eef2f4]">
                                                {lineas.map((l) => {
                                                    const cantNum =
                                                        Number(l.cantidad) || 0;
                                                    const maxDisp =
                                                        Number(
                                                            l.stock_disponible ??
                                                                0
                                                        ) +
                                                        Number(
                                                            l.cantidad_reservada_propia ??
                                                                0
                                                        );
                                                    const excedeStock =
                                                        cantNum > maxDisp;
                                                    const importe =
                                                        Math.round(
                                                            cantNum *
                                                                Number(
                                                                    l.precio_unitario
                                                                ) *
                                                                100
                                                        ) / 100;

                                                    return (
                                                        <tr
                                                            key={l.id_producto}
                                                            className="hover:bg-[#fafcfd]"
                                                        >
                                                            <td className="px-3 py-2 font-medium text-[#214451]">
                                                                {l.nombre}
                                                            </td>
                                                            <td className="px-3 py-2 font-mono text-[11px] text-[#145c73]">
                                                                {l.codigo}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono text-[11px] text-[#49636c]">
                                                                {formatQty(
                                                                    maxDisp
                                                                )}{" "}
                                                                {
                                                                    l.unidad_codigo
                                                                }
                                                            </td>
                                                            <td className="px-3 py-2 text-right">
                                                                {readOnlyMode ? (
                                                                    <span className="font-mono font-semibold text-[#173c4b]">
                                                                        {formatQty(
                                                                            cantNum
                                                                        )}{" "}
                                                                        {
                                                                            l.unidad_codigo
                                                                        }
                                                                    </span>
                                                                ) : (
                                                                    <div className="inline-flex flex-col items-end">
                                                                        <input
                                                                            type="number"
                                                                            min="1"
                                                                            step="any"
                                                                            max={
                                                                                maxDisp
                                                                            }
                                                                            value={
                                                                                l.cantidad
                                                                            }
                                                                            onChange={(
                                                                                e
                                                                            ) =>
                                                                                handleUpdateLineaCantidad(
                                                                                    l.id_producto,
                                                                                    e
                                                                                        .target
                                                                                        .value
                                                                                )
                                                                            }
                                                                            className={`h-8 w-28 rounded border px-2 text-right font-mono text-[11px] outline-none ${
                                                                                excedeStock ||
                                                                                cantNum <=
                                                                                    0
                                                                                    ? "border-[#ba584d] bg-[#fbe9e7] text-[#ba584d]"
                                                                                    : "border-[#cfdce0] bg-white text-[#173c4b]"
                                                                            }`}
                                                                        />
                                                                        {excedeStock && (
                                                                            <span className="mt-0.5 text-[9.5px] font-semibold text-[#ba584d]">
                                                                                Supera
                                                                                stock
                                                                                (
                                                                                {formatQty(
                                                                                    maxDisp
                                                                                )}

                                                                                )
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono text-[11px] text-[#49636c]">
                                                                ${" "}
                                                                {formatMoney(
                                                                    l.precio_unitario
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono font-bold text-[#173c4b]">
                                                                ${" "}
                                                                {formatMoney(
                                                                    importe
                                                                )}
                                                            </td>
                                                            {!readOnlyMode && (
                                                                <td className="px-3 py-2 text-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleRemoveLinea(
                                                                                l.id_producto
                                                                            )
                                                                        }
                                                                        className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#f1cfcb] bg-[#fbe9e7] px-2 py-1 text-[10px] font-semibold text-[#ba584d] hover:bg-[#f5d5d1]"
                                                                        title="Quitar producto del pedido"
                                                                    >
                                                                        <Trash2
                                                                            size={
                                                                                11
                                                                            }
                                                                        />
                                                                        Quitar
                                                                    </button>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Resumen de Totales */}
                                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#e6ecee] pt-3">
                                    <div className="text-[11px] text-[#667b83]">
                                        Líneas:{" "}
                                        <strong className="text-[#173c4b]">
                                            {lineas.length}
                                        </strong>{" "}
                                        · Cantidad total de unidades:{" "}
                                        <strong className="text-[#173c4b]">
                                            {formatQty(totalUnidadesPedido)}
                                        </strong>
                                    </div>

                                    <div className="flex items-baseline gap-2 rounded-md bg-[#eef5f7] px-3.5 py-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#145c73]">
                                            Total General:
                                        </span>
                                        <strong className="font-barlow text-[22px] leading-none text-[#173c4b]">
                                            $ {formatMoney(totalGeneralPedido)}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-soft bg-white px-6 py-4">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={savingPedido || Boolean(confirmingId)}
                            onClick={() => setFormModalOpen(false)}
                            className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft hover:bg-slate-soft"
                        >
                            Cerrar
                        </Button>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Si es un pedido existente en P o M y el usuario es rol 1 o 16: botón Confirmar Pedido */}
                            {editingPedido &&
                                canConfirmOrEdit &&
                                ["P", "M"].includes(
                                    String(editingPedido.estado).trim()
                                ) && (
                                    <Button
                                        type="button"
                                        disabled={
                                            savingPedido ||
                                            confirmingId ===
                                                editingPedido.id_pedido
                                        }
                                        onClick={() =>
                                            handleConfirmarPedido(editingPedido)
                                        }
                                        className="h-9 bg-[#145c73] text-[11px] font-semibold text-white hover:bg-[#10485b]"
                                    >
                                        <CheckCircle2
                                            size={14}
                                            className="mr-1.5"
                                        />
                                        {confirmingId ===
                                        editingPedido.id_pedido
                                            ? "Confirmando..."
                                            : "Confirmar Pedido (Reservar FIFO)"}
                                    </Button>
                                )}

                            {/* Si es edición habilitada de un pedido existente (rol 1 o 16) */}
                            {editingPedido &&
                                !readOnlyMode &&
                                canEditCurrentModalPedido && (
                                    <Button
                                        type="button"
                                        disabled={
                                            savingPedido ||
                                            !selectedClienteId ||
                                            lineas.length === 0 ||
                                            hayErrorCantidades
                                        }
                                        onClick={() =>
                                            handleGuardarPedido(false)
                                        }
                                        className="h-9 bg-green text-[11px] font-semibold text-white hover:bg-[#328160]"
                                    >
                                        <Save size={14} className="mr-1.5" />
                                        {savingPedido
                                            ? "Guardando cambios..."
                                            : "Guardar cambios"}
                                    </Button>
                                )}

                            {/* Si es un Nuevo Pedido */}
                            {!editingPedido && (
                                <>
                                    <Button
                                        type="button"
                                        disabled={
                                            savingPedido ||
                                            !selectedClienteId ||
                                            lineas.length === 0 ||
                                            hayErrorCantidades
                                        }
                                        onClick={() =>
                                            handleGuardarPedido(false)
                                        }
                                        className="h-9 bg-green text-[11px] font-semibold text-white hover:bg-[#328160]"
                                    >
                                        <ShoppingCart
                                            size={14}
                                            className="mr-1.5"
                                        />
                                        {savingPedido
                                            ? "Procesando..."
                                            : "Generar Pedido (Estado P)"}
                                    </Button>

                                    {canConfirmOrEdit && (
                                        <Button
                                            type="button"
                                            disabled={
                                                savingPedido ||
                                                !selectedClienteId ||
                                                lineas.length === 0 ||
                                                hayErrorCantidades
                                            }
                                            onClick={() =>
                                                handleGuardarPedido(true)
                                            }
                                            className="h-9 bg-[#145c73] text-[11px] font-semibold text-white hover:bg-[#10485b]"
                                        >
                                            <CheckCircle2
                                                size={14}
                                                className="mr-1.5"
                                            />
                                            {savingPedido
                                                ? "Confirmando..."
                                                : "Generar y Confirmar Pedido"}
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* DIÁLOGO DE CONFIRMACIÓN ANTES DE CONFIRMAR PEDIDO */}
            <Dialog
                open={Boolean(confirmDialogPedido)}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen && !confirmingId) {
                        setConfirmDialogPedido(null);
                    }
                }}
            >
                <DialogContent className="max-w-115 border border-[#e1e8ea] bg-white p-0 shadow-card">
                    <DialogHeader className="border-b border-slate-soft bg-white px-6 py-4">
                        <DialogTitle className="font-barlow text-[22px] font-normal text-ink">
                            Confirmar Pedido #
                            {confirmDialogPedido
                                ? String(
                                      confirmDialogPedido.id_pedido
                                  ).padStart(5, "0")
                                : ""}
                        </DialogTitle>
                        <DialogDescription className="text-[12px] text-muted-ink">
                            Esta operación ejecutará la reserva automática de
                            stock por FIFO en la base de datos y pasará el
                            pedido a estado Confirmado (C).
                        </DialogDescription>
                    </DialogHeader>

                    {confirmDialogPedido && (
                        <div className="space-y-2 bg-white px-6 py-4 text-[12px] text-[#35535d]">
                            <div>
                                <strong>Cliente:</strong>{" "}
                                {confirmDialogPedido.cliente_nombre}
                            </div>
                            <div>
                                <strong>Productos / Líneas:</strong>{" "}
                                {formatQty(
                                    confirmDialogPedido.cantidad_productos
                                )}{" "}
                                un. en {confirmDialogPedido.cantidad_lineas}{" "}
                                línea(s)
                            </div>
                            <div>
                                <strong>Importe Total:</strong> ${" "}
                                {formatMoney(confirmDialogPedido.importe_total)}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="border-t border-slate-soft bg-white px-6 py-3.5">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={Boolean(confirmingId)}
                            onClick={() => setConfirmDialogPedido(null)}
                            className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            disabled={Boolean(confirmingId)}
                            onClick={() =>
                                handleConfirmarPedido(confirmDialogPedido)
                            }
                            className="h-9 bg-green text-[11px] font-semibold text-white hover:bg-[#328160]"
                        >
                            <CheckCircle2 size={14} className="mr-1.5" />
                            {confirmingId
                                ? "Confirmando..."
                                : "Sí, confirmar pedido"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
