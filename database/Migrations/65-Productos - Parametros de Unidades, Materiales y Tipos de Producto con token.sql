-- =====================================================================
-- MIGRACIÓN 65: PRODUCTOS -> PARÁMETROS (UNIDADES DE MEDIDA, MATERIALES, TIPO DE PRODUCTO)
-- =====================================================================
-- Tablas involucradas:
--   - produccion.unidad_medida (id_unidad_medida, codigo, nombre, descripcion, estado, usu_alta, fec_alta, usu_mod, fec_mod)
--   - produccion.material      (id_material, codigo, nombre, descripcion, estado, usu_alta, fec_alta, usu_mod, fec_mod)
--   - produccion.tipo_producto (id_tipo_producto, codigo, nombre, descripcion, estado, usu_alta, fec_alta, usu_mod, fec_mod)
-- =====================================================================

BEGIN;

-- Helper de validación de usuario para parámetros de Productos
CREATE OR REPLACE FUNCTION usuarios.fn_actor_parametros_producto(p_token UUID)
RETURNS VARCHAR(20)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'usuarios', 'public'
AS $$
DECLARE
    v_login VARCHAR(20);
BEGIN
    SELECT left(u.usuario_login, 20)::VARCHAR(20)
    INTO v_login
    FROM usuarios.usuarios u
    LEFT JOIN usuarios.roles r ON r.id_rol = u.id_rol
    WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
      AND u.estado = 'A'
      AND (
          u.id_rol = 1
          OR 'productos' = ANY(coalesce(r.modulos, ARRAY[]::TEXT[]))
      );

    IF v_login IS NULL THEN
        RAISE EXCEPTION 'No autorizado para operar parámetros de Productos';
    END IF;

    RETURN v_login;
END;
$$;

-- =====================================================================
-- 1. UNIDADES DE MEDIDA (produccion.unidad_medida)
-- =====================================================================

CREATE OR REPLACE FUNCTION usuarios.listar_unidades_medida_catalogo(p_token UUID)
RETURNS TABLE(
    id_unidad_medida INTEGER,
    codigo           TEXT,
    nombre           TEXT,
    descripcion      TEXT,
    estado           TEXT,
    usu_alta         TEXT,
    fec_alta         TIMESTAMP WITHOUT TIME ZONE,
    usu_mod          TEXT,
    fec_mod          TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
BEGIN
    PERFORM usuarios.fn_actor_parametros_producto(p_token);

    RETURN QUERY
    SELECT
        um.id_unidad_medida::INTEGER,
        um.codigo::TEXT,
        um.nombre::TEXT,
        coalesce(um.descripcion, '')::TEXT,
        trim(um.estado)::TEXT,
        um.usu_alta::TEXT,
        um.fec_alta,
        um.usu_mod::TEXT,
        um.fec_mod
    FROM produccion.unidad_medida um
    ORDER BY
        CASE trim(um.estado)
            WHEN 'A' THEN 0
            WHEN 'I' THEN 1
            ELSE 2
        END ASC,
        um.id_unidad_medida ASC;
END;
$$;

CREATE OR REPLACE FUNCTION usuarios.crear_unidad_medida_catalogo(
    p_token       UUID,
    p_codigo      TEXT,
    p_nombre      TEXT,
    p_descripcion TEXT DEFAULT NULL,
    p_estado      TEXT DEFAULT 'A'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_login  VARCHAR(20);
    v_codigo VARCHAR(20);
    v_nombre VARCHAR(100);
    v_desc   VARCHAR(255);
    v_estado CHAR(1);
    v_id     INTEGER;
BEGIN
    v_login := usuarios.fn_actor_parametros_producto(p_token);

    v_codigo := upper(left(trim(coalesce(p_codigo, '')), 20));
    v_nombre := left(trim(coalesce(p_nombre, '')), 100);
    v_desc   := nullif(left(trim(coalesce(p_descripcion, '')), 255), '');
    v_estado := upper(left(trim(coalesce(p_estado, 'A')), 1));

    IF v_codigo = '' THEN
        RAISE EXCEPTION 'El código de la unidad de medida es obligatorio.';
    END IF;
    IF v_nombre = '' THEN
        RAISE EXCEPTION 'El nombre de la unidad de medida es obligatorio.';
    END IF;
    IF v_estado NOT IN ('A', 'I', 'E') THEN
        RAISE EXCEPTION 'El estado debe ser A, I o E.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM produccion.unidad_medida WHERE upper(trim(codigo)) = v_codigo
    ) THEN
        RAISE EXCEPTION 'Ya existe una unidad de medida con el código %.', v_codigo;
    END IF;

    INSERT INTO produccion.unidad_medida (
        codigo, nombre, descripcion, estado, usu_alta
    )
    VALUES (
        v_codigo, v_nombre, v_desc, v_estado, v_login
    )
    RETURNING id_unidad_medida INTO v_id;

    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION usuarios.actualizar_unidad_medida_catalogo(
    p_token            UUID,
    p_id_unidad_medida INTEGER,
    p_codigo           TEXT,
    p_nombre           TEXT,
    p_descripcion      TEXT DEFAULT NULL,
    p_estado           TEXT DEFAULT 'A'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_login  VARCHAR(20);
    v_codigo VARCHAR(20);
    v_nombre VARCHAR(100);
    v_desc   VARCHAR(255);
    v_estado CHAR(1);
BEGIN
    v_login := usuarios.fn_actor_parametros_producto(p_token);

    v_codigo := upper(left(trim(coalesce(p_codigo, '')), 20));
    v_nombre := left(trim(coalesce(p_nombre, '')), 100);
    v_desc   := nullif(left(trim(coalesce(p_descripcion, '')), 255), '');
    v_estado := upper(left(trim(coalesce(p_estado, 'A')), 1));

    IF v_codigo = '' THEN
        RAISE EXCEPTION 'El código de la unidad de medida es obligatorio.';
    END IF;
    IF v_nombre = '' THEN
        RAISE EXCEPTION 'El nombre de la unidad de medida es obligatorio.';
    END IF;
    IF v_estado NOT IN ('A', 'I', 'E') THEN
        RAISE EXCEPTION 'El estado debe ser A, I o E.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM produccion.unidad_medida
        WHERE upper(trim(codigo)) = v_codigo
          AND id_unidad_medida <> p_id_unidad_medida
    ) THEN
        RAISE EXCEPTION 'Ya existe otra unidad de medida con el código %.', v_codigo;
    END IF;

    UPDATE produccion.unidad_medida
    SET codigo      = v_codigo,
        nombre      = v_nombre,
        descripcion = v_desc,
        estado      = v_estado,
        usu_mod     = v_login,
        fec_mod     = CURRENT_TIMESTAMP
    WHERE id_unidad_medida = p_id_unidad_medida;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró la unidad de medida #%.', p_id_unidad_medida;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION usuarios.eliminar_unidad_medida_catalogo(
    p_token            UUID,
    p_id_unidad_medida INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_login VARCHAR(20);
BEGIN
    v_login := usuarios.fn_actor_parametros_producto(p_token);

    UPDATE produccion.unidad_medida
    SET estado  = 'E',
        usu_mod = v_login,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_unidad_medida = p_id_unidad_medida;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró la unidad de medida #%.', p_id_unidad_medida;
    END IF;

    RETURN TRUE;
END;
$$;

-- =====================================================================
-- 2. MATERIALES (produccion.material)
-- =====================================================================

CREATE OR REPLACE FUNCTION usuarios.listar_materiales_catalogo(p_token UUID)
RETURNS TABLE(
    id_material INTEGER,
    codigo      TEXT,
    nombre      TEXT,
    descripcion TEXT,
    estado      TEXT,
    usu_alta    TEXT,
    fec_alta    TIMESTAMP WITHOUT TIME ZONE,
    usu_mod     TEXT,
    fec_mod     TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
BEGIN
    PERFORM usuarios.fn_actor_parametros_producto(p_token);

    RETURN QUERY
    SELECT
        m.id_material::INTEGER,
        m.codigo::TEXT,
        m.nombre::TEXT,
        coalesce(m.descripcion, '')::TEXT,
        trim(m.estado)::TEXT,
        m.usu_alta::TEXT,
        m.fec_alta,
        m.usu_mod::TEXT,
        m.fec_mod
    FROM produccion.material m
    ORDER BY
        CASE trim(m.estado)
            WHEN 'A' THEN 0
            WHEN 'I' THEN 1
            ELSE 2
        END ASC,
        m.id_material ASC;
END;
$$;

CREATE OR REPLACE FUNCTION usuarios.crear_material_catalogo(
    p_token       UUID,
    p_codigo      TEXT,
    p_nombre      TEXT,
    p_descripcion TEXT DEFAULT NULL,
    p_estado      TEXT DEFAULT 'A'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_login  VARCHAR(20);
    v_codigo VARCHAR(20);
    v_nombre VARCHAR(100);
    v_desc   VARCHAR(255);
    v_estado CHAR(1);
    v_id     INTEGER;
BEGIN
    v_login := usuarios.fn_actor_parametros_producto(p_token);

    v_codigo := upper(left(trim(coalesce(p_codigo, '')), 20));
    v_nombre := left(trim(coalesce(p_nombre, '')), 100);
    v_desc   := nullif(left(trim(coalesce(p_descripcion, '')), 255), '');
    v_estado := upper(left(trim(coalesce(p_estado, 'A')), 1));

    IF v_codigo = '' THEN
        RAISE EXCEPTION 'El código del material es obligatorio.';
    END IF;
    IF v_nombre = '' THEN
        RAISE EXCEPTION 'El nombre del material es obligatorio.';
    END IF;
    IF v_estado NOT IN ('A', 'I', 'E') THEN
        RAISE EXCEPTION 'El estado debe ser A, I o E.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM produccion.material WHERE upper(trim(codigo)) = v_codigo
    ) THEN
        RAISE EXCEPTION 'Ya existe un material con el código %.', v_codigo;
    END IF;

    INSERT INTO produccion.material (
        codigo, nombre, descripcion, estado, usu_alta
    )
    VALUES (
        v_codigo, v_nombre, v_desc, v_estado, v_login
    )
    RETURNING id_material INTO v_id;

    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION usuarios.actualizar_material_catalogo(
    p_token       UUID,
    p_id_material INTEGER,
    p_codigo      TEXT,
    p_nombre      TEXT,
    p_descripcion TEXT DEFAULT NULL,
    p_estado      TEXT DEFAULT 'A'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_login  VARCHAR(20);
    v_codigo VARCHAR(20);
    v_nombre VARCHAR(100);
    v_desc   VARCHAR(255);
    v_estado CHAR(1);
BEGIN
    v_login := usuarios.fn_actor_parametros_producto(p_token);

    v_codigo := upper(left(trim(coalesce(p_codigo, '')), 20));
    v_nombre := left(trim(coalesce(p_nombre, '')), 100);
    v_desc   := nullif(left(trim(coalesce(p_descripcion, '')), 255), '');
    v_estado := upper(left(trim(coalesce(p_estado, 'A')), 1));

    IF v_codigo = '' THEN
        RAISE EXCEPTION 'El código del material es obligatorio.';
    END IF;
    IF v_nombre = '' THEN
        RAISE EXCEPTION 'El nombre del material es obligatorio.';
    END IF;
    IF v_estado NOT IN ('A', 'I', 'E') THEN
        RAISE EXCEPTION 'El estado debe ser A, I o E.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM produccion.material
        WHERE upper(trim(codigo)) = v_codigo
          AND id_material <> p_id_material
    ) THEN
        RAISE EXCEPTION 'Ya existe otro material con el código %.', v_codigo;
    END IF;

    UPDATE produccion.material
    SET codigo      = v_codigo,
        nombre      = v_nombre,
        descripcion = v_desc,
        estado      = v_estado,
        usu_mod     = v_login,
        fec_mod     = CURRENT_TIMESTAMP
    WHERE id_material = p_id_material;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el material #%.', p_id_material;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION usuarios.eliminar_material_catalogo(
    p_token       UUID,
    p_id_material INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_login VARCHAR(20);
BEGIN
    v_login := usuarios.fn_actor_parametros_producto(p_token);

    UPDATE produccion.material
    SET estado  = 'E',
        usu_mod = v_login,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_material = p_id_material;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el material #%.', p_id_material;
    END IF;

    RETURN TRUE;
END;
$$;

-- =====================================================================
-- 3. TIPO DE PRODUCTO (produccion.tipo_producto)
-- =====================================================================

CREATE OR REPLACE FUNCTION usuarios.listar_tipos_producto_catalogo(p_token UUID)
RETURNS TABLE(
    id_tipo_producto INTEGER,
    codigo           TEXT,
    nombre           TEXT,
    descripcion      TEXT,
    estado           TEXT,
    usu_alta         TEXT,
    fec_alta         TIMESTAMP WITHOUT TIME ZONE,
    usu_mod          TEXT,
    fec_mod          TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
BEGIN
    PERFORM usuarios.fn_actor_parametros_producto(p_token);

    RETURN QUERY
    SELECT
        tp.id_tipo_producto::INTEGER,
        tp.codigo::TEXT,
        tp.nombre::TEXT,
        coalesce(tp.descripcion, '')::TEXT,
        trim(tp.estado)::TEXT,
        tp.usu_alta::TEXT,
        tp.fec_alta,
        tp.usu_mod::TEXT,
        tp.fec_mod
    FROM produccion.tipo_producto tp
    ORDER BY
        CASE trim(tp.estado)
            WHEN 'A' THEN 0
            WHEN 'I' THEN 1
            ELSE 2
        END ASC,
        tp.id_tipo_producto ASC;
END;
$$;

CREATE OR REPLACE FUNCTION usuarios.crear_tipo_producto_catalogo(
    p_token       UUID,
    p_codigo      TEXT,
    p_nombre      TEXT,
    p_descripcion TEXT DEFAULT NULL,
    p_estado      TEXT DEFAULT 'A'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_login  VARCHAR(20);
    v_codigo VARCHAR(20);
    v_nombre VARCHAR(100);
    v_desc   VARCHAR(255);
    v_estado CHAR(1);
    v_id     INTEGER;
BEGIN
    v_login := usuarios.fn_actor_parametros_producto(p_token);

    v_codigo := upper(left(trim(coalesce(p_codigo, '')), 20));
    v_nombre := left(trim(coalesce(p_nombre, '')), 100);
    v_desc   := nullif(left(trim(coalesce(p_descripcion, '')), 255), '');
    v_estado := upper(left(trim(coalesce(p_estado, 'A')), 1));

    IF v_codigo = '' THEN
        RAISE EXCEPTION 'El código del tipo de producto es obligatorio.';
    END IF;
    IF v_nombre = '' THEN
        RAISE EXCEPTION 'El nombre del tipo de producto es obligatorio.';
    END IF;
    IF v_estado NOT IN ('A', 'I', 'E') THEN
        RAISE EXCEPTION 'El estado debe ser A, I o E.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM produccion.tipo_producto WHERE upper(trim(codigo)) = v_codigo
    ) THEN
        RAISE EXCEPTION 'Ya existe un tipo de producto con el código %.', v_codigo;
    END IF;

    INSERT INTO produccion.tipo_producto (
        codigo, nombre, descripcion, estado, usu_alta
    )
    VALUES (
        v_codigo, v_nombre, v_desc, v_estado, v_login
    )
    RETURNING id_tipo_producto INTO v_id;

    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION usuarios.actualizar_tipo_producto_catalogo(
    p_token            UUID,
    p_id_tipo_producto INTEGER,
    p_codigo           TEXT,
    p_nombre           TEXT,
    p_descripcion      TEXT DEFAULT NULL,
    p_estado           TEXT DEFAULT 'A'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_login  VARCHAR(20);
    v_codigo VARCHAR(20);
    v_nombre VARCHAR(100);
    v_desc   VARCHAR(255);
    v_estado CHAR(1);
BEGIN
    v_login := usuarios.fn_actor_parametros_producto(p_token);

    v_codigo := upper(left(trim(coalesce(p_codigo, '')), 20));
    v_nombre := left(trim(coalesce(p_nombre, '')), 100);
    v_desc   := nullif(left(trim(coalesce(p_descripcion, '')), 255), '');
    v_estado := upper(left(trim(coalesce(p_estado, 'A')), 1));

    IF v_codigo = '' THEN
        RAISE EXCEPTION 'El código del tipo de producto es obligatorio.';
    END IF;
    IF v_nombre = '' THEN
        RAISE EXCEPTION 'El nombre del tipo de producto es obligatorio.';
    END IF;
    IF v_estado NOT IN ('A', 'I', 'E') THEN
        RAISE EXCEPTION 'El estado debe ser A, I o E.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM produccion.tipo_producto
        WHERE upper(trim(codigo)) = v_codigo
          AND id_tipo_producto <> p_id_tipo_producto
    ) THEN
        RAISE EXCEPTION 'Ya existe otro tipo de producto con el código %.', v_codigo;
    END IF;

    UPDATE produccion.tipo_producto
    SET codigo      = v_codigo,
        nombre      = v_nombre,
        descripcion = v_desc,
        estado      = v_estado,
        usu_mod     = v_login,
        fec_mod     = CURRENT_TIMESTAMP
    WHERE id_tipo_producto = p_id_tipo_producto;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el tipo de producto #%.', p_id_tipo_producto;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION usuarios.eliminar_tipo_producto_catalogo(
    p_token            UUID,
    p_id_tipo_producto INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_login VARCHAR(20);
BEGIN
    v_login := usuarios.fn_actor_parametros_producto(p_token);

    UPDATE produccion.tipo_producto
    SET estado  = 'E',
        usu_mod = v_login,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_tipo_producto = p_id_tipo_producto;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el tipo de producto #%.', p_id_tipo_producto;
    END IF;

    RETURN TRUE;
END;
$$;

-- =====================================================================
-- 4. PERMISOS
-- =====================================================================
GRANT USAGE ON SCHEMA produccion TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON produccion.unidad_medida TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON produccion.material TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON produccion.tipo_producto TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA produccion TO anon, authenticated;

GRANT EXECUTE ON FUNCTION usuarios.fn_actor_parametros_producto(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_unidades_medida_catalogo(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.crear_unidad_medida_catalogo(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.actualizar_unidad_medida_catalogo(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.eliminar_unidad_medida_catalogo(UUID, INTEGER) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION usuarios.listar_materiales_catalogo(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.crear_material_catalogo(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.actualizar_material_catalogo(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.eliminar_material_catalogo(UUID, INTEGER) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION usuarios.listar_tipos_producto_catalogo(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.crear_tipo_producto_catalogo(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.actualizar_tipo_producto_catalogo(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.eliminar_tipo_producto_catalogo(UUID, INTEGER) TO anon, authenticated;

COMMIT;
