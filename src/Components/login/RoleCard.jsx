import { CheckCircle2 } from "lucide-react";

export default function RoleCard({ roleItem, selected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-[11px] rounded-[7px] border p-[11px] text-left text-[#47626c] transition-all duration-[180ms] cursor-pointer ${selected
        ? "border-[#7daebc] bg-[#f2f8f9] shadow-[0_4px_15px_rgba(20,92,115,0.08)]"
        : "border-[#dfe7e9] bg-white hover:border-[#7daebc] hover:shadow-[0_4px_15px_rgba(20,92,115,0.08)]"
        }`}
    >
      <span className="grid h-[30px] w-[30px] place-items-center rounded-[6px] bg-brand-soft font-barlow text-[12px] font-bold text-brand">
        {roleItem.initials}
      </span>

      <span className="flex-1">
        <strong className="block text-[11px]">
          {roleItem.label}
        </strong>

        <small className="mt-[2px] block text-[9px] text-[#92a1a6]">
          {roleItem.note}
        </small>
      </span>

      {selected && (
        <CheckCircle2
          size={17}
          className="text-green"
        />
      )}
    </button>
  );
}