import { AlertTriangle, Clock3, MapPin, Plus } from "lucide-react";
import SectionTitle from "@/components/common/SectionTitle";
import Table from "@/components/common/Table";
import Badge from "@/components/common/Badge";
import IconBox from "@/components/common/IconBox";
import ActionButton from "@/components/common/ActionButton";
import { stockRows } from "@/data/mockData";

export default function Warehouse({ fakeAction }) {
  return (
    <>
      <SectionTitle
        eyebrow="03 · DEPÓSITO"
        title="Stock por sector"
        description="Ubicaciones físicas, mínimos operativos y vencimientos próximos."
        action={<ActionButton onClick={() => fakeAction("Movimiento de stock en preparación")}><Plus size={17} /> Registrar movimiento</ActionButton>}
      />

      <div className="mb-3.5 grid grid-cols-[1.4fr_repeat(3,1fr)] gap-3 max-[760px]:grid-cols-1">
        <div className="rounded-lg border border-[#e1e8ea] bg-white p-4 shadow-card">
          <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">OCUPACIÓN TOTAL</div>
          <strong className="font-barlow text-[42px] leading-none text-brand">74<span className="text-xl">%</span></strong>
          <div className="mt-[13px] h-1.5 overflow-hidden rounded-full bg-slate-soft"><i className="block h-full rounded-full bg-brand" style={{ width: "74%" }} /></div>
          <small className="mt-2 block text-[9px] text-[#8b9a9f]">3 de 4 sectores en operación normal</small>
        </div>
        <div className="rounded-lg border border-[#e1e8ea] bg-white p-4 shadow-card">
          <span className="text-[9px] tracking-[0.1em] text-[#8c9ca0]">SECTOR A</span>
          <strong className="mt-2.5 block font-barlow text-[32px] text-[#214451]">82%</strong>
          <small className="mt-2 block text-[9px] text-[#8b9a9f]">Materia prima</small>
        </div>
        <div className="rounded-lg border border-[#e1e8ea] bg-white p-4 shadow-card">
          <span className="text-[9px] tracking-[0.1em] text-[#8c9ca0]">SECTOR B</span>
          <strong className="mt-2.5 block font-barlow text-[32px] text-amber">91%</strong>
          <small className="mt-2 block text-[9px] text-[#8b9a9f]">Biodegradables</small>
        </div>
        <div className="rounded-lg border border-[#e1e8ea] bg-white p-4 shadow-card">
          <span className="text-[9px] tracking-[0.1em] text-[#8c9ca0]">SECTOR C</span>
          <strong className="mt-2.5 block font-barlow text-[32px] text-[#214451]">48%</strong>
          <small className="mt-2 block text-[9px] text-[#8b9a9f]">Insumos</small>
        </div>
      </div>

      <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
        <div className="mb-[18px] flex items-start justify-between gap-3">
          <div><div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">UBICACIONES Y ALERTAS</div><h3 className="m-0 font-barlow text-[21px] text-[#214451]">Inventario crítico</h3></div>
          <ActionButton variant="secondary"><MapPin size={15} /> Mapa de sectores</ActionButton>
        </div>
        <Table
          headers={["Código", "Material", "Ubicación física", "Stock", "Vencimiento", "Nivel"]}
          rows={stockRows}
          renderCell={(cell, j) =>
            j === 5 ? <Badge tone={cell === "Crítico" ? "red" : cell === "Atención" ? "amber" : "green"}>{cell}</Badge> :
              j === 4 && cell !== "—" ? <span className={cell === "12 sep 2026" ? "font-bold text-red" : ""}>{cell}</span> : cell
          }
        />
      </div>

      <div className="mt-3.5 grid grid-cols-[1.25fr_0.75fr] gap-3.5 max-[1100px]:grid-cols-1">
        <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
          <div className="mb-[18px] flex items-start justify-between gap-3">
            <div><div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">ALERTAS DE VENCIMIENTO</div><h3 className="m-0 font-barlow text-[21px] text-[#214451]">Acciones sugeridas</h3></div>
            <AlertTriangle size={18} className="text-amber" />
          </div>
          <div className="flex items-center gap-2.5 py-[11px]">
            <IconBox icon={AlertTriangle} tone="amber" />
            <div className="flex-1"><strong className="block text-[11px] text-[#49656e]">PLA-014 · vence en 25 días</strong><span className="mt-1 block text-[9px] text-[#91a0a4]">1.280 kg · sugerido priorizar en producción</span></div>
            <button className="rounded border border-[#e1e8ea] px-[7px] py-[5px] text-[9px] font-bold text-brand" onClick={() => fakeAction("Prioridad aplicada al lote PLA-014")}>Priorizar</button>
          </div>
          <div className="flex items-center gap-2.5 border-t border-[#edf1f2] py-[11px]">
            <IconBox icon={Clock3} tone="slate" />
            <div className="flex-1"><strong className="block text-[11px] text-[#49656e]">TINT-NEG-041 · vence en 104 días</strong><span className="mt-1 block text-[9px] text-[#91a0a4]">180 kg · revisar rotación FEFO</span></div>
            <button className="rounded border border-[#e1e8ea] px-[7px] py-[5px] text-[9px] font-bold text-brand" onClick={() => fakeAction("Rotación FEFO marcada")}>Revisar</button>
          </div>
        </div>

        <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
          <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">REFERENCIA DE UBICACIÓN</div>
          <h3 className="mb-0 mt-1 font-barlow text-[21px] text-[#214451]">Mapa operativo</h3>
          <div className="mt-3.5 grid grid-cols-2 gap-[7px]">
            <span className="min-h-14 rounded-[5px] bg-[#4d8190] p-2.5 font-barlow text-[23px] text-white">A <small className="block font-sans text-[8px] text-white/80">82%</small></span>
            <span className="min-h-14 rounded-[5px] bg-[#d49a43] p-2.5 font-barlow text-[23px] text-white">B <small className="block font-sans text-[8px] text-white/80">91%</small></span>
            <span className="min-h-14 rounded-[5px] bg-[#8ba8ad] p-2.5 font-barlow text-[23px] text-white">C <small className="block font-sans text-[8px] text-white/80">48%</small></span>
            <span className="min-h-14 rounded-[5px] bg-[#426876] p-2.5 font-barlow text-[23px] text-white">D <small className="block font-sans text-[8px] text-white/80">Exp.</small></span>
          </div>
        </div>
      </div>
    </>
  );
}