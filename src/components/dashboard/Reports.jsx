import { ArrowUpRight, CalendarDays, ChevronDown, Gauge, Truck, Warehouse, Zap } from "lucide-react";
import SectionTitle from "@/components/common/SectionTitle";
import IconBox from "@/components/common/IconBox";
import ActionButton from "@/components/common/ActionButton";

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
        action={<ActionButton variant="secondary"><CalendarDays size={16} /> Esta semana <ChevronDown size={14} /></ActionButton>}
      />

      <div className="mb-3.5 grid grid-cols-3 gap-3.5 max-[760px]:grid-cols-1">
        {reportCards.map((card, i) => (
          <div key={card.label} className="relative rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
            <div className="mb-6"><IconBox icon={card.icon} tone={card.tone} /></div>
            <div className="absolute right-[19px] top-5 font-barlow text-xl text-[#cbd7da]">0{i + 1}</div>
            <h3 className="m-0 font-barlow text-[22px] text-[#214451]">{card.label}</h3>
            <p className="my-1.5 mb-5 text-[10px] text-[#8a9aa0]">{card.detail}</p>
            <button className="flex items-center gap-1.5 text-[11px] font-bold text-brand">Abrir reporte <ArrowUpRight size={15} /></button>
          </div>
        ))}
      </div>

      <div className="min-h-[310px] rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
        <div className="mb-[18px] flex items-start justify-between gap-3">
          <div><div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">CUMPLIMIENTO OPERATIVO</div><h3 className="m-0 font-barlow text-[21px] text-[#214451]">Producción vs. plan semanal</h3></div>
          <div className="flex gap-3 text-[9px] text-[#819298]">
            <span className="flex items-center gap-1.5"><i className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />Producido</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-1.5 w-1.5 rounded-full bg-[#cedadd]" />Planificado</span>
          </div>
        </div>
        <div className="flex h-[215px] items-end justify-around gap-6 px-[8%] py-2.5">
          {weekData.map(([day, value, plan]) => (
            <div key={day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <div className="relative h-[180px] w-[35px] overflow-hidden rounded-[5px] bg-[#f2f5f5]">
                <i className="absolute bottom-0 left-0 w-full rounded-t-[4px] bg-[#d3e1e4]" style={{ height: `${plan}%` }} />
                <i className="absolute bottom-0 left-0 z-[1] w-full rounded-t-[4px] bg-brand" style={{ height: `${value}%` }} />
              </div>
              <strong className="font-barlow text-[17px] text-[#41606a]">{value}%</strong>
              <span className="text-[9px] text-[#89999e]">{day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3.5 flex items-start gap-2.5 rounded-[7px] bg-brand-soft px-[15px] py-[13px] text-brand">
        <Zap size={18} />
        <div>
          <strong className="block text-[11px]">Lectura rápida</strong>
          <span className="mt-1 block text-[10px] text-[#59747d]">El jueves se superó el plan de producción en 2 puntos. La principal oportunidad está en reducir la espera entre cambio de bobina y control de calidad.</span>
        </div>
      </div>
    </>
  );
}