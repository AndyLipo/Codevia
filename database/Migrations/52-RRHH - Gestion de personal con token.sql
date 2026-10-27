-- =====================================================================
-- 52 - Recursos Humanos (administracion.recursos_humanos) con TOKEN
-- Requiere haber ejecutado antes el script 50.
--
-- Nota: Las funciones RPC se crean en el esquema "usuarios" (que ya está
-- expuesto en la API de Supabase) y operan sobre "administracion.recursos_humanos".
--
-- Reglas implementadas:
--  0. Solo usuarios activos con id_rol IN (1, 11, 15) pueden ver y operar RRHH.
--  1. Listado de personal ordenado por número de legajo ASC.
--  2. Alta y edición completa de empleados registrando usu_alta / usu_mod desde la sesión.
--  3. Solo permite eliminar (estado = 'E') si el empleado tiene fecha_egreso cargada.
--  4. Validaciones de unicidad de DNI y CUIL, y coherencia de fechas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: ¿el token pertenece a un usuario activo con rol 1, 11 o 15?
-- ---------------------------------------------------------------------
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
        WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
          AND u.estado = 'A'
          AND u.id_rol IN (1, 11, 15)
    );
$$;

REVOKE ALL ON FUNCTION usuarios.fn_puede_gestionar_rrhh(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- LISTAR PERSONAL ORDENADO POR LEGAJO
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.listar_personal_rrhh(p_token UUID)
RETURNS TABLE(
    legajo           text,
    nombre           text,
    apellido         text,
    cuil             text,
    dni              text,
    telefono         text,
    direccion        text,
    mail_personal    text,
    estado_civil     text,
    fecha_nacimiento date,
    fecha_ingreso    date,
    fecha_egreso     date,
    id_rol           integer,
    rol_nombre       text,
    observaciones    text,
    estado           text,
    usu_alta         text,
    fec_alta         timestamp,
    usu_mod          text,
    fec_mod          timestamp
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'usuarios', 'extensions', 'public'
AS $$
    SELECT
        rh.legajo::text,
        rh.nombre::text,
        rh.apellido::text,
        rh.cuil::text,
        rh.dni::text,
        rh.telefono::text,
        rh.direccion::text,
        rh.mail_personal::text,
        rh.estado_civil::text,
        rh.fecha_nacimiento,
        rh.fecha_ingreso,
        rh.fecha_egreso,
        rh.id_rol::integer,
        r.nombre::text AS rol_nombre,
        rh.observaciones::text,
        rh.estado::text,
        rh.usu_alta::text,
        rh.fec_alta,
        rh.usu_mod::text,
        rh.fec_mod
    FROM administracion.recursos_humanos rh
    LEFT JOIN usuarios.roles r ON r.id_rol = rh.id_rol
    WHERE usuarios.fn_puede_gestionar_rrhh(p_token)
    ORDER BY rh.legajo ASC;
$$;

-- ---------------------------------------------------------------------
-- LISTAR ROLES/PUESTOS DISPONIBLES PARA ASIGNAR EN RRHH (excluye id_rol = 1)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.listar_roles_rrhh(p_token UUID)
RETURNS TABLE(id_rol integer, nombre text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'usuarios', 'extensions', 'public'
AS $$
    SELECT r.id_rol::integer, r.nombre::text
    FROM usuarios.roles r
    WHERE usuarios.fn_puede_gestionar_rrhh(p_token)
      AND r.estado = 'A'
      AND r.id_rol <> 1
    ORDER BY r.nombre ASC;
$$;

-- ---------------------------------------------------------------------
-- CREAR EMPLEADO EN administracion.recursos_humanos
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.crear_empleado_rrhh(
    p_token            UUID,
    p_nombre           TEXT,
    p_apellido         TEXT,
    p_cuil             TEXT,
    p_dni              TEXT,
    p_telefono         TEXT,
    p_direccion        TEXT,
    p_mail_personal    TEXT,
    p_estado_civil     TEXT,
    p_fecha_nacimiento DATE,
    p_fecha_ingreso    DATE,
    p_fecha_egreso     DATE,
    p_id_rol           INTEGER,
    p_observaciones    TEXT,
    p_estado           TEXT DEFAULT 'A'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'usuarios', 'extensions', 'public'
AS $$
DECLARE
    v_actor_id    integer;
    v_actor_login text;
    v_dni         text := regexp_replace(coalesce(p_dni, ''), '\D', '', 'g');
    v_cuil        text := regexp_replace(coalesce(p_cuil, ''), '\D', '', 'g');
    v_estado      text := coalesce(nullif(trim(p_estado), ''), 'A');
    v_legajo      text;
BEGIN
    v_actor_id := usuarios.fn_usuario_de_token(p_token);

    SELECT u.usuario_login INTO v_actor_login
    FROM usuarios.usuarios u
    WHERE u.id_usuario = v_actor_id
      AND u.estado = 'A'
      AND u.id_rol IN (1, 11, 15);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado para registrar personal en Recursos Humanos';
    END IF;

    IF p_id_rol = 1 THEN
        RAISE EXCEPTION 'El rol Administrador (id_rol 1) no puede asignarse como puesto en Recursos Humanos';
    END IF;

    IF trim(coalesce(p_nombre, '')) = '' OR trim(coalesce(p_apellido, '')) = '' THEN
        RAISE EXCEPTION 'Nombre y apellido son obligatorios';
    END IF;

    IF length(v_dni) < 7 OR length(v_dni) > 8 THEN
        RAISE EXCEPTION 'El DNI debe tener entre 7 y 8 dígitos numéricos';
    END IF;

    IF length(v_cuil) <> 11 THEN
        RAISE EXCEPTION 'El CUIL debe tener exactamente 11 dígitos numéricos';
    END IF;

    IF p_fecha_ingreso IS NULL THEN
        RAISE EXCEPTION 'La fecha de ingreso es obligatoria';
    END IF;

    IF p_fecha_egreso IS NOT NULL AND p_fecha_egreso < p_fecha_ingreso THEN
        RAISE EXCEPTION 'La fecha de egreso no puede ser anterior a la fecha de ingreso';
    END IF;

    IF p_fecha_nacimiento IS NOT NULL AND p_fecha_nacimiento >= p_fecha_ingreso THEN
        RAISE EXCEPTION 'La fecha de nacimiento debe ser anterior a la fecha de ingreso';
    END IF;

    IF v_estado NOT IN ('A', 'I', 'E') THEN
        RAISE EXCEPTION 'Estado inválido';
    END IF;

    IF v_estado = 'E' AND p_fecha_egreso IS NULL THEN
        RAISE EXCEPTION 'Solo se puede marcar como Eliminado a un empleado que tenga fecha de egreso';
    END IF;

    IF EXISTS (SELECT 1 FROM administracion.recursos_humanos rh WHERE trim(rh.dni) = v_dni) THEN
        RAISE EXCEPTION 'Ya existe un empleado registrado con el DNI %', v_dni;
    END IF;

    IF EXISTS (SELECT 1 FROM administracion.recursos_humanos rh WHERE trim(rh.cuil) = v_cuil) THEN
        RAISE EXCEPTION 'Ya existe un empleado registrado con el CUIL %', v_cuil;
    END IF;

    INSERT INTO administracion.recursos_humanos (
        nombre,
        apellido,
        cuil,
        dni,
        telefono,
        direccion,
        mail_personal,
        estado_civil,
        fecha_nacimiento,
        fecha_ingreso,
        fecha_egreso,
        id_rol,
        observaciones,
        estado,
        usu_alta,
        fec_alta
    ) VALUES (
        trim(p_nombre),
        trim(p_apellido),
        v_cuil,
        v_dni,
        nullif(trim(coalesce(p_telefono, '')), ''),
        nullif(trim(coalesce(p_direccion, '')), ''),
        nullif(lower(trim(coalesce(p_mail_personal, ''))), ''),
        nullif(trim(coalesce(p_estado_civil, '')), ''),
        p_fecha_nacimiento,
        p_fecha_ingreso,
        p_fecha_egreso,
        p_id_rol,
        nullif(trim(coalesce(p_observaciones, '')), ''),
        v_estado,
        coalesce(v_actor_login, 'SISTEMA'),
        now()
    )
    RETURNING legajo INTO v_legajo;

    RETURN v_legajo;
END;
$$;

-- ---------------------------------------------------------------------
-- ACTUALIZAR EMPLEADO EN administracion.recursos_humanos
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.actualizar_empleado_rrhh(
    p_token            UUID,
    p_legajo           TEXT,
    p_nombre           TEXT,
    p_apellido         TEXT,
    p_cuil             TEXT,
    p_dni              TEXT,
    p_telefono         TEXT,
    p_direccion        TEXT,
    p_mail_personal    TEXT,
    p_estado_civil     TEXT,
    p_fecha_nacimiento DATE,
    p_fecha_ingreso    DATE,
    p_fecha_egreso     DATE,
    p_id_rol           INTEGER,
    p_observaciones    TEXT,
    p_estado           TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'usuarios', 'extensions', 'public'
AS $$
DECLARE
    v_actor_id    integer;
    v_actor_login text;
    v_dni         text := regexp_replace(coalesce(p_dni, ''), '\D', '', 'g');
    v_cuil        text := regexp_replace(coalesce(p_cuil, ''), '\D', '', 'g');
    v_estado      text := coalesce(nullif(trim(p_estado), ''), 'A');
BEGIN
    v_actor_id := usuarios.fn_usuario_de_token(p_token);

    SELECT u.usuario_login INTO v_actor_login
    FROM usuarios.usuarios u
    WHERE u.id_usuario = v_actor_id
      AND u.estado = 'A'
      AND u.id_rol IN (1, 11, 15);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado para modificar personal en Recursos Humanos';
    END IF;

    IF p_id_rol = 1 THEN
        RAISE EXCEPTION 'El rol Administrador (id_rol 1) no puede asignarse como puesto en Recursos Humanos';
    END IF;

    IF trim(coalesce(p_nombre, '')) = '' OR trim(coalesce(p_apellido, '')) = '' THEN
        RAISE EXCEPTION 'Nombre y apellido son obligatorios';
    END IF;

    IF length(v_dni) < 7 OR length(v_dni) > 8 THEN
        RAISE EXCEPTION 'El DNI debe tener entre 7 y 8 dígitos numéricos';
    END IF;

    IF length(v_cuil) <> 11 THEN
        RAISE EXCEPTION 'El CUIL debe tener exactamente 11 dígitos numéricos';
    END IF;

    IF p_fecha_ingreso IS NULL THEN
        RAISE EXCEPTION 'La fecha de ingreso es obligatoria';
    END IF;

    IF p_fecha_egreso IS NOT NULL AND p_fecha_egreso < p_fecha_ingreso THEN
        RAISE EXCEPTION 'La fecha de egreso no puede ser anterior a la fecha de ingreso';
    END IF;

    IF p_fecha_nacimiento IS NOT NULL AND p_fecha_nacimiento >= p_fecha_ingreso THEN
        RAISE EXCEPTION 'La fecha de nacimiento debe ser anterior a la fecha de ingreso';
    END IF;

    IF v_estado NOT IN ('A', 'I', 'E') THEN
        RAISE EXCEPTION 'Estado inválido';
    END IF;

    IF v_estado = 'E' AND p_fecha_egreso IS NULL THEN
        RAISE EXCEPTION 'Solo se puede eliminar un empleado si tiene fecha de egreso registrada';
    END IF;

    IF EXISTS (
        SELECT 1 FROM administracion.recursos_humanos rh
        WHERE trim(rh.dni) = v_dni AND rh.legajo <> p_legajo
    ) THEN
        RAISE EXCEPTION 'Ya existe otro empleado con el DNI %', v_dni;
    END IF;

    IF EXISTS (
        SELECT 1 FROM administracion.recursos_humanos rh
        WHERE trim(rh.cuil) = v_cuil AND rh.legajo <> p_legajo
    ) THEN
        RAISE EXCEPTION 'Ya existe otro empleado con el CUIL %', v_cuil;
    END IF;

    UPDATE administracion.recursos_humanos
    SET nombre           = trim(p_nombre),
        apellido         = trim(p_apellido),
        cuil             = v_cuil,
        dni              = v_dni,
        telefono         = nullif(trim(coalesce(p_telefono, '')), ''),
        direccion        = nullif(trim(coalesce(p_direccion, '')), ''),
        mail_personal    = nullif(lower(trim(coalesce(p_mail_personal, ''))), ''),
        estado_civil     = nullif(trim(coalesce(p_estado_civil, '')), ''),
        fecha_nacimiento = p_fecha_nacimiento,
        fecha_ingreso    = p_fecha_ingreso,
        fecha_egreso     = p_fecha_egreso,
        id_rol           = p_id_rol,
        observaciones    = nullif(trim(coalesce(p_observaciones, '')), ''),
        estado           = v_estado,
        usu_mod          = v_actor_login,
        fec_mod          = now()
    WHERE legajo = p_legajo;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el legajo %', p_legajo;
    END IF;

    RETURN true;
END;
$$;

-- ---------------------------------------------------------------------
-- ELIMINAR EMPLEADO (solo si tiene fecha_egreso)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.eliminar_empleado_rrhh(
    p_token  UUID,
    p_legajo TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'usuarios', 'extensions', 'public'
AS $$
DECLARE
    v_actor_id     integer;
    v_actor_login  text;
    v_fecha_egreso date;
BEGIN
    v_actor_id := usuarios.fn_usuario_de_token(p_token);

    SELECT u.usuario_login INTO v_actor_login
    FROM usuarios.usuarios u
    WHERE u.id_usuario = v_actor_id
      AND u.estado = 'A'
      AND u.id_rol IN (1, 11, 15);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado para eliminar personal en Recursos Humanos';
    END IF;

    SELECT rh.fecha_egreso INTO v_fecha_egreso
    FROM administracion.recursos_humanos rh
    WHERE rh.legajo = p_legajo;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el legajo %', p_legajo;
    END IF;

    IF v_fecha_egreso IS NULL THEN
        RAISE EXCEPTION 'No se puede eliminar el empleado porque no tiene fecha de egreso registrada';
    END IF;

    UPDATE administracion.recursos_humanos
    SET estado  = 'E',
        usu_mod = v_actor_login,
        fec_mod = now()
    WHERE legajo = p_legajo;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION usuarios.listar_personal_rrhh(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_roles_rrhh(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.crear_empleado_rrhh(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, DATE, INTEGER, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.actualizar_empleado_rrhh(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, DATE, INTEGER, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.eliminar_empleado_rrhh(UUID, TEXT) TO anon, authenticated;
