import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

import RoleGrid from "@/components/login/RoleGrid";
import { supabase } from "@/lib/supabaseClient";
import logo from "/logo-codevia1.png";

export default function Login({
  role,
  setRole,
  setLogged,
  usuarioActual,
  setUsuarioActual,
  onAnatomy,
}) {
  const [usuarios, setUsuarios] = useState([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [errorUsuarios, setErrorUsuarios] = useState("");

  useEffect(() => {
    let cancelado = false;

    async function cargarUsuarios() {
      setLoadingUsuarios(true);
      setErrorUsuarios("");

      const { data, error } = await supabase
        .schema("usuarios")
        .from("usuarios")
        .select(
          "id_usuario, nombre, apellido, dni, email, usuario_login, id_rol, estado"
        )
        .eq("estado", "A")
        .order("nombre", { ascending: true });

      if (cancelado) return;

      if (error) {
        console.error("Error al cargar usuarios:", error);
        setErrorUsuarios(error.message);
        setUsuarios([]);
      } else {
        setUsuarios(data ?? []);
      }

      setLoadingUsuarios(false);
    }

    cargarUsuarios();

    return () => {
      cancelado = true;
    };
  }, []);

  const handleLogin = () => {
    if (!usuarioActual) {
      toast.error("Seleccioná el usuario que va a operar el sistema.");
      return;
    }

    if (!usuarioActual.usuario_login) {
      toast.error(
        "El usuario seleccionado no tiene usuario_login configurado."
      );
      return;
    }

    setLogged(true);
  };

  return (
    <div className="grid min-h-screen grid-cols-[1.08fr_0.92fr] bg-[#f4f6f7] max-[760px]:grid-cols-1">
      {/* Panel visual izquierdo */}
      <div className="relative overflow-hidden bg-brand text-white max-[760px]:min-h-97.5">
        <div
          className="absolute inset-0 opacity-65"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div
          className="absolute -bottom-30 -right-42.5 h-145 w-145 rounded-full border border-white/15"
          style={{
            boxShadow:
              "0 0 0 44px rgba(255,255,255,0.025), 0 0 0 90px rgba(255,255,255,0.025)",
          }}
        />

        <div className="relative z-10 mx-auto flex h-full max-w-155 flex-col px-[8vw] py-10.5 max-[760px]:px-7 max-[760px]:py-6.75">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg">
              <img src={logo} alt="Logo Brother Plast" />
            </div>

            <div>
              <strong className="block font-barlow text-[22px] leading-4.5 tracking-[-0.3px] text-white">
                brother<span className="text-amber">plast</span>
              </strong>

              <small className="mt-0.75 block text-[8px] uppercase tracking-[0.12em] text-white/70">
                gestión industrial
              </small>
            </div>
          </div>

          <div className="mb-10 mt-auto max-w-117.5 max-[760px]:mb-8">
            <h1 className="mt-0 font-barlow text-[70px] leading-[0.88] tracking-[-1.2px] max-[760px]:text-[54px]">
              La planta,
              <br />
              <em className="not-italic text-[#e7ae54]">
                en una sola lectura.
              </em>
            </h1>

            <p className="mt-6 max-w-95 text-sm leading-relaxed text-[#b9d3d9]">
              Producción, depósito y expedición coordinados para que cada
              bobina encuentre su próximo destino.
            </p>
          </div>

          <div className="mb-20 flex gap-17.5 max-[760px]:mb-0 max-[760px]:gap-7.5">
            <div>
              <strong className="block font-barlow text-[29px]">98,4%</strong>
              <span className="mt-0.75 block text-[10px] text-[#b9d3d9]">
                trazabilidad de lotes
              </span>
            </div>

            <div>
              <strong className="block font-barlow text-[29px]">03:42 h</strong>
              <span className="mt-0.75 block text-[10px] text-[#b9d3d9]">
                tiempo medio de carga
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Panel de ingreso */}
      <div className="mb-2.5 flex flex-col justify-between">
        <div className="mx-auto my-auto w-[min(460px,calc(100%-80px))] py-6.25 max-[760px]:w-[calc(100%-42px)]">
          <div className="text-[9px] tracking-[0.16em] text-[#82979e]">
            ACCESO AL SISTEMA
          </div>

          <h2 className="m-0 font-barlow text-[38px] tracking-[-0.4px] text-[#173d4b]">
            Ingresá a tu puesto
          </h2>

          <p className="mb-3.75 mt-2.25 text-xs text-[#829298]">
            Seleccioná el usuario y el rol que querés utilizar en el prototipo.
          </p>

          <div className="mb-4">
            <label
              htmlFor="usuarioActual"
              className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#82979e]"
            >
              Usuario
            </label>

            <select
              id="usuarioActual"
              value={usuarioActual?.id_usuario ?? ""}
              disabled={loadingUsuarios || usuarios.length === 0}
              onChange={(event) => {
                const seleccionado = usuarios.find(
                  (u) => String(u.id_usuario) === event.target.value
                );

                setUsuarioActual(seleccionado ?? null);
              }}
              className="h-10 w-full rounded-md border border-[#dfe7e9] bg-white px-3 text-sm text-[#47626c] outline-none focus:border-[#7daebc]"
            >
              <option value="">
                {loadingUsuarios
                  ? "Cargando usuarios..."
                  : "Seleccionar usuario"}
              </option>

              {usuarios.map((usuario) => (
                <option
                  key={usuario.id_usuario}
                  value={String(usuario.id_usuario)}
                >
                  {usuario.nombre.trim()} {usuario.apellido.trim()} —{" "}
                  {usuario.email}
                </option>
              ))}
            </select>

            {errorUsuarios && (
              <p className="mt-2 text-xs text-red-600">
                Error al cargar usuarios: {errorUsuarios}
              </p>
            )}

            {!loadingUsuarios &&
              !errorUsuarios &&
              usuarios.length === 0 && (
                <p className="mt-2 text-xs text-[#829298]">
                  No hay usuarios activos disponibles.
                </p>
              )}
          </div>

          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#82979e]">
            Rol de la vista
          </div>

          <RoleGrid role={role} setRole={setRole} />

          <button
            type="button"
            disabled={
              loadingUsuarios ||
              !usuarioActual ||
              !usuarioActual.usuario_login
            }
            onClick={handleLogin}
            className="flex w-full cursor-pointer items-center justify-center gap-1.75 rounded-md bg-brand py-2.5 text-[11px] font-bold text-white shadow-[0_4px_10px_rgba(20,92,115,0.16)] transition-all hover:-translate-y-px hover:bg-brand-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Entrar al puesto <ArrowUpRight size={18} />
          </button>

          {onAnatomy && (
            <button
              type="button"
              onClick={onAnatomy}
              className="mt-3 w-full text-center text-[10px] text-[#829298] hover:underline"
            >
              Ver anatomía del sistema
            </button>
          )}
        </div>
      </div>
    </div>
  );
}