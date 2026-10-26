
import { useState, useEffect, useCallback } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import ActionButton from "@/components/common/ActionButton";
import CreateUsuarioModal from "../modals/CreateUsuarioModal";
import { supabase } from "@/lib/supabaseClient";

export default function UsersRoles({ fakeAction }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = useCallback(async () => {
        setLoading(true);

        const { data, error } = await supabase
            .schema("usuarios")
            .from("usuarios")
            .select(`
        id_usuario,
        nombre,
        apellido,
        dni,
        email,
        id_rol,
        estado,
        roles (
          nombre
        )
      `)
            .order("id_usuario", { ascending: false });

        if (error) {
            console.error("Error al traer usuarios:", error.message);
            toast.error("No se pudieron cargar los usuarios");
            setLoading(false);
            return;
        }

        setUsers(data || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleNewUser = () => {
        setSelectedUser(null);
        setModalOpen(true);
    };

    const handleEditUser = (user) => {
        setSelectedUser(user);
        setModalOpen(true);
    };

    const handleSaveUser = async () => {
        await fetchUsers();

        if (selectedUser) {
            toast.success("Usuario actualizado correctamente");
        } else {
            toast.success("Usuario creado correctamente");
            fakeAction?.("Usuario creado correctamente");
        }
    };

    const rows = users.map((user) => {
        const roleName = Array.isArray(user.roles)
            ? user.roles[0]?.nombre
            : user.roles?.nombre;

        const clickableCell = (content) => (
            <button
                type="button"
                onClick={() => handleEditUser(user)}
                className="block w-full cursor-pointer text-left"
                title="Hacé clic para editar este usuario"
            >
                {content}
            </button>
        );

        return [
            clickableCell(
                <span className="font-medium text-[#214451]">
                    {user.nombre} {user.apellido}
                </span>
            ),
            clickableCell(user.email || "—"),
            clickableCell(roleName || "—"),
            clickableCell(
                <Badge tone={user.estado === "A" ? "green" : "slate"}>
                    {user.estado === "A" ? "Activo" : "Inactivo"}
                </Badge>
            ),
        ];
    });

    return (
        <>
            <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
                <div className="mb-4.5 flex items-start justify-between gap-3">
                    <div>
                        <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
                            CUENTAS
                        </div>

                        <h3 className="m-0 font-barlow text-[21px] text-[#214451]">
                            Usuarios del sistema
                        </h3>
                    </div>

                    <div className="flex gap-2">
                        <ActionButton variant="secondary">
                            <Search size={15} />
                            Buscar
                        </ActionButton>

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
                ) : (
                    <Table
                        headers={["Nombre", "Email", "Rol", "Estado"]}
                        rows={rows}
                        renderCell={(cell) => cell}
                    />
                )}
            </div>

            <CreateUsuarioModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                onCreate={handleSaveUser}
                usuario={selectedUser}
            />
        </>
    );
}
