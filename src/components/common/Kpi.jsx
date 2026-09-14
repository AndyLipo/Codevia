import IconBox from "./IconBox";

export default function Kpi({
  icon,
  label,
  value,
  trend,
  note,
  tone,
}) {
  const trendColors = {
    blue: "text-[#145c73]",
    green: "text-[#3f9d77]",
    amber: "text-[#d58b27]",
    slate: "text-[#788b92]",
    red: "text-[#c95e53]",
  };

  return (
    <div className="relative min-h-[143px] rounded-[8px] border border-[#e1e8ea] bg-white p-[17px] shadow-[0_12px_30px_rgba(22,50,61,0.06)]">
      <IconBox icon={icon} tone={tone} />

      <div className="mt-[15px] text-[11px] text-[#778b92]">
        {label}
      </div>

      <strong className="mt-[7px] block font-barlow text-[33px] leading-none tracking-[-0.5px] text-[#173d4b]">
        {value}
      </strong>

      <div className="mt-[7px] flex items-center gap-[6px] text-[9px] text-[#98a6aa]">
        <span
          className={`font-extrabold ${trendColors[tone] ?? trendColors.slate
            }`}
        >
          {trend}
        </span>

        <span>{note}</span>
      </div>
    </div>
  );
}