import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Search,
  RefreshCcw,
  FileEdit,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Badge from "@/components/common/Badge";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

const ESTADO_META = {
  A: { label: "Activo", tone: "green" },
  I: { label: "Inactivo", tone: "amber" },
  E: { label: "Eliminado", tone: "red" },
};

const PAGE_SIZE = 10;

const initialForm = {
  codigo: "",
  nombre: "",
  descripcion: "",
  estado: "A",
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function CatalogoParametroManager({
  eyebrow,
  title,
  description,
  panelEyebrow,
  panelTitle,
  newButtonLabel,
  singularLabel,
  pluralLabel,
  codePlaceholder = "Ej: UNI",
  namePlaceholder = "Ej: Unidad",
  descPlaceholder = "Descripción opcional...",
  tableName,
  idColumn,
  rpcList,
  rpcCreate,
  rpcUpdate,
  rpcDelete,
  fakeAction,
  Icon = Layers,
}) {
  const { token, user } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("ALL"); // "ALL" | "A" | "I" | "E"
  const [currentPage, setCurrentPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .schema("usuarios")
        .rpc(rpcList, { p_token: token });

      if (!error && Array.isArray(data)) {
        setItems(data);
        return;
      }

      // Fallback directo a produccion.<tableName>
      const { data: fbData, error: fbErr } = await supabase
        .schema("produccion")
        .from(tableName)
        .select("*")
        .order(idColumn, { ascending: true });

      if (fbErr) {
        console.error(`Error al cargar ${pluralLabel}:`, error || fbErr);
        toast.error(
          (error || fbErr)?.message ||
            `No se pudo cargar el listado de ${pluralLabel}`
        );
        setItems([]);
        return;
      }

      setItems(
        (Array.isArray(fbData) ? fbData : []).map((row) => ({
          ...row,
          estado: String(row.estado || "A").trim(),
        }))
      );
    } catch (err) {
      console.error(`Error inesperado al listar ${pluralLabel}:`, err);
      toast.error(`Ocurrió un error al cargar ${pluralLabel}`);
    } finally {
      setLoading(false);
    }
  }, [token, rpcList, tableName, idColumn, pluralLabel]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchItems();
  }, [fetchItems]);

  const metrics = useMemo(() => {
    const total = items.length;
    const activos = items.filter(
      (i) => String(i.estado || "").trim() === "A"
    ).length;
    const inactivos = items.filter(
      (i) => String(i.estado || "").trim() === "I"
    ).length;
    const eliminados = items.filter(
      (i) => String(i.estado || "").trim() === "E"
    ).length;

    return { total, activos, inactivos, eliminados };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return items
      .filter((row) => {
        const est = String(row.estado || "A").trim();
        if (estadoFilter !== "ALL" && est !== estadoFilter) {
          return false;
        }

        if (!q) return true;

        const estadoInfo = ESTADO_META[est] ?? ESTADO_META.I;
        return [
          row[idColumn],
          row.codigo,
          row.nombre,
          row.descripcion,
          row.usu_alta,
          row.usu_mod,
          estadoInfo.label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const orderEst = { A: 0, I: 1, E: 2 };
        const aE = orderEst[String(a.estado || "A").trim()] ?? 1;
        const bE = orderEst[String(b.estado || "A").trim()] ?? 1;
        if (aE !== bE) return aE - bE;
        return Number(a[idColumn] ?? 0) - Number(b[idColumn] ?? 0);
      });
  }, [items, searchTerm, estadoFilter, idColumn]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [searchTerm, estadoFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, currentPage]);

  const handleOpenNew = () => {
    setEditingItem(null);
    setForm({ ...initialForm });
    setModalOpen(true);
  };

  const handleOpenEdit = (row) => {
    setEditingItem(row);
    setForm({
      codigo: row.codigo || "",
      nombre: row.nombre || "",
      descripcion: row.descripcion || "",
      estado: String(row.estado || "A").trim() === "I" ? "I" : "A",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token || saving) return;

    const codigoNorm = form.codigo.trim().toUpperCase();
    const nombreNorm = form.nombre.trim();
    const descNorm = form.descripcion.trim();
    const estadoNorm = String(form.estado || "A")
      .trim()
      .toUpperCase();

    if (!codigoNorm) {
      toast.error(`El código de ${singularLabel} es obligatorio.`);
      return;
    }
    if (codigoNorm.length > 20) {
      toast.error("El código no puede superar los 20 caracteres.");
      return;
    }
    if (!nombreNorm) {
      toast.error(`El nombre de ${singularLabel} es obligatorio.`);
      return;
    }
    if (nombreNorm.length > 100) {
      toast.error("El nombre no puede superar los 100 caracteres.");
      return;
    }
    if (descNorm.length > 255) {
      toast.error("La descripción no puede superar los 255 caracteres.");
      return;
    }

    setSaving(true);
    try {
      const usuLogin = String(user?.usuario_login || "sistema").slice(0, 20);

      if (editingItem) {
        const itemId = editingItem[idColumn];
        const { error } = await supabase.schema("usuarios").rpc(rpcUpdate, {
          p_token: token,
          [`p_${idColumn}`]: itemId,
          p_codigo: codigoNorm,
          p_nombre: nombreNorm,
          p_descripcion: descNorm || null,
          p_estado: estadoNorm,
        });

        if (error) {
          const { error: fbErr } = await supabase
            .schema("produccion")
            .from(tableName)
            .update({
              codigo: codigoNorm,
              nombre: nombreNorm,
              descripcion: descNorm || null,
              estado: estadoNorm,
              usu_mod: usuLogin,
              fec_mod: new Date().toISOString(),
            })
            .eq(idColumn, itemId);

          if (fbErr) {
            toast.error(
              error.message ||
                fbErr.message ||
                `No se pudo actualizar ${singularLabel}`
            );
            return;
          }
        }

        toast.success(`${codigoNorm} · ${nombreNorm} actualizado correctamente`);
        fakeAction?.(`${singularLabel} actualizado`);
      } else {
        const { error } = await supabase.schema("usuarios").rpc(rpcCreate, {
          p_token: token,
          p_codigo: codigoNorm,
          p_nombre: nombreNorm,
          p_descripcion: descNorm || null,
          p_estado: estadoNorm,
        });

        if (error) {
          // Fallback: INSERT INTO produccion.<tableName> (codigo, nombre, descripcion, estado, usu_alta) VALUES (...)
          const { error: fbErr } = await supabase
            .schema("produccion")
            .from(tableName)
            .insert({
              codigo: codigoNorm,
              nombre: nombreNorm,
              descripcion: descNorm || null,
              estado: estadoNorm,
              usu_alta: usuLogin,
            });

          if (fbErr) {
            toast.error(
              error.message ||
                fbErr.message ||
                `No se pudo registrar ${singularLabel}`
            );
            return;
          }
        }

        toast.success(`${codigoNorm} · ${nombreNorm} registrado correctamente`);
        fakeAction?.(`${singularLabel} registrado`);
      }

      setModalOpen(false);
      setEditingItem(null);
      await fetchItems();
    } catch (err) {
      console.error(`Error al guardar ${singularLabel}:`, err);
      toast.error(`Ocurrió un error al guardar ${singularLabel}`);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!token || !deleteTarget || deleting) return;

    const itemId = deleteTarget[idColumn];
    setDeleting(true);
    try {
      const { error } = await supabase.schema("usuarios").rpc(rpcDelete, {
        p_token: token,
        [`p_${idColumn}`]: itemId,
      });

      if (error) {
        const usuLogin = String(user?.usuario_login || "sistema").slice(0, 20);
        const { error: fbErr } = await supabase
          .schema("produccion")
          .from(tableName)
          .update({
            estado: "E",
            usu_mod: usuLogin,
            fec_mod: new Date().toISOString(),
          })
          .eq(idColumn, itemId);

        if (fbErr) {
          toast.error(
            error.message ||
              fbErr.message ||
              `No se pudo eliminar ${singularLabel}`
          );
          return;
        }
      }

      toast.success(
        `${deleteTarget.codigo} · ${deleteTarget.nombre} eliminado (estado E)`
      );
      setDeleteTarget(null);
      await fetchItems();
    } catch (err) {
      console.error(`Error al eliminar ${singularLabel}:`, err);
      toast.error(`Ocurrió un error al eliminar ${singularLabel}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleReactivar = async (row) => {
    if (!token) return;
    const itemId = row[idColumn];
    const usuLogin = String(user?.usuario_login || "sistema").slice(0, 20);

    try {
      const { error } = await supabase.schema("usuarios").rpc(rpcUpdate, {
        p_token: token,
        [`p_${idColumn}`]: itemId,
        p_codigo: row.codigo,
        p_nombre: row.nombre,
        p_descripcion: row.descripcion || null,
        p_estado: "A",
      });

      if (error) {
        const { error: fbErr } = await supabase
          .schema("produccion")
          .from(tableName)
          .update({
            estado: "A",
            usu_mod: usuLogin,
            fec_mod: new Date().toISOString(),
          })
          .eq(idColumn, itemId);

        if (fbErr) {
          toast.error(
            error.message ||
              fbErr.message ||
              `No se pudo reactivar ${singularLabel}`
          );
          return;
        }
      }

      toast.success(`${row.codigo} · ${row.nombre} reactivado (estado A)`);
      await fetchItems();
    } catch (err) {
      console.error(`Error al reactivar ${singularLabel}:`, err);
      toast.error(`Ocurrió un error al reactivar ${singularLabel}`);
    }
  };

  return (
    <div>
      {/* CABECERA COMPACTA + 4 CUADROS PEQUEÑOS A LA DERECHA */}
      <div className="mb-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5e6f77]">
            {eyebrow}
          </div>
          <h2 className="m-0 font-barlow text-[24px] leading-tight tracking-[0.01em] text-[#163946]">
            {title}
          </h2>
          <p className="mt-0.5 text-[12px] text-[#6b7d85]">{description}</p>
        </div>

        {/* 4 KPIs */}
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="min-w-31.25 rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Total
              </span>
              <Badge tone="blue">Padrón</Badge>
            </div>
            <div className="mt-0.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metrics.total}
              </span>
            </div>
          </div>

          <div className="min-w-31.25 rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Activos (A)
              </span>
              <Badge tone="green">Habilitados</Badge>
            </div>
            <div className="mt-0.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metrics.activos}
              </span>
            </div>
          </div>

          <div className="min-w-31.25 rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Inactivos (I)
              </span>
              <Badge tone="amber">Pausados</Badge>
            </div>
            <div className="mt-0.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metrics.inactivos}
              </span>
            </div>
          </div>

          <div className="min-w-31.25 rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Eliminados (E)
              </span>
              <Badge tone="red">Baja lógica</Badge>
            </div>
            <div className="mt-0.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metrics.eliminados}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL PRINCIPAL */}
      <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
          <div>
            <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
              {panelEyebrow}
            </div>
            <h3 className="m-0 font-barlow text-[22px] text-[#173d4b]">
              {panelTitle}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={fetchItems}
              className="h-9 border-[#d5e1e5] px-3 text-[11px] text-[#214451]"
            >
              <RefreshCcw size={13} className="mr-1.5" />
              Actualizar
            </Button>

            <Button
              type="button"
              onClick={handleOpenNew}
              className="h-9 bg-brand px-3.5 text-[11px] font-semibold text-white hover:bg-[#114c5f]"
            >
              <Plus size={14} className="mr-1.5" />
              {newButtonLabel}
            </Button>
          </div>
        </div>

        {/* Barra de búsqueda y filtro de estado */}
        <div className="mb-3.5 flex flex-wrap items-center gap-2 md:flex-nowrap">
          <div className="relative min-w-50 flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#82979e]"
            />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Buscar por código, nombre, descripción o usuario...`}
              className="h-9 w-full rounded-md border border-[#d8e2e5] bg-[#f8fafb] pl-8 pr-3 text-[12px] text-[#173d4b] outline-none transition-colors focus:border-brand focus:bg-white"
            />
          </div>

          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="h-9 w-48 shrink-0 rounded-md border border-[#d8e2e5] bg-white px-2.5 text-[12px] text-[#173d4b] outline-none focus:border-brand"
          >
            <option value="ALL">Estado: Todos (A / I / E)</option>
            <option value="A">A · Activo</option>
            <option value="I">I · Inactivo</option>
            <option value="E">E · Eliminado</option>
          </select>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearchTerm("");
              setEstadoFilter("ALL");
            }}
            className="h-9 shrink-0 border-[#d8e2e5] px-3 text-[11px] text-[#5e6f77]"
          >
            Limpiar
          </Button>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto rounded-lg border border-[#e3eaec]">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#e3eaec] bg-[#f4f8f9] text-[10px] font-bold uppercase tracking-widest text-[#697e86]">
                <th className="whitespace-nowrap px-3 py-2.5">ID</th>
                <th className="whitespace-nowrap px-3 py-2.5">Código</th>
                <th className="whitespace-nowrap px-3 py-2.5">Nombre</th>
                <th className="whitespace-nowrap px-3 py-2.5">Descripción</th>
                <th className="whitespace-nowrap px-3 py-2.5">Estado</th>
                <th className="whitespace-nowrap px-3 py-2.5">Auditoría</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2f4]">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-[12px] text-[#758990]"
                  >
                    Cargando registros de {pluralLabel}...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-[12px] text-[#758990]"
                  >
                    No se encontraron registros que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((row) => {
                  const rowId = row[idColumn];
                  const est = String(row.estado || "A").trim();
                  const estMeta = ESTADO_META[est] ?? {
                    label: est,
                    tone: "slate",
                  };

                  return (
                    <tr
                      key={rowId}
                      className={`transition-colors hover:bg-[#f8fbfc] ${
                        est === "E" ? "bg-[#fcf8f8]/70 opacity-75" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle font-mono text-[11px] font-semibold text-[#145c73]">
                        #{rowId}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                        <span className="inline-flex items-center gap-1.5 rounded border border-[#cbdce2] bg-[#eef5f8] px-2 py-0.5 font-mono text-[11.5px] font-bold tracking-wider text-brand">
                          <Icon size={12} />
                          {row.codigo}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 align-middle font-semibold text-[#173d4b]">
                        {row.nombre}
                      </td>

                      <td className="max-w-75 px-3 py-2.5 align-middle text-[11.5px] text-[#5f737b]">
                        {row.descripcion || "—"}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                        <Badge tone={estMeta.tone}>
                          {est} · {estMeta.label}
                        </Badge>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 align-middle text-[10.5px] text-[#6d8088]">
                        <div>
                          Alta:{" "}
                          <strong className="font-mono text-[#173d4b]">
                            {row.usu_alta || "—"}
                          </strong>{" "}
                          ({formatDateTime(row.fec_alta)})
                        </div>
                        {row.usu_mod && (
                          <div>
                            Mod:{" "}
                            <strong className="font-mono text-[#173d4b]">
                              {row.usu_mod}
                            </strong>{" "}
                            ({formatDateTime(row.fec_mod)})
                          </div>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle">
                        <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenEdit(row)}
                            className="h-7 shrink-0 border-[#cfe0e6] bg-white px-2.5 text-[11px] font-semibold text-brand hover:bg-[#eef5f7]"
                          >
                            <FileEdit size={12} className="mr-1" />
                            Editar
                          </Button>

                          {est !== "E" ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setDeleteTarget(row)}
                              className="h-7 shrink-0 border-[#f1cfcb] bg-[#fbe9e7] px-2.5 text-[11px] font-semibold text-[#ba584d] hover:bg-[#f5d5d1]"
                            >
                              <Trash2 size={12} className="mr-1" />
                              Eliminar
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleReactivar(row)}
                              className="h-7 shrink-0 border-[#b9dec9] bg-[#e7f4ed] px-2.5 text-[11px] font-semibold text-[#256349] hover:bg-[#d3ecdf]"
                            >
                              <RotateCcw size={12} className="mr-1" />
                              Reactivar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="mt-3 flex flex-col items-center justify-between gap-2 text-[11px] text-[#6d8088] sm:flex-row">
          <div>
            Mostrando{" "}
            <strong className="text-[#173d4b]">{paginatedItems.length}</strong>{" "}
            de{" "}
            <strong className="text-[#173d4b]">{filteredItems.length}</strong>{" "}
            registros
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-7 border-[#d8e2e5] px-2 text-[11px]"
            >
              <ChevronLeft size={13} />
              Anterior
            </Button>
            <span className="px-2 font-medium text-[#173d4b]">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-7 border-[#d8e2e5] px-2 text-[11px]"
            >
              Siguiente
              <ChevronRight size={13} />
            </Button>
          </div>
        </div>
      </div>

      {/* MODAL CREAR / EDITAR */}
      <Dialog
        open={modalOpen}
        onOpenChange={(nextOpen) => {
          if (!saving) setModalOpen(nextOpen);
        }}
      >
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-[95vw] max-w-lg overflow-hidden rounded-xl border border-[#e1e8ea] bg-white p-0 shadow-card sm:max-w-lg sm:p-0"
        >
          <div className="border-b border-[#e8eff1] bg-[#f6fafb] px-5 py-4 pr-10">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5e6f77]">
                PRODUCCION.{tableName.toUpperCase()}
              </span>
              <Badge tone="blue">{editingItem ? "Edición" : "Alta"}</Badge>
            </div>
            <DialogTitle className="font-barlow text-[20px] font-bold leading-tight text-[#163946]">
              {editingItem
                ? `Editar ${singularLabel} · ${editingItem.codigo}`
                : newButtonLabel}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-[12px] text-[#6b7d85]">
              Completá el código, nombre, descripción y estado en{" "}
              <code>produccion.{tableName}</code>.
            </DialogDescription>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-3.5 px-5 py-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label
                    htmlFor="param-codigo"
                    className="text-[10px] font-bold uppercase tracking-widest text-muted-ink"
                  >
                    Código (`codigo`) *
                  </Label>
                  <Input
                    id="param-codigo"
                    required
                    maxLength={20}
                    placeholder={codePlaceholder}
                    value={form.codigo}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        codigo: e.target.value.toUpperCase(),
                      }))
                    }
                    className="h-9 border-[#dfe7e9] font-mono text-[12px] font-bold uppercase text-[#173d4b]"
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="param-estado"
                    className="text-[10px] font-bold uppercase tracking-widest text-muted-ink"
                  >
                    Estado (`estado`) *
                  </Label>
                  <select
                    id="param-estado"
                    value={form.estado}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, estado: e.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[12px] text-[#173d4b] outline-none focus:border-brand"
                  >
                    <option value="A">A · Activo</option>
                    <option value="I">I · Inactivo</option>
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label
                    htmlFor="param-nombre"
                    className="text-[10px] font-bold uppercase tracking-widest text-muted-ink"
                  >
                    Nombre (`nombre`) *
                  </Label>
                  <Input
                    id="param-nombre"
                    required
                    maxLength={100}
                    placeholder={namePlaceholder}
                    value={form.nombre}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, nombre: e.target.value }))
                    }
                    className="h-9 border-[#dfe7e9] text-[12px] text-[#173d4b]"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label
                    htmlFor="param-descripcion"
                    className="text-[10px] font-bold uppercase tracking-widest text-muted-ink"
                  >
                    Descripción (`descripcion`)
                  </Label>
                  <Textarea
                    id="param-descripcion"
                    rows={3}
                    maxLength={255}
                    placeholder={descPlaceholder}
                    value={form.descripcion}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        descripcion: e.target.value,
                      }))
                    }
                    className="border-[#dfe7e9] text-[12px] text-[#173d4b]"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-[#e1e8ea] bg-[#f8fafb] px-3 py-2 text-[11px] text-[#5f737b]">
                Usuario de auditoría (
                <code>{editingItem ? "usu_mod" : "usu_alta"}</code>):{" "}
                <strong className="font-mono text-[#173d4b]">
                  {user?.usuario_login || "—"}
                </strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-[#e8eff1] bg-[#fafcfd] px-5 py-3.5">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                className="h-9 border-[#d5e1e5] bg-white px-4 text-[12px] font-semibold text-[#214451]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving || !form.codigo.trim() || !form.nombre.trim()}
                className="h-9 bg-brand px-4 text-[12px] font-semibold text-white hover:bg-[#114c5f]"
              >
                {saving
                  ? "Guardando..."
                  : editingItem
                    ? "Guardar cambios"
                    : newButtonLabel}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL CONFIRMAR ELIMINACIÓN */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent className="w-[95vw] max-w-md overflow-hidden rounded-xl border border-[#e1e8ea] bg-white p-0 shadow-card sm:max-w-md sm:p-0">
          <div className="border-b border-[#e8eff1] bg-[#f6fafb] px-5 py-4 pr-10">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5e6f77]">
                CONFIRMAR BAJA · PRODUCCION.{tableName.toUpperCase()}
              </span>
              <Badge tone="red">Eliminar</Badge>
            </div>
            <DialogTitle className="font-barlow text-[20px] font-bold leading-tight text-[#163946]">
              Eliminar {singularLabel}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-[12px] text-[#6b7d85]">
              {deleteTarget
                ? `${deleteTarget.codigo} — ${deleteTarget.nombre}`
                : ""}
            </DialogDescription>
          </div>

          <div className="space-y-3 px-5 py-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-[#f1cfcb] bg-[#fbe9e7] p-3.5 text-[#8a3228]">
              <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-[#ba584d]" />
              <div className="space-y-1 text-[12px] leading-relaxed">
                <p className="font-semibold">
                  ¿Seguro desea eliminar{" "}
                  <span className="font-mono font-bold">
                    {deleteTarget?.codigo}
                  </span>{" "}
                  ({deleteTarget?.nombre})?
                </p>
                <p className="text-[11px]">
                  El registro pasará a estado{" "}
                  <strong>E · Eliminado</strong> en{" "}
                  <code>produccion.{tableName}</code> y dejará de estar
                  disponible para nuevos productos.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-[#e8eff1] bg-[#fafcfd] px-5 py-3.5">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
              className="h-9 border-[#d5e1e5] bg-white px-4 text-[12px] font-semibold text-[#214451]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={deleting}
              onClick={handleConfirmDelete}
              className="h-9 bg-[#ba584d] px-4 text-[12px] font-semibold text-white hover:bg-[#9f463c]"
            >
              {deleting ? "Eliminando..." : "Confirmar eliminación"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
