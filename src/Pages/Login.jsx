import { ArrowUpRight } from "lucide-react";
import { Sparkles } from 'lucide-react';

import RoleGrid from "@/components/login/RoleGrid";

export default function Login({ role, setRole, setLogged }) {
  return (
    <div className="login-page">
      <div className="login-visual">
        <div className="login-visual-inner">
          <div className="brand light">
            <div className="brand-mark">
              {/* <img
                src={<Sparkles />}
                alt=""
              /> */}
              <div>
                <Sparkles />
              </div>
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
          <RoleGrid role={role} setRole={setRole} />

          <button className="primary-cta full" onClick={() => setLogged(true)}>
            Entrar al puesto <ArrowUpRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
