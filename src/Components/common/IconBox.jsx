export default function IconBox({ icon: Icon, tone = "blue" }) {
    return (
        <span className={`icon-box icon-${tone}`}>
            <Icon size={17} strokeWidth={2.1} />
        </span>
    );
}