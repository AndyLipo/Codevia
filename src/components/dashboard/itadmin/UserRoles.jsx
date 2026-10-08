import { useState, useEffect, useCallback } from "react";
import { Plus, Search } from "lucide-react";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import ActionButton from "@/components/common/ActionButton";
import CreateUsuarioModal from "../modals/CreateUsuarioModal";
import { supabase } from "@/lib/supabaseClient";



export default function UsersRoles({ fakeAction }) {
    const [createUser, setCreateUser] = useState(false);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = useCallback(async () => {
        setLoading(true);

        const { data, error } = await supabase
            .schema("usuarios")
            .from("usuarios")
            .select("nombre, apellido, email, estado, roles(nombre)")
            .order("id_usuario", { ascending: false });

        if (error) {
            console.error("Error al traer usuarios:", error.message);
            setLoading(false);
            return;
        }

        setUsers(data || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleCreateUser = (newUser) => {
        fakeAction?.(`Usuario creado correctamente`);
        fetchUsers(); // recargamos la tabla con el nuevo usuario incluido
    };

    const rows = users.map((u) => [
        `${u.nombre} ${u.apellido}`,
        u.email,
        u.rol?.nombre || "—",
        u.estado === "A" ? "Activo" : "Inactivo",
    ]);

    return (
        <>
            <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
                <div className="mb-4.5 flex items-start justify-between gap-3">
                    <div className="">
                        <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">CUENTAS</div>
                        <h3 className="m-0 font-barlow text-[21px] text-[#214451]">Usuarios del sistema</h3>
                    </div>
                    <div className="flex gap-2">
                        <ActionButton variant="secondary"><Search size={15} /> Buscar</ActionButton>
                        <ActionButton onClick={() => setCreateUser(true)}>
                            <Plus size={17} /> Nuevo usuario
                        </ActionButton>
                    </div>
                </div>

                {loading ? (
                    <p className="py-6 text-center text-[11px] text-muted-ink">Cargando usuarios...</p>
                ) : (
                    <Table
                        headers={["Nombre", "Email", "Rol", "Estado"]}
                        rows={rows}
                        renderCell={(cell, j) =>
                            j === 3 ? <Badge tone={cell === "Activo" ? "green" : "slate"}>{cell}</Badge> : cell
                        }
                    />
                )}
            </div>

            <CreateUsuarioModal
                open={createUser}
                onOpenChange={setCreateUser}
                onCreate={handleCreateUser}
            />
        </>
    );
}