import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

export default function FormLogin() {
    const { login } = useAuth();
    const [usuario, setUsuario] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const result = await login(usuario, password);

        setLoading(false);

        if (!result.ok) setError(result.message);
    };

    return (
        <form onSubmit={handleSubmit} className="mb-4.5 space-y-4">
            <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                    Usuario
                </Label>
                <Input
                    type="text"
                    placeholder="BP12345678"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    autoComplete="username"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="h-10 border-[#dfe7e9] bg-white text-[12px] text-ink-soft"
                    required
                />
            </div>

            <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-ink">
                    Contraseña
                </Label>
                <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="h-10 border-[#dfe7e9] bg-white text-[12px] text-ink-soft"
                    required
                />
            </div>

            {error && (
                <p className="rounded-md border border-[#f1cfcb] bg-red-soft px-3 py-2 text-[11px] text-red">
                    {error}
                </p>
            )}

            <button
                type="submit"
                disabled={loading || !usuario.trim() || !password}
                className="flex w-full items-center justify-center gap-1.75 rounded-md bg-brand py-2.5 text-[11px] font-bold text-white shadow-[0_4px_10px_rgba(20,92,115,0.16)] transition-all hover:-translate-y-px hover:bg-brand-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
                {loading ? "Verificando..." : "Entrar al puesto"}
                {!loading && <ArrowUpRight size={18} />}
            </button>
        </form>
    );
}
