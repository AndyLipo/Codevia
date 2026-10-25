
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Clock3, MapPin, Plus } from "lucide-react";

import SectionTitle from "@/components/common/SectionTitle";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import IconBox from "@/components/common/IconBox";
import ActionButton from "@/components/common/ActionButton";
import CreateMovModal from "./modals/CreateMovModal";
import { supabase } from "@/lib/supabaseClient";

const formatoFecha = (fecha) => {
  if (!fecha) return "—";

  const [year, month, day] = fecha.slice(0, 10).split("-");
  return `${day} ${new Date(Number(year), Number(month) - 1, Number(day))
    .toLocaleString("es-AR", { month: "short" })
    .replace(".", "")} ${year}`;
};

const obtenerNivel = (fecha) => {
  if (!fecha) return "Normal";

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const vencimiento = new Date(`${fecha.slice(0, 10)}T00:00:00`);
  const dias = Math.ceil(
    (vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (dias < 0) return "Crítico";
  if (dias <= 30) return "Atención";

  return "Normal";
};

const diasHastaVencimiento = (fecha) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const vencimiento = new Date(`${fecha.slice(0, 10)}T00:00:00`);

  return Math.ceil(
    (vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
  );
};

export default function Warehouse({ fakeAction, usuarioActual }) {
  const [movModalOpen, setMovModalOpen] = useState(false);
  const [lotes, setLotes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargarDeposito = useCallback(async () => {
    setLoading(true);

    try {
      const [
        { data: lotesData, error: lotesError },
        { data: productosData, error: productosError },
        { data: materialesData, error: materialesError },
        { data: unidadesData, error: unidadesError },
      ] = await Promise.all([
        supabase
          .schema("produccion")
          .from("lote_producto")
          .select(
            "id_lote_producto, id_produccion, id_producto, nro_lote, fecha_fabricacion, fecha_vencimiento, cantidad_total, estado_lote, estado"
          )
          .eq("estado", "A")
          .order("id_lote_producto", { ascending: false }),

        supabase
          .schema("produccion")
          .from("producto")
          .select(
            "id_producto, codigo, nombre, id_material, id_unidad_medida, estado"
          )
          .eq("estado", "A"),

        supabase
          .schema("produccion")
          .from("material")
          .select("id_material, codigo, nombre")
          .eq("estado", "A"),

        supabase
          .schema("produccion")
          .from("unidad_medida")
          .select("id_unidad_medida, codigo, nombre")
          .eq("estado", "A"),
      ]);

      if (lotesError) throw lotesError;
      if (productosError) throw productosError;

      if (materialesError) {
        console.error("Error al cargar materiales:", materialesError.message);
      }

      if (unidadesError) {
        console.error("Error al cargar unidades:", unidadesError.message);
      }

      setLotes(lotesData || []);
      setProductos(productosData || []);
      setMateriales(materialesData || []);
      setUnidades(unidadesData || []);
    } catch (error) {
      console.error("Error al cargar el depósito:", error.message);
      fakeAction?.(`Error al cargar el depósito: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [fakeAction]);

  useEffect(() => {
    cargarDeposito();
  }, [cargarDeposito]);

  const buscarProducto = (idProducto) =>
    productos.find(
      (producto) => producto.id_producto === idProducto
    );

  const buscarMaterial = (idMaterial) =>
    materiales.find(
      (material) => material.id_material === idMaterial
    );

  const buscarUnidad = (idUnidad) =>
    unidades.find(
      (unidad) => unidad.id_unidad_medida === idUnidad
    );

  const stockRows = lotes.map((lote) => {
    const producto = buscarProducto(lote.id_producto);
    const material = producto
      ? buscarMaterial(producto.id_material)
      : null;
    const unidad = producto
      ? buscarUnidad(producto.id_unidad_medida)
      : null;

    return [
      lote.nro_lote || `Lote ${lote.id_lote_producto}`,
      material?.nombre || producto?.nombre || "—",
      "—",
      `${Number(lote.cantidad_total).toLocaleString("es-AR")} ${unidad?.codigo || ""
        }`.trim(),
      formatoFecha(lote.fecha_vencimiento),
      obtenerNivel(lote.fecha_vencimiento),
    ];
  });

  const lotesConVencimiento = lotes
    .filter((lote) => lote.fecha_vencimiento)
    .map((lote) => ({
      ...lote,
      diasRestantes: diasHastaVencimiento(lote.fecha_vencimiento),
      producto: buscarProducto(lote.id_producto),
    }))
    .filter((lote) => lote.diasRestantes <= 30)
    .sort((a, b) => a.diasRestantes - b.diasRestantes)
    .slice(0, 2);

  const handleMovModal = async (nuevoLote) => {
    await cargarDeposito();

    if (nuevoLote) {
      fakeAction?.(
        `Lote ${nuevoLote.nro_lote || ""} creado correctamente`.trim()
      );
    }
  };

  const totalLotes = lotes.length;

  const lotesCriticos = lotes.filter(
    (lote) => obtenerNivel(lote.fecha_vencimiento) === "Crítico"
  ).length;

  const lotesAtencion = lotes.filter(
    (lote) => obtenerNivel(lote.fecha_vencimiento) === "Atención"
  ).length;

  return (
    <>
      <SectionTitle
        eyebrow="03 · DEPÓSITO"
        title="Stock por sector"
        description="Ubicaciones físicas, mínimos operativos y vencimientos próximos."
        action={
          <ActionButton
            onClick={() => setMovModalOpen(true)}
            className="cursor-pointer"
          >
            <Plus size={17} /> Registrar movimiento
          </ActionButton>
        }
      />

      <div className="mb-3.5 grid grid-cols-[1.4fr_repeat(3,1fr)] gap-3 max-[760px]:grid-cols-1">
        <div className="rounded-lg border border-[#e1e8ea] bg-white p-4 shadow-card">
          <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
            LOTES REGISTRADOS
          </div>

          <strong className="font-barlow text-[42px] leading-none text-brand">
            {loading ? "—" : totalLotes}
          </strong>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-soft">
            <i
              className="block h-full rounded-full bg-brand"
              style={{
                width: `${totalLotes ? 100 : 0}%`,
              }}
            />
          </div>

          <small className="mt-2 block text-[9px] text-[#8b9a9f]">
            {loading
              ? "Cargando inventario..."
              : `${totalLotes} lotes activos en Supabase`}
          </small>
        </div>

        <div className="rounded-lg border border-[#e1e8ea] bg-white p-4 shadow-card">
          <span className="text-[9px] tracking-widest text-[#8c9ca0]">
            SECTOR A
          </span>
          <strong className="mt-2.5 block font-barlow text-[32px] text-[#214451]">
            82%
          </strong>
          <small className="mt-2 block text-[9px] text-[#8b9a9f]">
            Materia prima
          </small>
        </div>

        <div className="rounded-lg border border-[#e1e8ea] bg-white p-4 shadow-card">
          <span className="text-[9px] tracking-widest text-[#8c9ca0]">
            SECTOR B
          </span>
          <strong className="mt-2.5 block font-barlow text-[32px] text-amber">
            91%
          </strong>
          <small className="mt-2 block text-[9px] text-[#8b9a9f]">
            Biodegradables
          </small>
        </div>

        <div className="rounded-lg border border-[#e1e8ea] bg-white p-4 shadow-card">
          <span className="text-[9px] tracking-widest text-[#8c9ca0]">
            SECTOR C
          </span>
          <strong className="mt-2.5 block font-barlow text-[32px] text-[#214451]">
            48%
          </strong>
          <small className="mt-2 block text-[9px] text-[#8b9a9f]">
            Insumos
          </small>
        </div>
      </div>

      <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
        <div className="mb-4.5 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
              UBICACIONES Y ALERTAS
            </div>
            <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
              Inventario crítico
            </h3>
          </div>

          <ActionButton variant="secondary">
            <MapPin size={15} /> Mapa de sectores
          </ActionButton>
        </div>

        <Table
          headers={[
            "Código",
            "Material",
            "Ubicación física",
            "Stock",
            "Vencimiento",
            "Nivel",
          ]}
          rows={stockRows}
          renderCell={(cell, j) =>
            j === 5 ? (
              <Badge
                tone={
                  cell === "Crítico"
                    ? "red"
                    : cell === "Atención"
                      ? "amber"
                      : "green"
                }
              >
                {cell}
              </Badge>
            ) : j === 4 && cell !== "—" ? (
              <span
                className={
                  obtenerNivel(
                    lotes.find(
                      (lote) =>
                        formatoFecha(lote.fecha_vencimiento) === cell
                    )?.fecha_vencimiento
                  ) === "Crítico"
                    ? "font-bold text-red"
                    : ""
                }
              >
                {cell}
              </span>
            ) : (
              cell
            )
          }
        />

        {!loading && stockRows.length === 0 && (
          <p className="py-4 text-center text-[11px] text-[#91a0a4]">
            No hay lotes activos registrados.
          </p>
        )}
      </div>

      <div className="mt-3.5 grid grid-cols-[1.25fr_0.75fr] gap-3.5 max-[1100px]:grid-cols-1">
        <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
          <div className="mb-4.5 flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
                ALERTAS DE VENCIMIENTO
              </div>
              <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
                Acciones sugeridas
              </h3>
            </div>

            <AlertTriangle size={18} className="text-amber" />
          </div>

          {lotesConVencimiento.length > 0 ? (
            lotesConVencimiento.map((lote, index) => (
              <div
                key={lote.id_lote_producto}
                className={`flex items-center gap-2.5 py-2.75 ${index > 0 ? "border-t border-slate-soft" : ""
                  }`}
              >
                <IconBox
                  icon={index === 0 ? AlertTriangle : Clock3}
                  tone={index === 0 ? "amber" : "slate"}
                />

                <div className="flex-1">
                  <strong className="block text-[11px] text-[#49656e]">
                    {lote.nro_lote || `Lote ${lote.id_lote_producto}`} ·{" "}
                    {lote.diasRestantes < 0
                      ? `vencido hace ${Math.abs(lote.diasRestantes)} días`
                      : `vence en ${lote.diasRestantes} días`}
                  </strong>

                  <span className="mt-1 block text-[9px] text-[#91a0a4]">
                    {Number(lote.cantidad_total).toLocaleString("es-AR")}{" "}
                    {lote.producto?.nombre || "Producto"}
                  </span>
                </div>

                <button
                  className="rounded border border-[#e1e8ea] px-1.75 py-1.25 text-[9px] font-bold text-brand"
                  onClick={() =>
                    fakeAction?.(
                      `Prioridad aplicada al lote ${lote.nro_lote}`
                    )
                  }
                >
                  Priorizar
                </button>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-2.5 py-2.75">
              <IconBox icon={Clock3} tone="slate" />
              <div className="flex-1">
                <strong className="block text-[11px] text-[#49656e]">
                  {loading
                    ? "Consultando vencimientos..."
                    : "Sin vencimientos próximos"}
                </strong>
                <span className="mt-1 block text-[9px] text-[#91a0a4]">
                  {loading
                    ? "Cargando información del inventario"
                    : "No hay lotes vencidos o próximos a vencer"}
                </span>
              </div>
            </div>
          )}

          {!loading && (lotesCriticos > 0 || lotesAtencion > 0) && (
            <p className="mt-2 border-t border-slate-soft pt-3 text-[10px] text-[#82979e]">
              {lotesCriticos} vencidos · {lotesAtencion} próximos a vencer
            </p>
          )}
        </div>

        <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
          <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
            REFERENCIA DE UBICACIÓN
          </div>

          <h3 className="mb-0 mt-1 font-barlow text-[21px] text-[#214451]">
            Mapa operativo
          </h3>

          <div className="mt-3.5 grid grid-cols-2 gap-1.75">
            <span className="min-h-14 rounded-[5px] bg-[#4d8190] p-2.5 font-barlow text-[23px] text-white">
              A
              <small className="block font-sans text-[8px] text-white/80">
                82%
              </small>
            </span>

            <span className="min-h-14 rounded-[5px] bg-[#d49a43] p-2.5 font-barlow text-[23px] text-white">
              B
              <small className="block font-sans text-[8px] text-white/80">
                91%
              </small>
            </span>

            <span className="min-h-14 rounded-[5px] bg-[#8ba8ad] p-2.5 font-barlow text-[23px] text-white">
              C
              <small className="block font-sans text-[8px] text-white/80">
                48%
              </small>
            </span>

            <span className="min-h-14 rounded-[5px] bg-[#426876] p-2.5 font-barlow text-[23px] text-white">
              D
              <small className="block font-sans text-[8px] text-white/80">
                {lotesCriticos > 0 ? `${lotesCriticos} críticos` : "Exp."}
              </small>
            </span>
          </div>
        </div>
      </div>

      <CreateMovModal
        open={movModalOpen}
        onOpenChange={setMovModalOpen}
        onCreate={handleMovModal}
        usuarioActual={usuarioActual}
      />
    </>
  );
}
