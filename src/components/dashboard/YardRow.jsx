import { Truck } from "lucide-react";
import Badge from "@/components/common/Badge";

export default function YardRow({ code, client, status, tone, progress }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-[29px] w-[29px] place-items-center rounded-md bg-brand-soft text-brand">
        <Truck size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <strong className="block truncate text-[10px] text-[#35535d]">{code} · {client}</strong>
        <div className="mt-[7px] h-1 overflow-hidden rounded-full bg-slate-soft">
          <i className="block h-full rounded-full bg-brand" style={{ width: progress }} />
        </div>
      </div>
      <Badge tone={tone}>{status}</Badge>
    </div>
  );
}