import { ArrowUpRight, Zap } from "lucide-react";
import RoleGrid from "@/components/login/RoleGrid";

export default function Login({ role, setRole, setLogged, onAnatomy }) {
  return (
    <div className="login-page">
      <div className="login-visual">
        <div className="login-visual-inner">
          <div className="brand light">
            <div className="brand-mark">
              <img
                src="/manus-storage/brother-plast-mark_63a96de1.png"
                alt=""
              />
            </div>
            <div>
              <strong>
                brother<span>plast</span>
              </strong>
              <small>gestión industrial</small>
            </div>
          </div>
          <div className="visual-copy">
            <div className="module-tag">
              <span>MOD. 00</span>
              <i />
              <span>ACCESO / CONTROL</span>
            </div>
            <div className="eyebrow">PUESTO DE CONTROL · BP 01</div>
            <h1>
              La planta,
              <br />
              <em>en una sola lectura.</em>
            </h1>
            <p>
              Producción, depósito y expedición coordinados para que cada bobina
              encuentre su próximo destino.
            </p>
          </div>
          <div className="login-statline">
            <div>
              <strong>98,4%</strong>
              <span>trazabilidad de lotes</span>
            </div>
            <div>
              <strong>03:42 h</strong>
              <span>tiempo medio de carga</span>
            </div>
          </div>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-panel-inner">
          <div className="eyebrow">ACCESO AL SISTEMA</div>
          <h2>Ingresá a tu puesto</h2>
          <p className="login-lede">
            Elegí un rol para explorar la vista correspondiente.
          </p>

          <div className="login-console">
            <div>
              <span className="console-label">NODO</span>
              <strong>BP-01 / ONLINE</strong>
            </div>
            <div>
              <span className="console-label">SEÑALES</span>
              <strong>
                <i className="status-pulse" /> 04 ESTABLES
              </strong>
            </div>
            <div>
              <span className="console-label">ATENCIÓN</span>
              <strong className="amber-text">02 ABIERTAS</strong>
            </div>
          </div>

          <RoleGrid role={role} setRole={setRole} />

          <button className="primary-cta full" onClick={() => setLogged(true)}>
            Entrar al puesto <ArrowUpRight size={18} />
          </button>
          <div className="login-note">
            <Zap size={14} /> Datos de demostración · sin credenciales reales
          </div>
          <button className="anatomy-link" onClick={onAnatomy}>
            Ver anatomía de interfaz <ArrowUpRight size={13} />
          </button>
        </div>
        <div className="login-footer">
          Brother Plast SRL <span>v0.9 · Exploración</span>
        </div>
      </div>
    </div>
  );
}
