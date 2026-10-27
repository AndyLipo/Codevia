import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { canAccessITAdmin, canAccessRRHH } from "@/data/mockData";
import AppShell from "@/components/layout/AppShell";
import SectionTitle from "@/components/common/SectionTitle";

import Overview from "@/components/dashboard/Overview";
import Production from "@/components/dashboard/Production";
import Warehouse from "@/components/dashboard/Warehouse";
import Dispatch from "@/components/dashboard/Dispatch";
import Orders from "@/components/dashboard/Orders";
import Reports from "@/components/dashboard/Reports";
import ITAdmin from "@/components/dashboard/itadmin/ITAdmin";
import RolesParams from "@/components/dashboard/itadmin/RolesParams";
import RRHH from "@/components/dashboard/RRHH";

export default function Dashboard() {
  const { user, role, logout } = useAuth();
  const [active, setActive] = useState("overview");
  const [query, setQuery] = useState("");

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
        return (
          <Orders
            fakeAction={fakeAction}
            query={query}
          />
        );

      case "reports":
        return <Reports />;

      case "it-admin":
        if (!canAccessITAdmin(user?.id_rol)) {
          return <Overview navigate={navigate} fakeAction={fakeAction} />;
        }
        return <ITAdmin fakeAction={fakeAction} />;

      case "it-params-roles":
        if (!canAccessITAdmin(user?.id_rol)) {
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

      case "rrhh":
        if (!canAccessRRHH(user?.id_rol)) {
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
