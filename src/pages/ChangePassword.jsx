import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

const labelCls = "text-[10px] font-bold uppercase tracking-widest text-muted-ink";
const inputCls = "h-10 border-[#dfe7e9] bg-white text-[12px] text-ink-soft";

export default function ChangePassword() {
    const { user, changePassword, logout } = useAuth();
    const [actual, setActual] = useState("");
    const [nueva, setNueva] = useState("");
    const [repetir, setRepetir] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (nueva.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
        if (nueva !== repetir) return setError("Las contraseñas no coinciden.");
        if (nueva === actual) return setError("La nueva contraseña debe ser distinta de la actual.");

        setLoading(true);
        // Al guardar, el servidor pone debe_cambiar_password = false y la app pasa sola al Dashboard.
        const result = await changePassword(actual, nueva);
        setLoading(false);

        if (!result.ok) setError(result.message);
    };

    return (
        <div className="grid min-h-screen place-items-center bg-[#f4f6f7] px-4">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-110 space-y-4 rounded-lg border border-[#e1e8ea] bg-white p-7 shadow-card"
            >
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand">
                    <KeyRound size={20} />
                </div>

                <div>
                    <h2 className="m-0 font-barlow text-[30px] text-[#173d4b]">Elegí tu contraseña</h2>
                    <p className="mt-1 text-[12px] text-[#829298]">
                        Hola {user.nombre}. Por seguridad, antes de entrar tenés que reemplazar la contraseña inicial.
                    </p>
                </div>

                <div className="space-y-2">
                    <Label className={labelCls}>Contraseña actual</Label>
                    <Input
                        type="password"
                        value={actual}
                        onChange={(e) => setActual(e.target.value)}
                        autoComplete="current-password"
                        className={inputCls}
                        required
                    />
                </div>

                <div className="space-y-2">
                    <Label className={labelCls}>Contraseña nueva</Label>
                    <Input
                        type="password"
                        value={nueva}
                        onChange={(e) => setNueva(e.target.value)}
                        autoComplete="new-password"
                        className={inputCls}
                        required
                    />
                    <p className="text-[10px] text-[#98a6aa]">Mínimo 8 caracteres.</p>
                </div>

                <div className="space-y-2">
                    <Label className={labelCls}>Repetir contraseña</Label>
                    <Input
                        type="password"
                        value={repetir}
                        onChange={(e) => setRepetir(e.target.value)}
                        autoComplete="new-password"
                        className={inputCls}
                        required
                    />
                </div>

                {error && (
                    <p className="rounded-md border border-[#f1cfcb] bg-red-soft px-3 py-2 text-[11px] text-red">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={loading || !actual || !nueva || !repetir}
                    className="w-full rounded-md bg-brand py-2.5 text-[11px] font-bold text-white transition-all hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? "Guardando..." : "Guardar y entrar"}
                </button>

                <button type="button" onClick={logout} className="w-full text-[11px] text-[#829298] hover:text-brand">
                    Cancelar
                </button>
            </form>
        </div>
    );
}
