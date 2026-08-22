import { AlertTriangle, ArrowUpRight, LogOut, Settings2, X } from "lucide-react";
import { modules } from "@/data/mockData";

export default function Sidebar({ active, navigate, mobileOpen, setMobileOpen, role, setLogged, fakeAction }) {
    return (
        <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`}>
            <div className="brand">
                <div className="brand-mark">
                    <img src="/manus-storage/brother-plast-mark_63a96de1.png" alt="" />
                </div>
                <div>
                    <strong>brother<span>plast</span></strong>
                    <small>gestión industrial</small>
                </div>
                <button className="close-menu" onClick={() => setMobileOpen(false)}>
                    <X size={17} />
                </button>
            </div>

            <div className="plant-status">
                <span className="status-pulse" /> Planta activa <span className="plant-code">BP · 01</span>
            </div>

            <nav className="nav-list">
                {modules.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button key={item.id} className={`nav-item ${active === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}>
                            <Icon size={18} />
                            <span>{item.label}</span>
                            {item.id === "warehouse" && <em>2</em>}
                        </button>
                    );
                })}
            </nav>

            <div className="sidebar-bottom">
                <div className="mini-alert" onClick={() => navigate("warehouse")}>
                    <AlertTriangle size={16} />
                    <div>
                        <strong>2 alertas críticas</strong>
                        <span>Requieren atención hoy</span>
                    </div>
                    <ArrowUpRight size={15} />
                </div>
                <button className="nav-item muted" onClick={() => fakeAction("Configuración en preparación")}>
                    <Settings2 size={18} />
                    <span>Configuración</span>
                </button>
            </div>

            <div className="user-card">
                <div className="avatar">{role.initials}</div>
                <div>
                    <strong>{role.label}</strong>
                    <span>Sesión de demostración</span>
                </div>
                <button onClick={() => setLogged(false)} title="Cerrar sesión">
                    <LogOut size={16} />
                </button>
            </div>
        </aside>
    );
}