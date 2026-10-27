import { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

const formatFechaHora = (iso) => {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return String(iso);
    return date.toLocaleString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export default function AuditLog() {
    const { token } = useAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const fetchAuditLogins = useCallback(
        async (query = "") => {
            if (!token) {
                setLogs([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const { data, error } = await supabase
                    .schema("usuarios")
                    .rpc("listar_auditoria_logins", {
                        p_token: token,
                        p_busqueda: query.trim(),
                    });

                if (error) {
                    console.error("Error al cargar auditoría de inicios de sesión:", error);
                    toast.error("No se pudo cargar el registro de inicios de sesión");
                    setLogs([]);
                    return;
                }

                setLogs(data ?? []);
            } catch (err) {
                console.error("Error inesperado en auditoría:", err);
                toast.error("Ocurrió un error al cargar la auditoría");
                setLogs([]);
            } finally {
                setLoading(false);
            }
        },
        [token]
    );

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchAuditLogins(search);
        }, 250);

        return () => clearTimeout(timer);
    }, [search, fetchAuditLogins]);

    const rows = logs.map((item) => [
        formatFechaHora(item.fec_login),
        <span key={`u-${item.id_evento}`} className="font-mono text-[11px] font-semibold text-[#145c73]">
            {item.usuario_login}
        </span>,
        `${item.nombre ?? ""} ${item.apellido ?? ""}`.trim() || "—",
        item.rol_nombre || "—",
        <Badge key={`b-${item.id_evento}`} tone="green">
            Inicio de sesión
        </Badge>,
    ]);

    return (
        <div className="mt-3.5 rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
            <div className="mb-4.5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                    <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
                        TRAZABILIDAD
                    </div>
                    <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
                        Registro de actividad · Inicios de sesión
                    </h3>
                </div>

                <div className="relative">
                    <Search
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#82979e]"
                    />

                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por usuario o nombre..."
                        aria-label="Buscar por usuario"
                        className="h-9 w-full rounded-md border border-[#e1e8ea] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#214451] sm:w-56"
                    />
                </div>
            </div>

            {loading ? (
                <p className="py-6 text-center text-[11px] text-muted-ink">
                    Cargando inicios de sesión...
                </p>
            ) : rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-ink">
                    {search.trim()
                        ? "No se encontraron inicios de sesión para ese usuario."
                        : "Aún no hay inicios de sesión registrados."}
                </p>
            ) : (
                <Table
                    headers={["Fecha y hora", "Usuario", "Nombre", "Rol", "Acción"]}
                    rows={rows}
                    renderCell={(cell) => cell}
                />
            )}
        </div>
    );
}
