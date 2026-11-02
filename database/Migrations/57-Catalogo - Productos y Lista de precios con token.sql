-- =====================================================================
-- 57 - Catálogo: Productos (produccion.producto) y
--      Lista de precios (administracion.precio_producto) con TOKEN
-- Requiere haber ejecutado antes los scripts 50 y 53.
--
-- Notas:
--  * No se crean tablas ni columnas nuevas.
--  * id_producto (IDENTITY) y codigo (trigger trg_producto_codigo) son
--    automáticos. id_precio_producto es automático.
--  * "Eliminar" es baja lógica (estado = 'E'); se conserva el historial.
--  * Acceso: id_rol = 1 o roles con 'productos' / 'lista-precios' en
--    usuarios.roles.modulos (Parámetros -> Permisos).
-- =====================================================================

-- 1. Módulos habilitados por defecto para el Administrador (id_rol = 1)
UPDATE usuarios.roles
SET modulos = array_append(coalesce(modulos, ARRAY[]::TEXT[]), 'productos')
WHERE id_rol = 1
  AND NOT ('productos' = ANY(coalesce(modulos, ARRAY[]::TEXT[])));

UPDATE usuarios.roles
SET modulos = array_append(coalesce(modulos, ARRAY[]::TEXT[]), 'lista-precios')
WHERE id_rol = 1
  AND NOT ('lista-precios' = ANY(coalesce(modulos, ARRAY[]::TEXT[])));

-- 2. Helper de autorización: devuelve el usuario_login o aborta
CREATE OR REPLACE FUNCTION usuarios.fn_actor_catalogo(p_token UUID, p_modulo TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'usuarios', 'public'
AS $$
DECLARE
    v_login TEXT;
BEGIN
    SELECT u.usuario_login
    INTO v_login
    FROM usuarios.usuarios u
    LEFT JOIN usuarios.roles r ON r.id_rol = u.id_rol
    WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
      AND u.estado = 'A'
      AND (
          u.id_rol = 1
          OR p_modulo = ANY(coalesce(r.modulos, ARRAY[]::TEXT[]))
      );

    IF v_login IS NULL THEN
        RAISE EXCEPTION 'No autorizado para operar el módulo %', p_modulo;
    END IF;

    RETURN v_login;
END;
$$;

REVOKE ALL ON FUNCTION usuarios.fn_actor_catalogo(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- =====================================================================
-- PRODUCTOS
-- =====================================================================

-- 3. Listado de productos (todos los estados) con datos de sus relaciones
CREATE OR REPLACE FUNCTION usuarios.listar_productos_catalogo(p_token UUID)
RETURNS TABLE(
    id_producto          integer,
    codigo               text,
    nombre               text,
    id_tipo_producto     integer,
    tipo_producto_nombre text,
    id_material          integer,
    material_nombre      text,
    id_unidad_medida     integer,
    unidad_codigo        text,
    unidad_nombre        text,
    es_biodegradable     boolean,
    vida_util_meses      integer,
    estado               text,
    usu_alta             text,
    fec_alta             timestamp without time zone,
    usu_mod              text,
    fec_mod              timestamp without time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
BEGIN
    PERFORM usuarios.fn_actor_catalogo(p_token, 'productos');

    RETURN QUERY
    SELECT
        p.id_producto::integer,
        p.codigo::text,
        p.nombre::text,
        p.id_tipo_producto::integer,
        t.nombre::text,
        p.id_material::integer,
        m.nombre::text,
        p.id_unidad_medida::integer,
        um.codigo::text,
        um.nombre::text,
        p.es_biodegradable,
        p.vida_util_meses::integer,
        trim(p.estado)::text,
        p.usu_alta::text,
        p.fec_alta,
        p.usu_mod::text,
        p.fec_mod
    FROM produccion.producto p
    LEFT JOIN produccion.tipo_producto t ON t.id_tipo_producto = p.id_tipo_producto
    LEFT JOIN produccion.material m ON m.id_material = p.id_material
    LEFT JOIN produccion.unidad_medida um ON um.id_unidad_medida = p.id_unidad_medida
    ORDER BY p.id_producto DESC;
END;
$$;

-- 4. Catálogos activos para los desplegables del formulario de productos
CREATE OR REPLACE FUNCTION usuarios.listar_catalogos_producto(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
BEGIN
    PERFORM usuarios.fn_actor_catalogo(p_token, 'productos');

    RETURN jsonb_build_object(
        'tipos', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', t.id_tipo_producto, 'codigo', t.codigo, 'nombre', t.nombre
            ) ORDER BY t.nombre)
            FROM produccion.tipo_producto t WHERE t.estado = 'A'
        ), '[]'::jsonb),
        'materiales', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', m.id_material, 'codigo', m.codigo, 'nombre', m.nombre
            ) ORDER BY m.nombre)
            FROM produccion.material m WHERE m.estado = 'A'
        ), '[]'::jsonb),
        'unidades', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', u.id_unidad_medida, 'codigo', u.codigo, 'nombre', u.nombre
            ) ORDER BY u.nombre)
            FROM produccion.unidad_medida u WHERE u.estado = 'A'
        ), '[]'::jsonb)
    );
END;
$$;

-- 5. Crear producto (id_producto y codigo se generan automáticamente)
CREATE OR REPLACE FUNCTION usuarios.crear_producto_catalogo(
    p_token            UUID,
    p_nombre           TEXT,
    p_id_tipo_producto INTEGER,
    p_id_material      INTEGER,
    p_id_unidad_medida INTEGER,
    p_es_biodegradable BOOLEAN,
    p_vida_util_meses  INTEGER DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_login TEXT;
    v_id    INTEGER;
    v_bio   BOOLEAN := coalesce(p_es_biodegradable, false);
BEGIN
    v_login := usuarios.fn_actor_catalogo(p_token, 'productos');

    IF nullif(trim(p_nombre), '') IS NULL THEN
        RAISE EXCEPTION 'El nombre del producto es obligatorio';
    END IF;
    IF v_bio AND (p_vida_util_meses IS NULL OR p_vida_util_meses <= 0) THEN
        RAISE EXCEPTION 'Un producto biodegradable requiere una vida útil en meses mayor a 0';
    END IF;

    INSERT INTO produccion.producto (
        codigo, nombre, id_tipo_producto, id_material, id_unidad_medida,
        es_biodegradable, vida_util_meses, estado, usu_alta
    )
    VALUES (
        NULL, trim(p_nombre), p_id_tipo_producto, p_id_material, p_id_unidad_medida,
        v_bio, CASE WHEN v_bio THEN p_vida_util_meses ELSE NULL END, 'A', v_login
    )
    RETURNING id_producto INTO v_id;

    RETURN v_id;
END;
$$;

-- 6. Modificar producto
CREATE OR REPLACE FUNCTION usuarios.modificar_producto_catalogo(
    p_token            UUID,
    p_id_producto      INTEGER,
    p_nombre           TEXT,
    p_id_tipo_producto INTEGER,
    p_id_material      INTEGER,
    p_id_unidad_medida INTEGER,
    p_es_biodegradable BOOLEAN,
    p_vida_util_meses  INTEGER DEFAULT NULL,
    p_estado           TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_login  TEXT;
    v_bio    BOOLEAN := coalesce(p_es_biodegradable, false);
    v_estado TEXT;
BEGIN
    v_login := usuarios.fn_actor_catalogo(p_token, 'productos');

    IF nullif(trim(p_nombre), '') IS NULL THEN
        RAISE EXCEPTION 'El nombre del producto es obligatorio';
    END IF;
    IF v_bio AND (p_vida_util_meses IS NULL OR p_vida_util_meses <= 0) THEN
        RAISE EXCEPTION 'Un producto biodegradable requiere una vida útil en meses mayor a 0';
    END IF;

    v_estado := nullif(trim(p_estado), '');
    IF v_estado IS NOT NULL AND v_estado NOT IN ('A', 'I') THEN
        RAISE EXCEPTION 'Estado inválido. Para eliminar use la opción Eliminar';
    END IF;

    UPDATE produccion.producto
    SET nombre           = trim(p_nombre),
        id_tipo_producto = p_id_tipo_producto,
        id_material      = p_id_material,
        id_unidad_medida = p_id_unidad_medida,
        es_biodegradable = v_bio,
        vida_util_meses  = CASE WHEN v_bio THEN p_vida_util_meses ELSE NULL END,
        estado           = coalesce(v_estado, estado),
        usu_mod          = v_login,
        fec_mod          = now()
    WHERE id_producto = p_id_producto;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el producto indicado';
    END IF;

    RETURN true;
END;
$$;

-- 7. Eliminar (baja lógica) / reactivar producto
CREATE OR REPLACE FUNCTION usuarios.cambiar_estado_producto_catalogo(
    p_token       UUID,
    p_id_producto INTEGER,
    p_estado      TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'administracion', 'usuarios', 'public'
AS $$
DECLARE
    v_login TEXT;
BEGIN
    v_login := usuarios.fn_actor_catalogo(p_token, 'productos');

    IF p_estado NOT IN ('A', 'I', 'E') THEN
        RAISE EXCEPTION 'Estado inválido';
    END IF;

    IF p_estado = 'E' THEN
        IF EXISTS (
            SELECT 1 FROM produccion.lote_producto l
            WHERE l.id_producto = p_id_producto
              AND l.estado = 'A'
              AND l.estado_lote <> 'A'
        ) THEN
            RAISE EXCEPTION 'No se puede eliminar el producto porque tiene lotes activos con stock';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM administracion.detalle_pedido dp
            JOIN administracion.pedido pe ON pe.id_pedido = dp.id_pedido
            WHERE dp.id_producto = p_id_producto
              AND pe.estado IN ('P', 'C', 'M', 'E', 'L')
        ) THEN
            RAISE EXCEPTION 'No se puede eliminar el producto porque tiene pedidos en curso';
        END IF;
    END IF;

    UPDATE produccion.producto
    SET estado  = p_estado,
        usu_mod = v_login,
        fec_mod = now()
    WHERE id_producto = p_id_producto;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el producto indicado';
    END IF;

    RETURN true;
END;
$$;

-- =====================================================================
-- LISTA DE PRECIOS
-- =====================================================================

-- 8. Listado de precios (todos los estados) con datos del producto
CREATE OR REPLACE FUNCTION usuarios.listar_precios_producto(p_token UUID)
RETURNS TABLE(
    id_precio_producto integer,
    id_producto        integer,
    producto_codigo    text,
    producto_nombre    text,
    unidad_codigo      text,
    precio_unitario    numeric,
    moneda             text,
    fecha_desde        date,
    fecha_hasta        date,
    vigente            boolean,
    estado             text,
    usu_alta           text,
    fec_alta           timestamp without time zone,
    usu_mod            text,
    fec_mod            timestamp without time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'administracion', 'usuarios', 'public'
AS $$
BEGIN
    PERFORM usuarios.fn_actor_catalogo(p_token, 'lista-precios');

    RETURN QUERY
    SELECT
        pp.id_precio_producto::integer,
        pp.id_producto::integer,
        p.codigo::text,
        p.nombre::text,
        um.codigo::text,
        pp.precio_unitario::numeric,
        trim(pp.moneda)::text,
        pp.fecha_desde,
        pp.fecha_hasta,
        (
            trim(pp.estado) = 'A'
            AND pp.fecha_desde <= CURRENT_DATE
            AND (pp.fecha_hasta IS NULL OR pp.fecha_hasta >= CURRENT_DATE)
        ) AS vigente,
        trim(pp.estado)::text,
        pp.usu_alta::text,
        pp.fec_alta,
        pp.usu_mod::text,
        pp.fec_mod
    FROM administracion.precio_producto pp
    JOIN produccion.producto p ON p.id_producto = pp.id_producto
    LEFT JOIN produccion.unidad_medida um ON um.id_unidad_medida = p.id_unidad_medida
    ORDER BY p.nombre ASC, pp.fecha_desde DESC, pp.id_precio_producto DESC;
END;
$$;

-- 9. Productos activos para el desplegable de la lista de precios
CREATE OR REPLACE FUNCTION usuarios.listar_productos_para_precio(p_token UUID)
RETURNS TABLE(
    id_producto   integer,
    codigo        text,
    nombre        text,
    unidad_codigo text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
BEGIN
    PERFORM usuarios.fn_actor_catalogo(p_token, 'lista-precios');

    RETURN QUERY
    SELECT p.id_producto::integer, p.codigo::text, p.nombre::text, um.codigo::text
    FROM produccion.producto p
    LEFT JOIN produccion.unidad_medida um ON um.id_unidad_medida = p.id_unidad_medida
    WHERE p.estado = 'A'
    ORDER BY p.nombre ASC;
END;
$$;

-- 10. Crear valor de precio
CREATE OR REPLACE FUNCTION usuarios.crear_precio_producto(
    p_token           UUID,
    p_id_producto     INTEGER,
    p_precio_unitario NUMERIC,
    p_moneda          TEXT,
    p_fecha_desde     DATE,
    p_fecha_hasta     DATE DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_login  TEXT;
    v_id     INTEGER;
    v_moneda TEXT := upper(trim(coalesce(p_moneda, '')));
BEGIN
    v_login := usuarios.fn_actor_catalogo(p_token, 'lista-precios');

    IF p_id_producto IS NULL OR NOT EXISTS (
        SELECT 1 FROM produccion.producto WHERE id_producto = p_id_producto AND estado = 'A'
    ) THEN
        RAISE EXCEPTION 'Seleccioná un producto activo';
    END IF;
    IF p_precio_unitario IS NULL OR p_precio_unitario <= 0 THEN
        RAISE EXCEPTION 'El precio unitario debe ser mayor a 0';
    END IF;
    IF v_moneda !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'La moneda debe tener exactamente 3 letras (ej: ARS, USD)';
    END IF;
    IF p_fecha_desde IS NULL THEN
        RAISE EXCEPTION 'La fecha desde es obligatoria';
    END IF;
    IF p_fecha_hasta IS NOT NULL AND p_fecha_hasta < p_fecha_desde THEN
        RAISE EXCEPTION 'La fecha hasta no puede ser anterior a la fecha desde';
    END IF;

    INSERT INTO administracion.precio_producto (
        id_producto, precio_unitario, moneda, fecha_desde, fecha_hasta, estado, usu_alta
    )
    VALUES (
        p_id_producto, round(p_precio_unitario, 2), v_moneda, p_fecha_desde, p_fecha_hasta, 'A', v_login
    )
    RETURNING id_precio_producto INTO v_id;

    RETURN v_id;
END;
$$;

-- 11. Modificar valor de precio
CREATE OR REPLACE FUNCTION usuarios.modificar_precio_producto(
    p_token              UUID,
    p_id_precio_producto INTEGER,
    p_id_producto        INTEGER,
    p_precio_unitario    NUMERIC,
    p_moneda             TEXT,
    p_fecha_desde        DATE,
    p_fecha_hasta        DATE DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_login  TEXT;
    v_moneda TEXT := upper(trim(coalesce(p_moneda, '')));
BEGIN
    v_login := usuarios.fn_actor_catalogo(p_token, 'lista-precios');

    IF p_id_producto IS NULL OR NOT EXISTS (
        SELECT 1 FROM produccion.producto WHERE id_producto = p_id_producto
    ) THEN
        RAISE EXCEPTION 'Seleccioná un producto válido';
    END IF;
    IF p_precio_unitario IS NULL OR p_precio_unitario <= 0 THEN
        RAISE EXCEPTION 'El precio unitario debe ser mayor a 0';
    END IF;
    IF v_moneda !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'La moneda debe tener exactamente 3 letras (ej: ARS, USD)';
    END IF;
    IF p_fecha_desde IS NULL THEN
        RAISE EXCEPTION 'La fecha desde es obligatoria';
    END IF;
    IF p_fecha_hasta IS NOT NULL AND p_fecha_hasta < p_fecha_desde THEN
        RAISE EXCEPTION 'La fecha hasta no puede ser anterior a la fecha desde';
    END IF;

    UPDATE administracion.precio_producto
    SET id_producto     = p_id_producto,
        precio_unitario = round(p_precio_unitario, 2),
        moneda          = v_moneda,
        fecha_desde     = p_fecha_desde,
        fecha_hasta     = p_fecha_hasta,
        usu_mod         = v_login,
        fec_mod         = now()
    WHERE id_precio_producto = p_id_precio_producto;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el valor de precio indicado';
    END IF;

    RETURN true;
END;
$$;

-- 12. Eliminar (baja lógica) / reactivar valor de precio
--     Los pedidos ya generados conservan su precio en detalle_pedido.precio_unitario.
CREATE OR REPLACE FUNCTION usuarios.cambiar_estado_precio_producto(
    p_token              UUID,
    p_id_precio_producto INTEGER,
    p_estado             TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'usuarios', 'public'
AS $$
DECLARE
    v_login TEXT;
BEGIN
    v_login := usuarios.fn_actor_catalogo(p_token, 'lista-precios');

    IF p_estado NOT IN ('A', 'I', 'E') THEN
        RAISE EXCEPTION 'Estado inválido';
    END IF;

    UPDATE administracion.precio_producto
    SET estado  = p_estado,
        usu_mod = v_login,
        fec_mod = now()
    WHERE id_precio_producto = p_id_precio_producto;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el valor de precio indicado';
    END IF;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION usuarios.listar_productos_catalogo(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_catalogos_producto(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.crear_producto_catalogo(UUID, TEXT, INTEGER, INTEGER, INTEGER, BOOLEAN, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.modificar_producto_catalogo(UUID, INTEGER, TEXT, INTEGER, INTEGER, INTEGER, BOOLEAN, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.cambiar_estado_producto_catalogo(UUID, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_precios_producto(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_productos_para_precio(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.crear_precio_producto(UUID, INTEGER, NUMERIC, TEXT, DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.modificar_precio_producto(UUID, INTEGER, INTEGER, NUMERIC, TEXT, DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.cambiar_estado_precio_producto(UUID, INTEGER, TEXT) TO anon, authenticated;
