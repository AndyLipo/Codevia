import { Plus, Search } from "lucide-react";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import { itUsersRows, itRolesRows } from "@/data/mockData";

export default function UsersRoles({ fakeAction }) {
    return (
        <>
            <div className="panel table-panel">
                <div className="panel-heading">
                    <div><div className="eyebrow">CUENTAS</div><h3>Usuarios del sistema</h3></div>
                    <div className="table-tools">
                        <button className="secondary-cta"><Search size={15} /> Buscar</button>
                        <button className="primary-cta" onClick={() => fakeAction("Alta de usuario en preparación")}>
                            <Plus size={17} /> Nuevo usuario
                        </button>
                    </div>
                </div>
                <Table
                    headers={["Nombre", "Email", "Rol", "Estado"]}
                    rows={itUsersRows}
                    renderCell={(cell, j) => (j === 3 ? <Badge tone={cell === "Activo" ? "green" : "slate"}>{cell}</Badge> : cell)}
                />
            </div>

            <div className="panel table-panel">
                <div className="panel-heading">
                    <div><div className="eyebrow">PERMISOS</div><h3>Roles y accesos</h3></div>
                    <button className="secondary-cta" onClick={() => fakeAction("Alta de rol en preparación")}>
                        <Plus size={15} /> Nuevo rol
                    </button>
                </div>
                <Table headers={["Rol", "Descripción", "Usuarios asignados"]} rows={itRolesRows} />
            </div>
        </>
    );
}