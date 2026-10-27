-- =====================================================================
-- 50 - Autenticación por usuario_login + sesiones con token
-- Ejecutar en el SQL Editor de Supabase.
--
-- Cambios:
--  1. login por usuario_login (ya no por email)
--  2. el hash (bcrypt, pgcrypto) se guarda en usuarios.usuarios.password_hash
--  3. la validación compara con crypt(): es CASE-SENSITIVE para la contraseña
--  4. cambiar_password pone debe_cambiar_password = false
--  5. sesión por token (usuarios.sesion) para sobrevivir a F5 sin guardar la clave
--  6. registro histórico de inicios de sesión en usuarios.historial_login
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Columna del cambio obligatorio (si todavía no existe)
ALTER TABLE usuarios.usuarios
    ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT TRUE;

-- ---------------------------------------------------------------------
-- Tabla de sesiones. Se guarda el SHA-256 del token, nunca el token.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios.sesion (
    id_sesion   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario  INTEGER NOT NULL REFERENCES usuarios.usuarios (id_usuario),
    token_hash  TEXT NOT NULL UNIQUE,
    fec_alta    TIMESTAMP NOT NULL DEFAULT now(),
    fec_expira  TIMESTAMP NOT NULL DEFAULT (now() + interval '12 hours')
);

CREATE INDEX IF NOT EXISTS ix_sesion_usuario ON usuarios.sesion (id_usuario);

-- La tabla no debe ser accesible directamente desde el cliente
ALTER TABLE usuarios.sesion ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON usuarios.sesion FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- Tabla de auditoría de inicios de sesión (persiste aunque se haga logout)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios.historial_login (
    id_login      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario    INTEGER NOT NULL REFERENCES usuarios.usuarios (id_usuario),
    usuario_login VARCHAR(20) NOT NULL,
    fec_login     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_historial_login_usuario ON usuarios.historial_login (id_usuario);
CREATE INDEX IF NOT EXISTS ix_historial_login_fecha ON usuarios.historial_login (fec_login DESC);

ALTER TABLE usuarios.historial_login ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON usuarios.historial_login FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- Helper: token -> id_usuario (NULL si no existe, expiró o el usuario no está activo)
-- Lo van a usar el resto de las RPC para autorizar.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.fn_usuario_de_token(p_token UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT s.id_usuario
    FROM usuarios.sesion s
    JOIN usuarios.usuarios u ON u.id_usuario = s.id_usuario
    WHERE s.token_hash = encode(digest(p_token::text, 'sha256'), 'hex')
      AND s.fec_expira > now()
      AND u.estado = 'A';
$$;

-- ---------------------------------------------------------------------
-- LOGIN: usuario_login + contraseña
-- Devuelve el token (solo se entrega en este momento) y los datos del usuario.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS usuarios.login(TEXT, TEXT);

CREATE OR REPLACE FUNCTION usuarios.login(p_usuario TEXT, p_password TEXT)
RETURNS TABLE (
    token                 UUID,
    id_usuario            INTEGER,
    nombre                VARCHAR,
    apellido              VARCHAR,
    usuario_login         VARCHAR,
    email                 VARCHAR,
    id_rol                INTEGER,
    rol_nombre            VARCHAR,
    debe_cambiar_password BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user  usuarios.usuarios%ROWTYPE;
    v_token UUID;
BEGIN
    -- El usuario se busca sin distinguir mayúsculas; la contraseña SÍ las distingue.
    SELECT * INTO v_user
    FROM usuarios.usuarios u
    WHERE lower(u.usuario_login) = lower(trim(p_usuario))
      AND u.estado = 'A';

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Compara el hash bcrypt guardado contra la clave ingresada
    IF v_user.password_hash IS NULL
       OR crypt(p_password, v_user.password_hash) <> v_user.password_hash THEN
        RETURN;
    END IF;

    v_token := gen_random_uuid();

    INSERT INTO usuarios.sesion (id_usuario, token_hash)
    VALUES (v_user.id_usuario, encode(digest(v_token::text, 'sha256'), 'hex'));

    -- Registrar inicio de sesión para auditoría
    INSERT INTO usuarios.historial_login (id_usuario, usuario_login, fec_login)
    VALUES (v_user.id_usuario, v_user.usuario_login, now());

    -- Limpieza de sesiones vencidas
    DELETE FROM usuarios.sesion WHERE fec_expira < now();

    RETURN QUERY
    SELECT v_token, v_user.id_usuario, v_user.nombre, v_user.apellido,
           v_user.usuario_login, v_user.email, v_user.id_rol, r.nombre,
           v_user.debe_cambiar_password
    FROM usuarios.roles r
    WHERE r.id_rol = v_user.id_rol;
END;
$$;

-- ---------------------------------------------------------------------
-- VALIDAR SESIÓN (se llama al recargar la página con F5)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.validar_sesion(p_token UUID)
RETURNS TABLE (
    id_usuario            INTEGER,
    nombre                VARCHAR,
    apellido              VARCHAR,
    usuario_login         VARCHAR,
    email                 VARCHAR,
    id_rol                INTEGER,
    rol_nombre            VARCHAR,
    debe_cambiar_password BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT u.id_usuario, u.nombre, u.apellido, u.usuario_login, u.email,
           u.id_rol, r.nombre, u.debe_cambiar_password
    FROM usuarios.usuarios u
    JOIN usuarios.roles r ON r.id_rol = u.id_rol
    WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token);
$$;

-- ---------------------------------------------------------------------
-- CAMBIAR PASSWORD: valida sesión + clave actual, guarda hash nuevo
-- y pone debe_cambiar_password = false
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS usuarios.cambiar_password(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION usuarios.cambiar_password(
    p_token            UUID,
    p_password_actual  TEXT,
    p_password_nueva   TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_id   INTEGER := usuarios.fn_usuario_de_token(p_token);
    v_hash TEXT;
BEGIN
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'Sesión inválida o vencida';
    END IF;

    IF p_password_nueva IS NULL OR length(p_password_nueva) < 8 THEN
        RAISE EXCEPTION 'La contraseña debe tener al menos 8 caracteres';
    END IF;

    SELECT password_hash INTO v_hash
    FROM usuarios.usuarios WHERE id_usuario = v_id;

    IF crypt(p_password_actual, v_hash) <> v_hash THEN
        RAISE EXCEPTION 'La contraseña actual es incorrecta';
    END IF;

    IF crypt(p_password_nueva, v_hash) = v_hash THEN
        RAISE EXCEPTION 'La nueva contraseña debe ser distinta de la actual';
    END IF;

    UPDATE usuarios.usuarios
    SET password_hash         = crypt(p_password_nueva, gen_salt('bf', 12)),
        debe_cambiar_password = FALSE,
        fec_mod               = now()
    WHERE id_usuario = v_id;

    RETURN TRUE;
END;
$$;

-- ---------------------------------------------------------------------
-- LOGOUT: invalida el token
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.logout(p_token UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    DELETE FROM usuarios.sesion
    WHERE token_hash = encode(digest(p_token::text, 'sha256'), 'hex');
$$;

-- Permisos: solo las RPC públicas del flujo de autenticación
REVOKE ALL ON FUNCTION usuarios.fn_usuario_de_token(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.login(TEXT, TEXT)                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.validar_sesion(UUID)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.cambiar_password(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.logout(UUID)                      TO anon, authenticated;
