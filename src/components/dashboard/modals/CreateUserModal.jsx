import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";

const EMPTY = { nombre: "", apellido: "", dni: "", email: "", rolId: "" };
const labelCls = "text-[10px] font-bold uppercase tracking-widest text-muted-ink";
const inputCls = "h-9 border-[#dfe7e9] bg-white text-[11px] text-ink-soft";

export default function CreateUseroModal({ open, onOpenChange, onCreate }) {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [creado, setCreado] = useState(null); // { login, nombre }
    const [form, setForm] = useState(EMPTY);

    useEffect(() => {
        if (!open) return;

        const fetchRoles = async () => {
            const { data, error } = await supabase
                .schema("usuarios")
                .from("roles")
                .select("id_rol, nombre");

            if (error) {
                console.error("Error al traer roles:", error.message);
                return;
            }
            setRoles(data || []);
        };

        fetchRoles();
    }, [open]);

    const handleClose = (next) => {
        if (!next) {
            setForm(EMPTY);
            setError("");
            setCreado(null);
        }
        onOpenChange(next);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const { data, error: rpcError } = await supabase
            .schema("usuarios")
            .rpc("crear_usuario", {
                p_nombre: form.nombre.trim(),
                p_apellido: form.apellido.trim(),
                p_dni: form.dni.trim(),
                p_email: form.email.trim(),
                p_id_rol: Number(form.rolId),
            });

        setLoading(false);

        if (rpcError) {
            setError(rpcError.message);
            return;
        }

        setCreado({ login: data, nombre: `${form.nombre} ${form.apellido}` });
        onCreate?.({ usuario_login: data });
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-125 border border-[#e1e8ea] bg-white p-0 shadow-card">
                <DialogHeader className="border-b border-slate-soft bg-white px-6 py-5">
                    <DialogTitle className="font-barlow text-[25px] font-normal text-ink">
                        {creado ? "Usuario creado" : "Nuevo usuario"}
                    </DialogTitle>
                    <DialogDescription className="text-[12px] text-muted-ink">
                        {creado
                            ? "Pasale estos datos a la persona."
                            : "Dá de alta a un nuevo usuario del sistema."}
                    </DialogDescription>
                </DialogHeader>

                {creado ? (
                    <>
                        <div className="space-y-4 bg-white px-6 py-5">
                            <p className="text-[12px] text-ink-soft">
                                {creado.nombre} ya puede ingresar. Al entrar por primera vez, el sistema le va a pedir
                                que elija una contraseña nueva.
                            </p>
                            <div className="rounded-md border border-[#e1e8ea] bg-slate-soft px-4 py-3">
                                <div className={labelCls}>Usuario</div>
                                <div className="font-barlow text-[18px] text-ink">{creado.login}</div>
                                <div className={`${labelCls} mt-3`}>Contraseña inicial</div>
                                <div className="font-barlow text-[18px] text-ink">{creado.login}</div>
                            </div>
                        </div>
                        <DialogFooter className="border-t border-slate-soft bg-white px-6 py-4">
                            <Button
                                type="button"
                                onClick={() => handleClose(false)}
                                className="h-9 bg-green text-[11px] text-white hover:bg-[#328160]"
                            >
                                Listo
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-5 bg-white px-6 py-5">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label className={labelCls}>Nombre</Label>
                                    <Input
                                        placeholder="Nombre"
                                        value={form.nombre}
                                        onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                                        className={inputCls}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className={labelCls}>Apellido</Label>
                                    <Input
                                        placeholder="Apellido"
                                        value={form.apellido}
                                        onChange={(e) => setForm((p) => ({ ...p, apellido: e.target.value }))}
                                        className={inputCls}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label className={labelCls}>DNI</Label>
                                    <Input
                                        placeholder="38636078"
                                        inputMode="numeric"
                                        value={form.dni}
                                        onChange={(e) =>
                                            setForm((p) => ({ ...p, dni: e.target.value.replace(/\D/g, "") }))
                                        }
                                        className={inputCls}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className={labelCls}>Email</Label>
                                    <Input
                                        type="email"
                                        placeholder="nombre@brotherplast.com"
                                        value={form.email}
                                        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                                        className={inputCls}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className={labelCls}>Rol</Label>
                                <Select
                                    value={form.rolId}
                                    onValueChange={(value) => setForm((p) => ({ ...p, rolId: value }))}
                                >
                                    <SelectTrigger className={inputCls}>
                                        <SelectValue placeholder="Seleccionar rol" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map((rol) => (
                                            <SelectItem
                                                key={rol.id_rol}
                                                value={String(rol.id_rol)}
                                                className="bg-white text-[11px]"
                                            >
                                                {rol.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {error && (
                                <p className="rounded-md border border-[#f1cfcb] bg-red-soft px-3 py-2 text-[11px] text-red">
                                    {error}
                                </p>
                            )}
                        </div>

                        <DialogFooter className="border-t border-slate-soft bg-white px-6 py-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleClose(false)}
                                className="h-9 border-[#dce5e8] bg-white text-[11px] text-ink-soft hover:bg-slate-soft"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    loading ||
                                    !form.nombre ||
                                    !form.apellido ||
                                    !form.dni ||
                                    !form.email ||
                                    !form.rolId
                                }
                                className="h-9 bg-green text-[11px] text-white hover:bg-[#328160]"
                            >
                                {loading ? "Creando..." : "Crear usuario"}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}