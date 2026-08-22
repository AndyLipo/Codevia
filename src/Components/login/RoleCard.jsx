import { CheckCircle2 } from "lucide-react";

export default function RoleCard({ roleItem, selected, onSelect }) {
  return (
    <button
      className={`role-card ${selected ? "selected" : ""}`}
      onClick={onSelect}
    >
      <span className="role-initials">{roleItem.initials}</span>
      <span>
        <strong>{roleItem.label}</strong>
        <small>{roleItem.note}</small>
      </span>
      {selected && <CheckCircle2 size={17} />}
    </button>
  );
}
