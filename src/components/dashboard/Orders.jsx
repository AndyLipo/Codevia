
import { useEffect, useState } from "react";
import { Plus, SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import SectionTitle from "@/components/common/SectionTitle";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import ActionButton from "@/components/common/ActionButton";
import CreateOrderModal from "./modals/CreateOrderModal";
import { supabase } from "@/lib/supabaseClient";

const initialFilters = {
  orden: "",
  producto: "",
  cantidad: "",
  fechaDesde: "",
  fechaHasta: "",
  estado: "",
  solicitante: "",
};

export default function Orders({ query }) {
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);

  const [orders, setOrders] = useState([]);
  const [solicitantes, setSolicitantes] = useState([]);

  const [loading, setLoading] = useState(true);

  // Filtros aplicados y filtros en edición
  const [filters, setFilters] = useState(initialFilters);
  const [draftFilters, setDraftFilters] = useState(initialFilters);

  const loadOrders = async () => {
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
      console.error("Error al cargar órdenes:", error);
      toast.error("No se pudieron cargar las órdenes");
      setOrders([]);
    } else {
      setOrders(data || []);
    }

    setLoading(false);
  };

  // Cargar solicitantes desde el esquema usuarios
  const loadSolicitantes = async () => {
    const { data, error } = await supabase
      .schema("usuarios")
      .from("usuarios")
      .select("id_usuario, nombre, apellido, usuario_login, estado")
      .order("apellido", { ascending: true });

    if (error) {
      console.error("Error al cargar solicitantes:", error);
      toast.error("No se pudieron cargar los solicitantes");
      setSolicitantes([]);
      return;
    }

    console.log("Solicitantes cargados:", data);

    setSolicitantes(data || []);
  };

  useEffect(() => {
    loadOrders();
    loadSolicitantes();
  }, []);

  const handleNewOrder = () => {
    setSelectedOrder(null);
    setSelectedDetail(null);
    setOrderModalOpen(true);
  };

  const handleEditOrder = (order, detail) => {
    setSelectedOrder(order);
    setSelectedDetail(detail);
    setOrderModalOpen(true);
  };

  const handleSaveOrder = async () => {
    await loadOrders();
  };

  const updateDraftFilter = (field, value) => {
    setDraftFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const applyFilters = () => {
    setFilters({ ...draftFilters });
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setDraftFilters(initialFilters);
  };

  const openFilters = () => {
    setDraftFilters({ ...filters });
    setFiltersOpen(true);
  };

  // Obtener nombre del solicitante por su ID
  const getSolicitante = (id) => {
    const solicitante = solicitantes.find(
      (item) => item.id_usuario === id
    );

    if (!solicitante) return "Sin solicitante";

    return `${solicitante.nombre || ""} ${solicitante.apellido || ""}`.trim()
      || solicitante.usuario_login
      || "Sin solicitante";
  };

  // Aplicar filtros sobre los detalles de cada orden
  const rows = orders.flatMap((order) =>
    (order.detalle_orden_produccion || [])
      .filter((detail) => {
        const product = detail.producto;
        const productName = product
          ? `${product.codigo || ""} ${product.nombre || ""}`
          : `Producto ${detail.id_producto}`;

        const solicitante = getSolicitante(order.id_solicitante);

        // Búsqueda general recibida desde el componente padre
        const globalSearch = !query ||
          [
            order.nro_orden,
            productName,
            detail.cantidad_solicitada,
            detail.fecha_limite,
            getEstadoLabel(detail.estado_detalle),
            solicitante,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase());

        // Número de orden
        const matchOrden =
          !filters.orden ||
          String(order.nro_orden || "")
            .toLowerCase()
            .includes(filters.orden.toLowerCase());

        // Producto
        const matchProducto =
          !filters.producto ||
          productName
            .toLowerCase()
            .includes(filters.producto.toLowerCase());

        // Cantidad
        const matchCantidad =
          !filters.cantidad ||
          String(detail.cantidad_solicitada ?? "")
            .includes(filters.cantidad);

        // Fecha límite
        const matchFechaDesde =
          !filters.fechaDesde ||
          (detail.fecha_limite &&
            detail.fecha_limite >= filters.fechaDesde);

        const matchFechaHasta =
          !filters.fechaHasta ||
          (detail.fecha_limite &&
            detail.fecha_limite <= filters.fechaHasta);

        // Estado
        const matchEstado =
          !filters.estado ||
          detail.estado_detalle === filters.estado;

        // Solicitante
        const matchSolicitante =
          !filters.solicitante ||
          String(order.id_solicitante) === filters.solicitante;

        return (
          globalSearch &&
          matchOrden &&
          matchProducto &&
          matchCantidad &&
          matchFechaDesde &&
          matchFechaHasta &&
          matchEstado &&
          matchSolicitante
        );
      })
      .map((detail) => {
        const product = detail.producto;
        const unit = detail.unidad_detalle ?? product?.unidad_medida;

        const clickableCell = (content) => (
          <button
            type="button"
            onClick={() => handleEditOrder(order, detail)}
            title="Hacé clic para editar esta orden"
            className="block w-full cursor-pointer text-left"
          >
            {content}
          </button>
        );

        return [
          clickableCell(order.nro_orden),

          clickableCell(
            product
              ? `${product.codigo} · ${product.nombre}`
              : `Producto #${detail.id_producto}`
          ),

          clickableCell(getSolicitante(order.id_solicitante)),

          clickableCell(
            `${detail.cantidad_solicitada} ${unit?.codigo ?? ""}`.trim()
          ),

          clickableCell(
            detail.fecha_limite
              ? new Date(
                `${detail.fecha_limite}T12:00:00`
              ).toLocaleDateString("es-AR")
              : "-"
          ),

          clickableCell(
            <Badge
              tone={
                getEstadoLabel(detail.estado_detalle) === "Completado"
                  ? "green"
                  : getEstadoLabel(detail.estado_detalle) === "Pendiente"
                    ? "amber"
                    : getEstadoLabel(detail.estado_detalle) === "En producción"
                      ? "blue"
                      : "red"
              }
            >
              {getEstadoLabel(detail.estado_detalle)}
            </Badge>
          ),
        ];
      })
  );

  const activeFiltersCount = Object.values(filters).filter(
    (value) => value !== ""
  ).length;

  return (
    <>
      <SectionTitle
        eyebrow="05 · PRODUCCIÓN"
        title="Órdenes de producción"
        description="Seguimiento de las órdenes de producción y sus productos."
        action={
          <ActionButton onClick={handleNewOrder}>
            <Plus size={17} />
            Nueva orden
          </ActionButton>
        }
      />

      {/* Indicadores */}
      <div className="mb-3.5 grid grid-cols-3 gap-3.5 px-5.75 py-5 max-[760px]:grid-cols-1">
        <div className="rounded-lg border border-[#e1e8ea] bg-white p-4.25 shadow-card">
          <span className="block text-[10px] text-[#819298]">
            Órdenes activas
          </span>

          <strong className="my-1 block font-barlow text-[33px] text-[#174354]">
            {orders.length}
          </strong>

          <small className="block text-[9px] text-[#819298]">
            Órdenes registradas
          </small>
        </div>

        <div className="rounded-lg border border-[#e1e8ea] bg-white p-4.25 shadow-card">
          <span className="block text-[10px] text-[#819298]">
            En producción
          </span>

          <strong className="my-1 block font-barlow text-[33px] text-[#174354]">
            {orders.filter((order) => order.estado_op === "P").length}
          </strong>

          <small className="block text-[9px] text-[#819298]">
            Órdenes pendientes
          </small>
        </div>

        <div className="rounded-lg border border-[#e1e8ea] bg-white p-4.25 shadow-card">
          <span className="block text-[10px] text-[#819298]">
            Productos solicitados
          </span>

          <strong className="my-1 block font-barlow text-[33px] text-[#174354]">
            {rows.length}
          </strong>

          <small className="block text-[9px] text-[#819298]">
            Resultados encontrados
          </small>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
        <div className="mb-4.5 flex items-start justify-between gap-3 max-[600px]:flex-col">
          <div>
            <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
              ÓRDENES ACTIVAS
            </div>

            <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
              Órdenes recientes
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <ActionButton
              variant="secondary"
              onClick={openFilters}
            >
              <SlidersHorizontal size={15} />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#174354] px-1 text-[10px] text-white">
                  {activeFiltersCount}
                </span>
              )}
            </ActionButton>
          </div>
        </div>

        {/* Indicador de filtros activos */}
        {activeFiltersCount > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#f3f7f8] px-3 py-2">
            <span className="text-xs text-[#526b74]">
              {activeFiltersCount} filtro(s) aplicado(s)
            </span>

            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-[#174354] hover:underline"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-sm text-[#819298]">
            Cargando órdenes...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#819298]">
            No se encontraron órdenes con los filtros seleccionados.
          </div>
        ) : (
          <Table
            headers={[
              "Orden",
              "Producto",
              "Solicitante",
              "Cantidad",
              "Fecha límite",
              "Estado",
            ]}
            rows={rows}
            renderCell={(cell) => cell}
          />
        )}
      </div>

      {/* Modal de filtros */}
      {filtersOpen && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setFiltersOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="filters-title"
            className="w-full max-w-135 overflow-hidden rounded-xl border border-[#e1e8ea] bg-white shadow-2xl"
          >
            {/* Encabezado */}
            <div className="flex items-center justify-between border-b border-[#e1e8ea] px-5 py-4">
              <div>
                <h3
                  id="filters-title"
                  className="font-barlow text-xl font-semibold text-[#174354]"
                >
                  Filtrar órdenes
                </h3>

                <p className="mt-1 text-xs text-[#819298]">
                  Combiná los criterios para encontrar una orden.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="rounded-md p-2 text-[#819298] transition hover:bg-[#f1f5f6] hover:text-[#174354]"
                aria-label="Cerrar filtros"
              >
                <X size={19} />
              </button>
            </div>

            {/* Contenido */}
            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-4 max-[480px]:grid-cols-1">
                {/* Número de orden */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#526b74]">
                    Número de orden
                  </label>

                  <input
                    type="text"
                    value={draftFilters.orden}
                    onChange={(e) =>
                      updateDraftFilter("orden", e.target.value)
                    }
                    placeholder="Ej. OP-00025"
                    className="w-full rounded-md border border-[#dce5e8] px-3 py-2.5 text-sm text-[#214451] outline-none transition focus:border-[#174354] focus:ring-2 focus:ring-[#174354]/10"
                  />
                </div>

                {/* Producto */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#526b74]">
                    Producto
                  </label>

                  <input
                    type="text"
                    value={draftFilters.producto}
                    onChange={(e) =>
                      updateDraftFilter("producto", e.target.value)
                    }
                    placeholder="Nombre o código"
                    className="w-full rounded-md border border-[#dce5e8] px-3 py-2.5 text-sm text-[#214451] outline-none transition focus:border-[#174354] focus:ring-2 focus:ring-[#174354]/10"
                  />
                </div>

                {/* Cantidad */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#526b74]">
                    Cantidad
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={draftFilters.cantidad}
                    onChange={(e) =>
                      updateDraftFilter("cantidad", e.target.value)
                    }
                    placeholder="Cantidad solicitada"
                    className="w-full rounded-md border border-[#dce5e8] px-3 py-2.5 text-sm text-[#214451] outline-none transition focus:border-[#174354] focus:ring-2 focus:ring-[#174354]/10"
                  />
                </div>

                {/* Estado */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#526b74]">
                    Estado
                  </label>

                  <select
                    value={draftFilters.estado}
                    onChange={(e) =>
                      updateDraftFilter("estado", e.target.value)
                    }
                    className="w-full rounded-md border border-[#dce5e8] bg-white px-3 py-2.5 text-sm text-[#214451] outline-none transition focus:border-[#174354] focus:ring-2 focus:ring-[#174354]/10"
                  >
                    <option value="">Todos los estados</option>
                    <option value="P">Pendiente</option>
                    <option value="E">En producción</option>
                    <option value="C">Completado</option>
                    <option value="A">Activo</option>
                  </select>
                </div>

                {/* Solicitante */}
                <div className="col-span-2 max-[480px]:col-span-1">
                  <label className="mb-1.5 block text-xs font-semibold text-[#526b74]">
                    Solicitante
                  </label>

                  <select
                    value={draftFilters.solicitante}
                    onChange={(e) =>
                      updateDraftFilter("solicitante", e.target.value)
                    }
                    className="w-full rounded-md border border-[#dce5e8] bg-white px-3 py-2.5 text-sm text-[#214451] outline-none transition focus:border-[#174354] focus:ring-2 focus:ring-[#174354]/10"
                  >
                    <option value="">Todos los solicitantes</option>

                    {solicitantes.map((solicitante) => (
                      <option
                        key={solicitante.id_usuario}
                        value={solicitante.id_usuario}
                      >
                        {`${solicitante.nombre || ""} ${solicitante.apellido || ""}`.trim()
                          || solicitante.usuario_login}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fechas */}
                <div className="col-span-2 max-[480px]:col-span-1">
                  <label className="mb-1.5 block text-xs font-semibold text-[#526b74]">
                    Fecha límite
                  </label>

                  <div className="grid grid-cols-2 gap-3 max-[380px]:grid-cols-1">
                    <div>
                      <span className="mb-1 block text-[11px] text-[#819298]">
                        Desde
                      </span>

                      <input
                        type="date"
                        value={draftFilters.fechaDesde}
                        onChange={(e) =>
                          updateDraftFilter("fechaDesde", e.target.value)
                        }
                        className="w-full min-w-0 rounded-md border border-[#dce5e8] px-2.5 py-2.5 text-sm text-[#214451] outline-none focus:border-[#174354]"
                      />
                    </div>

                    <div>
                      <span className="mb-1 block text-[11px] text-[#819298]">
                        Hasta
                      </span>

                      <input
                        type="date"
                        value={draftFilters.fechaHasta}
                        onChange={(e) =>
                          updateDraftFilter("fechaHasta", e.target.value)
                        }
                        min={draftFilters.fechaDesde || undefined}
                        className="w-full min-w-0 rounded-md border border-[#dce5e8] px-2.5 py-2.5 text-sm text-[#214451] outline-none focus:border-[#174354]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e1e8ea] bg-[#f8fafb] px-5 py-4">
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-2 text-xs font-semibold text-[#71868d] transition hover:text-[#174354]"
              >
                <RotateCcw size={14} />
                Limpiar filtros
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="rounded-md border border-[#dce5e8] bg-white px-4 py-2.5 text-xs font-semibold text-[#526b74] transition hover:bg-[#f1f5f6]"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={applyFilters}
                  className="rounded-md bg-[#174354] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#245c70]"
                >
                  Aplicar filtros
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CreateOrderModal
        open={orderModalOpen}
        onOpenChange={setOrderModalOpen}
        onCreate={handleSaveOrder}
        orden={selectedOrder}
        detalle={selectedDetail}
      />
    </>
  );
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
