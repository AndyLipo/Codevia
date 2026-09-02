export default function IconBox({ icon: Icon, tone = "blue" }) {
  const tones = {
    blue: "bg-[#e9f2f5] text-[#145c73]",
    green: "bg-[#e6f5ee] text-[#3f9d77]",
    amber: "bg-[#fff4df] text-[#d58b27]",
    slate: "bg-[#edf1f2] text-[#71828a]",
    red: "bg-[#fbeae8] text-[#c95e53]",
  };

  return (
    <span
      className={`grid h-[33px] w-[33px] place-items-center rounded-[7px] ${tones[tone] ?? tones.blue
        }`}
    >
      <Icon size={17} strokeWidth={2.1} />
    </span>
  );
}