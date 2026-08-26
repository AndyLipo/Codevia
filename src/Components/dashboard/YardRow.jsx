import { Truck } from "lucide-react";
import Badge from "@/Components/common/Badge";

export default function YardRow({ code, client, status, tone, progress }) {
  return (
    <div className="yard-row">
      <div className="yard-icon">
        <Truck size={16} />
      </div>
      <div className="yard-text">
        <strong>
          {code} · {client}
        </strong>
        <div className="yard-progress">
          <i style={{ width: progress }} />
        </div>
      </div>
      <Badge tone={tone}>{status}</Badge>
    </div>
  );
}
