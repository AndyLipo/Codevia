export default function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-[18px] max-md:flex-col max-md:items-start">
      <div className="min-w-0">
        <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">
          {eyebrow}
        </div>

        <h1 className="m-0 font-barlow text-[38px] leading-[0.95] tracking-[-0.6px] text-[#173c4b] max-md:text-[34px] max-md:leading-7">
          {title}
        </h1>

        {description && (
          <p className="mt-[9px] mb-0 text-[13px] text-[#829298] max-md:max-w-[520px] max-md:text-[12px]">
            {description}
          </p>
        )}
      </div>

      {action && (
        <div className="shrink-0 max-md:w-full">
          {action}
        </div>
      )}
    </div>
  );
}