import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Truck,
  Plus,
  Search,
  RefreshCcw,
  FileEdit,
  Trash2,
  CheckCircle2,
  AlertTriangle,
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

const ESTADO_VEHICULO_META = {
  A: { label: "Activo", tone: "green" },
  I: { label: "Inactivo", tone: "amber" },
  E: { label: "Eliminado", tone: "red" },
};

const initialForm = {
  patente: "",
  marca: "",
  modelo: "",
  anio: "",
  capacidad_kg: "",
  observaciones: "",
  estado: "A",
};

const formatKg = (val) => {
  if (val == null || val === "") return "—";
  const num = Number(val);
  if (Number.isNaN(num)) return String(val);
  return `${num.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} kg`;
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

export default function VehiculosParams({ fakeAction }) {
  const { token, user } = useAuth();

  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("ALL");

  // Modal de Alta / Edición
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVehiculo, setSelectedVehiculo] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  // Modal de Confirmación de Eliminación
  const [deleteDialogVehiculo, setDeleteDialogVehiculo] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchVehiculos = useCallback(async () => {
    if (!token) {
      setVehiculos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .schema("usuarios")
        .rpc("listar_vehiculos_transporte", { p_token: token });

      if (!error && Array.isArray(data)) {
        setVehiculos(data);
        return;
      }

      // Fallback directo sobre transporte.vehiculo
      const { data: tblData, error: tblErr } = await supabase
        .schema("transporte")
        .from("vehiculo")
        .select("*")
        .order("patente", { ascending: true });

      if (tblErr) {
        console.error("Error al listar vehículos:", error || tblErr);
        toast.error(
          (error || tblErr).message || "No se pudieron cargar los vehículos"
        );
        setVehiculos([]);
        return;
      }

      setVehiculos(
        (tblData ?? []).map((v) => ({
          ...v,
          estado: String(v.estado || "A").trim(),
        }))
      );
    } catch (err) {
      console.error("Error inesperado al listar vehículos:", err);
      toast.error("Ocurrió un error al cargar el padrón de vehículos");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVehiculos();
  }, [fetchVehiculos]);

  const metrics = useMemo(() => {
    const total = vehiculos.length;
    const activos = vehiculos.filter(
      (v) => String(v.estado || "").trim() === "A"
    ).length;
    const inactivos = vehiculos.filter(
      (v) => String(v.estado || "").trim() === "I"
    ).length;
    const enRuta = vehiculos.filter((v) => Boolean(v.ocupado_en_ruta)).length;
    return { total, activos, inactivos, enRuta };
  }, [vehiculos]);

  const filteredVehiculos = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return vehiculos.filter((v) => {
      const est = String(v.estado || "A").trim();
      if (estadoFilter !== "ALL" && est !== estadoFilter) {
        return false;
      }
      if (!q) return true;

      return [
        v.id_vehiculo,
        v.patente,
        v.marca,
        v.modelo,
        v.anio,
        v.observaciones,
        v.usu_alta,
      ]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q));
    });
  }, [vehiculos, searchTerm, estadoFilter]);

  const handleOpenNew = () => {
    setSelectedVehiculo(null);
    setForm({ ...initialForm });
    setModalOpen(true);
  };

  const handleOpenEdit = (vehiculo) => {
    setSelectedVehiculo(vehiculo);
    setForm({
      patente: vehiculo.patente || "",
      marca: vehiculo.marca || "",
      modelo: vehiculo.modelo || "",
      anio: vehiculo.anio != null ? String(vehiculo.anio) : "",
      capacidad_kg:
        vehiculo.capacidad_kg != null ? String(vehiculo.capacidad_kg) : "",
      observaciones: vehiculo.observaciones || "",
      estado: String(vehiculo.estado || "A").trim(),
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;

    const patenteClean = form.patente.trim().toUpperCase();
    if (!patenteClean) {
      toast.error("La patente del vehículo es obligatoria.");
      return;
    }

    const anioNum =
      form.anio !== "" && form.anio != null ? Number(form.anio) : null;
    if (
      anioNum !== null &&
      (!Number.isInteger(anioNum) || anioNum < 1900 || anioNum > 2100)
    ) {
      toast.error("El año del vehículo debe estar entre 1900 y 2100.");
      return;
    }

    const capNum =
      form.capacidad_kg !== "" && form.capacidad_kg != null
        ? Number(form.capacidad_kg)
        : null;
    if (capNum !== null && (!Number.isFinite(capNum) || capNum <= 0)) {
      toast.error("La capacidad en kg debe ser mayor a 0.");
      return;
    }

    const usuLogin = String(user?.usuario_login || "sistema").slice(0, 20);
    const nowIso = new Date().toISOString();

    setSaving(true);
    try {
      if (selectedVehiculo) {
        const { error } = await supabase
          .schema("usuarios")
          .rpc("actualizar_vehiculo_transporte", {
            p_token: token,
            p_id_vehiculo: selectedVehiculo.id_vehiculo,
            p_patente: patenteClean,
            p_marca: form.marca.trim() || null,
            p_modelo: form.modelo.trim() || null,
            p_anio: anioNum,
            p_capacidad_kg: capNum,
            p_observaciones: form.observaciones.trim() || null,
            p_estado: form.estado,
          });

        if (error) {
          const { error: directErr } = await supabase
            .schema("transporte")
            .from("vehiculo")
            .update({
              patente: patenteClean,
              marca: form.marca.trim() || null,
              modelo: form.modelo.trim() || null,
              anio: anioNum,
              capacidad_kg: capNum,
              observaciones: form.observaciones.trim() || null,
              estado: form.estado,
              usu_mod: usuLogin,
              fec_mod: nowIso,
            })
            .eq("id_vehiculo", selectedVehiculo.id_vehiculo);

          if (directErr) {
            toast.error(
              error.message ||
                directErr.message ||
                "No se pudo actualizar el vehículo"
            );
            return;
          }
        }

        toast.success(`Vehículo ${patenteClean} actualizado correctamente`);
        fakeAction?.(`Vehículo ${patenteClean} actualizado`);
      } else {
        const { error } = await supabase
          .schema("usuarios")
          .rpc("crear_vehiculo_transporte", {
            p_token: token,
            p_patente: patenteClean,
            p_marca: form.marca.trim() || null,
            p_modelo: form.modelo.trim() || null,
            p_anio: anioNum,
            p_capacidad_kg: capNum,
            p_observaciones: form.observaciones.trim() || null,
            p_estado: form.estado,
          });

        if (error) {
          // Formato exacto solicitado: INSERT INTO transporte.vehiculo (...)
          const { error: directErr } = await supabase
            .schema("transporte")
            .from("vehiculo")
            .insert({
              patente: patenteClean,
              marca: form.marca.trim() || null,
              modelo: form.modelo.trim() || null,
              anio: anioNum,
              capacidad_kg: capNum,
              observaciones: form.observaciones.trim() || null,
              estado: form.estado,
              usu_alta: usuLogin,
            });

          if (directErr) {
            toast.error(
              error.message ||
                directErr.message ||
                "No se pudo registrar el vehículo"
            );
            return;
          }
        }

        toast.success(`Vehículo ${patenteClean} registrado correctamente`);
        fakeAction?.(`Vehículo ${patenteClean} registrado`);
      }

      setModalOpen(false);
      setSelectedVehiculo(null);
      await fetchVehiculos();
    } catch (err) {
      console.error("Error inesperado al guardar vehículo:", err);
      toast.error("Ocurrió un error al guardar el vehículo");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!token || !deleteDialogVehiculo) return;

    const idVeh = deleteDialogVehiculo.id_vehiculo;
    const patente = deleteDialogVehiculo.patente;
    const usuLogin = String(user?.usuario_login || "sistema").slice(0, 20);

    setDeletingId(idVeh);
    try {
      const { error } = await supabase
        .schema("usuarios")
        .rpc("eliminar_vehiculo_transporte", {
          p_token: token,
          p_id_vehiculo: idVeh,
        });

      if (error) {
        const { error: directErr } = await supabase
          .schema("transporte")
          .from("vehiculo")
          .update({
            estado: "E",
            usu_mod: usuLogin,
            fec_mod: new Date().toISOString(),
          })
          .eq("id_vehiculo", idVeh);

        if (directErr) {
          toast.error(
            error.message ||
              directErr.message ||
              "No se pudo eliminar el vehículo"
          );
          return;
        }
      }

      toast.success(`Vehículo ${patente} marcado como Eliminado (E)`);
      setDeleteDialogVehiculo(null);
      await fetchVehiculos();
    } catch (err) {
      console.error("Error al eliminar vehículo:", err);
      toast.error("Ocurrió un error al eliminar el vehículo");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      {/* CABECERA COMPACTA + 4 KPIs */}
      <div className="mb-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5e6f77]">
            04 · EXPEDICIÓN · PARÁMETROS
          </div>
          <h2 className="m-0 font-barlow text-[24px] leading-tight tracking-[0.01em] text-[#163946]">
            Administración de vehículos
          </h2>
          <p className="mt-0.5 text-[12px] text-[#6b7d85]">
            Registro, edición, capacidad de carga y control de estado de la flota de transporte (`transporte.vehiculo`).
          </p>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="min-w-31.25 rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Total flota
              </span>
              <Badge tone="blue">Unidades</Badge>
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
                En ruta
              </span>
              <Badge tone="blue">Asignados</Badge>
            </div>
            <div className="mt-0.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metrics.enRuta}
              </span>
            </div>
          </div>

          <div className="min-w-31.25 rounded-lg border border-[#e1e8ea] bg-white px-3 py-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#6b7c83]">
                Inactivos (I)
              </span>
              <Badge tone="amber">Baja temp.</Badge>
            </div>
            <div className="mt-0.5">
              <span className="font-barlow text-[22px] font-bold leading-none text-[#163946]">
                {metrics.inactivos}
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
              FLOTA DE TRANSPORTE · PARÁMETROS DE EXPEDICIÓN
            </div>
            <h3 className="m-0 font-barlow text-[22px] text-[#173d4b]">
              Vehículos registrados
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={fetchVehiculos}
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
              Registrar Vehículo
            </Button>
          </div>
        </div>

        {/* Barra de filtros en una sola fila */}
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
              placeholder="Buscar por patente, marca, modelo u observación..."
              className="h-9 w-full rounded-md border border-[#d8e2e5] bg-[#f8fafb] pl-8 pr-3 text-[12px] text-[#173d4b] outline-none transition-colors focus:border-brand focus:bg-white"
            />
          </div>

          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="h-9 w-48 shrink-0 rounded-md border border-[#d8e2e5] bg-white px-2.5 text-[12px] text-[#173d4b] outline-none focus:border-brand"
          >
            <option value="ALL">Estado: Todos</option>
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

        {/* Tabla de Vehículos */}
        <div className="overflow-x-auto rounded-lg border border-[#e3eaec]">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#e3eaec] bg-[#f4f8f9] text-[10px] font-bold uppercase tracking-widest text-[#697e86]">
                <th className="px-3 py-2.5">ID / Patente</th>
                <th className="px-3 py-2.5">Marca y Modelo</th>
                <th className="px-3 py-2.5">Año</th>
                <th className="px-3 py-2.5 text-right">Capacidad</th>
                <th className="px-3 py-2.5">Observaciones</th>
                <th className="px-3 py-2.5">Alta / Modificación</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2f4]">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-[12px] text-[#758990]"
                  >
                    Cargando vehículos registrados...
                  </td>
                </tr>
              ) : filteredVehiculos.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-[12px] text-[#758990]"
                  >
                    No se encontraron vehículos registrados con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredVehiculos.map((v) => {
                  const est = String(v.estado || "A").trim();
                  const estMeta = ESTADO_VEHICULO_META[est] ?? {
                    label: est,
                    tone: "slate",
                  };

                  return (
                    <tr
                      key={v.id_vehiculo}
                      className="transition-colors hover:bg-[#f8fbfc]"
                    >
                      <td className="px-3 py-2.5 align-middle">
                        <div className="flex items-center gap-2">
                          <span className="rounded border border-[#cbdce2] bg-[#eef5f8] px-2 py-0.5 font-mono text-[12px] font-bold text-brand">
                            {v.patente}
                          </span>
                          <span className="font-mono text-[10.5px] text-[#73878f]">
                            #{v.id_vehiculo}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-2.5 align-middle">
                        <div className="font-semibold text-[#173d4b]">
                          {[v.marca, v.modelo].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </td>

                      <td className="px-3 py-2.5 align-middle font-mono text-[#49636c]">
                        {v.anio || "—"}
                      </td>

                      <td className="px-3 py-2.5 text-right align-middle font-mono font-semibold text-[#173d4b]">
                        {formatKg(v.capacidad_kg)}
                      </td>

                      <td className="max-w-64 truncate px-3 py-2.5 align-middle text-[11px] text-[#5f737b]">
                        {v.observaciones || "—"}
                      </td>

                      <td className="px-3 py-2.5 align-middle text-[10.5px] text-[#6d8088]">
                        <div>
                          Alta:{" "}
                          <strong className="font-mono text-[#214451]">
                            {v.usu_alta || "—"}
                          </strong>{" "}
                          ({formatDateTime(v.fec_alta)})
                        </div>
                        {v.usu_mod && (
                          <div>
                            Mod:{" "}
                            <strong className="font-mono text-[#214451]">
                              {v.usu_mod}
                            </strong>{" "}
                            ({formatDateTime(v.fec_mod)})
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2.5 align-middle">
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={estMeta.tone}>
                            {est} · {estMeta.label}
                          </Badge>
                          {v.ocupado_en_ruta && (
                            <span className="inline-flex items-center gap-1 rounded bg-[#e8f2f6] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-brand">
                              <Truck size={10} /> En ruta {v.nro_hoja_activa || ""}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2.5 text-right align-middle">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(v)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#dce5e8] bg-white px-2.5 py-1 text-[10.5px] font-semibold text-brand hover:bg-[#eef5f7]"
                            title="Editar vehículo"
                          >
                            <FileEdit size={11} />
                            Editar
                          </button>

                          {est !== "E" && (
                            <button
                              type="button"
                              onClick={() => setDeleteDialogVehiculo(v)}
                              className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#f1cfcb] bg-[#fbe9e7] px-2.5 py-1 text-[10.5px] font-semibold text-[#ba584d] hover:bg-[#f5d5d1]"
                              title="Eliminar vehículo"
                            >
                              <Trash2 size={11} />
                              Eliminar
                            </button>
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
      </div>

      {/* MODAL CREAR / EDITAR VEHÍCULO */}
      <Dialog
        open={modalOpen}
        onOpenChange={(nextOpen) => {
          if (!saving) setModalOpen(nextOpen);
        }}
      >
        <DialogContent className="w-[95vw] max-w-lg overflow-hidden rounded-xl border border-[#e1e8ea] bg-white p-0 shadow-card sm:max-w-lg sm:p-0">
          <div className="border-b border-[#e8eff1] bg-[#f6fafb] px-5 py-4 pr-10">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5e6f77]">
                PARÁMETROS DE TRANSPORTE · FLOTA
              </span>
              <Badge tone="blue">
                {selectedVehiculo ? "Edición" : "Nuevo Registro"}
              </Badge>
            </div>
            <DialogTitle className="font-barlow text-[20px] font-bold leading-tight text-[#163946]">
              {selectedVehiculo
                ? `Editar Vehículo · ${selectedVehiculo.patente}`
                : "Registrar Nuevo Vehículo"}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-[12px] text-[#6b7d85]">
              Complete los datos de identificación, capacidad y estado operativo en `transporte.vehiculo`.
            </DialogDescription>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-3.5 px-5 py-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                    Patente (Dominio) *
                  </Label>
                  <Input
                    required
                    maxLength={15}
                    value={form.patente}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        patente: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="Ej: AB123CD o AA999BB"
                    className="h-9 border-[#dfe7e9] bg-white font-mono text-[12px] font-semibold uppercase text-[#173d4b]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                    Estado *
                  </Label>
                  <select
                    value={form.estado}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, estado: e.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-[#dfe7e9] bg-white px-2.5 text-[12px] text-[#173d4b] outline-none focus:border-brand"
                  >
                    <option value="A">A · Activo</option>
                    <option value="I">I · Inactivo</option>
                    <option value="E">E · Eliminado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                    Marca
                  </Label>
                  <Input
                    maxLength={50}
                    value={form.marca}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, marca: e.target.value }))
                    }
                    placeholder="Ej: Mercedes-Benz, Iveco, Ford..."
                    className="h-9 border-[#dfe7e9] bg-white text-[12px] text-[#173d4b]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                    Modelo
                  </Label>
                  <Input
                    maxLength={50}
                    value={form.modelo}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, modelo: e.target.value }))
                    }
                    placeholder="Ej: Accelo 815, Daily, Cargo..."
                    className="h-9 border-[#dfe7e9] bg-white text-[12px] text-[#173d4b]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                    Año (1900 - 2100)
                  </Label>
                  <Input
                    type="number"
                    min="1900"
                    max="2100"
                    value={form.anio}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, anio: e.target.value }))
                    }
                    placeholder="Ej: 2023"
                    className="h-9 border-[#dfe7e9] bg-white font-mono text-[12px] text-[#173d4b]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                    Capacidad máxima (kg)
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.capacidad_kg}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        capacidad_kg: e.target.value,
                      }))
                    }
                    placeholder="Ej: 4500.00"
                    className="h-9 border-[#dfe7e9] bg-white font-mono text-[12px] text-[#173d4b]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                  Observaciones
                </Label>
                <Textarea
                  rows={2}
                  maxLength={1000}
                  value={form.observaciones}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      observaciones: e.target.value,
                    }))
                  }
                  placeholder="Características de caja, mantenimiento, notas operativas..."
                  className="border-[#dfe7e9] bg-white text-[12px] text-[#173d4b]"
                />
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
                disabled={saving || !form.patente.trim()}
                className="h-9 bg-brand px-4 text-[12px] font-semibold text-white hover:bg-[#114c5f]"
              >
                <CheckCircle2 size={14} className="mr-1.5" />
                {saving
                  ? "Guardando..."
                  : selectedVehiculo
                    ? "Guardar Cambios"
                    : "Registrar Vehículo"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL CONFIRMAR ELIMINACIÓN DE VEHÍCULO */}
      <Dialog
        open={Boolean(deleteDialogVehiculo)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deletingId) {
            setDeleteDialogVehiculo(null);
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-md overflow-hidden rounded-xl border border-[#e1e8ea] bg-white p-0 shadow-card sm:max-w-md sm:p-0">
          <div className="border-b border-[#e8eff1] bg-[#f6fafb] px-5 py-4 pr-10">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5e6f77]">
                BAJA DE VEHÍCULO · {deleteDialogVehiculo?.patente}
              </span>
              <Badge tone="red">Eliminar</Badge>
            </div>
            <DialogTitle className="font-barlow text-[20px] font-bold leading-tight text-[#163946]">
              ¿Eliminar vehículo {deleteDialogVehiculo?.patente}?
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-[12px] text-[#6b7d85]">
              {[deleteDialogVehiculo?.marca, deleteDialogVehiculo?.modelo]
                .filter(Boolean)
                .join(" · ") || "Unidad de transporte"}
            </DialogDescription>
          </div>

          <div className="px-5 py-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-[#f5d48f] bg-[#fff9eb] p-3.5 text-[#8a5a0d]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#c27b10]" />
              <div className="text-[12px] leading-relaxed">
                El vehículo pasará a estado <strong>E · Eliminado</strong> y dejará de estar disponible para nuevas hojas de ruta.
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-[#e8eff1] bg-[#fafcfd] px-5 py-3.5">
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(deletingId)}
              onClick={() => setDeleteDialogVehiculo(null)}
              className="h-9 border-[#d5e1e5] bg-white px-4 text-[12px] font-semibold text-[#214451]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={Boolean(deletingId)}
              onClick={handleConfirmDelete}
              className="h-9 bg-[#ba584d] px-4 text-[12px] font-semibold text-white hover:bg-[#9e443a]"
            >
              <Trash2 size={14} className="mr-1.5" />
              {deletingId ? "Eliminando..." : "Confirmar Eliminación"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
