-- =====================================================================
-- 56 - Depósito: Ocupación por zonas, listado de depósitos/zonas y
--      wrappers SECURITY DEFINER en esquema usuarios (con token)
-- =====================================================================

-- 1. Listar depósitos activos (deposito.deposito)
CREATE OR REPLACE FUNCTION usuarios.listar_depositos_activos(p_token UUID DEFAULT NULL)
RETURNS TABLE(
    id_deposito integer,
    codigo      text,
    nombre      text,
    descripcion text,
    estado      text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'deposito', 'usuarios', 'public'
AS $$
    SELECT
        d.id_deposito::integer,
        trim(d.codigo)::text AS codigo,
        d.nombre::text AS nombre,
        coalesce(d.descripcion, '')::text AS descripcion,
        trim(d.estado)::text AS estado
    FROM deposito.deposito d
    WHERE d.estado = 'A'
    ORDER BY d.id_deposito ASC;
$$;

-- 2. Listar zonas activas (deposito.zona)
CREATE OR REPLACE FUNCTION usuarios.listar_zonas_activas(p_token UUID DEFAULT NULL)
RETURNS TABLE(
    id_zona     integer,
    id_deposito integer,
    codigo      text,
    nombre      text,
    descripcion text,
    estado      text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'deposito', 'usuarios', 'public'
AS $$
    SELECT
        z.id_zona::integer,
        z.id_deposito::integer,
        trim(z.codigo)::text AS codigo,
        z.nombre::text AS nombre,
        coalesce(z.descripcion, '')::text AS descripcion,
        trim(z.estado)::text AS estado
    FROM deposito.zona z
    WHERE z.estado = 'A'
    ORDER BY z.id_deposito ASC, z.codigo ASC;
$$;

-- 3. Ocupación del depósito por zonas
CREATE OR REPLACE FUNCTION usuarios.obtener_ocupacion_deposito_zonas(p_token UUID DEFAULT NULL)
RETURNS TABLE(
    id_zona                integer,
    id_deposito            integer,
    codigo_zona            text,
    nombre_zona            text,
    cantidad_pasillos      bigint,
    posiciones_totales     bigint,
    posiciones_ocupadas    bigint,
    posiciones_disponibles bigint,
    porcentaje_ocupacion   numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'deposito', 'usuarios', 'public'
AS $$
    SELECT
        z.id_zona::integer,
        z.id_deposito::integer,
        trim(z.codigo)::text AS codigo_zona,
        z.nombre::text AS nombre_zona,

        COUNT(DISTINCT pa.id_pasillo) AS cantidad_pasillos,

        COUNT(pos.id_posicion) AS posiciones_totales,

        COUNT(pos.id_posicion) FILTER (
            WHERE pos.estado = 'A'
              AND pos.estado_posicion = 'O'
        ) AS posiciones_ocupadas,

        COUNT(pos.id_posicion) FILTER (
            WHERE pos.estado = 'A'
              AND pos.estado_posicion = 'D'
        ) AS posiciones_disponibles,

        COALESCE(
            ROUND(
                100.0 * COUNT(pos.id_posicion) FILTER (
                    WHERE pos.estado = 'A'
                      AND pos.estado_posicion = 'O'
                ) / NULLIF(
                    COUNT(pos.id_posicion) FILTER (
                        WHERE pos.estado = 'A'
                    ), 0
                ), 2
            ),
            0
        ) AS porcentaje_ocupacion

    FROM deposito.zona z
    LEFT JOIN deposito.pasillo pa
        ON pa.id_zona = z.id_zona
       AND pa.estado = 'A'
    LEFT JOIN deposito.modulo m
        ON m.id_pasillo = pa.id_pasillo
       AND m.estado = 'A'
    LEFT JOIN deposito.nivel n
        ON n.id_modulo = m.id_modulo
       AND n.estado = 'A'
    LEFT JOIN deposito.posicion pos
        ON pos.id_nivel = n.id_nivel

    WHERE z.estado = 'A'

    GROUP BY
        z.id_zona,
        z.id_deposito,
        z.codigo,
        z.nombre

    ORDER BY z.codigo;
$$;

-- 4. Configurar y generar nueva zona (invoca deposito.fn_configurar_y_generar_zona con el usuario de la sesión)
CREATE OR REPLACE FUNCTION usuarios.configurar_y_generar_zona_deposito(
    p_token                  UUID,
    p_id_deposito            INTEGER,
    p_codigo_zona            TEXT,
    p_cantidad_pasillos      INTEGER,
    p_posiciones_por_pasillo INTEGER,
    p_cantidad_niveles       INTEGER,
    p_capacidad_kg           NUMERIC DEFAULT NULL,
    p_capacidad_m3           NUMERIC DEFAULT NULL,
    p_usuario                TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'deposito', 'usuarios', 'public'
AS $$
DECLARE
    v_usuario_login TEXT;
    v_id_config     INTEGER;
BEGIN
    SELECT u.usuario_login
    INTO v_usuario_login
    FROM usuarios.usuarios u
    WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
      AND u.estado = 'A';

    v_usuario_login := coalesce(nullif(trim(v_usuario_login), ''), nullif(trim(p_usuario), ''));

    IF v_usuario_login IS NULL THEN
        RAISE EXCEPTION 'Sesión inválida o usuario no identificado para auditoría.';
    END IF;

    SELECT deposito.fn_configurar_y_generar_zona(
        p_id_deposito,
        upper(trim(p_codigo_zona))::char(1),
        p_cantidad_pasillos,
        p_posiciones_por_pasillo,
        p_cantidad_niveles,
        p_capacidad_kg,
        p_capacidad_m3,
        v_usuario_login::varchar(50)
    )
    INTO v_id_config;

    RETURN v_id_config;
END;
$$;

-- 5. Eliminar zona de depósito (invoca deposito.fn_eliminar_zona con el usuario de la sesión)
CREATE OR REPLACE FUNCTION usuarios.eliminar_zona_deposito(
    p_token       UUID,
    p_id_deposito INTEGER,
    p_codigo_zona TEXT,
    p_usuario     TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'deposito', 'usuarios', 'public'
AS $$
DECLARE
    v_usuario_login TEXT;
BEGIN
    SELECT u.usuario_login
    INTO v_usuario_login
    FROM usuarios.usuarios u
    WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
      AND u.estado = 'A';

    v_usuario_login := coalesce(nullif(trim(v_usuario_login), ''), nullif(trim(p_usuario), ''));

    IF v_usuario_login IS NULL THEN
        RAISE EXCEPTION 'Sesión inválida o usuario no identificado para auditoría.';
    END IF;

    -- Validación backend: no se puede eliminar una zona con posiciones ocupadas
    IF EXISTS (
        SELECT 1
        FROM deposito.zona z
        JOIN deposito.pasillo pa ON pa.id_zona = z.id_zona
        JOIN deposito.modulo m   ON m.id_pasillo = pa.id_pasillo
        JOIN deposito.nivel n    ON n.id_modulo = m.id_modulo
        JOIN deposito.posicion pos ON pos.id_nivel = n.id_nivel
        WHERE z.id_deposito = p_id_deposito
          AND z.codigo = upper(trim(p_codigo_zona))::char(1)
          AND z.estado = 'A'
          AND pos.estado = 'A'
          AND pos.estado_posicion = 'O'
    ) THEN
        RAISE EXCEPTION 'No se puede eliminar la zona % porque tiene productos en ella (posiciones ocupadas).', upper(trim(p_codigo_zona));
    END IF;

    PERFORM deposito.fn_eliminar_zona(
        p_id_deposito,
        upper(trim(p_codigo_zona))::char(1),
        v_usuario_login::varchar(50)
    );

    RETURN true;
END;
$$;

-- 6. Inventario crítico: Lotes de productos biodegradables con ubicación física y stock disponible (sin reservado)
CREATE OR REPLACE FUNCTION usuarios.listar_inventario_critico_deposito(p_token UUID DEFAULT NULL)
RETURNS TABLE(
    id_lote_producto   integer,
    codigo_lote        text,
    id_producto        integer,
    producto_codigo    text,
    producto_nombre    text,
    material_nombre    text,
    es_biodegradable   boolean,
    ubicacion_fisica   text,
    cantidad_total     numeric,
    cantidad_reservada numeric,
    cantidad_consumida numeric,
    stock_disponible   numeric,
    unidad_codigo      text,
    fecha_fabricacion  timestamp without time zone,
    fecha_vencimiento  date,
    codigo_estado_lote text,
    estado_lote_nombre text,
    situacion          text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'deposito', 'produccion', 'usuarios', 'public'
AS $$
    SELECT
        l.id_lote_producto::integer,
        l.nro_lote::text AS codigo_lote,
        p.id_producto::integer,
        p.codigo::text AS producto_codigo,
        p.nombre::text AS producto_nombre,
        coalesce(m.nombre, p.nombre)::text AS material_nombre,
        coalesce(p.es_biodegradable, false) AS es_biodegradable,
        coalesce(pos.codigo, '—')::text AS ubicacion_fisica,
        l.cantidad_total::numeric AS cantidad_total,
        coalesce(s.cantidad_reservada, 0)::numeric AS cantidad_reservada,
        coalesce(s.cantidad_consumida, 0)::numeric AS cantidad_consumida,
        CASE
            WHEN trim(l.estado_lote) = 'A' THEN 0::numeric
            ELSE GREATEST(
                l.cantidad_total - coalesce(s.cantidad_reservada, 0) - coalesce(s.cantidad_consumida, 0),
                0
            )::numeric
        END AS stock_disponible,
        coalesce(um.codigo, '')::text AS unidad_codigo,
        l.fecha_fabricacion,
        l.fecha_vencimiento,
        trim(l.estado_lote)::text AS codigo_estado_lote,
        CASE trim(l.estado_lote)
            WHEN 'P' THEN 'Pendiente'
            WHEN 'R' THEN 'Recibido'
            WHEN 'U' THEN 'Ubicado'
            WHEN 'B' THEN 'Bloqueado'
            WHEN 'A' THEN 'Agotado'
            ELSE trim(l.estado_lote)
        END::text AS estado_lote_nombre,
        CASE
            WHEN l.fecha_vencimiento IS NULL THEN 'Normal'
            WHEN CURRENT_DATE > l.fecha_vencimiento THEN 'Vencido'
            WHEN l.fecha_vencimiento <= (CURRENT_DATE + INTERVAL '1 month')::date THEN 'Próximo a vencer'
            ELSE 'Normal'
        END::text AS situacion
    FROM produccion.lote_producto l
    JOIN produccion.producto p
        ON p.id_producto = l.id_producto
    LEFT JOIN produccion.material m
        ON m.id_material = p.id_material
    LEFT JOIN produccion.unidad_medida um
        ON um.id_unidad_medida = p.id_unidad_medida
    LEFT JOIN deposito.stock s
        ON s.id_lote_producto = l.id_lote_producto
       AND s.estado = 'A'
    LEFT JOIN deposito.lote_posicion lp
        ON lp.id_lote_producto = l.id_lote_producto
       AND lp.estado = 'A'
    LEFT JOIN deposito.posicion pos
        ON pos.id_posicion = lp.id_posicion
       AND pos.estado = 'A'
    WHERE l.estado = 'A'
      AND p.estado = 'A'
      AND p.es_biodegradable = true
      AND trim(l.estado_lote) IN ('P', 'R', 'U', 'B', 'A')
    ORDER BY
        CASE
            WHEN l.fecha_vencimiento IS NOT NULL AND CURRENT_DATE > l.fecha_vencimiento THEN 1
            WHEN l.fecha_vencimiento IS NOT NULL AND l.fecha_vencimiento <= (CURRENT_DATE + INTERVAL '1 month')::date THEN 2
            ELSE 3
        END ASC,
        l.fecha_vencimiento ASC NULLS LAST,
        l.id_lote_producto DESC;
$$;

GRANT EXECUTE ON FUNCTION usuarios.listar_depositos_activos(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_zonas_activas(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.obtener_ocupacion_deposito_zonas(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.configurar_y_generar_zona_deposito(UUID, INTEGER, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.eliminar_zona_deposito(UUID, INTEGER, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_inventario_critico_deposito(UUID) TO anon, authenticated;

GRANT USAGE ON SCHEMA deposito TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA deposito TO anon, authenticated;
GRANT EXECUTE ON FUNCTION deposito.fn_configurar_y_generar_zona(INTEGER, CHAR(1), INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION deposito.fn_eliminar_zona(INTEGER, CHAR(1), VARCHAR) TO anon, authenticated;
