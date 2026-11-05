-- =====================================================================
-- 59 - Producción: Mis Órdenes y Control de Fabricación con TOKEN
-- =====================================================================

-- 1. Ajustar tabla produccion.produccion para permitir cantidad_producida NULL en anulaciones
ALTER TABLE produccion.produccion ALTER COLUMN cantidad_producida DROP NOT NULL;

-- 2. Actualizar constraints de produccion.produccion
ALTER TABLE produccion.produccion DROP CONSTRAINT IF EXISTS ck_produccion_cantidad;
ALTER TABLE produccion.produccion DROP CONSTRAINT IF EXISTS ck_produccion_estado;
ALTER TABLE produccion.produccion DROP CONSTRAINT IF EXISTS ck_produccion_motivo_anulacion;
ALTER TABLE produccion.produccion DROP CONSTRAINT IF EXISTS ck_produccion_motivo_estado;

ALTER TABLE produccion.produccion ADD CONSTRAINT ck_produccion_estado CHECK (
    estado_produccion IN ('P', 'E', 'I', 'C', 'A')
);

ALTER TABLE produccion.produccion ADD CONSTRAINT ck_produccion_cantidad CHECK (
    (estado_produccion = 'A' AND (cantidad_producida IS NULL OR cantidad_producida >= 0))
    OR (estado_produccion IN ('P', 'E') AND (cantidad_producida IS NULL OR cantidad_producida >= 0))
    OR (estado_produccion IN ('C', 'I') AND cantidad_producida >= 0)
);

ALTER TABLE produccion.produccion ADD CONSTRAINT ck_produccion_motivo_estado CHECK (
    estado_produccion NOT IN ('I', 'A') OR id_motivo_estado IS NOT NULL
);

-- Asegurar secuencia o identidad
CREATE SEQUENCE IF NOT EXISTS produccion.produccion_id_produccion_seq;

-- 3. Limpiar funciones previas si existiesen
DROP FUNCTION IF EXISTS usuarios.listar_mis_ordenes_produccion(UUID);
DROP FUNCTION IF EXISTS usuarios.devolver_orden_produccion(UUID, INTEGER);
DROP FUNCTION IF EXISTS usuarios.obtener_detalle_mis_ordenes(UUID, INTEGER);
DROP FUNCTION IF EXISTS usuarios.listar_producciones_detalle(UUID, INTEGER);
DROP FUNCTION IF EXISTS usuarios.iniciar_produccion(UUID, INTEGER);
DROP FUNCTION IF EXISTS usuarios.finalizar_produccion(UUID, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS usuarios.finalizar_incompleta_produccion(UUID, INTEGER, NUMERIC, INTEGER);
DROP FUNCTION IF EXISTS usuarios.anular_produccion(UUID, INTEGER, INTEGER);

-- 4. Listar Mis Órdenes de Producción:
-- Filtra exclusivamente las órdenes que fueron tomadas por el usuario autenticado (usu_mod = usuario_login)
-- y que se encuentran activas en trabajo (estado_op = 'T' o 'E').
CREATE OR REPLACE FUNCTION usuarios.listar_mis_ordenes_produccion(p_token UUID)
RETURNS TABLE(
    id_orden_produccion integer,
    nro_orden           text,
    fecha_orden         timestamp without time zone,
    id_solicitante      integer,
    solicitante_login   text,
    solicitante_nombre  text,
    estado_op           text,
    estado_op_nombre    text,
    usu_mod             text,
    fec_mod             timestamp without time zone,
    cantidad_items      bigint,
    total_solicitado    numeric,
    total_producido     numeric,
    total_faltante      numeric,
    fecha_limite_min    date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_usuario_login TEXT;
BEGIN
    SELECT u.usuario_login
    INTO v_usuario_login
    FROM usuarios.usuarios u
    WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
      AND u.estado = 'A';

    IF v_usuario_login IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        op.id_orden_produccion::integer,
        trim(op.nro_orden)::text,
        op.fecha_orden,
        op.id_solicitante::integer,
        coalesce(u.usuario_login, '')::text AS solicitante_login,
        trim(concat_ws(' ', u.nombre, u.apellido))::text AS solicitante_nombre,
        trim(op.estado_op)::text AS estado_op,
        CASE trim(op.estado_op)
            WHEN 'T' THEN 'Tomada'
            WHEN 'E' THEN 'En ejecución'
            WHEN 'P' THEN 'Pendiente'
            WHEN 'D' THEN 'Devuelta'
            WHEN 'I' THEN 'Incompleta'
            WHEN 'C' THEN 'Completa'
            WHEN 'A' THEN 'Anulada'
            ELSE trim(op.estado_op)
        END::text AS estado_op_nombre,
        op.usu_mod::text,
        op.fec_mod,
        coalesce(det.items, 0)::bigint AS cantidad_items,
        coalesce(det.solicitado, 0)::numeric AS total_solicitado,
        coalesce(det.producido, 0)::numeric AS total_producido,
        GREATEST(0, coalesce(det.solicitado, 0) - coalesce(det.producido, 0))::numeric AS total_faltante,
        det.limite_min AS fecha_limite_min
    FROM produccion.orden_produccion op
    LEFT JOIN usuarios.usuarios u
        ON u.id_usuario = op.id_solicitante
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
      AND trim(op.estado_op) IN ('T', 'E')
      AND lower(trim(coalesce(op.usu_mod, ''))) = lower(trim(v_usuario_login))
    ORDER BY op.id_orden_produccion DESC;
END;
$$;

-- 5. Devolver orden de producción: cambia el estado de 'T' (o 'E') a 'D'
CREATE OR REPLACE FUNCTION usuarios.devolver_orden_produccion(
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
    v_usu_mod       TEXT;
BEGIN
    SELECT u.usuario_login
    INTO v_usuario_login
    FROM usuarios.usuarios u
    WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
      AND u.estado = 'A';

    IF v_usuario_login IS NULL THEN
        RAISE EXCEPTION 'Sesión inválida o usuario no autenticado.';
    END IF;

    SELECT trim(estado_op), trim(usu_mod)
    INTO v_estado_actual, v_usu_mod
    FROM produccion.orden_produccion
    WHERE id_orden_produccion = p_id_orden_produccion
      AND estado <> 'E';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró la orden de producción indicada.';
    END IF;

    IF v_estado_actual NOT IN ('T', 'E') THEN
        RAISE EXCEPTION 'Solo se pueden devolver órdenes que estén Tomadas (T) o En ejecución (E). Estado actual: %', v_estado_actual;
    END IF;

    -- Validar que la orden pertenezca al usuario que la devuelve
    IF lower(v_usu_mod) <> lower(v_usuario_login) THEN
        RAISE EXCEPTION 'Solo el usuario que tomó la orden puede devolverla.';
    END IF;

    UPDATE produccion.orden_produccion
    SET estado_op = 'D',
        usu_mod   = v_usuario_login,
        fec_mod   = CURRENT_TIMESTAMP
    WHERE id_orden_produccion = p_id_orden_produccion;

    RETURN true;
END;
$$;

-- 6. Obtener detalle de productos de una orden con cálculo de Faltante
CREATE OR REPLACE FUNCTION usuarios.obtener_detalle_mis_ordenes(
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
    cantidad_faltante     numeric,
    fecha_limite          date,
    estado_detalle        text,
    estado_detalle_nombre text,
    producciones_activas  bigint
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
        GREATEST(0, d.cantidad_solicitada - coalesce(d.cantidad_producida, 0))::numeric AS cantidad_faltante,
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
        coalesce(pr.activas, 0)::bigint AS producciones_activas
    FROM produccion.detalle_orden_produccion d
    JOIN produccion.producto p
        ON p.id_producto = d.id_producto
    LEFT JOIN produccion.material m
        ON m.id_material = p.id_material
    LEFT JOIN produccion.unidad_medida um
        ON um.id_unidad_medida = coalesce(d.id_unidad_medida, p.id_unidad_medida)
    LEFT JOIN LATERAL (
        SELECT COUNT(*) AS activas
        FROM produccion.produccion prd
        WHERE prd.id_detalle_orden = d.id_detalle_orden
          AND prd.estado_produccion = 'E'
          AND prd.estado <> 'E'
    ) pr ON true
    WHERE d.id_orden_produccion = p_id_orden_produccion
      AND d.estado <> 'E'
    ORDER BY d.id_detalle_orden ASC;
$$;

-- 7. Listar producciones de un producto específico (Resumen de Producción)
CREATE OR REPLACE FUNCTION usuarios.listar_producciones_detalle(
    p_token            UUID,
    p_id_detalle_orden INTEGER
)
RETURNS TABLE(
    id_produccion          integer,
    id_detalle_orden       integer,
    id_responsable         integer,
    responsable_login      text,
    responsable_nombre     text,
    fecha_inicio           timestamp without time zone,
    fecha_fin              timestamp without time zone,
    cantidad_producida     numeric,
    estado_produccion      text,
    estado_produccion_nom  text,
    id_motivo_estado       integer,
    motivo_codigo          text,
    motivo_nombre          text,
    motivo_descripcion     text,
    usu_alta               text,
    fec_alta               timestamp without time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'sistema', 'usuarios', 'public'
AS $$
    SELECT
        pr.id_produccion::integer,
        pr.id_detalle_orden::integer,
        pr.id_responsable::integer,
        coalesce(u.usuario_login, '')::text AS responsable_login,
        trim(concat_ws(' ', u.nombre, u.apellido))::text AS responsable_nombre,
        pr.fecha_inicio,
        pr.fecha_fin,
        pr.cantidad_producida::numeric,
        trim(pr.estado_produccion)::text AS estado_produccion,
        CASE trim(pr.estado_produccion)
            WHEN 'E' THEN 'En ejecución'
            WHEN 'C' THEN 'Finalizada'
            WHEN 'I' THEN 'Finalizada incompleta'
            WHEN 'A' THEN 'Anulada'
            WHEN 'P' THEN 'Pendiente'
            ELSE trim(pr.estado_produccion)
        END::text AS estado_produccion_nom,
        pr.id_motivo_estado::integer,
        coalesce(me.codigo, '')::text AS motivo_codigo,
        coalesce(me.nombre, '')::text AS motivo_nombre,
        coalesce(me.descripcion, '')::text AS motivo_descripcion,
        pr.usu_alta::text,
        pr.fec_alta
    FROM produccion.produccion pr
    LEFT JOIN usuarios.usuarios u
        ON u.id_usuario = pr.id_responsable
    LEFT JOIN sistema.motivo_estado me
        ON me.id_motivo_estado = pr.id_motivo_estado
    WHERE pr.id_detalle_orden = p_id_detalle_orden
      AND pr.estado <> 'E'
    ORDER BY pr.id_produccion DESC;
$$;

-- 8. Iniciar nueva producción para una línea de detalle:
-- Carga id_responsable, fecha_inicio = CURRENT_TIMESTAMP, estado_produccion = 'E'
CREATE OR REPLACE FUNCTION usuarios.iniciar_produccion(
    p_token            UUID,
    p_id_detalle_orden INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_id_usuario     INTEGER;
    v_usuario_login  TEXT;
    v_id_orden       INTEGER;
    v_id_produccion  INTEGER;
    v_cant_solic     NUMERIC;
    v_cant_prod      NUMERIC;
BEGIN
    SELECT u.id_usuario, u.usuario_login
    INTO v_id_usuario, v_usuario_login
    FROM usuarios.usuarios u
    WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
      AND u.estado = 'A';

    IF v_id_usuario IS NULL THEN
        RAISE EXCEPTION 'Sesión inválida o usuario no autenticado.';
    END IF;

    SELECT id_orden_produccion, cantidad_solicitada, coalesce(cantidad_producida, 0)
    INTO v_id_orden, v_cant_solic, v_cant_prod
    FROM produccion.detalle_orden_produccion
    WHERE id_detalle_orden = p_id_detalle_orden
      AND estado <> 'E';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró la línea de detalle de la orden.';
    END IF;

    IF v_cant_prod >= v_cant_solic THEN
        RAISE EXCEPTION 'Este producto ya completó la cantidad solicitada (solicitado: %, producido: %).', v_cant_solic, v_cant_prod;
    END IF;

    IF EXISTS (
        SELECT 1 FROM produccion.produccion
        WHERE id_detalle_orden = p_id_detalle_orden
          AND estado_produccion = 'I'
          AND estado <> 'E'
    ) THEN
        RAISE EXCEPTION 'No se puede retomar la producción de un producto que fue finalizado incompleto.';
    END IF;

    -- Insertar nuevo registro de producción en estado 'E'
    INSERT INTO produccion.produccion (
        id_detalle_orden,
        id_responsable,
        fecha_inicio,
        fecha_fin,
        cantidad_producida,
        estado_produccion,
        estado,
        usu_alta,
        fec_alta
    )
    VALUES (
        p_id_detalle_orden,
        v_id_usuario,
        CURRENT_TIMESTAMP,
        NULL,
        0,
        'E',
        'A',
        v_usuario_login,
        CURRENT_TIMESTAMP
    )
    RETURNING id_produccion INTO v_id_produccion;

    RETURN v_id_produccion;
END;
$$;

-- 9. Finalizar producción (Completa):
-- Setea fecha_fin = CURRENT_TIMESTAMP, cantidad_producida ingresada a mano (con tope faltante), estado_produccion = 'C'
CREATE OR REPLACE FUNCTION usuarios.finalizar_produccion(
    p_token               UUID,
    p_id_produccion       INTEGER,
    p_cantidad_producida  NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_usuario_login   TEXT;
    v_id_detalle      INTEGER;
    v_cant_solic      NUMERIC;
    v_cant_acumulada  NUMERIC;
    v_faltante_max    NUMERIC;
    v_estado_actual   CHAR(1);
BEGIN
    SELECT u.usuario_login
    INTO v_usuario_login
    FROM usuarios.usuarios u
    WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
      AND u.estado = 'A';

    IF v_usuario_login IS NULL THEN
        RAISE EXCEPTION 'Sesión inválida o usuario no autenticado.';
    END IF;

    IF p_cantidad_producida IS NULL OR p_cantidad_producida <= 0 THEN
        RAISE EXCEPTION 'La cantidad producida debe ser un número mayor a cero.';
    END IF;

    SELECT id_detalle_orden, trim(estado_produccion)
    INTO v_id_detalle, v_estado_actual
    FROM produccion.produccion
    WHERE id_produccion = p_id_produccion;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró la producción indicada.';
    END IF;

    IF v_estado_actual <> 'E' THEN
        RAISE EXCEPTION 'Solo se pueden finalizar producciones en ejecución (E). Estado actual: %', v_estado_actual;
    END IF;

    -- Obtener cantidad solicitada y lo acumulado en otras producciones activas
    SELECT cantidad_solicitada
    INTO v_cant_solic
    FROM produccion.detalle_orden_produccion
    WHERE id_detalle_orden = v_id_detalle;

    SELECT coalesce(SUM(cantidad_producida), 0)
    INTO v_cant_acumulada
    FROM produccion.produccion
    WHERE id_detalle_orden = v_id_detalle
      AND id_produccion <> p_id_produccion
      AND estado_produccion NOT IN ('A');

    v_faltante_max := GREATEST(0, v_cant_solic - v_cant_acumulada);

    IF p_cantidad_producida > v_faltante_max THEN
        RAISE EXCEPTION 'La cantidad ingresada (%) supera el faltante disponible para fabricar (%).', p_cantidad_producida, v_faltante_max;
    END IF;

    UPDATE produccion.produccion
    SET fecha_fin          = CURRENT_TIMESTAMP,
        cantidad_producida = round(p_cantidad_producida, 3),
        estado_produccion  = 'C',
        usu_mod            = v_usuario_login,
        fec_mod            = CURRENT_TIMESTAMP
    WHERE id_produccion = p_id_produccion;

    RETURN true;
END;
$$;

-- 10. Finalizar incompleto:
-- Setea fecha_fin = CURRENT_TIMESTAMP, cantidad_producida ingresada a mano (con tope faltante),
-- estado_produccion = 'I', obligatorio id_motivo_estado de sistema.motivo_estado
CREATE OR REPLACE FUNCTION usuarios.finalizar_incompleta_produccion(
    p_token               UUID,
    p_id_produccion       INTEGER,
    p_cantidad_producida  NUMERIC,
    p_id_motivo_estado    INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'produccion', 'sistema', 'usuarios', 'public'
AS $$
DECLARE
    v_usuario_login   TEXT;
    v_id_detalle      INTEGER;
    v_cant_solic      NUMERIC;
    v_cant_acumulada  NUMERIC;
    v_faltante_max    NUMERIC;
    v_estado_actual   CHAR(1);
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
        RAISE EXCEPTION 'Debe seleccionar obligatoriamente un motivo de estado válido.';
    END IF;

    IF p_cantidad_producida IS NULL OR p_cantidad_producida < 0 THEN
        RAISE EXCEPTION 'La cantidad producida debe ser igual o mayor a cero.';
    END IF;

    SELECT id_detalle_orden, trim(estado_produccion)
    INTO v_id_detalle, v_estado_actual
    FROM produccion.produccion
    WHERE id_produccion = p_id_produccion;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró la producción indicada.';
    END IF;

    IF v_estado_actual <> 'E' THEN
        RAISE EXCEPTION 'Solo se pueden finalizar producciones en ejecución (E). Estado actual: %', v_estado_actual;
    END IF;

    SELECT cantidad_solicitada
    INTO v_cant_solic
    FROM produccion.detalle_orden_produccion
    WHERE id_detalle_orden = v_id_detalle;

    SELECT coalesce(SUM(cantidad_producida), 0)
    INTO v_cant_acumulada
    FROM produccion.produccion
    WHERE id_detalle_orden = v_id_detalle
      AND id_produccion <> p_id_produccion
      AND estado_produccion NOT IN ('A');

    v_faltante_max := GREATEST(0, v_cant_solic - v_cant_acumulada);

    IF p_cantidad_producida > v_faltante_max THEN
        RAISE EXCEPTION 'La cantidad ingresada (%) supera el faltante disponible (%).', p_cantidad_producida, v_faltante_max;
    END IF;

    UPDATE produccion.produccion
    SET fecha_fin          = CURRENT_TIMESTAMP,
        cantidad_producida = round(p_cantidad_producida, 3),
        estado_produccion  = 'I',
        id_motivo_estado   = p_id_motivo_estado,
        usu_mod            = v_usuario_login,
        fec_mod            = CURRENT_TIMESTAMP
    WHERE id_produccion = p_id_produccion;

    RETURN true;
END;
$$;

-- 11. Anular producción:
-- Setea fecha_fin = CURRENT_TIMESTAMP, cantidad_producida = NULL (o 0),
-- estado_produccion = 'A', obligatorio id_motivo_estado de sistema.motivo_estado
CREATE OR REPLACE FUNCTION usuarios.anular_produccion(
    p_token               UUID,
    p_id_produccion       INTEGER,
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
        RAISE EXCEPTION 'Debe seleccionar obligatoriamente un motivo de anulación válido.';
    END IF;

    SELECT trim(estado_produccion)
    INTO v_estado_actual
    FROM produccion.produccion
    WHERE id_produccion = p_id_produccion;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró la producción indicada.';
    END IF;

    IF v_estado_actual = 'A' THEN
        RAISE EXCEPTION 'La producción ya se encuentra anulada.';
    END IF;

    UPDATE produccion.produccion
    SET fecha_fin          = CURRENT_TIMESTAMP,
        cantidad_producida = NULL,
        estado_produccion  = 'A',
        id_motivo_estado   = p_id_motivo_estado,
        usu_mod            = v_usuario_login,
        fec_mod            = CURRENT_TIMESTAMP
    WHERE id_produccion = p_id_produccion;

    RETURN true;
END;
$$;

-- Permisos de ejecución
GRANT EXECUTE ON FUNCTION usuarios.listar_mis_ordenes_produccion(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.devolver_orden_produccion(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.obtener_detalle_mis_ordenes(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_producciones_detalle(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.iniciar_produccion(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.finalizar_produccion(UUID, INTEGER, NUMERIC) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.finalizar_incompleta_produccion(UUID, INTEGER, NUMERIC, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.anular_produccion(UUID, INTEGER, INTEGER) TO anon, authenticated;

GRANT USAGE ON SCHEMA produccion TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA produccion TO anon, authenticated;
GRANT USAGE ON SCHEMA sistema TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA sistema TO anon, authenticated;
