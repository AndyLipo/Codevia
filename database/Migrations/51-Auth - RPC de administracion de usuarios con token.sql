-- =====================================================================
-- 51 - Administración de usuarios, roles y auditoría con TOKEN DE SESIÓN
-- Requiere haber ejecutado antes el script 50.
--
-- Incluye:
--  1. Búsqueda de personas en administracion.recursos_humanos (nombre, apellido o dni)
--  2. Listado de usuarios incluyendo usuario_login
--  3. Estados permitidos: 'A' (Activo), 'I' (Inactivo), 'E' (Eliminado)
--  4. Para nuevo usuario: usuario_login = 'BP' || dni, clave inicial = 'BP' || dni
--     hasheada con bcrypt y debe_cambiar_password = true
--  5. Blanqueo de clave en edición: vuelve a 'BP' || dni y debe_cambiar_password = true
--  6. Restricción de roles: id_rol 7 puede asignar todos los roles EXCEPTO id_rol 1;
--     solo un id_rol 1 puede asignar o editar usuarios con id_rol 1
--  7. Auditoría de inicios de sesión con filtro por usuario
--  8. Gestión de Parámetros -> Roles (listar, crear, editar, activar/inactivar/eliminar)
--     protegiendo id_rol = 1 contra modificación o eliminación
-- =====================================================================

-- Asegura que exista la tabla de historial_login aunque no se haya re-ejecutado el 50
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
-- Helper: ¿el token pertenece a un usuario activo con rol 1 o 7?
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
        WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
          AND u.estado = 'A'
          AND u.id_rol IN (1, 7)
    );
$$;

REVOKE ALL ON FUNCTION usuarios.fn_es_admin_sistema(UUID) FROM PUBLIC, anon, authenticated;

-- Se eliminan las versiones viejas para recrearlas con las nuevas columnas
DROP FUNCTION IF EXISTS usuarios.listar_usuarios_autorizados(TEXT, TEXT);
DROP FUNCTION IF EXISTS usuarios.listar_usuarios_autorizados(UUID);
DROP FUNCTION IF EXISTS usuarios.listar_roles_autorizados(TEXT, TEXT);
DROP FUNCTION IF EXISTS usuarios.crear_usuario_autorizado(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS usuarios.actualizar_usuario_autorizado(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT);

-- ---------------------------------------------------------------------
-- BUSCAR PERSONAS EN administracion.recursos_humanos
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.buscar_personas_rrhh(
    p_token    UUID,
    p_busqueda TEXT DEFAULT ''
)
RETURNS TABLE(
    legajo            text,
    nombre            text,
    apellido          text,
    dni               text,
    cuil              text,
    mail_personal     text,
    id_rol            integer,
    estado            text,
    ya_tiene_usuario  boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'usuarios', 'administracion', 'extensions', 'public'
AS $$
    SELECT
        rh.legajo::text,
        rh.nombre::text,
        rh.apellido::text,
        rh.dni::text,
        rh.cuil::text,
        rh.mail_personal::text,
        rh.id_rol::integer,
        rh.estado::text,
        EXISTS (
            SELECT 1
            FROM usuarios.usuarios u
            WHERE trim(u.dni) = trim(rh.dni)
        ) AS ya_tiene_usuario
    FROM administracion.recursos_humanos rh
    WHERE usuarios.fn_es_admin_sistema(p_token)
      AND (
          coalesce(trim(p_busqueda), '') = ''
          OR rh.nombre ILIKE '%' || trim(p_busqueda) || '%'
          OR rh.apellido ILIKE '%' || trim(p_busqueda) || '%'
          OR (rh.nombre || ' ' || rh.apellido) ILIKE '%' || trim(p_busqueda) || '%'
          OR (rh.apellido || ' ' || rh.nombre) ILIKE '%' || trim(p_busqueda) || '%'
          OR rh.dni ILIKE '%' || trim(p_busqueda) || '%'
      )
    ORDER BY rh.apellido ASC, rh.nombre ASC
    LIMIT 25;
$$;

-- ---------------------------------------------------------------------
-- LISTAR USUARIOS (incluye usuario_login)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.listar_usuarios_autorizados(p_token UUID)
RETURNS TABLE(
    id_usuario    integer,
    usuario_login text,
    nombre        text,
    apellido      text,
    dni           text,
    email         text,
    id_rol        integer,
    estado        text,
    rol_nombre    text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'usuarios', 'extensions', 'public'
AS $$
    SELECT
        destino.id_usuario::integer,
        destino.usuario_login::text,
        destino.nombre::text,
        destino.apellido::text,
        destino.dni::text,
        destino.email::text,
        destino.id_rol::integer,
        destino.estado::text,
        r.nombre::text
    FROM usuarios.usuarios AS destino
    JOIN usuarios.roles AS r ON r.id_rol = destino.id_rol
    WHERE usuarios.fn_es_admin_sistema(p_token)
    ORDER BY destino.nombre ASC, destino.apellido ASC;
$$;

-- ---------------------------------------------------------------------
-- LISTAR ROLES ACTIVOS PARA SELECTOR DE USUARIOS (rol 7 no recibe rol 1)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.listar_roles_autorizados(p_token UUID)
RETURNS TABLE(id_rol integer, nombre text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'usuarios', 'extensions', 'public'
AS $$
    WITH actor AS (
        SELECT u.id_rol
        FROM usuarios.usuarios u
        WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
          AND u.estado = 'A'
          AND u.id_rol IN (1, 7)
    )
    SELECT r.id_rol, r.nombre::text
    FROM usuarios.roles r
    CROSS JOIN actor a
    WHERE r.estado = 'A'
      AND (a.id_rol = 1 OR r.id_rol <> 1)
    ORDER BY r.nombre;
$$;

-- ---------------------------------------------------------------------
-- CREAR USUARIO
-- Clave inicial = 'BP' || dni (hasheada con bcrypt) y debe_cambiar_password = true
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.crear_usuario_autorizado(
    p_token    UUID,
    p_nombre   TEXT,
    p_apellido TEXT,
    p_dni      TEXT,
    p_email    TEXT,
    p_id_rol   INTEGER,
    p_estado   TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'usuarios', 'extensions', 'public'
AS $$
DECLARE
    v_actor_id     integer;
    v_actor_rol    integer;
    v_usuario_alta text;
    v_dni          text := regexp_replace(coalesce(p_dni, ''), '\D', '', 'g');
    v_email        text := lower(trim(coalesce(p_email, '')));
    v_login        text;
BEGIN
    v_actor_id := usuarios.fn_usuario_de_token(p_token);

    SELECT u.id_rol, u.usuario_login
    INTO v_actor_rol, v_usuario_alta
    FROM usuarios.usuarios u
    WHERE u.id_usuario = v_actor_id
      AND u.estado = 'A'
      AND u.id_rol IN (1, 7);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado para crear usuarios';
    END IF;

    IF p_id_rol = 1 AND v_actor_rol <> 1 THEN
        RAISE EXCEPTION 'Solo un Administrador (rol 1) puede asignar el rol de Administrador';
    END IF;

    IF p_estado NOT IN ('A', 'I', 'E') THEN
        RAISE EXCEPTION 'Estado inválido';
    END IF;

    IF v_dni = '' THEN
        RAISE EXCEPTION 'El DNI es obligatorio';
    END IF;

    IF v_email = '' THEN
        RAISE EXCEPTION 'El email es obligatorio';
    END IF;

    IF EXISTS (SELECT 1 FROM usuarios.usuarios u WHERE trim(u.dni) = v_dni) THEN
        RAISE EXCEPTION 'Ya existe un usuario registrado con el DNI %', v_dni;
    END IF;

    IF EXISTS (SELECT 1 FROM usuarios.usuarios u WHERE lower(trim(u.email)) = v_email) THEN
        RAISE EXCEPTION 'El email % ya está asignado a otro usuario', v_email;
    END IF;

    v_login := 'BP' || v_dni;

    INSERT INTO usuarios.usuarios (
        id_rol,
        nombre,
        apellido,
        dni,
        email,
        usuario_login,
        password_hash,
        debe_cambiar_password,
        estado,
        usu_alta,
        fec_alta
    ) VALUES (
        p_id_rol,
        trim(p_nombre),
        trim(p_apellido),
        v_dni,
        v_email,
        v_login,
        extensions.crypt(v_login, extensions.gen_salt('bf', 12)),
        TRUE,
        p_estado,
        coalesce(v_usuario_alta, 'SISTEMA'),
        now()
    );

    RETURN v_login;
END;
$$;

-- ---------------------------------------------------------------------
-- ACTUALIZAR USUARIO
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.actualizar_usuario_autorizado(
    p_token      UUID,
    p_id_usuario INTEGER,
    p_nombre     TEXT,
    p_apellido   TEXT,
    p_dni        TEXT,
    p_email      TEXT,
    p_id_rol     INTEGER,
    p_estado     TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'usuarios', 'extensions', 'public'
AS $$
DECLARE
    v_actor_id     integer;
    v_actor_rol    integer;
    v_actor_login  text;
    v_rol_actual   integer;
    v_dni          text := regexp_replace(coalesce(p_dni, ''), '\D', '', 'g');
    v_email        text := lower(trim(coalesce(p_email, '')));
BEGIN
    v_actor_id := usuarios.fn_usuario_de_token(p_token);

    SELECT u.id_rol, u.usuario_login
    INTO v_actor_rol, v_actor_login
    FROM usuarios.usuarios u
    WHERE u.id_usuario = v_actor_id
      AND u.estado = 'A'
      AND u.id_rol IN (1, 7);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado para editar usuarios';
    END IF;

    SELECT u.id_rol INTO v_rol_actual
    FROM usuarios.usuarios u
    WHERE u.id_usuario = p_id_usuario;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el usuario';
    END IF;

    IF (p_id_rol = 1 OR v_rol_actual = 1) AND v_actor_rol <> 1 THEN
        RAISE EXCEPTION 'Solo un Administrador (rol 1) puede asignar o modificar usuarios con rol Administrador';
    END IF;

    IF p_estado NOT IN ('A', 'I', 'E') THEN
        RAISE EXCEPTION 'Estado inválido';
    END IF;

    IF v_dni = '' THEN
        RAISE EXCEPTION 'El DNI es obligatorio';
    END IF;

    IF v_email = '' THEN
        RAISE EXCEPTION 'El email es obligatorio';
    END IF;

    IF EXISTS (
        SELECT 1 FROM usuarios.usuarios u
        WHERE trim(u.dni) = v_dni AND u.id_usuario <> p_id_usuario
    ) THEN
        RAISE EXCEPTION 'Ya existe otro usuario con el DNI %', v_dni;
    END IF;

    IF EXISTS (
        SELECT 1 FROM usuarios.usuarios u
        WHERE lower(trim(u.email)) = v_email AND u.id_usuario <> p_id_usuario
    ) THEN
        RAISE EXCEPTION 'El email % ya está asignado a otro usuario', v_email;
    END IF;

    UPDATE usuarios.usuarios
    SET nombre        = trim(p_nombre),
        apellido      = trim(p_apellido),
        dni           = v_dni,
        email         = v_email,
        id_rol        = p_id_rol,
        estado        = p_estado,
        usuario_login = 'BP' || v_dni,
        usu_mod       = v_actor_login,
        fec_mod       = now()
    WHERE id_usuario = p_id_usuario;

    -- Si pasa a Inactivo o Eliminado, se cierran sus sesiones activas
    IF p_estado IN ('I', 'E') THEN
        DELETE FROM usuarios.sesion WHERE id_usuario = p_id_usuario;
    END IF;

    RETURN true;
END;
$$;

-- ---------------------------------------------------------------------
-- BLANQUEAR CLAVE DE UN USUARIO (vuelve a 'BP' || dni y pide cambio al entrar)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.blanquear_clave_usuario(
    p_token      UUID,
    p_id_usuario INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'usuarios', 'extensions', 'public'
AS $$
DECLARE
    v_actor_id     integer;
    v_actor_rol    integer;
    v_actor_login  text;
    v_dni          text;
    v_rol_destino  integer;
    v_clave_nueva  text;
BEGIN
    v_actor_id := usuarios.fn_usuario_de_token(p_token);

    SELECT u.id_rol, u.usuario_login
    INTO v_actor_rol, v_actor_login
    FROM usuarios.usuarios u
    WHERE u.id_usuario = v_actor_id
      AND u.estado = 'A'
      AND u.id_rol IN (1, 7);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado para blanquear claves';
    END IF;

    SELECT regexp_replace(u.dni, '\D', '', 'g'), u.id_rol
    INTO v_dni, v_rol_destino
    FROM usuarios.usuarios u
    WHERE u.id_usuario = p_id_usuario;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el usuario';
    END IF;

    IF v_rol_destino = 1 AND v_actor_rol <> 1 THEN
        RAISE EXCEPTION 'Solo un Administrador (rol 1) puede blanquear la clave de otro Administrador';
    END IF;

    v_clave_nueva := 'BP' || v_dni;

    UPDATE usuarios.usuarios
    SET usuario_login         = v_clave_nueva,
        password_hash         = extensions.crypt(v_clave_nueva, extensions.gen_salt('bf', 12)),
        debe_cambiar_password = TRUE,
        usu_mod               = v_actor_login,
        fec_mod               = now()
    WHERE id_usuario = p_id_usuario;

    -- Cerramos sesiones abiertas de ese usuario para forzar el ingreso con la clave nueva
    DELETE FROM usuarios.sesion WHERE id_usuario = p_id_usuario;

    RETURN v_clave_nueva;
END;
$$;

-- ---------------------------------------------------------------------
-- AUDITORÍA: LISTAR INICIOS DE SESIÓN (con filtro por usuario)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.listar_auditoria_logins(
    p_token    UUID,
    p_busqueda TEXT DEFAULT ''
)
RETURNS TABLE(
    id_evento     bigint,
    fec_login     timestamp,
    usuario_login text,
    nombre        text,
    apellido      text,
    rol_nombre    text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'usuarios', 'extensions', 'public'
AS $$
    WITH eventos AS (
        SELECT
            hl.id_login AS id_evento,
            hl.fec_login,
            hl.id_usuario
        FROM usuarios.historial_login hl
        UNION ALL
        SELECT
            s.id_sesion AS id_evento,
            s.fec_alta AS fec_login,
            s.id_usuario
        FROM usuarios.sesion s
        WHERE NOT EXISTS (
            SELECT 1
            FROM usuarios.historial_login hl2
            WHERE hl2.id_usuario = s.id_usuario
              AND abs(extract(epoch FROM (hl2.fec_login - s.fec_alta))) < 2
        )
    )
    SELECT
        e.id_evento::bigint,
        e.fec_login,
        u.usuario_login::text,
        u.nombre::text,
        u.apellido::text,
        r.nombre::text AS rol_nombre
    FROM eventos e
    JOIN usuarios.usuarios u ON u.id_usuario = e.id_usuario
    JOIN usuarios.roles r ON r.id_rol = u.id_rol
    WHERE usuarios.fn_es_admin_sistema(p_token)
      AND (
          coalesce(trim(p_busqueda), '') = ''
          OR u.usuario_login ILIKE '%' || trim(p_busqueda) || '%'
          OR u.nombre ILIKE '%' || trim(p_busqueda) || '%'
          OR u.apellido ILIKE '%' || trim(p_busqueda) || '%'
          OR (u.nombre || ' ' || u.apellido) ILIKE '%' || trim(p_busqueda) || '%'
      )
    ORDER BY e.fec_login DESC
    LIMIT 200;
$$;

-- =====================================================================
-- PARÁMETROS -> ROLES (ABM de usuarios.roles para id_rol 1 y 7)
-- id_rol = 1 no puede ser modificado ni eliminado
-- =====================================================================

CREATE OR REPLACE FUNCTION usuarios.listar_roles_gestion(p_token UUID)
RETURNS TABLE(
    id_rol            integer,
    nombre            text,
    descripcion       text,
    estado            text,
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
        r.usu_alta::text,
        r.fec_alta,
        r.usu_mod::text,
        r.fec_mod,
        count(u.id_usuario)::bigint AS cantidad_usuarios
    FROM usuarios.roles r
    LEFT JOIN usuarios.usuarios u ON u.id_rol = r.id_rol
    WHERE usuarios.fn_es_admin_sistema(p_token)
    GROUP BY r.id_rol, r.nombre, r.descripcion, r.estado, r.usu_alta, r.fec_alta, r.usu_mod, r.fec_mod
    ORDER BY r.id_rol ASC;
$$;

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
      AND u.id_rol IN (1, 7);

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
        usu_alta,
        fec_alta
    ) VALUES (
        v_nombre,
        nullif(trim(coalesce(p_descripcion, '')), ''),
        p_estado,
        coalesce(v_actor_login, 'SISTEMA'),
        now()
    )
    RETURNING id_rol INTO v_nuevo_id;

    RETURN v_nuevo_id;
END;
$$;

CREATE OR REPLACE FUNCTION usuarios.actualizar_rol_autorizado(
    p_token       UUID,
    p_id_rol      INTEGER,
    p_nombre      TEXT,
    p_descripcion TEXT,
    p_estado      TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'usuarios', 'extensions', 'public'
AS $$
DECLARE
    v_actor_id    integer;
    v_actor_login text;
    v_nombre      text := trim(coalesce(p_nombre, ''));
BEGIN
    v_actor_id := usuarios.fn_usuario_de_token(p_token);

    SELECT u.usuario_login INTO v_actor_login
    FROM usuarios.usuarios u
    WHERE u.id_usuario = v_actor_id
      AND u.estado = 'A'
      AND u.id_rol IN (1, 7);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado para modificar roles';
    END IF;

    IF p_id_rol = 1 THEN
        RAISE EXCEPTION 'El rol Administrador (id_rol 1) no puede ser modificado ni eliminado';
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
          AND r.id_rol <> p_id_rol
    ) THEN
        RAISE EXCEPTION 'Ya existe otro rol con el nombre "%"', v_nombre;
    END IF;

    UPDATE usuarios.roles
    SET nombre      = v_nombre,
        descripcion = nullif(trim(coalesce(p_descripcion, '')), ''),
        estado      = p_estado,
        usu_mod     = v_actor_login,
        fec_mod     = now()
    WHERE id_rol = p_id_rol;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el rol indicado';
    END IF;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION usuarios.buscar_personas_rrhh(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_usuarios_autorizados(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_roles_autorizados(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.crear_usuario_autorizado(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.actualizar_usuario_autorizado(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.blanquear_clave_usuario(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_auditoria_logins(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_roles_gestion(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.crear_rol_autorizado(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.actualizar_rol_autorizado(UUID, INTEGER, TEXT, TEXT, TEXT) TO anon, authenticated;
