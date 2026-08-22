import IconBox from "./IconBox";

export default function Kpi({ icon, label, value, trend, note, tone }) {
  return (
    <div className="kpi">
      <IconBox icon={icon} tone={tone} />
      <div className="kpi-label">{label}</div>
      <strong>{value}</strong>
      <div className="kpi-meta">
        <span className={`trend ${tone}`}>{trend}</span>
        <span>{note}</span>
      </div>
    </div>
  );
}
