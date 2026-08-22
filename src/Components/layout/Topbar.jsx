import { Bell, ChevronDown, Menu, Search } from "lucide-react";
import { modules, roleOptions } from "@/data/mockData";

export default function Topbar({
  active,
  role,
  setRole,
  setMobileOpen,
  setQuery,
  fakeAction,
}) {
  const currentModule = modules.find((m) => m.id === active);

  return (
    <header className="topbar">
      <button className="menu-trigger" onClick={() => setMobileOpen(true)}>
        <Menu size={20} />
      </button>

      <div className="breadcrumbs">
        <span>Brother Plast</span>
        <span>/</span>
        <strong>{currentModule.label}</strong>
      </div>

      <div className="top-actions">
        <div className="search">
          <Search size={17} />
          <input
            placeholder="Buscar orden, lote o cliente"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          className="icon-button notification"
          onClick={() => fakeAction("No hay nuevas notificaciones")}
        >
          <Bell size={18} />
          <i />
        </button>
        <div className="role-switcher">
          <div className="avatar small">{role.initials}</div>
          <select
            value={role.id}
            onChange={(e) =>
              setRole(roleOptions.find((r) => r.id === e.target.value))
            }
          >
            {roleOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </div>
      </div>
    </header>
  );
}
