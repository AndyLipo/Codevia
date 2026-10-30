
import { useCallback, useEffect, useMemo, useState } from "react";
import { es } from "date-fns/locale";
import { CalendarDays, Clock3, Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Calendar } from "@/components/ui/calendar";
import Badge from "@/components/common/Badge";
import CreateOrderModal from "./modals/CreateOrderModal";
import { supabase } from "@/lib/supabaseClient";

function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
    if (!value) return null;

    const [year, month, day] = value.split("-").map(Number);

    if (!year || !month || !day) return null;

    return new Date(year, month - 1, day);
}

function formatDate(value) {
    const date = parseLocalDate(value);

    if (!date) return "Sin fecha";

    return date.toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function getEstadoLabel(estado) {
    switch (estado) {
        case "P":
            return "Pendiente";
        case "E":
            return "En producción";
        case "C":
            return "Completado";
        case "A":
            return "Activo";
        default:
            return estado || "Sin estado";
    }
}

function getEstadoTone(estado) {
    switch (estado) {
        case "P":
            return "amber";
        case "E":
            return "blue";
        case "C":
            return "green";
        default:
            return "slate";
    }
}

export default function ProductionCalendar() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [orderModalOpen, setOrderModalOpen] = useState(false);

    const loadOrders = useCallback(async () => {
        setLoading(true);

        const { data, error } = await supabase
            .schema("produccion")
            .from("orden_produccion")
            .select(`
        id_orden_produccion,
        nro_orden,
        fecha_orden,
        id_solicitante,
        estado_op,
        estado,
        detalle_orden_produccion (
          id_detalle_orden,
          id_producto,
          id_unidad_medida,
          cantidad_solicitada,
          cantidad_producida,
          fecha_limite,
          estado_detalle,
          unidad_detalle:unidad_medida (
            codigo,
            nombre
          ),
          producto (
            codigo,
            nombre,
            unidad_medida (
              codigo,
              nombre
            )
          )
        )
      `)
            .eq("estado", "A")
            .order("fecha_orden", { ascending: false });

        if (error) {
            console.error("Error al cargar calendario:", error);
            toast.error("No se pudieron cargar las órdenes del calendario");
            setOrders([]);
        } else {
            setOrders(data || []);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    // Cada detalle representa una fecha límite independiente.
    const calendarItems = useMemo(() => {
        return orders.flatMap((order) =>
            (order.detalle_orden_produccion || [])
                .filter((detail) => detail.fecha_limite)
                .map((detail) => ({
                    order,
                    detail,
                    date: detail.fecha_limite,
                }))
        );
    }, [orders]);

    // Fechas que tienen al menos una orden.
    const datesWithOrders = useMemo(() => {
        return calendarItems.map((item) =>
            parseLocalDate(item.date)
        ).filter(Boolean);
    }, [calendarItems]);

    // Órdenes correspondientes al día seleccionado.
    const selectedItems = useMemo(() => {
        const selectedKey = dateKey(selectedDate);

        return calendarItems.filter(
            (item) => item.date === selectedKey
        );
    }, [calendarItems, selectedDate]);

    const todayKey = dateKey(new Date());

    const overdueCount = calendarItems.filter(
        (item) =>
            item.date < todayKey &&
            item.detail.estado_detalle !== "C"
    ).length;

    const handleEdit = (order, detail) => {
        setSelectedOrder(order);
        setSelectedDetail(detail);
        setOrderModalOpen(true);
    };

    const handleSave = async () => {
        await loadOrders();
    };

    return (
        <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.85fr)]">

                {/* CALENDARIO */}
                <section className="min-w-0 rounded-lg border border-[#e1e8ea] bg-white p-4 shadow-card sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
                                PLANIFICACIÓN
                            </span>

                            <h3 className="font-barlow text-[21px] text-[#214451]">
                                Fechas límite
                            </h3>
                        </div>

                        <button
                            type="button"
                            onClick={loadOrders}
                            disabled={loading}
                            title="Actualizar calendario"
                            className="rounded-md border border-[#e1e8ea] p-2 text-[#607982] transition hover:bg-[#f3f7f8] disabled:opacity-50 cursor-pointer"
                        >
                            <RefreshCw
                                size={16}
                                className={loading ? "animate-spin" : ""}
                            />
                        </button>
                    </div>

                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                            if (date) setSelectedDate(date);
                        }}
                        locale={es}
                        weekStartsOn={1}
                        showOutsideDays
                        modifiers={{
                            hasOrders: datesWithOrders,
                        }}
                        modifiersClassNames={{
                            hasOrders:
                                "font-bold text-brand underline decoration-brand decoration-2 underline-offset-4",
                        }}
                        className="mx-auto w-full"
                        classNames={{
                            month: "w-full space-y-4",
                            month_grid: "w-full border-collapse",
                            weekdays: "flex w-full",
                            weekday: "flex-1 text-center text-xs font-semibold text-[#82949a]",
                            week: "mt-2 flex w-full",
                            day: "flex-1 p-0 text-center",
                        }}
                    />

                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate pt-4">
                        <div className="flex items-center gap-2 text-[10px] text-[#71858d]">
                            <span className="h-2 w-2 rounded-full bg-brand" />
                            Días con vencimientos
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-[#71858d]">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            Vencimientos atrasados
                        </div>
                    </div>
                </section>

                {/* DETALLE DEL DÍA */}
                <section className="min-w-0 rounded-lg border border-[#e1e8ea] bg-white p-4 shadow-card sm:p-5">
                    <div className="mb-4 border-b border-slate pb-4">
                        <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
                            ÓRDENES PROGRAMADAS
                        </span>

                        <h3 className="font-barlow text-[21px] text-[#214451]">
                            {formatDate(dateKey(selectedDate))}
                        </h3>

                        <p className="mt-1 text-[11px] text-[#82949a]">
                            {selectedItems.length}{" "}
                            {selectedItems.length === 1
                                ? "producto con fecha límite"
                                : "productos con fecha límite"}
                        </p>
                    </div>

                    {loading ? (
                        <div className="py-10 text-center text-sm text-[#82949a]">
                            Cargando órdenes...
                        </div>
                    ) : selectedItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <CalendarDays
                                size={30}
                                className="mb-3 text-[#a6b5b9]"
                            />

                            <p className="text-sm font-semibold text-[#526d76]">
                                No hay vencimientos este día
                            </p>

                            <p className="mt-1 max-w-57.5 text-xs text-[#82949a]">
                                Seleccioná otra fecha para consultar sus órdenes.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {selectedItems.map(({ order, detail }) => {
                                const product = detail.producto;
                                const unit =
                                    detail.unidad_detalle ??
                                    product?.unidad_medida;

                                const isOverdue =
                                    detail.fecha_limite < todayKey &&
                                    detail.estado_detalle !== "C";

                                return (
                                    <button
                                        key={detail.id_detalle_orden}
                                        type="button"
                                        onClick={() => handleEdit(order, detail)}
                                        className="w-full rounded-lg border border-[#e5ebed] bg-white p-3 text-left transition hover:border-brand hover:bg-[#f8fbfb]"
                                    >
                                        <div className="mb-2 flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <span className="text-[10px] font-bold text-brand">
                                                    {order.nro_orden || `Orden #${order.id_orden_produccion}`}
                                                </span>

                                                <h4 className="mt-1 text-sm font-semibold text-[#214451]">
                                                    {product?.nombre ||
                                                        `Producto #${detail.id_producto}`}
                                                </h4>

                                                <p className="mt-1 text-[11px] text-[#82949a]">
                                                    {product?.codigo || "Sin código"}
                                                </p>
                                            </div>

                                            <Badge
                                                tone={
                                                    isOverdue
                                                        ? "red"
                                                        : getEstadoTone(detail.estado_detalle)
                                                }
                                            >
                                                {isOverdue
                                                    ? "Atrasada"
                                                    : getEstadoLabel(detail.estado_detalle)}
                                            </Badge>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate pt-2 text-[11px] text-[#71858d]">
                                            <span className="flex items-center gap-1.5">
                                                <Package size={13} />
                                                {detail.cantidad_solicitada}{" "}
                                                {unit?.codigo || unit?.nombre || ""}
                                            </span>

                                            <span className="flex items-center gap-1.5">
                                                <Clock3 size={13} />
                                                Fecha límite: {formatDate(detail.fecha_limite)}
                                            </span>
                                        </div>

                                        <p className="mt-2 text-[10px] font-semibold text-brand">
                                            Hacé clic para editar la orden
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-[#e1e8ea] bg-white p-4 shadow-card">
                    <span className="text-[10px] text-[#82949a]">
                        Productos programados
                    </span>
                    <strong className="mt-1 block font-barlow text-[28px] text-[#214451]">
                        {calendarItems.length}
                    </strong>
                </div>

                <div className="rounded-lg border border-[#e1e8ea] bg-white p-4 shadow-card">
                    <span className="text-[10px] text-[#82949a]">
                        Vencimientos atrasados
                    </span>
                    <strong className="mt-1 block font-barlow text-[28px] text-red-600">
                        {overdueCount}
                    </strong>
                </div>

                <div className="rounded-lg border border-[#e1e8ea] bg-white p-4 shadow-card">
                    <span className="text-[10px] text-[#82949a]">
                        Órdenes del día
                    </span>
                    <strong className="mt-1 block font-barlow text-[28px] text-[#214451]">
                        {selectedItems.length}
                    </strong>
                </div>
            </div>

            <CreateOrderModal
                open={orderModalOpen}
                onOpenChange={setOrderModalOpen}
                onCreate={handleSave}
                orden={selectedOrder}
                detalle={selectedDetail}
            />
        </>
    );
}
