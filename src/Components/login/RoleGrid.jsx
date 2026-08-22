import RoleCard from "./RoleCard";
import { roleOptions } from "@/data/mockData";

export default function RoleGrid({ role, setRole }) {
  return (
    <div className="role-grid">
      {roleOptions.map((r) => (
        <RoleCard
          key={r.id}
          roleItem={r}
          selected={role.id === r.id}
          onSelect={() => setRole(r)}
        />
      ))}
    </div>
  );
}
