/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { clearSession, loadSession, saveSession } from "@/lib/session";
import { resolveRole } from "@/data/mockData";

const AuthContext = createContext(null);

const usuariosRpc = (fn, args) => supabase.schema("usuarios").rpc(fn, args);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession());
  // Si hay una sesión guardada, hay que validarla contra la base antes de mostrar nada.
  const [checking, setChecking] = useState(() => loadSession() !== null);

  useEffect(() => {
    const stored = loadSession();
    if (!stored) return;

    let cancelled = false;

    (async () => {
      const { data, error } = await usuariosRpc("validar_sesion", { p_token: stored.token });
      if (cancelled) return;

      const user = data?.[0];
      if (error || !user) {
        clearSession();
        setSession(null);
      } else {
        const fresh = { token: stored.token, user };
        saveSession(fresh);
        setSession(fresh);
      }
      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (usuario, password) => {
    const { data, error } = await usuariosRpc("login", {
      p_usuario: usuario.trim(),
      p_password: password,
    });

    if (error) {
      console.error("Error de login:", error.message);
      return { ok: false, message: "No se pudo iniciar sesión. Probá de nuevo." };
    }

    const row = data?.[0];
    if (!row) return { ok: false, message: "Usuario o contraseña incorrectos." };

    const { token, ...user } = row;
    const next = { token, user };
    saveSession(next);
    setSession(next);
    return { ok: true };
  }, []);

  const changePassword = useCallback(
    async (actual, nueva) => {
      if (!session) return { ok: false, message: "Sesión inválida." };

      const { data, error } = await usuariosRpc("cambiar_password", {
        p_token: session.token,
        p_password_actual: actual,
        p_password_nueva: nueva,
      });

      if (error) return { ok: false, message: error.message };
      if (!data) return { ok: false, message: "No se pudo actualizar la contraseña." };

      const next = { ...session, user: { ...session.user, debe_cambiar_password: false } };
      saveSession(next);
      setSession(next);
      return { ok: true };
    },
    [session]
  );

  const logout = useCallback(async () => {
    const token = session?.token;
    clearSession();
    setSession(null);
    if (token) {
      // Se invalida en el servidor; si falla, igual se cerró localmente.
      await usuariosRpc("logout", { p_token: token }).catch(() => {});
    }
  }, [session]);

  const value = useMemo(
    () => ({
      checking,
      isAuthenticated: !!session,
      token: session?.token ?? null,
      user: session?.user ?? null,
      role: session ? resolveRole(session.user.rol_nombre, session.user.id_rol) : null,
      login,
      logout,
      changePassword,
    }),
    [checking, session, login, logout, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
