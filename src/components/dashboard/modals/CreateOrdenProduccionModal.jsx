import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Trash2, Package, AlertCircle, Pencil } from "lucide-react";
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
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

const hoyISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const fechaSugeridaLimite = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const labelCls = "text-[10px] font-bold uppercase tracking-widest text-muted-ink";
const selectCls =
  "h-9 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[11px] text-ink-soft outline-none focus:border-[#214451]";

export default function CreateOrdenProduccionModal({
  open,
  onOpenChange,
  onCreated,
  usuarioActual,
  ordenEditar = null,
}) {
  const { token, user } = useAuth();
  const currentUser = usuarioActual || user;
  const esEdicion = Boolean(ordenEditar?.id_orden_produccion);
  const idOrdenEditar = ordenEditar?.id_orden_produccion;

  const [productos, setProductos] = useState([]);
  const [loadingProds, setLoadingProds] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // Formulario de agregar línea
  const [selectedProdId, setSelectedProdId] = useState("");
  const [cantidadInput, setCantidadInput] = useState("");
  const [fechaLimiteInput, setFechaLimiteInput] = useState(fechaSugeridaLimite());

  // Grilla dinámica de productos
  const [lineas, setLineas] = useState([]);
  const [saving, setSaving] = useState(false);

  // Cargar productos activos
  const cargarProductos = useCallback(async () => {
    if (!open) return;
    setLoadingProds(true);
    try {
      const resRpc = await supabase
        .schema("usuarios")
        .rpc("listar_productos_para_orden", { p_token: token ?? null });

      if (!resRpc.error && Array.isArray(resRpc.data)) {
        setProductos(resRpc.data);
      } else {
        // Fallback directo a produccion.producto
        const { data: directData, error: directError } = await supabase
          .schema("produccion")
          .from("producto")
          .select(`
            id_producto,
            codigo,
            nombre,
            id_material,
            id_unidad_medida,
            material:id_material (nombre),
            unidad:id_unidad_medida (codigo, nombre)
          `)
          .eq("estado", "A")
          .order("nombre", { ascending: true });

        if (directError) throw directError;

        setProductos(
          (directData || []).map((p) => ({
            id_producto: p.id_producto,
            codigo: p.codigo,
            nombre: p.nombre,
            id_material: p.id_material,
            material_nombre: p.material?.nombre || "—",
            id_unidad_medida: p.id_unidad_medida,
            unidad_codigo: p.unidad?.codigo || "",
            unidad_nombre: p.unidad?.nombre || "",
          }))
        );
      }
    } catch (err) {
      console.error("Error al cargar productos para la orden:", err);
      toast.error("No se pudieron cargar los productos disponibles");
    } finally {
      setLoadingProds(false);
    }
  }, [open, token]);

  // Cargar líneas actuales si estamos en modo edición
  const cargarLineasOrden = useCallback(async () => {
    if (!open || !idOrdenEditar) return;
    setLoadingDetalle(true);
    try {
      const resRpc = await supabase
        .schema("usuarios")
        .rpc("obtener_detalle_orden_produccion", {
          p_token: token ?? null,
          p_id_orden_produccion: idOrdenEditar,
        });

      if (!resRpc.error && Array.isArray(resRpc.data)) {
        setLineas(
          resRpc.data.map((d) => ({
            id_producto: d.id_producto,
            codigo: d.producto_codigo || "—",
            nombre: d.producto_nombre || "—",
            material_nombre: d.material_nombre || "—",
            unidad_codigo: d.unidad_codigo || "",
            cantidad_solicitada: Number(d.cantidad_solicitada || 0),
            fecha_limite: String(d.fecha_limite || "").slice(0, 10) || fechaSugeridaLimite(),
          }))
        );
      } else {
        const { data: directData, error: directError } = await supabase
          .schema("produccion")
          .from("detalle_orden_produccion")
          .select(`
            id_detalle_orden,
            id_producto,
            cantidad_solicitada,
            fecha_limite,
            producto:id_producto (
              codigo,
              nombre,
              material:id_material (nombre),
              unidad:id_unidad_medida (codigo)
            )
          `)
          .eq("id_orden_produccion", idOrdenEditar)
          .neq("estado", "E")
          .order("id_detalle_orden", { ascending: true });

        if (directError) throw directError;

        setLineas(
          (directData || []).map((d) => ({
            id_producto: d.id_producto,
            codigo: d.producto?.codigo || "—",
            nombre: d.producto?.nombre || "—",
            material_nombre: d.producto?.material?.nombre || "—",
            unidad_codigo: d.producto?.unidad?.codigo || "",
            cantidad_solicitada: Number(d.cantidad_solicitada || 0),
            fecha_limite: String(d.fecha_limite || "").slice(0, 10) || fechaSugeridaLimite(),
          }))
        );
      }
    } catch (err) {
      console.error("Error al cargar detalle para modificar orden:", err);
      toast.error("No se pudieron cargar los productos de la orden.");
    } finally {
      setLoadingDetalle(false);
    }
  }, [open, idOrdenEditar, token]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarProductos();
      setSelectedProdId("");
      setCantidadInput("");
      setFechaLimiteInput(fechaSugeridaLimite());

      if (idOrdenEditar) {
        cargarLineasOrden();
      } else {
        setLineas([]);
      }
    }
  }, [open, idOrdenEditar, cargarProductos, cargarLineasOrden]);

  // Productos no seleccionados aún en la grilla
  const productosDisponibles = useMemo(() => {
    const idsEnUso = new Set(lineas.map((l) => Number(l.id_producto)));
    return productos.filter((p) => !idsEnUso.has(Number(p.id_producto)));
  }, [productos, lineas]);

  const productoSeleccionado = useMemo(() => {
    return productos.find((p) => String(p.id_producto) === String(selectedProdId)) || null;
  }, [productos, selectedProdId]);

  const handleAgregarLinea = (e) => {
    e.preventDefault();
    if (!productoSeleccionado) {
      toast.error("Seleccioná un producto de la lista.");
      return;
    }
    const cant = Number(cantidadInput);
    if (!Number.isFinite(cant) || cant <= 0) {
      toast.error("La cantidad solicitada debe ser un número mayor a 0.");
      return;
    }
    if (!fechaLimiteInput) {
      toast.error("Seleccioná una fecha límite de fabricación.");
      return;
    }

    setLineas((prev) => [
      ...prev,
      {
        id_producto: productoSeleccionado.id_producto,
        codigo: productoSeleccionado.codigo,
        nombre: productoSeleccionado.nombre,
        material_nombre: productoSeleccionado.material_nombre,
        unidad_codigo: productoSeleccionado.unidad_codigo,
        cantidad_solicitada: cant,
        fecha_limite: fechaLimiteInput,
      },
    ]);

    setSelectedProdId("");
    setCantidadInput("");
  };

  const handleActualizarLinea = (idProd, campo, valor) => {
    setLineas((prev) =>
      prev.map((l) => (l.id_producto === idProd ? { ...l, [campo]: valor } : l))
    );
  };

  const handleQuitarLinea = (idProd) => {
    setLineas((prev) => prev.filter((l) => l.id_producto !== idProd));
  };

  const totalUnidades = useMemo(() => {
    return lineas.reduce((acc, l) => acc + Number(l.cantidad_solicitada || 0), 0);
  }, [lineas]);

  const handleGuardarOrden = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (lineas.length === 0) {
      toast.error("Debes incluir al menos un producto en la orden de producción.");
      return;
    }

    for (const l of lineas) {
      const c = Number(l.cantidad_solicitada);
      if (!Number.isFinite(c) || c <= 0) {
        toast.error(`La cantidad del producto ${l.nombre} debe ser mayor a 0.`);
        return;
      }
      if (!l.fecha_limite) {
        toast.error(`Debes indicar fecha límite para el producto ${l.nombre}.`);
        return;
      }
    }

    setSaving(true);
    try {
      const itemsPayload = lineas.map((l) => ({
        id_producto: l.id_producto,
        cantidad_solicitada: Number(l.cantidad_solicitada),
        fecha_limite: l.fecha_limite,
      }));

      if (esEdicion) {
        // MODO MODIFICAR ORDEN (si estado_op = 'P' o 'D')
        const resRpc = await supabase
          .schema("usuarios")
          .rpc("modificar_orden_produccion", {
            p_token: token,
            p_id_orden_produccion: ordenEditar.id_orden_produccion,
            p_items: itemsPayload,
          });

        if (resRpc.error) {
          console.warn(
            "RPC modificar_orden_produccion falló, intentando directo:",
            resRpc.error
          );

          const { error: updHeaderErr } = await supabase
            .schema("produccion")
            .from("orden_produccion")
            .update({
              usu_mod: currentUser?.usuario_login || "SISTEMA",
              fec_mod: new Date().toISOString(),
            })
            .eq("id_orden_produccion", ordenEditar.id_orden_produccion)
            .in("estado_op", ["P", "D"]);

          if (updHeaderErr) throw updHeaderErr;

          const { error: delDetErr } = await supabase
            .schema("produccion")
            .from("detalle_orden_produccion")
            .delete()
            .eq("id_orden_produccion", ordenEditar.id_orden_produccion);

          if (delDetErr) throw delDetErr;

          const nuevosDetalles = lineas.map((l) => ({
            id_orden_produccion: ordenEditar.id_orden_produccion,
            id_producto: l.id_producto,
            cantidad_solicitada: Number(l.cantidad_solicitada),
            cantidad_producida: 0,
            fecha_limite: l.fecha_limite,
            estado_detalle: "P",
            estado: "A",
            usu_alta: currentUser?.usuario_login || "SISTEMA",
            usu_mod: currentUser?.usuario_login || "SISTEMA",
            fec_mod: new Date().toISOString(),
          }));

          const { error: insDetErr } = await supabase
            .schema("produccion")
            .from("detalle_orden_produccion")
            .insert(nuevosDetalles);

          if (insDetErr) throw insDetErr;
        }

        toast.success(`Orden ${ordenEditar.nro_orden} modificada correctamente.`);
      } else {
        // MODO CREAR ORDEN
        const resRpc = await supabase.schema("usuarios").rpc("crear_orden_produccion", {
          p_token: token,
          p_id_solicitante: currentUser?.id_usuario || null,
          p_items: itemsPayload,
        });

        if (resRpc.error) {
          console.warn("RPC crear_orden_produccion falló, intentando directo:", resRpc.error);

          // 1. Cabecera
          const { data: headerData, error: headerError } = await supabase
            .schema("produccion")
            .from("orden_produccion")
            .insert({
              nro_orden: "",
              fecha_orden: new Date().toISOString(),
              id_solicitante: currentUser?.id_usuario,
              estado_op: "P",
              estado: "A",
              usu_alta: currentUser?.usuario_login || "SISTEMA",
            })
            .select("id_orden_produccion, nro_orden")
            .single();

          if (headerError) throw headerError;

          const newIdOrden = headerData.id_orden_produccion;

          // 2. Líneas
          const detalles = lineas.map((l) => ({
            id_orden_produccion: newIdOrden,
            id_producto: l.id_producto,
            cantidad_solicitada: Number(l.cantidad_solicitada),
            cantidad_producida: 0,
            fecha_limite: l.fecha_limite,
            estado_detalle: "P",
            estado: "A",
            usu_alta: currentUser?.usuario_login || "SISTEMA",
          }));

          const { error: detError } = await supabase
            .schema("produccion")
            .from("detalle_orden_produccion")
            .insert(detalles);

          if (detError) throw detError;
        }

        toast.success("Orden de producción generada correctamente.");
      }

      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      console.error("Error al guardar la orden de producción:", err);
      toast.error(err.message || "Ocurrió un error al guardar la orden.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!saving) onOpenChange(val);
      }}
    >
      <DialogContent className="max-w-2xl border border-[#e1e8ea] bg-white p-0 shadow-card">
        <DialogHeader className="border-b border-slate-soft bg-white px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#eaf2f5] text-[#145c73]">
              {esEdicion ? <Pencil size={17} /> : <Package size={18} />}
            </div>
            <div>
              <DialogTitle className="font-barlow text-[22px] font-normal text-ink">
                {esEdicion
                  ? `Modificar Orden ${ordenEditar?.nro_orden}`
                  : "Generar Orden de Producción"}
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-ink">
                {esEdicion
                  ? "Actualizá los productos, cantidades o fechas límite de la orden."
                  : "Definí la cabecera y agregá los productos con sus cantidades y fechas límite de fabricación."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleGuardarOrden}>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4">
            {/* Cabecera informativa */}
            <div className="rounded-lg border border-[#e1e8ea] bg-[#f8fafb] p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-[#82979e]">
                    Solicitante
                  </span>
                  <strong className="block text-[12px] text-[#214451]">
                    {esEdicion
                      ? ordenEditar?.solicitante_nombre ||
                        ordenEditar?.solicitante_login ||
                        "Usuario"
                      : currentUser?.nombre
                        ? `${currentUser.nombre} ${currentUser.apellido || ""}`.trim()
                        : currentUser?.usuario_login || "Usuario actual"}
                  </strong>
                  <span className="font-mono text-[10px] text-[#71858c]">
                    {esEdicion
                      ? ordenEditar?.solicitante_login
                      : currentUser?.usuario_login}
                  </span>
                </div>

                <div>
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-[#82979e]">
                    {esEdicion ? "N° de Orden" : "Fecha de la orden"}
                  </span>
                  <span className="font-mono text-[12px] font-semibold text-[#214451]">
                    {esEdicion
                      ? ordenEditar?.nro_orden
                      : new Date().toLocaleDateString("es-AR")}
                  </span>
                  <span className="block text-[10px] text-[#71858c]">
                    {esEdicion ? "En edición" : "Automático"}
                  </span>
                </div>

                <div>
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-[#82979e]">
                    Estado
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff2d8] px-2 py-0.5 text-[10px] font-bold text-[#a76e1a]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#a76e1a]" />
                    {esEdicion
                      ? ordenEditar?.estado_op === "D"
                        ? "Devuelta"
                        : "Pendiente"
                      : "Pendiente"}
                  </span>
                </div>
              </div>
            </div>

            {/* Agregar producto */}
            <div className="rounded-lg border border-[#dce6e9] bg-white p-3.5">
              <span className="mb-2.5 block text-[10px] font-bold uppercase tracking-wider text-[#145c73]">
                + Agregar producto a la orden
              </span>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 sm:items-end">
                <div className="sm:col-span-5 space-y-1">
                  <Label className={labelCls}>Producto *</Label>
                  <select
                    value={selectedProdId}
                    onChange={(e) => setSelectedProdId(e.target.value)}
                    className={selectCls}
                    disabled={loadingProds}
                  >
                    <option value="">
                      {loadingProds ? "Cargando productos..." : "Seleccionar producto..."}
                    </option>
                    {productosDisponibles.map((p) => (
                      <option key={p.id_producto} value={String(p.id_producto)}>
                        {p.codigo} · {p.nombre} {p.unidad_codigo ? `(${p.unidad_codigo})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <Label className={labelCls}>
                    Cantidad {productoSeleccionado?.unidad_codigo ? `(${productoSeleccionado.unidad_codigo})` : ""} *
                  </Label>
                  <Input
                    type="number"
                    min="0.001"
                    step="any"
                    value={cantidadInput}
                    onChange={(e) => setCantidadInput(e.target.value)}
                    placeholder="0.00"
                    className="h-9 border-[#dfe7e9] bg-white text-[12px]"
                  />
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <Label className={labelCls}>Fecha límite *</Label>
                  <Input
                    type="date"
                    min={hoyISO()}
                    value={fechaLimiteInput}
                    onChange={(e) => setFechaLimiteInput(e.target.value)}
                    className="h-9 border-[#dfe7e9] bg-white text-[12px]"
                  />
                </div>

                <div className="sm:col-span-1">
                  <Button
                    type="button"
                    onClick={handleAgregarLinea}
                    disabled={!selectedProdId || !cantidadInput}
                    className="h-9 w-full bg-[#145c73] p-0 text-white hover:bg-[#10485b]"
                    title="Agregar a la grilla"
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>
            </div>

            {/* Grilla dinámica de productos agregados */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className={labelCls}>
                  Productos solicitados ({lineas.length})
                </Label>
                {lineas.length > 0 && (
                  <span className="text-[11px] font-semibold text-[#145c73]">
                    Total unidades: {totalUnidades.toLocaleString("es-AR")}
                  </span>
                )}
              </div>

              {loadingDetalle ? (
                <p className="py-6 text-center text-[11px] text-[#91a0a4]">
                  Cargando productos de la orden...
                </p>
              ) : lineas.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#d2dee1] bg-[#fbfdfd] py-6 text-center">
                  <AlertCircle size={24} className="mb-1.5 text-[#91a0a4]" />
                  <p className="m-0 text-[12px] font-medium text-[#647c84]">
                    Todavía no agregaste productos a esta orden.
                  </p>
                  <span className="text-[10px] text-[#91a0a4]">
                    Seleccioná un producto arriba y presioná el botón «+».
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[#e1e8ea]">
                  <table className="w-full text-left">
                    <thead className="border-b border-[#e1e8ea] bg-[#f8fafb] text-[9.5px] font-bold uppercase tracking-wider text-[#82979e]">
                      <tr>
                        <th className="px-3 py-2">Código</th>
                        <th className="px-3 py-2">Producto</th>
                        <th className="px-3 py-2 text-right">Cantidad</th>
                        <th className="px-3 py-2">Unidad</th>
                        <th className="px-3 py-2">Fecha límite</th>
                        <th className="px-2 py-2 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf1f2] text-[11px]">
                      {lineas.map((linea) => (
                        <tr key={linea.id_producto} className="hover:bg-[#fbfcfc]">
                          <td className="px-3 py-2 font-mono font-semibold text-[#145c73]">
                            {linea.codigo}
                          </td>
                          <td className="px-3 py-2 font-medium text-[#214451]">
                            {linea.nombre}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={linea.cantidad_solicitada}
                              onChange={(e) =>
                                handleActualizarLinea(
                                  linea.id_producto,
                                  "cantidad_solicitada",
                                  e.target.value
                                )
                              }
                              className="h-7 w-24 rounded border border-[#dfe7e9] bg-white px-2 text-right font-mono text-[11px] font-bold text-[#173c4b] outline-none focus:border-[#145c73]"
                            />
                          </td>
                          <td className="px-3 py-2 text-[#657d85]">
                            {linea.unidad_codigo || "UN"}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-[#49656e]">
                            <input
                              type="date"
                              value={linea.fecha_limite}
                              onChange={(e) =>
                                handleActualizarLinea(
                                  linea.id_producto,
                                  "fecha_limite",
                                  e.target.value
                                )
                              }
                              className="h-7 rounded border border-[#dfe7e9] bg-white px-2 font-mono text-[11px] text-[#49656e] outline-none focus:border-[#145c73]"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleQuitarLinea(linea.id_producto)}
                              className="cursor-pointer rounded p-1 text-[#ba584d] hover:bg-[#fbe9e7]"
                              title="Quitar producto"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-slate-soft bg-white px-6 py-3.5">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
              className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || loadingDetalle || lineas.length === 0}
              className="h-9 cursor-pointer bg-green text-[11px] font-semibold text-white hover:bg-[#328160]"
            >
              {saving
                ? esEdicion
                  ? "Guardando cambios..."
                  : "Generando orden..."
                : esEdicion
                  ? "Guardar Cambios"
                  : "Generar Orden"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
