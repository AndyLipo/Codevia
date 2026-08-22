import { ArrowUpRight, Plus, RefreshCw, Route } from "lucide-react";
import SectionTitle from "@/components/common/SectionTitle";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import RouteStep from "./RouteStep";
import { dispatchRows } from "@/data/mockData";

export default function Dispatch({ fakeAction }) {
    return (
        <>
            <SectionTitle
                eyebrow="04 · EXPEDICIÓN"
                title="Playa y hojas de ruta"
                description="Coordiná la carga de camiones y seguí cada despacho en tiempo real."
                action={<button className="primary-cta" onClick={() => fakeAction("Nueva hoja de ruta en preparación")}><Plus size={17} /> Armar hoja de ruta</button>}
            />

            <div className="dispatch-banner">
                <div>
                    <div className="eyebrow">OPERACIÓN DE HOY · MARTES 18 AGO</div>
                    <h3>7 camiones programados <span>·</span> 4 en playa <span>·</span> 2 despachados</h3>
                </div>
                <div className="banner-metric"><strong>03:42 h</strong><span>tiempo medio de carga</span></div>
                <div className="banner-metric"><strong className="green-text">−18 min</strong><span>vs. objetivo diario</span></div>
            </div>

            <div className="dispatch-layout">
                <div className="panel table-panel">
                    <div className="panel-heading">
                        <div><div className="eyebrow">SEGUIMIENTO DE CARGAS</div><h3>Camiones en operación</h3></div>
                        <button className="secondary-cta" onClick={() => fakeAction("Tablero actualizado")}><RefreshCw size={15} /> Actualizar</button>
                    </div>
                    <Table
                        headers={["Hoja", "Cliente", "Camión", "Chofer", "Picking", "Estado"]}
                        rows={dispatchRows}
                        renderCell={(cell, j) => j === 5 ? <Badge tone={cell === "Despachado" ? "green" : cell === "Cargando" ? "blue" : "amber"}>{cell}</Badge> : cell}
                    />
                </div>

                <div className="panel route-panel">
                    <div className="panel-heading">
                        <div><div className="eyebrow">RUTA DESTACADA</div><h3>EXP-00841</h3></div>
                        <Route size={18} className="blue-text" />
                    </div>
                    <div className="route-line">
                        <RouteStep label="Planta Brother Plast" detail="08:10 · Carga iniciada" done />
                        <RouteStep label="Plásticos del Sur" detail="Parque Industrial · 14:00" current />
                        <RouteStep label="Mayorista Centro" detail="Ruta 5 · 16:30" />
                    </div>
                    <button className="primary-cta full" onClick={() => fakeAction("Hoja de ruta abierta")}>Ver hoja completa <ArrowUpRight size={16} /></button>
                </div>
            </div>
        </>
    );
}