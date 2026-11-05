-- =====================================================================
-- 58 - Producción: Gestión de Órdenes de Producción con TOKEN
-- =====================================================================

-- 1. Asegurar columna id_unidad_medida en detalle_orden_produccion si no existe
ALTER TABLE produccion.detalle_orden_produccion
    ADD COLUMN IF NOT EXISTS id_unidad_medida INTEGER REFERENCES produccion.unidad_medida(id_unidad_medida);

-- 2. Asegurar secuencia para nro_orden si no existe y sincronizar
CREATE SEQUENCE IF NOT EXISTS produccion.seq_nro_orden;

SELECT setval(
    'produccion.seq_nro_orden',
    GREATEST(
        COALESCE((
            SELECT MAX(NULLIF(regexp_replace(nro_orden, '^OP-0*', ''), '')::BIGINT)
            FROM produccion.orden_produccion
            WHERE nro_orden ~ '^OP-[0-9]+$'
        ), 0),
        1
    )
);

-- Eliminar funciones previas por si cambió la firma de retorno
DROP FUNCTION IF EXISTS usuarios.obtener_resumen_ordenes_produccion(UUID);
DROP FUNCTION IF EXISTS usuarios.listar_ordenes_produccion(UUID);
DROP FUNCTION IF EXISTS usuarios.obtener_detalle_orden_produccion(UUID, INTEGER);
DROP FUNCTION IF EXISTS usuarios.listar_productos_para_orden(UUID);
DROP FUNCTION IF EXISTS usuarios.listar_motivos_estado(UUID);
DROP FUNCTION IF EXISTS usuarios.crear_orden_produccion(UUID, INTEGER, JSONB);
DROP FUNCTION IF EXISTS usuarios.modificar_orden_produccion(UUID, INTEGER, JSONB);
DROP FUNCTION IF EXISTS usuarios.tomar_orden_produccion(UUID, INTEGER);
DROP FUNCTION IF EXISTS usuarios.anular_orden_produccion(UUID, INTEGER, INTEGER);

-- 3. Resumen de contadores por estado_op
-- En pendientes se contabilizan las órdenes con estado 'P', 'T' o 'D'
CREATE OR REPLACE FUNCTION usuarios.obtener_resumen_ordenes_produccion(p_token UUID DEFAULT NULL)
RETURNS TABLE(
    pendientes    bigint,
    tomadas       bigint,
    en_ejecucion  bigint,
    incompletas   bigint,
    completas     bigint,
    anuladas      bigint,
    total         bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
    SELECT
        COUNT(*) FILTER (WHERE trim(op.estado_op) IN ('P', 'T', 'D')) AS pendientes,
        COUNT(*) FILTER (WHERE trim(op.estado_op) = 'T') AS tomadas,
        COUNT(*) FILTER (WHERE trim(op.estado_op) = 'E') AS en_ejecucion,
        COUNT(*) FILTER (WHERE trim(op.estado_op) = 'I') AS incompletas,
        COUNT(*) FILTER (WHERE trim(op.estado_op) = 'C') AS completas,
        COUNT(*) FILTER (WHERE trim(op.estado_op) = 'A') AS anuladas,
        COUNT(*) AS total
    FROM produccion.orden_produccion op
    WHERE op.estado <> 'E';
$$;

-- 4. Listado general de órdenes de producción
-- Incluye datos de quién modificó (tomó/devolvió/anuló) y ordenamiento por estado: D, P, T, E, C, A
CREATE OR REPLACE FUNCTION usuarios.listar_ordenes_produccion(p_token UUID DEFAULT NULL)
RETURNS TABLE(
    id_orden_produccion integer,
    nro_orden           text,
    fecha_orden         timestamp without time zone,
    id_solicitante      integer,
    solicitante_login   text,
    solicitante_nombre  text,
    estado_op           text,
    estado_op_nombre    text,
    id_motivo_estado    integer,
    motivo_codigo       text,
    motivo_nombre       text,
    motivo_descripcion  text,
    estado              text,
    usu_alta            text,
    fec_alta            timestamp without time zone,
    usu_mod             text,
    usu_mod_nombre      text,
    fec_mod             timestamp without time zone,
    cantidad_items      bigint,
    total_solicitado    numeric,
    total_producido     numeric,
    fecha_limite_min    date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'sistema', 'usuarios', 'public'
AS $$
    SELECT
        op.id_orden_produccion::integer,
        trim(op.nro_orden)::text,
        op.fecha_orden,
        op.id_solicitante::integer,
        coalesce(u.usuario_login, '')::text AS solicitante_login,
        trim(concat_ws(' ', u.nombre, u.apellido))::text AS solicitante_nombre,
        trim(op.estado_op)::text AS estado_op,
        CASE trim(op.estado_op)
            WHEN 'P' THEN 'Pendiente'
            WHEN 'T' THEN 'Tomada'
            WHEN 'D' THEN 'Devuelta'
            WHEN 'E' THEN 'En ejecución'
            WHEN 'I' THEN 'Incompleta'
            WHEN 'C' THEN 'Completa'
            WHEN 'A' THEN 'Anulada'
            ELSE trim(op.estado_op)
        END::text AS estado_op_nombre,
        op.id_motivo_estado::integer,
        coalesce(me.codigo, '')::text AS motivo_codigo,
        coalesce(me.nombre, '')::text AS motivo_nombre,
        coalesce(me.descripcion, '')::text AS motivo_descripcion,
        trim(op.estado)::text AS estado,
        op.usu_alta::text,
        op.fec_alta,
        op.usu_mod::text,
        trim(concat_ws(' ', u_mod.nombre, u_mod.apellido))::text AS usu_mod_nombre,
        op.fec_mod,
        coalesce(det.items, 0)::bigint AS cantidad_items,
        coalesce(det.solicitado, 0)::numeric AS total_solicitado,
        coalesce(det.producido, 0)::numeric AS total_producido,
        det.limite_min AS fecha_limite_min
    FROM produccion.orden_produccion op
    LEFT JOIN usuarios.usuarios u
        ON u.id_usuario = op.id_solicitante
    LEFT JOIN usuarios.usuarios u_mod
        ON lower(u_mod.usuario_login) = lower(op.usu_mod)
    LEFT JOIN sistema.motivo_estado me
        ON me.id_motivo_estado = op.id_motivo_estado
    LEFT JOIN LATERAL (
        SELECT
            COUNT(*) AS items,
            SUM(d.cantidad_solicitada) AS solicitado,
            SUM(d.cantidad_producida)  AS producido,
            MIN(d.fecha_limite)        AS limite_min
        FROM produccion.detalle_orden_produccion d
        WHERE d.id_orden_produccion = op.id_orden_produccion
          AND d.estado <> 'E'
    ) det ON true
    WHERE op.estado <> 'E'
    ORDER BY
        CASE trim(op.estado_op)
            WHEN 'D' THEN 1
            WHEN 'P' THEN 2
            WHEN 'T' THEN 3
            WHEN 'E' THEN 4
            WHEN 'I' THEN 5
            WHEN 'C' THEN 6
            WHEN 'A' THEN 7
            ELSE 8
        END ASC,
        op.id_orden_produccion DESC;
$$;

-- 5. Detalle de productos de una orden de producción
CREATE OR REPLACE FUNCTION usuarios.obtener_detalle_orden_produccion(
    p_token               UUID,
    p_id_orden_produccion INTEGER
)
RETURNS TABLE(
    id_detalle_orden      integer,
    id_orden_produccion   integer,
    id_producto           integer,
    producto_codigo       text,
    producto_nombre       text,
    material_nombre       text,
    id_unidad_medida      integer,
    unidad_codigo         text,
    unidad_nombre         text,
    cantidad_solicitada   numeric,
    cantidad_producida    numeric,
    fecha_limite          date,
    estado_detalle        text,
    estado_detalle_nombre text,
    estado                text,
    usu_alta              text,
    fec_alta              timestamp without time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
    SELECT
        d.id_detalle_orden::integer,
        d.id_orden_produccion::integer,
        d.id_producto::integer,
        p.codigo::text AS producto_codigo,
        p.nombre::text AS producto_nombre,
        coalesce(m.nombre, '—')::text AS material_nombre,
        coalesce(d.id_unidad_medida, p.id_unidad_medida)::integer AS id_unidad_medida,
        coalesce(um.codigo, '')::text AS unidad_codigo,
        coalesce(um.nombre, '')::text AS unidad_nombre,
        d.cantidad_solicitada::numeric,
        d.cantidad_producida::numeric,
        d.fecha_limite,
        trim(d.estado_detalle)::text AS estado_detalle,
        CASE trim(d.estado_detalle)
            WHEN 'P' THEN 'Pendiente'
            WHEN 'E' THEN 'En proceso'
            WHEN 'I' THEN 'Incompleto'
            WHEN 'C' THEN 'Completo'
            WHEN 'A' THEN 'Anulado'
            ELSE trim(d.estado_detalle)
        END::text AS estado_detalle_nombre,
        trim(d.estado)::text AS estado,
        d.usu_alta::text,
        d.fec_alta
    FROM produccion.detalle_orden_produccion d
    JOIN produccion.producto p
        ON p.id_producto = d.id_producto
    LEFT JOIN produccion.material m
        ON m.id_material = p.id_material
    LEFT JOIN produccion.unidad_medida um
        ON um.id_unidad_medida = coalesce(d.id_unidad_medida, p.id_unidad_medida)
    WHERE d.id_orden_produccion = p_id_orden_produccion
      AND d.estado <> 'E'
    ORDER BY d.id_detalle_orden ASC;
$$;

-- 6. Listar productos activos para el formulario de generación/edición de orden
CREATE OR REPLACE FUNCTION usuarios.listar_productos_para_orden(p_token UUID DEFAULT NULL)
RETURNS TABLE(
    id_producto      integer,
    codigo           text,
    nombre           text,
    id_material      integer,
    material_nombre  text,
    id_unidad_medida integer,
    unidad_codigo    text,
    unidad_nombre    text,
    es_biodegradable boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
    SELECT
        p.id_producto::integer,
        p.codigo::text,
        p.nombre::text,
        p.id_material::integer,
        coalesce(m.nombre, '—')::text AS material_nombre,
        p.id_unidad_medida::integer,
        coalesce(um.codigo, '')::text AS unidad_codigo,
        coalesce(um.nombre, '')::text AS unidad_nombre,
        coalesce(p.es_biodegradable, false) AS es_biodegradable
    FROM produccion.producto p
    LEFT JOIN produccion.material m
        ON m.id_material = p.id_material
    LEFT JOIN produccion.unidad_medida um
        ON um.id_unidad_medida = p.id_unidad_medida
    WHERE p.estado = 'A'
    ORDER BY p.nombre ASC;
$$;

-- 7. Listar motivos de estado activos (sistema.motivo_estado)
CREATE OR REPLACE FUNCTION usuarios.listar_motivos_estado(p_token UUID DEFAULT NULL)
RETURNS TABLE(
    id_motivo_estado integer,
    codigo           text,
    nombre           text,
    descripcion      text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'sistema', 'usuarios', 'public'
AS $$
    SELECT
        me.id_motivo_estado::integer,
        me.codigo::text,
        me.nombre::text,
        coalesce(me.descripcion, '')::text AS descripcion
    FROM sistema.motivo_estado me
    WHERE me.estado = 'A'
    ORDER BY me.id_motivo_estado ASC;
$$;

-- 8. Crear nueva orden de producción con sus líneas de productos
CREATE OR REPLACE FUNCTION usuarios.crear_orden_produccion(
    p_token            UUID,
    p_id_solicitante   INTEGER DEFAULT NULL,
    p_items            JSONB DEFAULT '[]'::JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_usuario_login  TEXT;
    v_id_solicitante INTEGER;
    v_id_orden       INTEGER;
    v_item           JSONB;
    v_id_producto    INTEGER;
    v_cantidad       NUMERIC;
    v_fecha_limite   DATE;
    v_id_unidad      INTEGER;
BEGIN
    -- Identificar usuario que ejecuta la acción
    SELECT u.id_usuario, u.usuario_login
    INTO v_id_solicitante, v_usuario_login
    FROM usuarios.usuarios u
    WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
      AND u.estado = 'A';

    IF v_usuario_login IS NULL THEN
        RAISE EXCEPTION 'Sesión inválida o usuario no autenticado.';
    END IF;

    -- Si se especificó un solicitante explícito, validar que exista
    IF p_id_solicitante IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM usuarios.usuarios WHERE id_usuario = p_id_solicitante AND estado = 'A') THEN
            v_id_solicitante := p_id_solicitante;
        END IF;
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Debe incluir al menos un producto en la orden de producción.';
    END IF;

    -- Insertar cabecera de la orden (el trigger trg_orden_produccion_nro generará nro_orden)
    INSERT INTO produccion.orden_produccion (
        nro_orden,
        fecha_orden,
        id_solicitante,
        estado_op,
        estado,
        usu_alta,
        fec_alta
    )
    VALUES (
        '',
        CURRENT_TIMESTAMP,
        v_id_solicitante,
        'P',
        'A',
        v_usuario_login,
        CURRENT_TIMESTAMP
    )
    RETURNING id_orden_produccion INTO v_id_orden;

    -- Insertar líneas de detalle
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_id_producto  := (v_item->>'id_producto')::INTEGER;
        v_cantidad     := (v_item->>'cantidad_solicitada')::NUMERIC;
        v_fecha_limite := (v_item->>'fecha_limite')::DATE;

        IF v_id_producto IS NULL OR NOT EXISTS (
            SELECT 1 FROM produccion.producto WHERE id_producto = v_id_producto AND estado = 'A'
        ) THEN
            RAISE EXCEPTION 'Producto inválido o inactivo (ID %)', v_id_producto;
        END IF;

        IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
            RAISE EXCEPTION 'La cantidad solicitada debe ser mayor a cero.';
        END IF;

        IF v_fecha_limite IS NULL THEN
            RAISE EXCEPTION 'La fecha límite de fabricación es obligatoria.';
        END IF;

        -- Obtener unidad de medida asociada al producto
        SELECT p.id_unidad_medida
        INTO v_id_unidad
        FROM produccion.producto p
        WHERE p.id_producto = v_id_producto;

        INSERT INTO produccion.detalle_orden_produccion (
            id_orden_produccion,
            id_producto,
            cantidad_solicitada,
            cantidad_producida,
            fecha_limite,
            id_unidad_medida,
            estado_detalle,
            estado,
            usu_alta,
            fec_alta
        )
        VALUES (
            v_id_orden,
            v_id_producto,
            round(v_cantidad, 3),
            0,
            v_fecha_limite,
            v_id_unidad,
            'P',
            'A',
            v_usuario_login,
            CURRENT_TIMESTAMP
        );
    END LOOP;

    RETURN v_id_orden;
END;
$$;

-- 9. Modificar orden de producción (solo permitido si estado_op = 'P')
CREATE OR REPLACE FUNCTION usuarios.modificar_orden_produccion(
    p_token               UUID,
    p_id_orden_produccion INTEGER,
    p_items               JSONB DEFAULT '[]'::JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_usuario_login TEXT;
    v_estado_actual CHAR(1);
    v_item          JSONB;
    v_id_producto   INTEGER;
    v_cantidad      NUMERIC;
    v_fecha_limite  DATE;
    v_id_unidad     INTEGER;
BEGIN
    SELECT u.usuario_login
    INTO v_usuario_login
    FROM usuarios.usuarios u
    WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
      AND u.estado = 'A';

    IF v_usuario_login IS NULL THEN
        RAISE EXCEPTION 'Sesión inválida o usuario no autenticado.';
    END IF;

    SELECT trim(estado_op)
    INTO v_estado_actual
    FROM produccion.orden_produccion
    WHERE id_orden_produccion = p_id_orden_produccion
      AND estado <> 'E';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró la orden de producción indicada.';
    END IF;

    IF v_estado_actual NOT IN ('P', 'D') THEN
        RAISE EXCEPTION 'Solo se pueden modificar órdenes en estado Pendiente (P) o Devuelta (D). Estado actual: %', v_estado_actual;
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'La orden de producción debe contener al menos un producto.';
    END IF;

    -- Actualizar auditoría en cabecera
    UPDATE produccion.orden_produccion
    SET usu_mod = v_usuario_login,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_orden_produccion = p_id_orden_produccion;

    -- Reemplazar detalle de la orden (al estar en estado 'P' aún no tiene lotes/producción ejecutada)
    DELETE FROM produccion.detalle_orden_produccion
    WHERE id_orden_produccion = p_id_orden_produccion;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_id_producto  := (v_item->>'id_producto')::INTEGER;
        v_cantidad     := (v_item->>'cantidad_solicitada')::NUMERIC;
        v_fecha_limite := (v_item->>'fecha_limite')::DATE;

        IF v_id_producto IS NULL OR NOT EXISTS (
            SELECT 1 FROM produccion.producto WHERE id_producto = v_id_producto AND estado = 'A'
        ) THEN
            RAISE EXCEPTION 'Producto inválido o inactivo (ID %)', v_id_producto;
        END IF;

        IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
            RAISE EXCEPTION 'La cantidad solicitada debe ser mayor a cero.';
        END IF;

        IF v_fecha_limite IS NULL THEN
            RAISE EXCEPTION 'La fecha límite de fabricación es obligatoria.';
        END IF;

        SELECT p.id_unidad_medida
        INTO v_id_unidad
        FROM produccion.producto p
        WHERE p.id_producto = v_id_producto;

        INSERT INTO produccion.detalle_orden_produccion (
            id_orden_produccion,
            id_producto,
            cantidad_solicitada,
            cantidad_producida,
            fecha_limite,
            id_unidad_medida,
            estado_detalle,
            estado,
            usu_alta,
            fec_alta,
            usu_mod,
            fec_mod
        )
        VALUES (
            p_id_orden_produccion,
            v_id_producto,
            round(v_cantidad, 3),
            0,
            v_fecha_limite,
            v_id_unidad,
            'P',
            'A',
            v_usuario_login,
            CURRENT_TIMESTAMP,
            v_usuario_login,
            CURRENT_TIMESTAMP
        );
    END LOOP;

    RETURN true;
END;
$$;

-- 10. Tomar orden de producción: pasa el estado_op de 'P' a 'T'
CREATE OR REPLACE FUNCTION usuarios.tomar_orden_produccion(
    p_token               UUID,
    p_id_orden_produccion INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_usuario_login TEXT;
    v_estado_actual CHAR(1);
BEGIN
    SELECT u.usuario_login
    INTO v_usuario_login
    FROM usuarios.usuarios u
    WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
      AND u.estado = 'A';

    IF v_usuario_login IS NULL THEN
        RAISE EXCEPTION 'Sesión inválida o usuario no autenticado.';
    END IF;

    SELECT trim(estado_op)
    INTO v_estado_actual
    FROM produccion.orden_produccion
    WHERE id_orden_produccion = p_id_orden_produccion;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró la orden de producción indicada.';
    END IF;

    IF v_estado_actual NOT IN ('P', 'D') THEN
        RAISE EXCEPTION 'Solo se pueden tomar órdenes que estén en estado Pendiente (P) o Devuelta (D). Estado actual: %', v_estado_actual;
    END IF;

    UPDATE produccion.orden_produccion
    SET estado_op = 'T',
        usu_mod   = v_usuario_login,
        fec_mod   = CURRENT_TIMESTAMP
    WHERE id_orden_produccion = p_id_orden_produccion;

    RETURN true;
END;
$$;

-- 11. Anular orden de producción: pasa estado_op a 'A' y registra id_motivo_estado
-- No permite anular si la orden tiene estado 'T' (Tomada) o 'A' (Anulada)
CREATE OR REPLACE FUNCTION usuarios.anular_orden_produccion(
    p_token               UUID,
    p_id_orden_produccion INTEGER,
    p_id_motivo_estado    INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'sistema', 'usuarios', 'public'
AS $$
DECLARE
    v_usuario_login TEXT;
    v_estado_actual CHAR(1);
BEGIN
    SELECT u.usuario_login
    INTO v_usuario_login
    FROM usuarios.usuarios u
    WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
      AND u.estado = 'A';

    IF v_usuario_login IS NULL THEN
        RAISE EXCEPTION 'Sesión inválida o usuario no autenticado.';
    END IF;

    IF p_id_motivo_estado IS NULL OR NOT EXISTS (
        SELECT 1 FROM sistema.motivo_estado WHERE id_motivo_estado = p_id_motivo_estado AND estado = 'A'
    ) THEN
        RAISE EXCEPTION 'Debe seleccionar un motivo de anulación válido.';
    END IF;

    SELECT trim(estado_op)
    INTO v_estado_actual
    FROM produccion.orden_produccion
    WHERE id_orden_produccion = p_id_orden_produccion
      AND estado <> 'E';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró la orden de producción indicada.';
    END IF;

    IF v_estado_actual NOT IN ('P', 'D') THEN
        RAISE EXCEPTION 'Solo se pueden anular órdenes de producción en estado Pendiente (P) o Devuelta (D). Estado actual: %', v_estado_actual;
    END IF;

    UPDATE produccion.orden_produccion
    SET estado_op        = 'A',
        id_motivo_estado = p_id_motivo_estado,
        usu_mod          = v_usuario_login,
        fec_mod          = CURRENT_TIMESTAMP
    WHERE id_orden_produccion = p_id_orden_produccion;

    RETURN true;
END;
$$;

-- Permisos de ejecución
GRANT EXECUTE ON FUNCTION usuarios.obtener_resumen_ordenes_produccion(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_ordenes_produccion(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.obtener_detalle_orden_produccion(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_productos_para_orden(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_motivos_estado(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.crear_orden_produccion(UUID, INTEGER, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.modificar_orden_produccion(UUID, INTEGER, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.tomar_orden_produccion(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.anular_orden_produccion(UUID, INTEGER, INTEGER) TO anon, authenticated;

GRANT USAGE ON SCHEMA produccion TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA produccion TO anon, authenticated;
GRANT USAGE ON SCHEMA sistema TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA sistema TO anon, authenticated;
