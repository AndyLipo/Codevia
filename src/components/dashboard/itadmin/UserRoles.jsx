import { useState, useEffect, useCallback } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import ActionButton from "@/components/common/ActionButton";
import CreateUsuarioModal from "../modals/CreateUsuarioModal";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

const ESTADO_META = {
    A: { label: "Activo", tone: "green" },
    I: { label: "Inactivo", tone: "slate" },
    E: { label: "Eliminado", tone: "red" },
};

export default function UsersRoles({ fakeAction }) {
    const { token } = useAuth();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const fetchUsers = useCallback(async () => {
        if (!token) {
            setUsers([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            const { data, error } = await supabase
                .schema("usuarios")
                .rpc("listar_usuarios_autorizados", {
                    p_token: token,
                });

            if (error) {
                console.error("Error al traer usuarios:", error);
                toast.error("No se pudieron cargar los usuarios");
                setUsers([]);
                return;
            }

            setUsers(data ?? []);
        } catch (error) {
            console.error("Error inesperado al traer usuarios:", error);
            toast.error("Ocurrió un error al cargar los usuarios");
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleNewUser = () => {
        setSelectedUser(null);
        setModalOpen(true);
    };

    const handleEditUser = (selected) => {
        setSelectedUser(selected);
        setModalOpen(true);
    };

    const handleSaveUser = async () => {
        await fetchUsers();
        if (!selectedUser) {
            fakeAction?.("Usuario creado correctamente");
        }
        setModalOpen(false);
        setSelectedUser(null);
    };

    const filteredUsers = users.filter((item) => {
        const estadoInfo = ESTADO_META[item.estado] ?? ESTADO_META.I;
        const userLogin =
            item.usuario_login || (item.dni ? `BP${item.dni}` : "");

        const value = [
            userLogin,
            item.nombre,
            item.apellido,
            item.email,
            item.dni,
            item.rol_nombre,
            item.estado,
            estadoInfo.label,
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return value.includes(search.toLowerCase().trim());
    });

    const rows = filteredUsers.map((item) => {
        const estadoInfo = ESTADO_META[item.estado] ?? {
            label: item.estado || "Inactivo",
            tone: "slate",
        };
        const userLogin =
            item.usuario_login || (item.dni ? `BP${item.dni}` : "—");

        const clickableCell = (content) => (
            <button
                type="button"
                onClick={() => handleEditUser(item)}
                className="block w-full cursor-pointer text-left"
                title="Hacé clic para editar este usuario"
            >
                {content}
            </button>
        );

        return [
            clickableCell(
                <span className="font-mono text-[11px] font-semibold text-[#145c73]">
                    {userLogin}
                </span>
            ),
            clickableCell(
                <span className="font-medium text-[#214451]">
                    {item.nombre} {item.apellido}
                </span>
            ),
            clickableCell(item.email || "—"),
            clickableCell(item.rol_nombre || "—"),
            clickableCell(
                <Badge tone={estadoInfo.tone}>
                    {estadoInfo.label}
                </Badge>
            ),
        ];
    });

    return (
        <>
            <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
                <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                        <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
                            CUENTAS
                        </div>

                        <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
                            Usuarios del sistema
                        </h3>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <div className="relative">
                            <Search
                                size={15}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#82979e]"
                            />

                            <input
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Buscar usuario..."
                                aria-label="Buscar usuario"
                                className="h-9 w-full rounded-md border border-[#e1e8ea] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#214451] sm:w-48"
                            />
                        </div>

                        <ActionButton onClick={handleNewUser}>
                            <Plus size={17} />
                            Nuevo usuario
                        </ActionButton>
                    </div>
                </div>

                {loading ? (
                    <p className="py-6 text-center text-[11px] text-muted-ink">
                        Cargando usuarios...
                    </p>
                ) : filteredUsers.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-ink">
                        {users.length === 0
                            ? "No hay usuarios para mostrar."
                            : "No se encontraron usuarios con esa búsqueda."}
                    </p>
                ) : (
                    <Table
                        headers={["Usuario", "Nombre", "Email", "Rol", "Estado"]}
                        rows={rows}
                        renderCell={(cell) => cell}
                    />
                )}
            </div>

            <CreateUsuarioModal
                open={modalOpen}
                onOpenChange={(open) => {
                    setModalOpen(open);

                    if (!open) {
                        setSelectedUser(null);
                    }
                }}
                onCreate={handleSaveUser}
                usuario={selectedUser}
                existingUsers={users}
            />
        </>
    );
}
