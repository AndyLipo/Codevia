-- =====================================================================
-- MIGRACIÓN 61: MÓDULO DE PREPARACIÓN DE PEDIDOS Y CONTROL DE PICKING / VERIFICACIÓN
-- =====================================================================
-- Objetivos:
--  1. Asegurar tablas y columnas en deposito.verificacion_detalle_pedido,
--     deposito.preparacion_pedido y deposito.detalle_preparacion_pedido.
--  2. Habilitar el módulo 'preparacion-pedidos' en usuarios.roles.modulos
--     para roles pertinentes (1 = sysadmin, 14 = encargado de depósito y roles con 'warehouse').
--  3. RPCs seguros con p_token UUID:
--     - usuarios.listar_pedidos_preparacion
--     - usuarios.obtener_detalle_preparacion_pedido
--     - usuarios.iniciar_preparacion_pedido
--     - usuarios.cambiar_picking_lote
--     - usuarios.solicitar_verificacion_picking
--     - usuarios.cambiar_verificacion_linea (exclusivo roles 1 y 14)
--     - usuarios.finalizar_verificacion_pedido (exclusivo roles 1 y 14)
-- =====================================================================

-- 1. Estructura de tablas y columnas necesarias
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deposito.verificacion_detalle_pedido (
    id_detalle_pedido    INTEGER PRIMARY KEY REFERENCES administracion.detalle_pedido(id_detalle_pedido),
    verificado           BOOLEAN NOT NULL DEFAULT FALSE,
    usu_verificacion     VARCHAR(50),
    fec_verificacion     TIMESTAMP WITHOUT TIME ZONE,
    usu_mod              VARCHAR(50),
    fec_mod              TIMESTAMP WITHOUT TIME ZONE,
    estado               CHAR(1) NOT NULL DEFAULT 'A',
    disponible_verificar BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE deposito.verificacion_detalle_pedido
    ADD COLUMN IF NOT EXISTS disponible_verificar BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE deposito.preparacion_pedido
    ADD COLUMN IF NOT EXISTS finalizada_con_excepcion BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS observacion_excepcion TEXT,
    ADD COLUMN IF NOT EXISTS usu_finalizacion VARCHAR(50),
    ADD COLUMN IF NOT EXISTS fec_finalizacion TIMESTAMP WITHOUT TIME ZONE;

ALTER TABLE deposito.detalle_preparacion_pedido
    ADD COLUMN IF NOT EXISTS cantidad_recogida NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS estado_picking CHAR(1) NOT NULL DEFAULT 'P',
    ADD COLUMN IF NOT EXISTS usu_picking VARCHAR(50),
    ADD COLUMN IF NOT EXISTS fec_picking TIMESTAMP WITHOUT TIME ZONE;

-- Corregir id_detalle_pedido en caso de registros huérfanos históricos
UPDATE deposito.detalle_preparacion_pedido dpp
SET id_detalle_pedido = dp.id_detalle_pedido
FROM deposito.preparacion_pedido prep,
     administracion.detalle_pedido dp,
     produccion.lote_producto lp
WHERE prep.id_preparacion = dpp.id_preparacion
  AND dp.id_pedido = prep.id_pedido
  AND lp.id_lote_producto = dpp.id_lote_producto
  AND dp.id_producto = lp.id_producto
  AND dpp.id_detalle_pedido IS NULL;

-- 2. Habilitar módulo en usuarios.roles.modulos
-- ---------------------------------------------------------------------
UPDATE usuarios.roles
SET modulos = array_append(coalesce(modulos, ARRAY['overview']::TEXT[]), 'preparacion-pedidos')
WHERE id_rol IN (1, 14)
  AND NOT ('preparacion-pedidos' = ANY(coalesce(modulos, ARRAY[]::TEXT[])));

UPDATE usuarios.roles
SET modulos = array_append(coalesce(modulos, ARRAY['overview']::TEXT[]), 'preparacion-pedidos')
WHERE 'warehouse' = ANY(coalesce(modulos, ARRAY[]::TEXT[]))
  AND NOT ('preparacion-pedidos' = ANY(coalesce(modulos, ARRAY[]::TEXT[])));

-- 3. Helper de validación de actor para Preparación
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.fn_actor_preparacion(p_token UUID)
RETURNS TABLE(
    id_usuario    integer,
    usuario_login varchar,
    id_rol        integer,
    rol_nombre    varchar
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'usuarios', 'public'
AS $$
    SELECT
        u.id_usuario,
        u.usuario_login,
        u.id_rol,
        r.nombre AS rol_nombre
    FROM usuarios.usuarios u
    JOIN usuarios.roles r ON r.id_rol = u.id_rol
    WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
      AND u.estado = 'A';
$$;

-- 4. LISTAR PEDIDOS PARA PREPARACIÓN
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.listar_pedidos_preparacion(p_token UUID)
RETURNS TABLE(
    id_pedido                 INTEGER,
    fecha_pedido              TIMESTAMP WITHOUT TIME ZONE,
    id_cliente                INTEGER,
    cliente_nombre            TEXT,
    cliente_cuit              TEXT,
    modalidad_entrega         TEXT,
    domicilio_entrega         TEXT,
    localidad_entrega         TEXT,
    provincia_entrega         TEXT,
    observaciones             TEXT,
    estado_pedido             TEXT,
    id_preparacion            INTEGER,
    estado_preparacion        TEXT,
    finalizada_con_excepcion  BOOLEAN,
    observacion_excepcion     TEXT,
    usu_finalizacion          TEXT,
    fec_finalizacion          TIMESTAMP WITHOUT TIME ZONE,
    total_solicitado          NUMERIC,
    total_reservado           NUMERIC,
    total_recogido            NUMERIC,
    cant_lotes                INTEGER,
    cant_lotes_recogidos      INTEGER,
    cant_lineas               INTEGER,
    cant_lineas_verificadas   INTEGER,
    disponible_verificar      BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'deposito', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_actor RECORD;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_preparacion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    RETURN QUERY
    SELECT
        p.id_pedido,
        p.fecha_pedido,
        p.id_cliente,
        c.nombre_razon_social::TEXT AS cliente_nombre,
        c.cuit::TEXT AS cliente_cuit,
        trim(coalesce(p.modalidad_entrega, ''))::TEXT AS modalidad_entrega,
        coalesce(p.domicilio_entrega, '')::TEXT AS domicilio_entrega,
        coalesce(p.localidad_entrega, '')::TEXT AS localidad_entrega,
        coalesce(p.provincia_entrega, '')::TEXT AS provincia_entrega,
        coalesce(p.observaciones, '')::TEXT AS observaciones,
        trim(p.estado)::TEXT AS estado_pedido,
        prep.id_preparacion,
        trim(coalesce(prep.estado, ''))::TEXT AS estado_preparacion,
        coalesce(prep.finalizada_con_excepcion, false) AS finalizada_con_excepcion,
        prep.observacion_excepcion::TEXT,
        prep.usu_finalizacion::TEXT,
        prep.fec_finalizacion,
        coalesce(solic.total_solicitado, 0) AS total_solicitado,
        coalesce(prep_agg.total_reservado, 0) AS total_reservado,
        coalesce(prep_agg.total_recogido, 0) AS total_recogido,
        coalesce(prep_agg.cant_lotes, 0)::INTEGER AS cant_lotes,
        coalesce(prep_agg.cant_lotes_recogidos, 0)::INTEGER AS cant_lotes_recogidos,
        coalesce(solic.cant_lineas, 0)::INTEGER AS cant_lineas,
        coalesce(verif_agg.cant_lineas_verificadas, 0)::INTEGER AS cant_lineas_verificadas,
        coalesce(verif_agg.disponible_verificar, false) AS disponible_verificar
    FROM administracion.pedido p
    JOIN administracion.cliente c ON c.id_cliente = p.id_cliente
    LEFT JOIN deposito.preparacion_pedido prep ON prep.id_pedido = p.id_pedido
    LEFT JOIN LATERAL (
        SELECT
            SUM(dp.cantidad) AS total_solicitado,
            COUNT(dp.id_detalle_pedido) AS cant_lineas
        FROM administracion.detalle_pedido dp
        WHERE dp.id_pedido = p.id_pedido
    ) solic ON true
    LEFT JOIN LATERAL (
        SELECT
            SUM(dpp.cantidad) AS total_reservado,
            SUM(dpp.cantidad_recogida) AS total_recogido,
            COUNT(dpp.id_detalle_preparacion) AS cant_lotes,
            COUNT(CASE WHEN dpp.estado_picking = 'L' THEN 1 END) AS cant_lotes_recogidos
        FROM deposito.detalle_preparacion_pedido dpp
        WHERE dpp.id_preparacion = prep.id_preparacion
          AND dpp.estado <> 'C'
    ) prep_agg ON true
    LEFT JOIN LATERAL (
        SELECT
            COUNT(CASE WHEN vdp.verificado = true THEN 1 END) AS cant_lineas_verificadas,
            coalesce(bool_or(vdp.disponible_verificar), false) AS disponible_verificar
        FROM administracion.detalle_pedido dp
        LEFT JOIN deposito.verificacion_detalle_pedido vdp ON vdp.id_detalle_pedido = dp.id_detalle_pedido
        WHERE dp.id_pedido = p.id_pedido
    ) verif_agg ON true
    WHERE p.estado IN ('C', 'E', 'L')
    ORDER BY
        CASE p.estado
            WHEN 'E' THEN 1
            WHEN 'C' THEN 2
            WHEN 'L' THEN 3
            ELSE 4
        END,
        p.fecha_pedido ASC,
        p.id_pedido ASC;
END;
$$;

-- 5. OBTENER DETALLE DE PREPARACIÓN DE UN PEDIDO
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.obtener_detalle_preparacion_pedido(
    p_token     UUID,
    p_id_pedido INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'deposito', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_actor   RECORD;
    v_pedido  JSONB;
    v_lotes   JSONB;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_preparacion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    SELECT jsonb_build_object(
        'id_pedido', p.id_pedido,
        'fecha_pedido', p.fecha_pedido,
        'id_cliente', p.id_cliente,
        'cliente_nombre', c.nombre_razon_social,
        'cliente_cuit', c.cuit,
        'modalidad_entrega', trim(coalesce(p.modalidad_entrega, '')),
        'domicilio_entrega', p.domicilio_entrega,
        'localidad_entrega', p.localidad_entrega,
        'provincia_entrega', p.provincia_entrega,
        'observaciones', p.observaciones,
        'estado_pedido', trim(p.estado),
        'id_preparacion', prep.id_preparacion,
        'estado_preparacion', trim(coalesce(prep.estado, '')),
        'finalizada_con_excepcion', coalesce(prep.finalizada_con_excepcion, false),
        'observacion_excepcion', prep.observacion_excepcion,
        'usu_finalizacion', prep.usu_finalizacion,
        'fec_finalizacion', prep.fec_finalizacion,
        'disponible_verificar', coalesce(verif_status.disponible, false),
        'todos_recogidos', coalesce(prep_status.todos_recogidos, false),
        'todos_verificados', coalesce(verif_status.todos_verificados, false)
    )
    INTO v_pedido
    FROM administracion.pedido p
    JOIN administracion.cliente c ON c.id_cliente = p.id_cliente
    LEFT JOIN deposito.preparacion_pedido prep ON prep.id_pedido = p.id_pedido
    LEFT JOIN LATERAL (
        SELECT
            coalesce(bool_and(dpp.estado_picking = 'L'), false) AS todos_recogidos
        FROM deposito.detalle_preparacion_pedido dpp
        WHERE dpp.id_preparacion = prep.id_preparacion
          AND dpp.estado <> 'C'
    ) prep_status ON true
    LEFT JOIN LATERAL (
        SELECT
            coalesce(bool_or(vdp.disponible_verificar), false) AS disponible,
            coalesce(bool_and(vdp.verificado = true), false) AND count(dp.id_detalle_pedido) > 0 AS todos_verificados
        FROM administracion.detalle_pedido dp
        LEFT JOIN deposito.verificacion_detalle_pedido vdp ON vdp.id_detalle_pedido = dp.id_detalle_pedido
        WHERE dp.id_pedido = p.id_pedido
    ) verif_status ON true
    WHERE p.id_pedido = p_id_pedido;

    IF v_pedido IS NULL THEN
        RAISE EXCEPTION 'No se encontró el pedido #%', p_id_pedido;
    END IF;

    SELECT coalesce(jsonb_agg(
        jsonb_build_object(
            'id_detalle_preparacion', dpp.id_detalle_preparacion,
            'id_preparacion', dpp.id_preparacion,
            'id_detalle_pedido', coalesce(dpp.id_detalle_pedido, dp.id_detalle_pedido),
            'id_producto', pr.id_producto,
            'producto_codigo', pr.codigo,
            'producto_nombre', pr.nombre,
            'unidad_medida', coalesce(um.codigo, 'un.'),
            'id_lote_producto', dpp.id_lote_producto,
            'nro_lote', lp.nro_lote,
            'posicion_codigo', coalesce(pos.codigo, '—'),
            'fecha_fabricacion', lp.fecha_fabricacion,
            'fecha_vencimiento', lp.fecha_vencimiento,
            'cantidad_solicitada', dpp.cantidad,
            'cantidad_recogida', dpp.cantidad_recogida,
            'estado_picking', trim(coalesce(dpp.estado_picking, 'P')),
            'usu_picking', dpp.usu_picking,
            'fec_picking', dpp.fec_picking,
            'verificado', coalesce(vdp.verificado, false),
            'usu_verificacion', vdp.usu_verificacion,
            'fec_verificacion', vdp.fec_verificacion,
            'disponible_verificar', coalesce(vdp.disponible_verificar, false)
        ) ORDER BY pr.nombre ASC, lp.fecha_fabricacion ASC, dpp.id_detalle_preparacion ASC
    ), '[]'::jsonb)
    INTO v_lotes
    FROM deposito.preparacion_pedido prep
    JOIN deposito.detalle_preparacion_pedido dpp ON dpp.id_preparacion = prep.id_preparacion
    JOIN produccion.lote_producto lp ON lp.id_lote_producto = dpp.id_lote_producto
    JOIN produccion.producto pr ON pr.id_producto = lp.id_producto
    LEFT JOIN produccion.unidad_medida um ON um.id_unidad_medida = pr.id_unidad_medida
    LEFT JOIN administracion.detalle_pedido dp
        ON dp.id_pedido = prep.id_pedido
       AND (dp.id_detalle_pedido = dpp.id_detalle_pedido OR (dpp.id_detalle_pedido IS NULL AND dp.id_producto = pr.id_producto))
    LEFT JOIN deposito.verificacion_detalle_pedido vdp
        ON vdp.id_detalle_pedido = coalesce(dpp.id_detalle_pedido, dp.id_detalle_pedido)
    LEFT JOIN deposito.lote_posicion lpos
        ON lpos.id_lote_producto = dpp.id_lote_producto AND lpos.estado = 'A'
    LEFT JOIN deposito.posicion pos
        ON pos.id_posicion = lpos.id_posicion
    WHERE prep.id_pedido = p_id_pedido
      AND dpp.estado <> 'C';

    RETURN jsonb_build_object(
        'pedido', v_pedido,
        'lotes', v_lotes
    );
END;
$$;

-- 6. INICIAR PREPARACIÓN DE PEDIDO (Pasa pedido a 'E')
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.iniciar_preparacion_pedido(
    p_token     UUID,
    p_id_pedido INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'deposito', 'usuarios', 'public'
AS $$
DECLARE
    v_actor RECORD;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_preparacion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    -- Actualiza el estado del pedido a 'E'
    UPDATE administracion.pedido
    SET estado  = 'E',
        usu_mod = v_actor.usuario_login,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_pedido = p_id_pedido;

    -- Actualiza preparacion_pedido
    UPDATE deposito.preparacion_pedido
    SET estado  = CASE WHEN estado = 'P' THEN 'E' ELSE estado END,
        usu_mod = v_actor.usuario_login,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_pedido = p_id_pedido;

    RETURN TRUE;
END;
$$;

-- 7. CAMBIAR PICKING DE UN LOTE (Checkbox recogido)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.cambiar_picking_lote(
    p_token                  UUID,
    p_id_detalle_preparacion INTEGER,
    p_recogido               BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'deposito', 'usuarios', 'public'
AS $$
DECLARE
    v_actor          RECORD;
    v_dpp            RECORD;
    v_id_pedido      INTEGER;
    v_nuevo_estado   CHAR(1);
    v_cant_recogida  NUMERIC;
    v_usu_picking    VARCHAR(50);
    v_fec_picking    TIMESTAMP WITHOUT TIME ZONE;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_preparacion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    SELECT dpp.*, prep.id_pedido
    INTO v_dpp
    FROM deposito.detalle_preparacion_pedido dpp
    JOIN deposito.preparacion_pedido prep ON prep.id_preparacion = dpp.id_preparacion
    WHERE dpp.id_detalle_preparacion = p_id_detalle_preparacion;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el detalle de preparación #%', p_id_detalle_preparacion;
    END IF;

    v_id_pedido := v_dpp.id_pedido;

    -- Bloquear modificaciones de picking si la verificación está habilitada
    IF EXISTS (
        SELECT 1
        FROM administracion.detalle_pedido dp
        JOIN deposito.verificacion_detalle_pedido vdp ON vdp.id_detalle_pedido = dp.id_detalle_pedido
        WHERE dp.id_pedido = v_id_pedido
          AND vdp.disponible_verificar = true
    ) THEN
        RAISE EXCEPTION 'La verificación está habilitada para este pedido. Seleccione "Volver a Preparación" para modificar el picking.';
    END IF;

    IF p_recogido THEN
        v_nuevo_estado  := 'L';
        v_cant_recogida := v_dpp.cantidad;
        v_usu_picking   := v_actor.usuario_login;
        v_fec_picking   := CURRENT_TIMESTAMP;
    ELSE
        v_nuevo_estado  := 'P';
        v_cant_recogida := 0;
        v_usu_picking   := NULL;
        v_fec_picking   := NULL;
    END IF;

    UPDATE deposito.detalle_preparacion_pedido
    SET estado_picking    = v_nuevo_estado,
        cantidad_recogida = v_cant_recogida,
        usu_picking       = v_usu_picking,
        fec_picking       = v_fec_picking,
        usu_mod           = v_actor.usuario_login,
        fec_mod           = CURRENT_TIMESTAMP
    WHERE id_detalle_preparacion = p_id_detalle_preparacion;

    -- Si el pedido aún figuraba en 'C', pasa a 'E'
    UPDATE administracion.pedido
    SET estado  = 'E',
        usu_mod = v_actor.usuario_login,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_pedido = v_id_pedido
      AND estado = 'C';

    RETURN jsonb_build_object(
        'success', true,
        'id_detalle_preparacion', p_id_detalle_preparacion,
        'estado_picking', v_nuevo_estado,
        'cantidad_recogida', v_cant_recogida,
        'usu_picking', v_usu_picking,
        'fec_picking', v_fec_picking
    );
END;
$$;

-- 8. SOLICITAR LA VERIFICACIÓN DEL PICKING
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.solicitar_verificacion_picking(
    p_token     UUID,
    p_id_pedido INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'deposito', 'usuarios', 'public'
AS $$
DECLARE
    v_actor      RECORD;
    v_pendientes INTEGER;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_preparacion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    -- Validar que no queden lotes sin recoger
    SELECT COUNT(*)
    INTO v_pendientes
    FROM deposito.preparacion_pedido prep
    JOIN deposito.detalle_preparacion_pedido dpp ON dpp.id_preparacion = prep.id_preparacion
    WHERE prep.id_pedido = p_id_pedido
      AND dpp.estado <> 'C'
      AND dpp.estado_picking <> 'L';

    IF v_pendientes > 0 THEN
        RAISE EXCEPTION 'Aún quedan % lote(s) sin recoger. Debe marcar todos como recogidos antes de solicitar verificación.', v_pendientes;
    END IF;

    -- Insertar o actualizar verificacion_detalle_pedido con disponible_verificar = true
    INSERT INTO deposito.verificacion_detalle_pedido (
        id_detalle_pedido,
        verificado,
        usu_verificacion,
        fec_verificacion,
        usu_mod,
        fec_mod,
        estado,
        disponible_verificar
    )
    SELECT
        dp.id_detalle_pedido,
        false,
        NULL,
        NULL,
        v_actor.usuario_login,
        CURRENT_TIMESTAMP,
        'A',
        true
    FROM administracion.detalle_pedido dp
    WHERE dp.id_pedido = p_id_pedido
    ON CONFLICT (id_detalle_pedido)
    DO UPDATE SET
        disponible_verificar = true,
        estado = 'A',
        usu_mod = v_actor.usuario_login,
        fec_mod = CURRENT_TIMESTAMP;

    RETURN TRUE;
END;
$$;

-- 8b. VOLVER A PREPARACIÓN (Desbloquea Marcar como Recogido y vuelve Marcar como Verificado a estado previo)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.volver_a_preparacion_pedido(
    p_token     UUID,
    p_id_pedido INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'deposito', 'usuarios', 'public'
AS $$
DECLARE
    v_actor RECORD;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_preparacion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    UPDATE deposito.verificacion_detalle_pedido vdp
    SET disponible_verificar = false,
        verificado           = false,
        usu_verificacion     = NULL,
        fec_verificacion     = NULL,
        usu_mod              = v_actor.usuario_login,
        fec_mod              = CURRENT_TIMESTAMP
    FROM administracion.detalle_pedido dp
    WHERE dp.id_detalle_pedido = vdp.id_detalle_pedido
      AND dp.id_pedido = p_id_pedido;

    RETURN TRUE;
END;
$$;

-- 9. CAMBIAR VERIFICACIÓN DE LÍNEA (Checkbox Verificado - Roles 1 y 14)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.cambiar_verificacion_linea(
    p_token             UUID,
    p_id_detalle_pedido INTEGER,
    p_verificado        BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'deposito', 'usuarios', 'public'
AS $$
DECLARE
    v_actor          RECORD;
    v_usu_verif      VARCHAR(50);
    v_fec_verif      TIMESTAMP WITHOUT TIME ZONE;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_preparacion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    -- Regla estricta: Solo id_rol 1 (sysadmin) y 14 (encargado de depósito)
    IF v_actor.id_rol NOT IN (1, 14) THEN
        RAISE EXCEPTION 'Permiso denegado: solo el Administrador de Sistemas o el Encargado de Depósito pueden verificar productos.';
    END IF;

    IF p_verificado THEN
        v_usu_verif := v_actor.usuario_login;
        v_fec_verif := CURRENT_TIMESTAMP;
    ELSE
        v_usu_verif := NULL;
        v_fec_verif := NULL;
    END IF;

    INSERT INTO deposito.verificacion_detalle_pedido (
        id_detalle_pedido,
        verificado,
        usu_verificacion,
        fec_verificacion,
        usu_mod,
        fec_mod,
        estado,
        disponible_verificar
    )
    VALUES (
        p_id_detalle_pedido,
        p_verificado,
        v_usu_verif,
        v_fec_verif,
        v_actor.usuario_login,
        CURRENT_TIMESTAMP,
        'A',
        true
    )
    ON CONFLICT (id_detalle_pedido)
    DO UPDATE SET
        verificado       = p_verificado,
        usu_verificacion = v_usu_verif,
        fec_verificacion = v_fec_verif,
        usu_mod          = v_actor.usuario_login,
        fec_mod          = CURRENT_TIMESTAMP;

    RETURN jsonb_build_object(
        'success', true,
        'id_detalle_pedido', p_id_detalle_pedido,
        'verificado', p_verificado,
        'usu_verificacion', v_usu_verif,
        'fec_verificacion', v_fec_verif
    );
END;
$$;

-- 10. FINALIZAR VERIFICACIÓN (Roles 1 y 14)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.finalizar_verificacion_pedido(
    p_token                 UUID,
    p_id_pedido             INTEGER,
    p_observacion_excepcion TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'deposito', 'usuarios', 'public'
AS $$
DECLARE
    v_actor               RECORD;
    v_total_lineas        INTEGER;
    v_lineas_verificadas  INTEGER;
    v_con_excepcion       BOOLEAN;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_preparacion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    -- Regla estricta: Solo id_rol 1 (sysadmin) y 14 (encargado de depósito)
    IF v_actor.id_rol NOT IN (1, 14) THEN
        RAISE EXCEPTION 'Permiso denegado: solo el Administrador de Sistemas o el Encargado de Depósito pueden finalizar la verificación.';
    END IF;

    -- Contar líneas totales del pedido vs líneas verificadas
    SELECT
        COUNT(dp.id_detalle_pedido),
        COUNT(CASE WHEN vdp.verificado = true THEN 1 END)
    INTO v_total_lineas, v_lineas_verificadas
    FROM administracion.detalle_pedido dp
    LEFT JOIN deposito.verificacion_detalle_pedido vdp ON vdp.id_detalle_pedido = dp.id_detalle_pedido
    WHERE dp.id_pedido = p_id_pedido;

    IF v_total_lineas = 0 THEN
        RAISE EXCEPTION 'El pedido #% no tiene líneas de detalle registradas.', p_id_pedido;
    END IF;

    IF v_lineas_verificadas < v_total_lineas THEN
        v_con_excepcion := true;
        IF p_observacion_excepcion IS NULL OR trim(p_observacion_excepcion) = '' THEN
            RAISE EXCEPTION 'Quedan productos sin controlar. Debe ingresar obligatoriamente una observación de excepción.';
        END IF;
    ELSE
        v_con_excepcion := false;
    END IF;

    -- 1. Actualizar deposito.preparacion_pedido:
    -- estado = 'V', finalizada_con_excepcion, observacion_excepcion, usu_finalizacion, fec_finalizacion
    UPDATE deposito.preparacion_pedido
    SET estado                   = 'V',
        finalizada_con_excepcion = v_con_excepcion,
        observacion_excepcion    = CASE WHEN v_con_excepcion THEN trim(p_observacion_excepcion) ELSE NULL END,
        usu_finalizacion         = v_actor.usuario_login,
        fec_finalizacion         = CURRENT_TIMESTAMP,
        usu_mod                  = v_actor.usuario_login,
        fec_mod                  = CURRENT_TIMESTAMP
    WHERE id_pedido = p_id_pedido;

    -- 2. Al pasar a Estado = 'V' en deposito.preparacion_pedido el campo estado de administracion.pedido pasara a 'L'
    UPDATE administracion.pedido
    SET estado  = 'L',
        usu_mod = v_actor.usuario_login,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_pedido = p_id_pedido;

    RETURN TRUE;
END;
$$;

-- 11. CANCELAR PREPARACIÓN DE PEDIDO (Vuelve el pedido de 'E' a 'C')
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.cancelar_preparacion_pedido(
    p_token     UUID,
    p_id_pedido INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'deposito', 'usuarios', 'public'
AS $$
DECLARE
    v_actor          RECORD;
    v_id_preparacion INTEGER;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_preparacion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    SELECT id_preparacion
    INTO v_id_preparacion
    FROM deposito.preparacion_pedido
    WHERE id_pedido = p_id_pedido;

    -- Revertir avances de verificación si los hubiera
    UPDATE deposito.verificacion_detalle_pedido vdp
    SET disponible_verificar = false,
        verificado           = false,
        usu_verificacion     = NULL,
        fec_verificacion     = NULL,
        usu_mod              = v_actor.usuario_login,
        fec_mod              = CURRENT_TIMESTAMP
    FROM administracion.detalle_pedido dp
    WHERE dp.id_detalle_pedido = vdp.id_detalle_pedido
      AND dp.id_pedido = p_id_pedido;

    -- Revertir avances de picking en detalle_preparacion_pedido
    IF v_id_preparacion IS NOT NULL THEN
        UPDATE deposito.detalle_preparacion_pedido
        SET estado_picking    = 'P',
            cantidad_recogida = 0,
            usu_picking       = NULL,
            fec_picking       = NULL,
            usu_mod           = v_actor.usuario_login,
            fec_mod           = CURRENT_TIMESTAMP
        WHERE id_preparacion = v_id_preparacion
          AND estado <> 'C';

        UPDATE deposito.preparacion_pedido
        SET estado                   = 'P',
            finalizada_con_excepcion = false,
            observacion_excepcion    = NULL,
            usu_finalizacion         = NULL,
            fec_finalizacion         = NULL,
            usu_mod                  = v_actor.usuario_login,
            fec_mod                  = CURRENT_TIMESTAMP
        WHERE id_preparacion = v_id_preparacion;
    END IF;

    -- Volver administracion.pedido a estado 'C'
    UPDATE administracion.pedido
    SET estado  = 'C',
        usu_mod = v_actor.usuario_login,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_pedido = p_id_pedido;

    RETURN TRUE;
END;
$$;

-- 12. ANULAR PEDIDO (Permite anular en P, M, C, E, L excepto D; libera reservas y revierte avances)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.anular_pedido_autorizado(
    p_token            UUID,
    p_id_pedido        INTEGER,
    p_motivo_anulacion TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'deposito', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_actor          RECORD;
    v_pedido         RECORD;
    v_id_preparacion INTEGER;
    v_dpp            RECORD;
    v_id_stock       INTEGER;
    v_id_pos         INTEGER;
    v_motivo         TEXT;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_preparacion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    v_motivo := trim(coalesce(p_motivo_anulacion, ''));
    IF v_motivo = '' THEN
        RAISE EXCEPTION 'Debe ingresar obligatoriamente el motivo de anulación del pedido.';
    END IF;

    SELECT *
    INTO v_pedido
    FROM administracion.pedido
    WHERE id_pedido = p_id_pedido
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el pedido #%', p_id_pedido;
    END IF;

    IF trim(v_pedido.estado) = 'D' THEN
        RAISE EXCEPTION 'No se puede anular el pedido #% porque ya fue Despachado (D).', p_id_pedido;
    END IF;

    IF trim(v_pedido.estado) = 'A' THEN
        RAISE EXCEPTION 'El pedido #% ya se encuentra anulado.', p_id_pedido;
    END IF;

    -- 1. Revertir avances de verificación
    UPDATE deposito.verificacion_detalle_pedido vdp
    SET disponible_verificar = false,
        verificado           = false,
        usu_verificacion     = NULL,
        fec_verificacion     = NULL,
        estado               = 'C',
        usu_mod              = v_actor.usuario_login,
        fec_mod              = CURRENT_TIMESTAMP
    FROM administracion.detalle_pedido dp
    WHERE dp.id_detalle_pedido = vdp.id_detalle_pedido
      AND dp.id_pedido = p_id_pedido;

    -- 2. Liberar reservas de stock y revertir preparación/picking si existía preparación
    SELECT pp.id_preparacion
    INTO v_id_preparacion
    FROM deposito.preparacion_pedido pp
    WHERE pp.id_pedido = p_id_pedido
    FOR UPDATE;

    IF v_id_preparacion IS NOT NULL THEN
        FOR v_dpp IN
            SELECT *
            FROM deposito.detalle_preparacion_pedido dpp
            WHERE dpp.id_preparacion = v_id_preparacion
              AND dpp.estado = 'A'
            FOR UPDATE
        LOOP
            SELECT s.id_stock INTO v_id_stock
            FROM deposito.stock s
            WHERE s.id_lote_producto = v_dpp.id_lote_producto
              AND s.estado = 'A'
            FOR UPDATE;

            SELECT lp.id_posicion INTO v_id_pos
            FROM deposito.lote_posicion lp
            WHERE lp.id_lote_producto = v_dpp.id_lote_producto
              AND lp.estado = 'A'
            LIMIT 1;

            IF v_id_stock IS NOT NULL THEN
                UPDATE deposito.stock
                SET cantidad_reservada = GREATEST(0, cantidad_reservada - v_dpp.cantidad),
                    usu_mod            = v_actor.usuario_login,
                    fec_mod            = CURRENT_TIMESTAMP
                WHERE id_stock = v_id_stock;

                INSERT INTO deposito.movimiento_stock_pedido (
                    id_stock,
                    id_lote_producto,
                    id_pedido,
                    id_detalle_preparacion,
                    tipo_movimiento,
                    cantidad,
                    id_posicion_origen,
                    observacion,
                    usu_alta
                ) VALUES (
                    v_id_stock,
                    v_dpp.id_lote_producto,
                    p_id_pedido,
                    v_dpp.id_detalle_preparacion,
                    'LIBERACION',
                    v_dpp.cantidad,
                    v_id_pos,
                    'Liberación de reserva por anulación de pedido: ' || v_motivo,
                    v_actor.usuario_login
                );
            END IF;

            UPDATE deposito.detalle_preparacion_pedido
            SET estado            = 'C',
                estado_picking    = 'P',
                cantidad_recogida = 0,
                usu_picking       = NULL,
                fec_picking       = NULL,
                usu_mod           = v_actor.usuario_login,
                fec_mod           = CURRENT_TIMESTAMP
            WHERE id_detalle_preparacion = v_dpp.id_detalle_preparacion;
        END LOOP;

        UPDATE deposito.preparacion_pedido
        SET estado                   = 'C',
            finalizada_con_excepcion = false,
            observacion_excepcion    = NULL,
            usu_finalizacion         = NULL,
            fec_finalizacion         = NULL,
            usu_mod                  = v_actor.usuario_login,
            fec_mod                  = CURRENT_TIMESTAMP
        WHERE id_preparacion = v_id_preparacion;
    END IF;

    -- 3. Actualizar administracion.pedido a estado 'A' con motivo_anulacion
    UPDATE administracion.pedido
    SET estado           = 'A',
        motivo_anulacion = v_motivo,
        usu_anulacion    = v_actor.usuario_login,
        fec_anulacion    = CURRENT_TIMESTAMP,
        usu_mod          = v_actor.usuario_login,
        fec_mod          = CURRENT_TIMESTAMP
    WHERE id_pedido = p_id_pedido;

    RETURN TRUE;
END;
$$;

-- 13. Concesión de permisos de ejecución
-- ---------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION usuarios.fn_actor_preparacion(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_pedidos_preparacion(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.obtener_detalle_preparacion_pedido(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.iniciar_preparacion_pedido(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.cambiar_picking_lote(UUID, INTEGER, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.solicitar_verificacion_picking(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.volver_a_preparacion_pedido(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.cambiar_verificacion_linea(UUID, INTEGER, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.finalizar_verificacion_pedido(UUID, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.cancelar_preparacion_pedido(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.anular_pedido_autorizado(UUID, INTEGER, TEXT) TO anon, authenticated;
