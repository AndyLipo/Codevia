export default function SystemConfig({ fakeAction }) {
    const fields = [
        { label: "Nombre de la planta", value: "Brother Plast SRL — BP · 01" },
        { label: "Zona horaria", value: "GMT-3 (Buenos Aires)" },
        { label: "Umbral de alerta de vencimiento", value: "30 días antes" },
        { label: "Ocupación crítica de sector", value: "≥ 90%" },
        { label: "Tiempo objetivo de carga", value: "04:00 h" },
    ];

    return (
        <div className="rounded-lg border border-[#e1e8ea] bg-white p-5 shadow-card">
            <div className="mb-[18px] flex items-start justify-between gap-3">
                <div>
                    <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82979e]">CONFIGURACIÓN</div>
                    <h3 className="m-0 font-barlow text-[21px] text-[#214451]">Parámetros generales</h3>
                </div>
            </div>
            <div className="flex flex-col divide-y divide-[#edf1f2]">
                {fields.map((f) => (
                    <div key={f.label} className="flex items-center justify-between py-3">
                        <span className="text-[12px] text-[#49656e]">{f.label}</span>
                        <div className="flex items-center gap-3">
                            <span className="text-[12px] font-semibold text-[#173d4b]">{f.value}</span>
                            <button
                                className="rounded-md border border-[#e1e8ea] px-2 py-1 text-[10px] font-bold text-brand"
                                onClick={() => fakeAction(`Edición de "${f.label}" en preparación`)}
                            >
                                Editar
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}