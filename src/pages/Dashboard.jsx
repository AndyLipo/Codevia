import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import {
  canAccessITAdmin,
  canAccessRRHH,
  canAccessClientes,
  canAccessPedidos,
  canAccessCatalogo,
} from "@/data/mockData";
import AppShell from "@/components/layout/AppShell";
import SectionTitle from "@/components/common/SectionTitle";

import Overview from "@/components/dashboard/Overview";
import Production from "@/components/dashboard/Production";
import MisOrdenes from "@/components/dashboard/MisOrdenes";
import Warehouse from "@/components/dashboard/Warehouse";
import Dispatch from "@/components/dashboard/Dispatch";
import GestionPedidos from "@/components/dashboard/GestionPedidos";
import SeguimientoPedidos from "@/components/dashboard/SeguimientoPedidos";
import Clientes from "@/components/dashboard/Clientes";
import Productos from "@/components/dashboard/Productos";
import ListaPrecios from "@/components/dashboard/ListaPrecios";
import Reports from "@/components/dashboard/Reports";
import ITAdmin from "@/components/dashboard/itadmin/ITAdmin";
import RolesParams from "@/components/dashboard/itadmin/RolesParams";
import PermisosParams from "@/components/dashboard/itadmin/PermisosParams";
import RRHH from "@/components/dashboard/RRHH";

export default function Dashboard() {
  const { user, role, logout } = useAuth();
  const [active, setActive] = useState("overview");
  const [, setQuery] = useState("");

  const navigate = (id) => {
    setActive(id);
  };

  const fakeAction = (message) => {
    toast.success(message);
  };

  const renderContent = () => {
    switch (active) {
      case "overview":
        return (
          <Overview
            navigate={navigate}
            fakeAction={fakeAction}
          />
        );

      case "production":
        return <Production fakeAction={fakeAction} />;

      case "mis-ordenes":
        return <MisOrdenes fakeAction={fakeAction} />;

      case "warehouse":
        return (
          <Warehouse
            fakeAction={fakeAction}
            usuarioActual={user}
          />
        );

      case "dispatch":
        return <Dispatch fakeAction={fakeAction} />;

      case "orders":
      case "pedidos-gestion":
        if (!canAccessPedidos(user?.id_rol)) {
          return <Overview
            navigate={navigate}
            fakeAction={fakeAction} />;
        }
        return <GestionPedidos fakeAction={fakeAction} />;

      case "pedidos-seguimiento":
        if (!canAccessPedidos(user?.id_rol)) {
          return <Overview navigate={navigate} fakeAction={fakeAction} />;
        }
        return <SeguimientoPedidos fakeAction={fakeAction} />;

      case "clients":
        if (!canAccessClientes(user?.id_rol, user?.rol_modulos)) {
          return <Overview navigate={navigate} fakeAction={fakeAction} />;
        }
        return <Clientes fakeAction={fakeAction} />;

      case "productos":
        if (!canAccessCatalogo(user?.id_rol, user?.rol_modulos, "productos")) {
          return <Overview navigate={navigate} fakeAction={fakeAction} />;
        }
        return <Productos fakeAction={fakeAction} />;

      case "lista-precios":
        if (!canAccessCatalogo(user?.id_rol, user?.rol_modulos, "lista-precios")) {
          return <Overview navigate={navigate} fakeAction={fakeAction} />;
        }
        return <ListaPrecios fakeAction={fakeAction} />;

      case "reports":
        return <Reports />;

      case "it-admin":
        if (!canAccessITAdmin(user?.id_rol, user?.rol_modulos)) {
          return <Overview navigate={navigate} fakeAction={fakeAction} />;
        }
        return <ITAdmin fakeAction={fakeAction} />;

      case "it-params-roles":
        if (!canAccessITAdmin(user?.id_rol, user?.rol_modulos)) {
          return <Overview navigate={navigate} fakeAction={fakeAction} />;
        }
        return (
          <>
            <SectionTitle
              eyebrow="07 · IT / SISTEMAS · PARÁMETROS"
              title="Administración de roles"
              description="Creación, edición y gestión del estado de los roles del sistema."
            />
            <RolesParams fakeAction={fakeAction} />
          </>
        );

      case "it-params-permisos":
        if (!canAccessITAdmin(user?.id_rol, user?.rol_modulos)) {
          return <Overview navigate={navigate} fakeAction={fakeAction} />;
        }
        return (
          <>
            <SectionTitle
              eyebrow="07 · IT / SISTEMAS · PARÁMETROS"
              title="Permisos de módulos por rol"
              description="Definí qué módulos del menú principal puede visualizar y operar cada rol del sistema."
            />
            <PermisosParams fakeAction={fakeAction} />
          </>
        );

      case "rrhh":
        if (!canAccessRRHH(user?.id_rol, user?.rol_modulos)) {
          return <Overview navigate={navigate} fakeAction={fakeAction} />;
        }
        return <RRHH fakeAction={fakeAction} />;

      default:
        return (
          <Overview
            navigate={navigate}
            fakeAction={fakeAction}
          />
        );
    }
  };

  return (
    <AppShell
      active={active}
      navigate={navigate}
      role={role}
      setLogged={logout}
      fakeAction={fakeAction}
      setQuery={setQuery}
    >
      {renderContent()}
    </AppShell>
  );
}
