import { useEffect, useState } from "react";
import { Plus, Search, UsersRound } from "lucide-react";
import { toast } from "sonner";

import SectionTitle from "@/components/common/SectionTitle";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import ActionButton from "@/components/common/ActionButton";
import CreateOrderModal from "./modals/CreateOrderModal";
import { supabase } from "@/lib/supabaseClient";

export default function Orders({ query }) {
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

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
          cantidad_solicitada,
          cantidad_producida,
          fecha_limite,
          estado_detalle,
          producto (
            codigo,
            nombre
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

  useEffect(() => {
    loadOrders();
  }, []);

  const rows = orders
    .filter((order) => {
      if (!query) return true;

      return JSON.stringify(order)
        .toLowerCase()
        .includes(query.toLowerCase());
    })
    .flatMap((order) =>
      (order.detalle_orden_produccion || []).map((detalle) => {
        const producto = detalle.producto;

        return [
          order.nro_orden,
          producto
            ? `${producto.codigo} · ${producto.nombre}`
            : `Producto #${detalle.id_producto}`,
          `${detalle.cantidad_solicitada} unidades`,
          detalle.fecha_limite
            ? new Date(detalle.fecha_limite).toLocaleDateString("es-AR")
            : "-",
          getEstadoLabel(detalle.estado_detalle),
        ];
      })
    );

  const handleCreateOrder = async () => {
    setOrderModalOpen(false);
    await loadOrders();
  };

  return (
    <>
      <SectionTitle
        eyebrow="05 · PRODUCCIÓN"
        title="Órdenes de producción"
        description="Seguimiento de las órdenes de producción y sus productos."
        action={
          <ActionButton onClick={() => setOrderModalOpen(true)}>
            <Plus size={17} />
            Nueva orden
          </ActionButton>
        }
      />

      <div className="mb-3.5 grid grid-cols-3 gap-3.5 max-[760px]:grid-cols-1">
        <div className="rounded-lg border border-[#e1e8ea] bg-white p-[17px] shadow-card">
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

        <div className="rounded-lg border border-[#e1e8ea] bg-white p-[17px] shadow-card">
          <span className="block text-[10px] text-[#819298]">
            En producción
          </span>

          <strong className="my-1 block font-barlow text-[33px] text-[#174354]">
            {
              orders.filter((order) => order.estado_op === "P").length
            }
          </strong>

          <small className="block text-[9px] text-[#819298]">
            Órdenes pendientes
          </small>
        </div>

        <div className="rounded-lg border border-[#e1e8ea] bg-white p-[17px] shadow-card">
          <span className="block text-[10px] text-[#819298]">
            Productos solicitados
          </span>

          <strong className="my-1 block font-barlow text-[33px] text-[#174354]">
            {rows.length}
          </strong>

          <small className="block text-[9px] text-[#819298]">
            Detalles de órdenes
          </small>
        </div>
      </div>

      <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
        <div className="mb-4.5 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
              ÓRDENES ACTIVAS
            </div>

            <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
              Órdenes recientes
            </h3>
          </div>

          <div className="flex gap-2">
            <ActionButton variant="secondary">
              <Search size={15} />
              Buscar
            </ActionButton>

            <ActionButton variant="secondary">
              <UsersRound size={15} />
              Solicitantes
            </ActionButton>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-[#819298]">
            Cargando órdenes...
          </div>
        ) : (
          <Table
            headers={[
              "Orden",
              "Producto",
              "Cantidad",
              "Fecha límite",
              "Estado",
            ]}
            rows={rows}
            renderCell={(cell, j) =>
              j === 4 ? (
                <Badge
                  tone={
                    cell === "Completado"
                      ? "green"
                      : cell === "Pendiente"
                        ? "amber"
                        : cell === "En producción"
                          ? "blue"
                          : "red"
                  }
                >
                  {cell}
                </Badge>
              ) : (
                cell
              )
            }
          />
        )}
      </div>

      <CreateOrderModal
        open={orderModalOpen}
        onOpenChange={setOrderModalOpen}
        onCreate={handleCreateOrder}
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