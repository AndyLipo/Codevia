export default function Badge({ children, tone = "slate" }) {
    return (
        <span className={`badge badge-${tone}`}>
            <span className="badge-dot" />
            {children}
        </span>
    );
}