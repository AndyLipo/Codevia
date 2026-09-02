export default function Footer() {
  return (
    <footer className="mx-auto flex w-full max-w-[1440px] justify-between px-[38px] pb-7 pt-[22px] text-[9px] text-[#9ba8ac]">
      <span>Brother Plast SRL · Prototipo exploratorio</span>

      <span>
        Última sincronización{" "}
        <strong className="text-[#70868e]">hace 2 min</strong>{" "}
        ·{" "}
        <span className="ml-[5px] text-[#4b8f73]">
          <span className="mr-[5px] inline-block h-[7px] w-[7px] rounded-full bg-[#4fb288] shadow-[0_0_0_3px_#e6f5ee]" />
          Sistema operativo
        </span>
      </span>
    </footer>
  );
}