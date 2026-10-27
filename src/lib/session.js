const KEY = "codevia.session";

/**
 * La sesión (token + datos del usuario) se guarda en sessionStorage:
 * sobrevive a F5 pero se pierde al cerrar la pestaña.
 * NUNCA se guarda la contraseña.
 */
export function loadSession() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token && parsed?.user ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(KEY);
}
