import { useCallback, useEffect, useMemo, useState } from "react";
import { FileEdit, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import SectionTitle from "@/components/common/SectionTitle";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import ActionButton from "@/components/common/ActionButton";
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
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

const ESTADO_META = {
  A: { label: "Activo", tone: "green" },
  I: { label: "Inactivo", tone: "slate" },
  E: { label: "Eliminado", tone: "red" },
};

const MONEDAS_SUGERIDAS = ["ARS", "USD", "EUR", "BRL", "UYU", "CLP", "PYG", "BOB"];

const hoyISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formInicial = () => ({
  idProducto: "",
  precio: "",
  moneda: "ARS",
  fechaDesde: hoyISO(),
  fechaHasta: "",
});

const formatFecha = (f) => {
  if (!f) return "—";
  const [y, m, d] = String(f).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

const formatPrecio = (valor, moneda) =>
  `${Number(valor ?? 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${moneda ?? ""}`.trim();

const labelCls =
  "text-[10px] font-bold uppercase tracking-widest text-muted-ink";
const selectCls =
  "h-9 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[11px] text-ink-soft outline-none focus:border-[#214451]";

export default function ListaPrecios({ fakeAction }) {
  const { token } = useAuth();

  const [precios, setPrecios] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("ALL");
  const [monedaFilter, setMonedaFilter] = useState("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formInicial());
  const [saving, setSaving] = useState(false);

  const [aEliminar, setAEliminar] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) {
      setPrecios([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [resPrecios, resProd] = await Promise.all([
        supabase
          .schema("usuarios")
          .rpc("listar_precios_producto", { p_token: token }),
        supabase
          .schema("usuarios")
          .rpc("listar_productos_para_precio", { p_token: token }),
      ]);

      if (resPrecios.error) {
        console.error("Error al cargar lista de precios:", resPrecios.error);
        toast.error(resPrecios.error.message || "No se pudo cargar la lista de precios");
        setPrecios([]);
      } else {
        setPrecios(resPrecios.data ?? []);
      }

      setProductos(resProd.error ? [] : resProd.data ?? []);
    } catch (err) {
      console.error("Error inesperado al cargar precios:", err);
      toast.error("Ocurrió un error al cargar la lista de precios");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const monedasExistentes = useMemo(
    () =>
      Array.from(new Set(precios.map((p) => p.moneda).filter(Boolean))).sort(),
    [precios]
  );

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return precios.filter((p) => {
      if (estadoFilter === "VIGENTE") {
        if (!p.vigente) return false;
      } else if (estadoFilter !== "ALL" && p.estado !== estadoFilter) {
        return false;
      }
      if (monedaFilter !== "ALL" && p.moneda !== monedaFilter) return false;
      if (!q) return true;
      return [p.producto_codigo, p.producto_nombre, p.moneda]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [precios, search, estadoFilter, monedaFilter]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(formInicial());
    setModalOpen(true);
  };

  const abrirEditar = (p) => {
    setEditando(p);
    setForm({
      idProducto: String(p.id_producto),
      precio: String(p.precio_unitario ?? ""),
      moneda: p.moneda ?? "ARS",
      fechaDesde: String(p.fecha_desde ?? "").slice(0, 10),
      fechaHasta: p.fecha_hasta ? String(p.fecha_hasta).slice(0, 10) : "",
    });
    setModalOpen(true);
  };

  // En edición se conserva el producto aunque ya no esté activo
  const opcionesProducto = useMemo(() => {
    if (
      editando &&
      !productos.some((p) => p.id_producto === editando.id_producto)
    ) {
      return [
        ...productos,
        {
          id_producto: editando.id_producto,
          codigo: editando.producto_codigo,
          nombre: editando.producto_nombre,
        },
      ];
    }
    return productos;
  }, [productos, editando]);

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (saving) return;

    const precio = Number(form.precio);
    const moneda = form.moneda.trim().toUpperCase();

    if (!form.idProducto) {
      toast.error("Seleccioná un producto.");
      return;
    }
    if (!Number.isFinite(precio) || precio <= 0) {
      toast.error("El precio unitario debe ser mayor a 0.");
      return;
    }
    if (!/^[A-Z]{3}$/.test(moneda)) {
      toast.error("La moneda debe tener exactamente 3 letras (ej: ARS, USD).");
      return;
    }
    if (!form.fechaDesde) {
      toast.error("Seleccioná la fecha desde.");
      return;
    }
    if (form.fechaHasta && form.fechaHasta < form.fechaDesde) {
      toast.error("La fecha hasta no puede ser anterior a la fecha desde.");
      return;
    }

    setSaving(true);
    try {
      const base = {
        p_token: token,
        p_id_producto: Number(form.idProducto),
        p_precio_unitario: precio,
        p_moneda: moneda,
        p_fecha_desde: form.fechaDesde,
        p_fecha_hasta: form.fechaHasta || null,
      };

      const { error } = editando
        ? await supabase.schema("usuarios").rpc("modificar_precio_producto", {
            ...base,
            p_id_precio_producto: editando.id_precio_producto,
          })
        : await supabase.schema("usuarios").rpc("crear_precio_producto", base);

      if (error) {
        toast.error(error.message || "No se pudo guardar el precio");
        return;
      }

      toast.success(editando ? "Precio modificado correctamente" : "Precio creado correctamente");
      fakeAction?.(editando ? "Precio modificado" : "Precio creado");
      setModalOpen(false);
      await cargar();
    } catch (err) {
      console.error("Error al guardar precio:", err);
      toast.error("Ocurrió un error al guardar el precio");
    } finally {
      setSaving(false);
    }
  };

  const cambiarEstado = async (p, estado) => {
    const { error } = await supabase
      .schema("usuarios")
      .rpc("cambiar_estado_precio_producto", {
        p_token: token,
        p_id_precio_producto: p.id_precio_producto,
        p_estado: estado,
      });

    if (error) {
      toast.error(error.message || "No se pudo actualizar el precio");
      return false;
    }
    return true;
  };

  const confirmarEliminar = async () => {
    if (!aEliminar || deleting) return;
    setDeleting(true);
    try {
      if (await cambiarEstado(aEliminar, "E")) {
        toast.success("Valor de precio eliminado");
        setAEliminar(null);
        await cargar();
      }
    } finally {
      setDeleting(false);
    }
  };

  const reactivar = async (p) => {
    if (await cambiarEstado(p, "A")) {
      toast.success("Valor de precio reactivado");
      await cargar();
    }
  };

  const rows = filtrados.map((p) => {
    const meta = ESTADO_META[p.estado] ?? { label: p.estado, tone: "slate" };
    const id = p.id_precio_producto;
    return [
      <span key={`i-${id}`} className="font-mono text-[#145c73]">
        #{id}
      </span>,
      <div key={`p-${id}`}>
        <strong className="block font-medium text-[#214451]">
          {p.producto_nombre}
        </strong>
        <span className="font-mono text-[10px] text-[#7c9097]">
          {p.producto_codigo}
        </span>
      </div>,
      <span key={`pr-${id}`} className="font-mono font-semibold text-[#173c4b]">
        {formatPrecio(p.precio_unitario, p.moneda)}
        {p.unidad_codigo ? (
          <span className="font-normal text-[#7c9097]"> / {p.unidad_codigo}</span>
        ) : null}
      </span>,
      <span key={`d-${id}`} className="font-mono">{formatFecha(p.fecha_desde)}</span>,
      <span key={`h-${id}`} className="font-mono">
        {p.fecha_hasta ? formatFecha(p.fecha_hasta) : "Sin fin"}
      </span>,
      p.vigente ? (
        <Badge key={`v-${id}`} tone="blue">Vigente</Badge>
      ) : (
        <span key={`v-${id}`} className="text-[#9aa8ad]">—</span>
      ),
      <Badge key={`e-${id}`} tone={meta.tone}>{meta.label}</Badge>,
      <div key={`a-${id}`} className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => abrirEditar(p)}
          className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#dce5e8] bg-white px-2 py-1 text-[10px] font-semibold text-[#214451] hover:bg-[#f4f7f8]"
        >
          <FileEdit size={11} /> Modificar
        </button>
        {p.estado !== "E" ? (
          <button
            type="button"
            onClick={() => setAEliminar(p)}
            className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#f1cfcb] bg-[#fbe9e7] px-2 py-1 text-[10px] font-semibold text-[#ba584d] hover:bg-[#f5d5d1]"
          >
            <Trash2 size={11} /> Eliminar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => reactivar(p)}
            className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#cce8da] bg-[#e7f4ed] px-2 py-1 text-[10px] font-semibold text-[#256349] hover:bg-[#d5ece0]"
          >
            <RotateCcw size={11} /> Reactivar
          </button>
        )}
      </div>,
    ];
  });

  return (
    <>
      <SectionTitle
        eyebrow="11 · CATÁLOGO"
        title="Lista de precios"
        description="Precios de venta por producto, moneda y período de vigencia."
        action={
          <ActionButton onClick={abrirNuevo}>
            <Plus size={16} /> Nuevo valor
          </ActionButton>
        }
      />

      <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-[8fr_1fr_1fr]">
          <div className="relative min-w-0 sm:col-span-2 md:col-span-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#82979e]"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código o nombre de producto..."
              className="h-9 w-full rounded-md border border-[#dfe7e9] bg-white pl-9 pr-3 text-[12px] text-[#173d4b] outline-none transition-colors focus:border-[#214451]"
            />
          </div>
          <select
            value={monedaFilter}
            onChange={(e) => setMonedaFilter(e.target.value)}
            className={`${selectCls} min-w-0 truncate`}
          >
            <option value="ALL">Todas las monedas</option>
            {monedasExistentes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className={`${selectCls} min-w-0 truncate`}
          >
            <option value="ALL">Todos los estados</option>
            <option value="VIGENTE">Solo vigentes</option>
            <option value="A">Activos</option>
            <option value="I">Inactivos</option>
            <option value="E">Eliminados</option>
          </select>
        </div>

        <Table
          headers={[
            "ID",
            "Producto",
            "Precio unitario",
            "Desde",
            "Hasta",
            "Vigencia",
            "Estado",
            "Acciones",
          ]}
          rows={rows}
        />

        {loading ? (
          <p className="py-4 text-center text-[11px] text-[#91a0a4]">
            Cargando lista de precios...
          </p>
        ) : (
          rows.length === 0 && (
            <p className="py-4 text-center text-[11px] text-[#91a0a4]">
              No hay precios para mostrar.
            </p>
          )
        )}
      </div>

      {/* Alta / modificación */}
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!saving) setModalOpen(open);
        }}
      >
        <DialogContent className="max-w-130 border border-[#e1e8ea] bg-white p-0 shadow-card">
          <DialogHeader className="border-b border-slate-soft bg-white px-6 py-4">
            <DialogTitle className="font-barlow text-[22px] font-normal text-ink">
              {editando ? `Modificar valor #${editando.id_precio_producto}` : "Nuevo valor de precio"}
            </DialogTitle>
            <DialogDescription className="text-[12px] text-muted-ink">
              Los pedidos ya generados conservan el precio aplicado en su momento.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGuardar}>
            <div className="space-y-3.5 bg-white px-6 py-4">
              <div className="space-y-1">
                <Label className={labelCls}>Producto *</Label>
                <select
                  value={form.idProducto}
                  onChange={(e) => setForm((f) => ({ ...f, idProducto: e.target.value }))}
                  className={selectCls}
                  required
                >
                  <option value="">Seleccionar producto...</option>
                  {opcionesProducto.map((p) => (
                    <option key={p.id_producto} value={String(p.id_producto)}>
                      {p.codigo} · {p.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className={labelCls}>Precio unitario *</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.precio}
                    onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
                    placeholder="0,00"
                    className="h-9 border-[#dfe7e9] bg-white text-[12px]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className={labelCls}>Moneda (3 letras) *</Label>
                  <Input
                    list="monedas-sugeridas"
                    maxLength={3}
                    value={form.moneda}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        moneda: e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase(),
                      }))
                    }
                    placeholder="ARS"
                    className="h-9 border-[#dfe7e9] bg-white text-[12px] font-bold uppercase"
                    required
                  />
                  <datalist id="monedas-sugeridas">
                    {Array.from(new Set([...MONEDAS_SUGERIDAS, ...monedasExistentes])).map(
                      (m) => (
                        <option key={m} value={m} />
                      )
                    )}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className={labelCls}>Fecha desde *</Label>
                  <Input
                    type="date"
                    value={form.fechaDesde}
                    onChange={(e) => setForm((f) => ({ ...f, fechaDesde: e.target.value }))}
                    className="h-9 border-[#dfe7e9] bg-white text-[12px]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className={labelCls}>Fecha hasta (opcional)</Label>
                  <Input
                    type="date"
                    min={form.fechaDesde || undefined}
                    value={form.fechaHasta}
                    onChange={(e) => setForm((f) => ({ ...f, fechaHasta: e.target.value }))}
                    className="h-9 border-[#dfe7e9] bg-white text-[12px]"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-slate-soft bg-white px-6 py-3.5">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="h-9 bg-green text-[11px] font-semibold text-white hover:bg-[#328160]"
              >
                {saving ? "Guardando..." : editando ? "Guardar cambios" : "Crear valor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmación de eliminación */}
      <Dialog
        open={Boolean(aEliminar)}
        onOpenChange={(open) => {
          if (!deleting && !open) setAEliminar(null);
        }}
      >
        <DialogContent className="max-w-110 border border-[#e1e8ea] bg-white p-0 shadow-card">
          <DialogHeader className="border-b border-slate-soft bg-white px-6 py-4">
            <DialogTitle className="font-barlow text-[22px] font-normal text-ink">
              Eliminar valor de precio
            </DialogTitle>
            <DialogDescription className="text-[12px] text-muted-ink">
              ¿Confirmás eliminar el precio de <strong>{aEliminar?.producto_nombre}</strong>{" "}
              ({aEliminar ? formatPrecio(aEliminar.precio_unitario, aEliminar.moneda) : ""})?
              Dejará de tenerse en cuenta para nuevos pedidos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t border-slate-soft bg-white px-6 py-3.5">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setAEliminar(null)}
              className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={deleting}
              onClick={confirmarEliminar}
              className="h-9 bg-[#ba584d] text-[11px] font-semibold text-white hover:bg-[#9f463c]"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
