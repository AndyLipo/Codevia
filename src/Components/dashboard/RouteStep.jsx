import { CheckCircle2, Truck } from "lucide-react";

export default function RouteStep({ label, detail, done, current }) {
    return (
        <div className={`route-step ${done ? "done" : ""} ${current ? "current" : ""}`}>
            <div className="route-dot">{done ? <CheckCircle2 size={15} /> : current ? <Truck size={14} /> : <span />}</div>
            <div><strong>{label}</strong><span>{detail}</span></div>
        </div>
    );
}