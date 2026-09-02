import { CheckCircle2, Truck } from "lucide-react";

export default function RouteStep({ label, detail, done, current }) {
  return (
    <div className="relative flex gap-[13px] pb-[22px] last:pb-0">
      <div
        className={`z-[1] grid h-[17px] w-[17px] place-items-center rounded-full ${done ? "bg-green-soft text-green" : current ? "bg-brand-soft text-brand shadow-[0_0_0_4px_#f1f7f8]" : "bg-slate-soft text-[#9aabb0]"
          }`}
      >
        {done ? <CheckCircle2 size={15} /> : current ? <Truck size={14} /> : <span />}
      </div>
      <div>
        <strong className="block text-[11px] text-[#48636c]">{label}</strong>
        <span className="mt-1 block text-[9px] text-[#96a4a8]">{detail}</span>
      </div>
    </div>
  );
}