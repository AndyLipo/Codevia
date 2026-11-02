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

const formInicial = {
  nombre: "",
  idTipo: "",
  idMaterial: "",
  idUnidad: "",
  esBiodegradable: "false",
  vidaUtil: "",
  estado: "A",
};

const labelCls =
  "text-[10px] font-bold uppercase tracking-widest text-muted-ink";
const selectCls =
  "h-9 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[11px] text-ink-soft outline-none focus:border-[#214451]";

export default function Productos({ fakeAction }) {
  const { token } = useAuth();

  const [productos, setProductos] = useState([]);
  const [catalogos, setCatalogos] = useState({
    tipos: [],
    materiales: [],
    unidades: [],
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formInicial);
  const [saving, setSaving] = useState(false);

  const [aEliminar, setAEliminar] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) {
      setProductos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [resProd, resCat] = await Promise.all([
        supabase
          .schema("usuarios")
          .rpc("listar_productos_catalogo", { p_token: token }),
        supabase
          .schema("usuarios")
          .rpc("listar_catalogos_producto", { p_token: token }),
      ]);

      if (resProd.error) {
        console.error("Error al cargar productos:", resProd.error);
        toast.error(resProd.error.message || "No se pudo cargar el listado");
        setProductos([]);
      } else {
        setProductos(resProd.data ?? []);
      }

      if (!resCat.error && resCat.data) {
        setCatalogos({
          tipos: resCat.data.tipos ?? [],
          materiales: resCat.data.materiales ?? [],
          unidades: resCat.data.unidades ?? [],
        });
      }
    } catch (err) {
      console.error("Error inesperado al cargar productos:", err);
      toast.error("Ocurrió un error al cargar los productos");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productos.filter((p) => {
      if (estadoFilter !== "ALL" && p.estado !== estadoFilter) return false;
      if (!q) return true;
      return [
        p.codigo,
        p.nombre,
        p.tipo_producto_nombre,
        p.material_nombre,
        p.unidad_codigo,
        p.unidad_nombre,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [productos, search, estadoFilter]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(formInicial);
    setModalOpen(true);
  };

  const abrirEditar = (p) => {
    setEditando(p);
    setForm({
      nombre: p.nombre ?? "",
      idTipo: String(p.id_tipo_producto ?? ""),
      idMaterial: String(p.id_material ?? ""),
      idUnidad: String(p.id_unidad_medida ?? ""),
      esBiodegradable: p.es_biodegradable ? "true" : "false",
      vidaUtil: p.vida_util_meses != null ? String(p.vida_util_meses) : "",
      estado: p.estado === "I" ? "I" : "A",
    });
    setModalOpen(true);
  };

  const esBio = form.esBiodegradable === "true";

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!form.nombre.trim()) {
      toast.error("Ingresá el nombre del producto.");
      return;
    }
    if (!form.idTipo || !form.idMaterial || !form.idUnidad) {
      toast.error("Seleccioná tipo de producto, material y unidad de medida.");
      return;
    }
    const vida = esBio ? Number(form.vidaUtil) : null;
    if (esBio && (!Number.isInteger(vida) || vida <= 0)) {
      toast.error(
        "Un producto biodegradable requiere una vida útil en meses (entero mayor a 0)."
      );
      return;
    }

    setSaving(true);
    try {
      const base = {
        p_token: token,
        p_nombre: form.nombre.trim(),
        p_id_tipo_producto: Number(form.idTipo),
        p_id_material: Number(form.idMaterial),
        p_id_unidad_medida: Number(form.idUnidad),
        p_es_biodegradable: esBio,
        p_vida_util_meses: vida,
      };

      const { error } = editando
        ? await supabase.schema("usuarios").rpc("modificar_producto_catalogo", {
            ...base,
            p_id_producto: editando.id_producto,
            p_estado: editando.estado === "E" ? null : form.estado,
          })
        : await supabase
            .schema("usuarios")
            .rpc("crear_producto_catalogo", base);

      if (error) {
        toast.error(error.message || "No se pudo guardar el producto");
        return;
      }

      toast.success(
        editando ? "Producto modificado correctamente" : "Producto creado correctamente"
      );
      fakeAction?.(editando ? "Producto modificado" : "Producto creado");
      setModalOpen(false);
      await cargar();
    } catch (err) {
      console.error("Error al guardar producto:", err);
      toast.error("Ocurrió un error al guardar el producto");
    } finally {
      setSaving(false);
    }
  };

  const cambiarEstado = async (p, estado) => {
    const { error } = await supabase
      .schema("usuarios")
      .rpc("cambiar_estado_producto_catalogo", {
        p_token: token,
        p_id_producto: p.id_producto,
        p_estado: estado,
      });

    if (error) {
      toast.error(error.message || "No se pudo actualizar el producto");
      return false;
    }
    return true;
  };

  const confirmarEliminar = async () => {
    if (!aEliminar || deleting) return;
    setDeleting(true);
    try {
      if (await cambiarEstado(aEliminar, "E")) {
        toast.success(`Producto ${aEliminar.codigo} eliminado`);
        setAEliminar(null);
        await cargar();
      }
    } finally {
      setDeleting(false);
    }
  };

  const reactivar = async (p) => {
    if (await cambiarEstado(p, "A")) {
      toast.success(`Producto ${p.codigo} reactivado`);
      await cargar();
    }
  };

  const rows = filtrados.map((p) => {
    const meta = ESTADO_META[p.estado] ?? { label: p.estado, tone: "slate" };
    return [
      <span key={`c-${p.id_producto}`} className="font-mono font-semibold text-[#145c73]">
        {p.codigo}
      </span>,
      <strong key={`n-${p.id_producto}`} className="font-medium text-[#214451]">
        {p.nombre}
      </strong>,
      p.tipo_producto_nombre || "—",
      p.material_nombre || "—",
      p.unidad_codigo ? `${p.unidad_codigo} · ${p.unidad_nombre ?? ""}` : "—",
      <Badge key={`b-${p.id_producto}`} tone={p.es_biodegradable ? "green" : "slate"}>
        {p.es_biodegradable ? "Sí" : "No"}
      </Badge>,
      p.vida_util_meses != null ? `${p.vida_util_meses} meses` : "—",
      <Badge key={`e-${p.id_producto}`} tone={meta.tone}>
        {meta.label}
      </Badge>,
      <div key={`a-${p.id_producto}`} className="flex items-center gap-1.5">
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
        eyebrow="10 · CATÁLOGO"
        title="Productos"
        description="Listado de productos creados. El ID y el código se generan automáticamente."
        action={
          <ActionButton onClick={abrirNuevo}>
            <Plus size={16} /> Nuevo producto
          </ActionButton>
        }
      />

      <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-[4fr_1fr]">
          <div className="relative min-w-0">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#82979e]"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, nombre, tipo, material o unidad..."
              className="h-9 w-full rounded-md border border-[#dfe7e9] bg-white pl-9 pr-3 text-[12px] text-[#173d4b] outline-none transition-colors focus:border-[#214451]"
            />
          </div>
          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className={`${selectCls} min-w-0`}
          >
            <option value="ALL">Todos los estados</option>
            <option value="A">Activos</option>
            <option value="I">Inactivos</option>
            <option value="E">Eliminados</option>
          </select>
        </div>

        <Table
          headers={[
            "Código",
            "Nombre",
            "Tipo",
            "Material",
            "Unidad",
            "Biodegradable",
            "Vida útil",
            "Estado",
            "Acciones",
          ]}
          rows={rows}
        />

        {loading ? (
          <p className="py-4 text-center text-[11px] text-[#91a0a4]">
            Cargando productos...
          </p>
        ) : (
          rows.length === 0 && (
            <p className="py-4 text-center text-[11px] text-[#91a0a4]">
              No hay productos para mostrar.
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
        <DialogContent className="max-w-140 border border-[#e1e8ea] bg-white p-0 shadow-card">
          <DialogHeader className="border-b border-slate-soft bg-white px-6 py-4">
            <DialogTitle className="font-barlow text-[22px] font-normal text-ink">
              {editando ? `Modificar producto ${editando.codigo}` : "Nuevo producto"}
            </DialogTitle>
            <DialogDescription className="text-[12px] text-muted-ink">
              {editando
                ? "Actualizá los datos del producto."
                : "El código se asigna automáticamente al guardar."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGuardar}>
            <div className="space-y-3.5 bg-white px-6 py-4">
              <div className="space-y-1">
                <Label className={labelCls}>Nombre *</Label>
                <Input
                  value={form.nombre}
                  maxLength={100}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Nombre del producto"
                  className="h-9 border-[#dfe7e9] bg-white text-[12px]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className={labelCls}>Tipo de producto *</Label>
                  <select
                    value={form.idTipo}
                    onChange={(e) => setForm((f) => ({ ...f, idTipo: e.target.value }))}
                    className={selectCls}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {catalogos.tipos.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className={labelCls}>Material *</Label>
                  <select
                    value={form.idMaterial}
                    onChange={(e) => setForm((f) => ({ ...f, idMaterial: e.target.value }))}
                    className={selectCls}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {catalogos.materiales.map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className={labelCls}>Unidad de medida *</Label>
                  <select
                    value={form.idUnidad}
                    onChange={(e) => setForm((f) => ({ ...f, idUnidad: e.target.value }))}
                    className={selectCls}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {catalogos.unidades.map((u) => (
                      <option key={u.id} value={String(u.id)}>
                        {u.codigo} · {u.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className={labelCls}>Biodegradable *</Label>
                  <select
                    value={form.esBiodegradable}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        esBiodegradable: e.target.value,
                        vidaUtil: e.target.value === "true" ? f.vidaUtil : "",
                      }))
                    }
                    className={selectCls}
                  >
                    <option value="false">No</option>
                    <option value="true">Sí</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className={labelCls}>
                    Vida útil (meses){esBio ? " *" : ""}
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={form.vidaUtil}
                    disabled={!esBio}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, vidaUtil: e.target.value.replace(/\D/g, "") }))
                    }
                    placeholder={esBio ? "Ej: 12" : "No aplica"}
                    className="h-9 border-[#dfe7e9] bg-white text-[12px] disabled:bg-[#f4f7f8]"
                  />
                </div>

                {editando && editando.estado !== "E" && (
                  <div className="space-y-1">
                    <Label className={labelCls}>Estado</Label>
                    <select
                      value={form.estado}
                      onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
                      className={selectCls}
                    >
                      <option value="A">Activo</option>
                      <option value="I">Inactivo</option>
                    </select>
                  </div>
                )}
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
                {saving ? "Guardando..." : editando ? "Guardar cambios" : "Crear producto"}
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
              Eliminar producto
            </DialogTitle>
            <DialogDescription className="text-[12px] text-muted-ink">
              ¿Confirmás eliminar <strong>{aEliminar?.codigo}</strong> ·{" "}
              {aEliminar?.nombre}? No se podrá eliminar si tiene lotes con stock
              o pedidos en curso.
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
