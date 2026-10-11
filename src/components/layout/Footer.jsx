export default function Footer() {
  return (
    <footer className="mx-auto flex w-full max-w-360 justify-between px-9.5 pb-7 pt-5.5 text-[9px] text-[#9ba8ac]">
      <span>Brother Plast SRL · Prototipo exploratorio</span>

      <span>
        Última sincronización{" "}
        <strong className="text-[#70868e]">hace 2 min</strong>{" "}
        ·{" "}
        <span className="ml-1.25 text-[#4b8f73]">
          <span className="mr-1.25 inline-block h-1.75 w-1.75 rounded-full bg-[#4fb288] shadow-[0_0_0_3px_#e6f5ee]" />
          Sistema operativo
        </span>
      </span>
    </footer>
  );
}