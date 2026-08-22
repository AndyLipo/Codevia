export default function Footer() {
  return (
    <footer className="footer">
      <span>Brother Plast SRL · Prototipo exploratorio</span>
      <span>
        Última sincronización <strong>hace 2 min</strong> ·{" "}
        <span className="online">
          <span className="status-pulse" /> Sistema operativo
        </span>
      </span>
    </footer>
  );
}
