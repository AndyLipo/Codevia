export default function Badge({ children, tone = "slate" }) {
  const tones = {
    blue: "bg-[#e9f2f5] text-[#145c73]",
    green: "bg-[#e7f4ed] text-[#328160]",
    amber: "bg-[#fff2d8] text-[#a76e1a]",
    red: "bg-[#fbe9e7] text-[#ba584d]",
    slate: "bg-[#edf1f2] text-[#6f8087]",
  };

  return (
    <span
      className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[7px] py-[5px] text-[9px] font-bold ${tones[tone] ?? tones.slate
        }`}
    >
      <span className="h-[5px] w-[5px] rounded-full bg-current" />
      {children}
    </span>
  );
}