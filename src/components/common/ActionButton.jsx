const variants = {
    primary: "text-white bg-brand shadow-[0_4px_10px_rgba(20,92,115,0.16)] hover:bg-brand-dark hover:-translate-y-px",
    secondary: "text-[#5e747c] bg-white border border-[#d9e3e6] hover:text-brand hover:border-[#9ebbc5]",
    link: "bg-transparent text-brand font-bold",
};

export default function ActionButton({ variant = "primary", full = false, className = "", children, ...props }) {
    return (
        <button
            className={`inline-flex items-center justify-center gap-[7px] rounded-md text-[11px] font-bold transition-all duration-150 active:scale-[0.98] ${variant === "link" ? "" : "px-[14px] py-[10px]"
                } ${variants[variant]} ${full ? "w-full" : ""} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}