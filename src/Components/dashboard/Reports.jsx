import { ArrowUpRight, CalendarDays, ChevronDown, Gauge, Truck, Warehouse, Zap } from "lucide-react";
import SectionTitle from "@/components/common/SectionTitle";
import IconBox from "@/components/common/IconBox";

const reportCards = [
    { icon: Gauge, label: "Producción por turno", detail: "kg, eficiencia y cumplimiento", tone: "blue" },
    { icon: Warehouse, label: "Stock por sector", detail: "ocupación, rotación y mínimos", tone: "amber" },
    { icon: Truck, label: "Entregas por cliente", detail: "OTIF y tiempo en ruta", tone: "green" },
];

const weekData = [["Lun", 74, 82], ["Mar", 88, 90], ["Mié", 68, 78], ["Jue", 94, 92], ["Vie", 81, 88], ["Sáb", 96, 92]];

export default function Reports() {
    return (
        <>
            <SectionTitle
                eyebrow="06 · REPORTES"
                title="Lecturas para decidir"
                description="Indicadores básicos para el seguimiento diario y semanal."
                action={<button className="secondary-cta"><CalendarDays size={16} /> Esta semana <ChevronDown size={14} /></button>}
            />

            <div className="report-grid">
                {reportCards.map((card, i) => (
                    <div className="report-card" key={card.label}>
                        <IconBox icon={card.icon} tone={card.tone} />
                        <div className="report-index">0{i + 1}</div>
                        <h3>{card.label}</h3>
                        <p>{card.detail}</p>
                        <button className="link-button">Abrir reporte <ArrowUpRight size={15} /></button>
                    </div>
                ))}
            </div>

            <div className="panel report-main">
                <div className="panel-heading">
                    <div><div className="eyebrow">CUMPLIMIENTO OPERATIVO</div><h3>Producción vs. plan semanal</h3></div>
                    <div className="legend"><span><i className="legend-dot blue" />Producido</span><span><i className="legend-dot gray" />Planificado</span></div>
                </div>
                <div className="report-bars">
                    {weekData.map(([day, value, plan]) => (
                        <div className="report-bar-day" key={day}>
                            <div className="report-bar-track">
                                <i style={{ height: `${plan}%` }} className="plan" />
                                <i style={{ height: `${value}%` }} className="actual" />
                            </div>
                            <strong>{value}%</strong>
                            <span>{day}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="insight">
                <Zap size={18} />
                <div>
                    <strong>Lectura rápida</strong>
                    <span>El jueves se superó el plan de producción en 2 puntos. La principal oportunidad está en reducir la espera entre cambio de bobina y control de calidad.</span>
                </div>
            </div>
        </>
    );
}