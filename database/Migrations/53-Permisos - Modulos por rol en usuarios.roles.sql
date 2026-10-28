-- =====================================================================
-- 53 - Parámetros -> Permisos: columna "modulos" en usuarios.roles
-- Ejecutar en el SQL Editor de Supabase (después de 50, 51 y 52).
--
-- Incluye:
--  1. Columna "modulos text[]" en usuarios.roles con valores iniciales
--  2. Actualización de login y validar_sesion para devolver rol_modulos
--  3. Actualización de listar_roles_gestion para incluir modulos
--  4. Función usuarios.actualizar_modulos_rol(p_token, p_id_rol, p_modulos)
--     (id_rol = 1 tiene siempre acceso total y no puede restringirse)
-- =====================================================================

-- 1. Agregar columna modulos a usuarios.roles
ALTER TABLE usuarios.roles
    ADD COLUMN IF NOT EXISTS modulos TEXT[];

-- Inicializar los roles existentes que aún tengan modulos en NULL
UPDATE usuarios.roles
SET modulos = ARRAY[
    'overview',
    'production',
    'warehouse',
    'dispatch',
    'orders',
    'reports',
    'it-admin',
    'rrhh'
]
WHERE id_rol = 1
  AND (modulos IS NULL OR cardinality(modulos) = 0);

UPDATE usuarios.roles
SET modulos = ARRAY['overview', 'it-admin']
WHERE id_rol = 7
  AND modulos IS NULL;

UPDATE usuarios.roles
SET modulos = ARRAY['overview', 'rrhh']
WHERE id_rol IN (11, 15)
  AND modulos IS NULL;

UPDATE usuarios.roles
SET modulos = ARRAY[
    'overview',
    'production',
    'warehouse',
    'dispatch',
    'orders',
    'reports'
]
WHERE modulos IS NULL;

-- ---------------------------------------------------------------------
-- Actualizar helpers de permisos para contemplar también r.modulos
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.fn_es_admin_sistema(p_token UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'usuarios', 'extensions', 'public'
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM usuarios.usuarios u
        JOIN usuarios.roles r ON r.id_rol = u.id_rol
        WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
          AND u.estado = 'A'
          AND (
              u.id_rol IN (1, 7)
              OR 'it-admin' = ANY(coalesce(r.modulos, ARRAY[]::text[]))
          )
    );
$$;

REVOKE ALL ON FUNCTION usuarios.fn_es_admin_sistema(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION usuarios.fn_puede_gestionar_rrhh(p_token UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'usuarios', 'extensions', 'public'
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM usuarios.usuarios u
        JOIN usuarios.roles r ON r.id_rol = u.id_rol
        WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
          AND u.estado = 'A'
          AND (
              u.id_rol IN (1, 11, 15)
              OR 'rrhh' = ANY(coalesce(r.modulos, ARRAY[]::text[]))
          )
    );
$$;

REVOKE ALL ON FUNCTION usuarios.fn_puede_gestionar_rrhh(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Actualizar LOGIN y VALIDAR_SESION para devolver rol_modulos
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
    rol_modulos           TEXT[],
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
    SELECT * INTO v_user
    FROM usuarios.usuarios u
    WHERE lower(u.usuario_login) = lower(trim(p_usuario))
      AND u.estado = 'A';

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF v_user.password_hash IS NULL
       OR crypt(p_password, v_user.password_hash) <> v_user.password_hash THEN
        RETURN;
    END IF;

    v_token := gen_random_uuid();

    INSERT INTO usuarios.sesion (id_usuario, token_hash)
    VALUES (v_user.id_usuario, encode(digest(v_token::text, 'sha256'), 'hex'));

    INSERT INTO usuarios.historial_login (id_usuario, usuario_login, fec_login)
    VALUES (v_user.id_usuario, v_user.usuario_login, now());

    DELETE FROM usuarios.sesion WHERE fec_expira < now();

    RETURN QUERY
    SELECT v_token,
           v_user.id_usuario,
           v_user.nombre,
           v_user.apellido,
           v_user.usuario_login,
           v_user.email,
           v_user.id_rol,
           r.nombre,
           r.modulos,
           v_user.debe_cambiar_password
    FROM usuarios.roles r
    WHERE r.id_rol = v_user.id_rol;
END;
$$;

DROP FUNCTION IF EXISTS usuarios.validar_sesion(UUID);

CREATE OR REPLACE FUNCTION usuarios.validar_sesion(p_token UUID)
RETURNS TABLE (
    id_usuario            INTEGER,
    nombre                VARCHAR,
    apellido              VARCHAR,
    usuario_login         VARCHAR,
    email                 VARCHAR,
    id_rol                INTEGER,
    rol_nombre            VARCHAR,
    rol_modulos           TEXT[],
    debe_cambiar_password BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT u.id_usuario,
           u.nombre,
           u.apellido,
           u.usuario_login,
           u.email,
           u.id_rol,
           r.nombre,
           r.modulos,
           u.debe_cambiar_password
    FROM usuarios.usuarios u
    JOIN usuarios.roles r ON r.id_rol = u.id_rol
    WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token);
$$;

-- ---------------------------------------------------------------------
-- 3. Actualizar listar_roles_gestion para incluir modulos
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS usuarios.listar_roles_gestion(UUID);

CREATE OR REPLACE FUNCTION usuarios.listar_roles_gestion(p_token UUID)
RETURNS TABLE(
    id_rol            integer,
    nombre            text,
    descripcion       text,
    estado            text,
    modulos           text[],
    usu_alta          text,
    fec_alta          timestamp,
    usu_mod           text,
    fec_mod           timestamp,
    cantidad_usuarios bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'usuarios', 'extensions', 'public'
AS $$
    SELECT
        r.id_rol::integer,
        r.nombre::text,
        coalesce(r.descripcion, '')::text AS descripcion,
        r.estado::text,
        coalesce(r.modulos, ARRAY['overview']::text[]) AS modulos,
        r.usu_alta::text,
        r.fec_alta,
        r.usu_mod::text,
        r.fec_mod,
        count(u.id_usuario)::bigint AS cantidad_usuarios
    FROM usuarios.roles r
    LEFT JOIN usuarios.usuarios u ON u.id_rol = r.id_rol
    WHERE usuarios.fn_es_admin_sistema(p_token)
    GROUP BY r.id_rol, r.nombre, r.descripcion, r.estado, r.modulos, r.usu_alta, r.fec_alta, r.usu_mod, r.fec_mod
    ORDER BY r.id_rol ASC;
$$;

-- Al crear un rol nuevo, por defecto nace con ['overview']
CREATE OR REPLACE FUNCTION usuarios.crear_rol_autorizado(
    p_token       UUID,
    p_nombre      TEXT,
    p_descripcion TEXT,
    p_estado      TEXT DEFAULT 'A'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'usuarios', 'extensions', 'public'
AS $$
DECLARE
    v_actor_id    integer;
    v_actor_login text;
    v_nombre      text := trim(coalesce(p_nombre, ''));
    v_nuevo_id    integer;
BEGIN
    v_actor_id := usuarios.fn_usuario_de_token(p_token);

    SELECT u.usuario_login INTO v_actor_login
    FROM usuarios.usuarios u
    WHERE u.id_usuario = v_actor_id
      AND u.estado = 'A'
      AND usuarios.fn_es_admin_sistema(p_token);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado para crear roles';
    END IF;

    IF v_nombre = '' THEN
        RAISE EXCEPTION 'El nombre del rol es obligatorio';
    END IF;

    IF p_estado NOT IN ('A', 'I', 'E') THEN
        RAISE EXCEPTION 'Estado inválido';
    END IF;

    IF EXISTS (
        SELECT 1 FROM usuarios.roles r
        WHERE lower(trim(r.nombre)) = lower(v_nombre)
    ) THEN
        RAISE EXCEPTION 'Ya existe un rol con el nombre "%"', v_nombre;
    END IF;

    INSERT INTO usuarios.roles (
        nombre,
        descripcion,
        estado,
        modulos,
        usu_alta,
        fec_alta
    ) VALUES (
        v_nombre,
        nullif(trim(coalesce(p_descripcion, '')), ''),
        p_estado,
        ARRAY['overview'],
        coalesce(v_actor_login, 'SISTEMA'),
        now()
    )
    RETURNING id_rol INTO v_nuevo_id;

    RETURN v_nuevo_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. ACTUALIZAR MÓDULOS (PERMISOS) DE UN ROL
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.actualizar_modulos_rol(
    p_token   UUID,
    p_id_rol  INTEGER,
    p_modulos TEXT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'usuarios', 'extensions', 'public'
AS $$
DECLARE
    v_actor_id    integer;
    v_actor_login text;
    v_limpios     text[];
BEGIN
    v_actor_id := usuarios.fn_usuario_de_token(p_token);

    SELECT u.usuario_login INTO v_actor_login
    FROM usuarios.usuarios u
    WHERE u.id_usuario = v_actor_id
      AND u.estado = 'A'
      AND usuarios.fn_es_admin_sistema(p_token);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado para modificar permisos de roles';
    END IF;

    IF p_id_rol = 1 THEN
        RAISE EXCEPTION 'El rol Administrador (id_rol 1) tiene acceso total y sus permisos no pueden modificarse';
    END IF;

    SELECT coalesce(array_agg(DISTINCT trim(m)), ARRAY[]::text[])
    INTO v_limpios
    FROM unnest(coalesce(p_modulos, ARRAY[]::text[])) AS m
    WHERE trim(coalesce(m, '')) <> '';

    UPDATE usuarios.roles
    SET modulos = v_limpios,
        usu_mod = v_actor_login,
        fec_mod = now()
    WHERE id_rol = p_id_rol;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el rol indicado';
    END IF;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION usuarios.login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.validar_sesion(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_roles_gestion(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.crear_rol_autorizado(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.actualizar_modulos_rol(UUID, INTEGER, TEXT[]) TO anon, authenticated;
