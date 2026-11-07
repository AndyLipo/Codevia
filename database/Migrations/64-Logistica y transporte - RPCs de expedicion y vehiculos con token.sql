-- =====================================================================
-- MIGRACIÓN 64: EXPEDICIÓN, HOJAS DE RUTA Y PARÁMETROS DE VEHÍCULOS CON TOKEN
-- =====================================================================
-- Basado en:
--   - 62-Logistica y transporte creacion de tablas .sql
--   - 63-Alter Hoja de ruta .sql
--
-- Incluye:
--   1. Asegurar columna estado_hoja_ruta ('P', 'D') en logistica.hoja_ruta
--   2. Permisos sobre esquemas logistica y transporte
--   3. RPCs para Parámetros -> Vehículos (transporte.vehiculo):
--      - usuarios.listar_vehiculos_transporte
--      - usuarios.crear_vehiculo_transporte
--      - usuarios.actualizar_vehiculo_transporte
--      - usuarios.eliminar_vehiculo_transporte
--   4. RPCs para Expedición -> Hojas de Ruta:
--      - usuarios.listar_choferes_expedicion (empleados RRHH con id_rol = 17)
--      - usuarios.listar_pedidos_listos_expedicion (pedidos en estado 'L')
--      - usuarios.listar_hojas_ruta_expedicion
--      - usuarios.guardar_hoja_ruta_expedicion (creación y edición en estado_hoja_ruta = 'P')
--      - usuarios.despachar_hoja_ruta_expedicion (pasa hoja a 'D' y pedidos a 'D')
-- =====================================================================

BEGIN;

-- 1. Asegurar columna estado_hoja_ruta en logistica.hoja_ruta (Migración 63)
-- ---------------------------------------------------------------------
ALTER TABLE logistica.hoja_ruta
    ADD COLUMN IF NOT EXISTS estado_hoja_ruta CHAR(1) NOT NULL DEFAULT 'P';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_hoja_ruta_estado_operativo'
    ) THEN
        ALTER TABLE logistica.hoja_ruta
            ADD CONSTRAINT ck_hoja_ruta_estado_operativo
            CHECK (estado_hoja_ruta IN ('P', 'D'));
    END IF;
END $$;

-- Permitir que un mismo vehículo o chofer sea asignado a distintas hojas de ruta en fechas diferentes
DROP INDEX IF EXISTS logistica.uq_asignacion_vehiculo_activo;
DROP INDEX IF EXISTS logistica.uq_asignacion_conductor_activo;

-- Asegurar que la función trigger de validación tenga acceso al esquema administracion
CREATE OR REPLACE FUNCTION logistica.fn_validar_pedido_hoja_ruta()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = logistica, administracion, pg_temp
AS $$
DECLARE
    v_estado_pedido CHAR(1);
    v_estado_hoja CHAR(1);
BEGIN
    SELECT p.estado
      INTO v_estado_pedido
      FROM administracion.pedido p
     WHERE p.id_pedido = NEW.id_pedido
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El pedido % no existe.', NEW.id_pedido;
    END IF;

    IF v_estado_pedido <> 'L' THEN
        RAISE EXCEPTION
            'El pedido % no puede incorporarse. Su estado actual es %, debe estar en estado L.',
            NEW.id_pedido, v_estado_pedido;
    END IF;

    SELECT h.estado
      INTO v_estado_hoja
      FROM logistica.hoja_ruta h
     WHERE h.id_hoja_ruta = NEW.id_hoja_ruta
     FOR UPDATE;

    IF NOT FOUND OR v_estado_hoja <> 'A' THEN
        RAISE EXCEPTION
            'La hoja de ruta debe existir y estar activa para incorporar pedidos.';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM logistica.detalle_hoja_ruta d
          JOIN logistica.hoja_ruta h
            ON h.id_hoja_ruta = d.id_hoja_ruta
         WHERE d.id_pedido = NEW.id_pedido
           AND d.estado = 'A'
           AND h.estado = 'A'
           AND (
                TG_OP = 'INSERT'
                OR d.id_detalle_hoja_ruta <> NEW.id_detalle_hoja_ruta
           )
    ) THEN
        RAISE EXCEPTION
            'El pedido % ya está incorporado en otra hoja de ruta activa.',
            NEW.id_pedido;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION logistica.fn_validar_asignacion_transporte()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = logistica, transporte, administracion, pg_temp
AS $$
DECLARE
    v_id_rol INTEGER;
    v_estado_empleado CHAR(1);
    v_estado_conductor CHAR(1);
    v_estado_vehiculo CHAR(1);
BEGIN
    SELECT rh.id_rol, rh.estado, c.estado
      INTO v_id_rol, v_estado_empleado, v_estado_conductor
      FROM transporte.conductor c
      JOIN administracion.recursos_humanos rh
        ON rh.legajo = c.legajo
     WHERE c.legajo = NEW.legajo_conductor;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El conductor con legajo % no está registrado.',
            NEW.legajo_conductor;
    END IF;

    IF v_id_rol <> 17 THEN
        RAISE EXCEPTION
            'El empleado % no tiene el rol de Chofer (17).',
            NEW.legajo_conductor;
    END IF;

    IF v_estado_empleado <> 'A' OR v_estado_conductor <> 'A' THEN
        RAISE EXCEPTION
            'El conductor % no está activo.',
            NEW.legajo_conductor;
    END IF;

    SELECT v.estado
      INTO v_estado_vehiculo
      FROM transporte.vehiculo v
     WHERE v.id_vehiculo = NEW.id_vehiculo;

    IF NOT FOUND OR v_estado_vehiculo <> 'A' THEN
        RAISE EXCEPTION
            'El vehículo seleccionado no existe o no está activo.';
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Helper de validación de usuario activo con token
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.fn_actor_expedicion(p_token UUID)
RETURNS TABLE(
    id_usuario    INTEGER,
    usuario_login VARCHAR(20),
    id_rol        INTEGER,
    rol_nombre    VARCHAR
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'usuarios', 'public'
AS $$
    SELECT
        u.id_usuario,
        left(u.usuario_login, 20)::VARCHAR(20) AS usuario_login,
        u.id_rol,
        r.nombre AS rol_nombre
    FROM usuarios.usuarios u
    JOIN usuarios.roles r ON r.id_rol = u.id_rol
    WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
      AND u.estado = 'A';
$$;

-- =====================================================================
-- 3. PARÁMETROS -> VEHÍCULOS (transporte.vehiculo)
-- =====================================================================

-- 3.1. Listar vehículos
CREATE OR REPLACE FUNCTION usuarios.listar_vehiculos_transporte(p_token UUID)
RETURNS TABLE(
    id_vehiculo      INTEGER,
    patente          TEXT,
    marca            TEXT,
    modelo           TEXT,
    anio             INTEGER,
    capacidad_kg     NUMERIC,
    observaciones    TEXT,
    estado           TEXT,
    usu_alta         TEXT,
    fec_alta         TIMESTAMP WITHOUT TIME ZONE,
    usu_mod          TEXT,
    fec_mod          TIMESTAMP WITHOUT TIME ZONE,
    ocupado_en_ruta  BOOLEAN,
    nro_hoja_activa  TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'transporte', 'logistica', 'usuarios', 'public'
AS $$
DECLARE
    v_actor RECORD;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_expedicion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    RETURN QUERY
    SELECT
        v.id_vehiculo,
        v.patente::TEXT,
        coalesce(v.marca, '')::TEXT,
        coalesce(v.modelo, '')::TEXT,
        v.anio,
        v.capacidad_kg,
        coalesce(v.observaciones, '')::TEXT,
        trim(v.estado)::TEXT,
        v.usu_alta::TEXT,
        v.fec_alta,
        v.usu_mod::TEXT,
        v.fec_mod,
        (at_act.id_asignacion_transporte IS NOT NULL) AS ocupado_en_ruta,
        at_act.nro_hoja_ruta::TEXT AS nro_hoja_activa
    FROM transporte.vehiculo v
    LEFT JOIN LATERAL (
        SELECT
            at.id_asignacion_transporte,
            hr.nro_hoja_ruta
        FROM logistica.asignacion_transporte at
        JOIN logistica.hoja_ruta hr ON hr.id_hoja_ruta = at.id_hoja_ruta
        WHERE at.id_vehiculo = v.id_vehiculo
          AND at.estado = 'A'
          AND hr.estado = 'A'
          AND hr.estado_hoja_ruta = 'P'
        ORDER BY at.id_asignacion_transporte DESC
        LIMIT 1
    ) at_act ON true
    ORDER BY
        CASE trim(v.estado)
            WHEN 'A' THEN 0
            WHEN 'I' THEN 1
            ELSE 2
        END ASC,
        v.patente ASC;
END;
$$;

-- 3.2. Crear vehículo (bajo el formato solicitado INSERT INTO transporte.vehiculo)
CREATE OR REPLACE FUNCTION usuarios.crear_vehiculo_transporte(
    p_token         UUID,
    p_patente       TEXT,
    p_marca         TEXT DEFAULT NULL,
    p_modelo        TEXT DEFAULT NULL,
    p_anio          INTEGER DEFAULT NULL,
    p_capacidad_kg  NUMERIC DEFAULT NULL,
    p_observaciones TEXT DEFAULT NULL,
    p_estado        TEXT DEFAULT 'A'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'transporte', 'usuarios', 'public'
AS $$
DECLARE
    v_actor       RECORD;
    v_patente     VARCHAR(15);
    v_estado      CHAR(1);
    v_id_vehiculo INTEGER;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_expedicion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    v_patente := upper(trim(coalesce(p_patente, '')));
    IF v_patente = '' THEN
        RAISE EXCEPTION 'La patente del vehículo es obligatoria.';
    END IF;

    v_estado := upper(trim(coalesce(p_estado, 'A')));
    IF v_estado NOT IN ('A', 'I', 'E') THEN
        RAISE EXCEPTION 'El estado del vehículo debe ser A, I o E.';
    END IF;

    IF p_anio IS NOT NULL AND (p_anio < 1900 OR p_anio > 2100) THEN
        RAISE EXCEPTION 'El año del vehículo debe estar entre 1900 y 2100.';
    END IF;

    IF p_capacidad_kg IS NOT NULL AND p_capacidad_kg <= 0 THEN
        RAISE EXCEPTION 'La capacidad en kg debe ser mayor a 0.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM transporte.vehiculo WHERE upper(trim(patente)) = v_patente
    ) THEN
        RAISE EXCEPTION 'Ya existe un vehículo registrado con la patente %.', v_patente;
    END IF;

    INSERT INTO transporte.vehiculo (
        patente,
        marca,
        modelo,
        anio,
        capacidad_kg,
        observaciones,
        estado,
        usu_alta
    )
    VALUES (
        v_patente,
        nullif(trim(coalesce(p_marca, '')), ''),
        nullif(trim(coalesce(p_modelo, '')), ''),
        p_anio,
        p_capacidad_kg,
        nullif(trim(coalesce(p_observaciones, '')), ''),
        v_estado,
        v_actor.usuario_login
    )
    RETURNING id_vehiculo INTO v_id_vehiculo;

    RETURN v_id_vehiculo;
END;
$$;

-- 3.3. Actualizar vehículo
CREATE OR REPLACE FUNCTION usuarios.actualizar_vehiculo_transporte(
    p_token         UUID,
    p_id_vehiculo   INTEGER,
    p_patente       TEXT,
    p_marca         TEXT DEFAULT NULL,
    p_modelo        TEXT DEFAULT NULL,
    p_anio          INTEGER DEFAULT NULL,
    p_capacidad_kg  NUMERIC DEFAULT NULL,
    p_observaciones TEXT DEFAULT NULL,
    p_estado        TEXT DEFAULT 'A'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'transporte', 'usuarios', 'public'
AS $$
DECLARE
    v_actor   RECORD;
    v_patente VARCHAR(15);
    v_estado  CHAR(1);
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_expedicion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    v_patente := upper(trim(coalesce(p_patente, '')));
    IF v_patente = '' THEN
        RAISE EXCEPTION 'La patente del vehículo es obligatoria.';
    END IF;

    v_estado := upper(trim(coalesce(p_estado, 'A')));
    IF v_estado NOT IN ('A', 'I', 'E') THEN
        RAISE EXCEPTION 'El estado del vehículo debe ser A, I o E.';
    END IF;

    IF p_anio IS NOT NULL AND (p_anio < 1900 OR p_anio > 2100) THEN
        RAISE EXCEPTION 'El año del vehículo debe estar entre 1900 y 2100.';
    END IF;

    IF p_capacidad_kg IS NOT NULL AND p_capacidad_kg <= 0 THEN
        RAISE EXCEPTION 'La capacidad en kg debe ser mayor a 0.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM transporte.vehiculo
        WHERE upper(trim(patente)) = v_patente
          AND id_vehiculo <> p_id_vehiculo
    ) THEN
        RAISE EXCEPTION 'Ya existe otro vehículo registrado con la patente %.', v_patente;
    END IF;

    UPDATE transporte.vehiculo
    SET patente       = v_patente,
        marca         = nullif(trim(coalesce(p_marca, '')), ''),
        modelo        = nullif(trim(coalesce(p_modelo, '')), ''),
        anio          = p_anio,
        capacidad_kg  = p_capacidad_kg,
        observaciones = nullif(trim(coalesce(p_observaciones, '')), ''),
        estado        = v_estado,
        usu_mod       = v_actor.usuario_login,
        fec_mod       = CURRENT_TIMESTAMP
    WHERE id_vehiculo = p_id_vehiculo;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el vehículo #%.', p_id_vehiculo;
    END IF;

    RETURN TRUE;
END;
$$;

-- 3.4. Eliminar vehículo (baja lógica estado = 'E')
CREATE OR REPLACE FUNCTION usuarios.eliminar_vehiculo_transporte(
    p_token       UUID,
    p_id_vehiculo INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'transporte', 'logistica', 'usuarios', 'public'
AS $$
DECLARE
    v_actor RECORD;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_expedicion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM logistica.asignacion_transporte at
        JOIN logistica.hoja_ruta hr ON hr.id_hoja_ruta = at.id_hoja_ruta
        WHERE at.id_vehiculo = p_id_vehiculo
          AND at.estado = 'A'
          AND hr.estado = 'A'
          AND hr.estado_hoja_ruta = 'P'
    ) THEN
        RAISE EXCEPTION 'No se puede eliminar el vehículo porque está asignado a una hoja de ruta pendiente.';
    END IF;

    UPDATE transporte.vehiculo
    SET estado  = 'E',
        usu_mod = v_actor.usuario_login,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_vehiculo = p_id_vehiculo;

    RETURN TRUE;
END;
$$;

-- =====================================================================
-- 4. EXPEDICIÓN -> CHOFERES, PEDIDOS EN 'L' Y HOJAS DE RUTA
-- =====================================================================

-- 4.1. Listar choferes (empleados en administracion.recursos_humanos con id_rol = 17)
CREATE OR REPLACE FUNCTION usuarios.listar_choferes_expedicion(p_token UUID)
RETURNS TABLE(
    legajo          TEXT,
    nombre          TEXT,
    apellido        TEXT,
    dni             TEXT,
    cuil            TEXT,
    telefono        TEXT,
    id_rol          INTEGER,
    estado          TEXT,
    ocupado_en_ruta BOOLEAN,
    nro_hoja_activa TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'transporte', 'logistica', 'usuarios', 'public'
AS $$
DECLARE
    v_actor RECORD;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_expedicion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    -- Sincronizar automáticamente en transporte.conductor todos los empleados activos con id_rol = 17
    INSERT INTO transporte.conductor (legajo, estado, usu_alta)
    SELECT rh.legajo, 'A', v_actor.usuario_login
    FROM administracion.recursos_humanos rh
    WHERE rh.id_rol = 17
      AND rh.estado = 'A'
      AND rh.fecha_egreso IS NULL
    ON CONFLICT (legajo) DO UPDATE
    SET estado  = 'A',
        usu_mod = v_actor.usuario_login,
        fec_mod = CURRENT_TIMESTAMP
    WHERE transporte.conductor.estado <> 'A';

    RETURN QUERY
    SELECT
        rh.legajo::TEXT,
        rh.nombre::TEXT,
        rh.apellido::TEXT,
        coalesce(rh.dni, '')::TEXT,
        coalesce(rh.cuil, '')::TEXT,
        coalesce(rh.telefono, '')::TEXT,
        rh.id_rol::INTEGER,
        trim(rh.estado)::TEXT,
        (at_act.id_asignacion_transporte IS NOT NULL) AS ocupado_en_ruta,
        at_act.nro_hoja_ruta::TEXT AS nro_hoja_activa
    FROM administracion.recursos_humanos rh
    LEFT JOIN LATERAL (
        SELECT
            at.id_asignacion_transporte,
            hr.nro_hoja_ruta
        FROM logistica.asignacion_transporte at
        JOIN logistica.hoja_ruta hr ON hr.id_hoja_ruta = at.id_hoja_ruta
        WHERE at.legajo_conductor = rh.legajo
          AND at.estado = 'A'
          AND hr.estado = 'A'
          AND hr.estado_hoja_ruta = 'P'
        ORDER BY at.id_asignacion_transporte DESC
        LIMIT 1
    ) at_act ON true
    WHERE rh.id_rol = 17
      AND rh.estado = 'A'
      AND rh.fecha_egreso IS NULL
    ORDER BY rh.apellido ASC, rh.nombre ASC, rh.legajo ASC;
END;
$$;

-- 4.2. Listar pedidos en estado 'L' disponibles para incorporar a una Hoja de Ruta
CREATE OR REPLACE FUNCTION usuarios.listar_pedidos_listos_expedicion(
    p_token        UUID,
    p_id_hoja_ruta INTEGER DEFAULT NULL
)
RETURNS TABLE(
    id_pedido          INTEGER,
    fecha_pedido       TIMESTAMP WITHOUT TIME ZONE,
    id_cliente         INTEGER,
    cliente_nombre     TEXT,
    cliente_cuit       TEXT,
    modalidad_entrega  TEXT,
    domicilio_entrega  TEXT,
    localidad_entrega  TEXT,
    provincia_entrega  TEXT,
    observaciones      TEXT,
    estado             TEXT,
    cantidad_lineas    INTEGER,
    cantidad_productos NUMERIC,
    importe_total      NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'logistica', 'usuarios', 'public'
AS $$
DECLARE
    v_actor RECORD;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_expedicion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    RETURN QUERY
    SELECT
        p.id_pedido::INTEGER,
        p.fecha_pedido,
        p.id_cliente::INTEGER,
        c.nombre_razon_social::TEXT AS cliente_nombre,
        coalesce(c.cuit, '')::TEXT AS cliente_cuit,
        trim(coalesce(p.modalidad_entrega, 'P'))::TEXT AS modalidad_entrega,
        coalesce(nullif(trim(p.domicilio_entrega), ''), c.domicilio, '')::TEXT AS domicilio_entrega,
        coalesce(nullif(trim(p.localidad_entrega), ''), c.localidad, '')::TEXT AS localidad_entrega,
        coalesce(nullif(trim(p.provincia_entrega), ''), c.provincia, '')::TEXT AS provincia_entrega,
        coalesce(p.observaciones, '')::TEXT AS observaciones,
        trim(p.estado)::TEXT AS estado,
        coalesce(det.cant_lineas, 0)::INTEGER AS cantidad_lineas,
        coalesce(det.cant_productos, 0)::NUMERIC AS cantidad_productos,
        coalesce(det.imp_total, 0)::NUMERIC AS importe_total
    FROM administracion.pedido p
    JOIN administracion.cliente c ON c.id_cliente = p.id_cliente
    LEFT JOIN LATERAL (
        SELECT
            COUNT(*) AS cant_lineas,
            SUM(dp.cantidad) AS cant_productos,
            SUM(dp.importe_total) AS imp_total
        FROM administracion.detalle_pedido dp
        WHERE dp.id_pedido = p.id_pedido
    ) det ON true
    WHERE trim(p.estado) = 'L'
      AND NOT EXISTS (
          SELECT 1
          FROM logistica.detalle_hoja_ruta dhr
          JOIN logistica.hoja_ruta hr ON hr.id_hoja_ruta = dhr.id_hoja_ruta
          WHERE dhr.id_pedido = p.id_pedido
            AND dhr.estado = 'A'
            AND hr.estado = 'A'
            AND (p_id_hoja_ruta IS NULL OR dhr.id_hoja_ruta <> p_id_hoja_ruta)
      )
    ORDER BY p.fecha_pedido ASC, p.id_pedido ASC;
END;
$$;

-- 4.3. Listar todas las Hojas de Ruta generadas con vehículo, chofer y paradas
CREATE OR REPLACE FUNCTION usuarios.listar_hojas_ruta_expedicion(p_token UUID)
RETURNS TABLE(
    id_hoja_ruta       INTEGER,
    nro_hoja_ruta      TEXT,
    fecha_hoja_ruta    DATE,
    observaciones      TEXT,
    estado             TEXT,
    estado_hoja_ruta   TEXT,
    usu_alta           TEXT,
    fec_alta           TIMESTAMP WITHOUT TIME ZONE,
    usu_mod            TEXT,
    fec_mod            TIMESTAMP WITHOUT TIME ZONE,
    id_vehiculo        INTEGER,
    vehiculo_patente   TEXT,
    vehiculo_marca     TEXT,
    vehiculo_modelo    TEXT,
    vehiculo_capacidad NUMERIC,
    legajo_conductor   TEXT,
    conductor_nombre   TEXT,
    conductor_apellido TEXT,
    conductor_dni      TEXT,
    conductor_telefono TEXT,
    cant_paradas       INTEGER,
    total_unidades     NUMERIC,
    total_importe      NUMERIC,
    paradas            JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'logistica', 'transporte', 'administracion', 'usuarios', 'public'
AS $$
DECLARE
    v_actor RECORD;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_expedicion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    RETURN QUERY
    SELECT
        hr.id_hoja_ruta,
        hr.nro_hoja_ruta::TEXT,
        hr.fecha_hoja_ruta,
        coalesce(hr.observaciones, '')::TEXT,
        trim(hr.estado)::TEXT,
        trim(coalesce(hr.estado_hoja_ruta, 'P'))::TEXT AS estado_hoja_ruta,
        hr.usu_alta::TEXT,
        hr.fec_alta,
        hr.usu_mod::TEXT,
        hr.fec_mod,
        asig.id_vehiculo,
        coalesce(asig.patente, '')::TEXT AS vehiculo_patente,
        coalesce(asig.marca, '')::TEXT AS vehiculo_marca,
        coalesce(asig.modelo, '')::TEXT AS vehiculo_modelo,
        asig.capacidad_kg AS vehiculo_capacidad,
        coalesce(asig.legajo_conductor, '')::TEXT AS legajo_conductor,
        coalesce(asig.nombre, '')::TEXT AS conductor_nombre,
        coalesce(asig.apellido, '')::TEXT AS conductor_apellido,
        coalesce(asig.dni, '')::TEXT AS conductor_dni,
        coalesce(asig.telefono, '')::TEXT AS conductor_telefono,
        coalesce(par_agg.cant_paradas, 0)::INTEGER AS cant_paradas,
        coalesce(par_agg.total_unidades, 0)::NUMERIC AS total_unidades,
        coalesce(par_agg.total_importe, 0)::NUMERIC AS total_importe,
        coalesce(par_agg.paradas_json, '[]'::JSONB) AS paradas
    FROM logistica.hoja_ruta hr
    LEFT JOIN LATERAL (
        SELECT
            at.id_vehiculo,
            v.patente,
            v.marca,
            v.modelo,
            v.capacidad_kg,
            at.legajo_conductor,
            rh.nombre,
            rh.apellido,
            rh.dni,
            rh.telefono
        FROM logistica.asignacion_transporte at
        LEFT JOIN transporte.vehiculo v ON v.id_vehiculo = at.id_vehiculo
        LEFT JOIN administracion.recursos_humanos rh ON rh.legajo = at.legajo_conductor
        WHERE at.id_hoja_ruta = hr.id_hoja_ruta
          AND at.estado IN ('A', 'I')
        ORDER BY
            CASE WHEN at.estado = 'A' THEN 0 ELSE 1 END ASC,
            at.id_asignacion_transporte DESC
        LIMIT 1
    ) asig ON true
    LEFT JOIN LATERAL (
        SELECT
            COUNT(dhr.id_detalle_hoja_ruta) AS cant_paradas,
            SUM(coalesce(ped_tot.cant_productos, 0)) AS total_unidades,
            SUM(coalesce(ped_tot.imp_total, 0)) AS total_importe,
            jsonb_agg(
                jsonb_build_object(
                    'id_detalle_hoja_ruta', dhr.id_detalle_hoja_ruta,
                    'id_parada', phr.id_parada,
                    'orden_parada', coalesce(phr.orden_parada, 1),
                    'id_pedido', p.id_pedido,
                    'fecha_pedido', p.fecha_pedido,
                    'estado_pedido', trim(p.estado),
                    'id_cliente', c.id_cliente,
                    'cliente_nombre', c.nombre_razon_social,
                    'cliente_cuit', coalesce(c.cuit, ''),
                    'modalidad_entrega', trim(coalesce(p.modalidad_entrega, 'P')),
                    'domicilio', coalesce(phr.domicilio, p.domicilio_entrega, c.domicilio, ''),
                    'localidad', coalesce(phr.localidad, p.localidad_entrega, c.localidad, ''),
                    'provincia', coalesce(phr.provincia, p.provincia_entrega, c.provincia, ''),
                    'observaciones', coalesce(phr.observaciones, dhr.observaciones, p.observaciones, ''),
                    'cantidad_lineas', coalesce(ped_tot.cant_lineas, 0),
                    'cantidad_productos', coalesce(ped_tot.cant_productos, 0),
                    'importe_total', coalesce(ped_tot.imp_total, 0),
                    'estado_entrega', coalesce(ent.estado_entrega, 'P'),
                    'fecha_entrega', ent.fecha_entrega
                ) ORDER BY coalesce(phr.orden_parada, 9999) ASC, dhr.id_detalle_hoja_ruta ASC
            ) AS paradas_json
        FROM logistica.detalle_hoja_ruta dhr
        JOIN administracion.pedido p ON p.id_pedido = dhr.id_pedido
        JOIN administracion.cliente c ON c.id_cliente = p.id_cliente
        LEFT JOIN logistica.parada_hoja_ruta phr
            ON phr.id_detalle_hoja_ruta = dhr.id_detalle_hoja_ruta
           AND phr.estado = 'A'
        LEFT JOIN LATERAL (
            SELECT e.estado_entrega, e.fecha_entrega
            FROM transporte.entrega e
            WHERE e.id_parada = phr.id_parada
              AND e.estado = 'A'
            ORDER BY e.id_entrega DESC
            LIMIT 1
        ) ent ON true
        LEFT JOIN LATERAL (
            SELECT
                COUNT(*) AS cant_lineas,
                SUM(dp.cantidad) AS cant_productos,
                SUM(dp.importe_total) AS imp_total
            FROM administracion.detalle_pedido dp
            WHERE dp.id_pedido = p.id_pedido
        ) ped_tot ON true
        WHERE dhr.id_hoja_ruta = hr.id_hoja_ruta
          AND dhr.estado = 'A'
    ) par_agg ON true
    WHERE hr.estado = 'A'
    ORDER BY
        CASE WHEN trim(coalesce(hr.estado_hoja_ruta, 'P')) = 'P' THEN 0 ELSE 1 END ASC,
        hr.id_hoja_ruta DESC;
END;
$$;

-- 4.4. Guardar Hoja de Ruta (Crear nueva o Editar existente en estado_hoja_ruta = 'P')
CREATE OR REPLACE FUNCTION usuarios.guardar_hoja_ruta_expedicion(
    p_token            UUID,
    p_id_hoja_ruta     INTEGER DEFAULT NULL,
    p_fecha_hoja_ruta  DATE DEFAULT CURRENT_DATE,
    p_id_vehiculo      INTEGER DEFAULT NULL,
    p_legajo_conductor TEXT DEFAULT NULL,
    p_observaciones    TEXT DEFAULT NULL,
    p_paradas          JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'logistica', 'transporte', 'administracion', 'usuarios', 'public'
AS $$
DECLARE
    v_actor                RECORD;
    v_id_hoja_ruta         INTEGER;
    v_nro_hoja_ruta        VARCHAR(20);
    v_estado_hoja_ruta     CHAR(1);
    v_legajo               VARCHAR(20);
    v_item                 JSONB;
    v_id_pedido            INTEGER;
    v_orden                INTEGER;
    v_domicilio            VARCHAR(200);
    v_localidad            VARCHAR(100);
    v_provincia            VARCHAR(100);
    v_obs_parada           VARCHAR(1000);
    v_id_detalle_hoja_ruta INTEGER;
    v_id_parada            INTEGER;
    v_idx                  INTEGER := 0;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_expedicion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    IF p_id_vehiculo IS NULL THEN
        RAISE EXCEPTION 'Debe seleccionar un vehículo para la hoja de ruta.';
    END IF;

    v_legajo := trim(coalesce(p_legajo_conductor, ''));
    IF v_legajo = '' THEN
        RAISE EXCEPTION 'Debe seleccionar un chofer para la hoja de ruta.';
    END IF;

    IF p_paradas IS NULL OR jsonb_typeof(p_paradas) <> 'array' OR jsonb_array_length(p_paradas) = 0 THEN
        RAISE EXCEPTION 'Debe incorporar al menos un pedido en estado L a la hoja de ruta.';
    END IF;

    -- Asegurar que el chofer (id_rol = 17 en recursos_humanos) exista y esté activo en transporte.conductor
    INSERT INTO transporte.conductor (legajo, estado, usu_alta)
    SELECT rh.legajo, 'A', v_actor.usuario_login
    FROM administracion.recursos_humanos rh
    WHERE rh.legajo = v_legajo
      AND rh.id_rol = 17
      AND rh.estado = 'A'
    ON CONFLICT (legajo) DO UPDATE
    SET estado  = 'A',
        usu_mod = v_actor.usuario_login,
        fec_mod = CURRENT_TIMESTAMP;

    -- Liberar asignaciones activas que hayan quedado de hojas de ruta ya despachadas ('D')
    UPDATE logistica.asignacion_transporte at
    SET estado  = 'I',
        usu_mod = v_actor.usuario_login,
        fec_mod = CURRENT_TIMESTAMP
    FROM logistica.hoja_ruta hr
    WHERE hr.id_hoja_ruta = at.id_hoja_ruta
      AND at.estado = 'A'
      AND (hr.estado <> 'A' OR hr.estado_hoja_ruta = 'D');

    -- Validar que el vehículo no esté ocupado en otra hoja de ruta pendiente en la MISMA fecha
    IF EXISTS (
        SELECT 1
        FROM logistica.asignacion_transporte at
        JOIN logistica.hoja_ruta hr ON hr.id_hoja_ruta = at.id_hoja_ruta
        WHERE at.id_vehiculo = p_id_vehiculo
          AND at.estado IN ('A', 'I')
          AND hr.estado = 'A'
          AND hr.estado_hoja_ruta = 'P'
          AND hr.fecha_hoja_ruta = coalesce(p_fecha_hoja_ruta, CURRENT_DATE)
          AND (p_id_hoja_ruta IS NULL OR at.id_hoja_ruta <> p_id_hoja_ruta)
    ) THEN
        RAISE EXCEPTION 'El vehículo seleccionado ya se encuentra asignado a otra hoja de ruta pendiente en la fecha %.', coalesce(p_fecha_hoja_ruta, CURRENT_DATE);
    END IF;

    -- Validar que el chofer no esté ocupado en otra hoja de ruta pendiente en la MISMA fecha
    IF EXISTS (
        SELECT 1
        FROM logistica.asignacion_transporte at
        JOIN logistica.hoja_ruta hr ON hr.id_hoja_ruta = at.id_hoja_ruta
        WHERE at.legajo_conductor = v_legajo
          AND at.estado IN ('A', 'I')
          AND hr.estado = 'A'
          AND hr.estado_hoja_ruta = 'P'
          AND hr.fecha_hoja_ruta = coalesce(p_fecha_hoja_ruta, CURRENT_DATE)
          AND (p_id_hoja_ruta IS NULL OR at.id_hoja_ruta <> p_id_hoja_ruta)
    ) THEN
        RAISE EXCEPTION 'El chofer seleccionado ya se encuentra asignado a otra hoja de ruta pendiente en la fecha %.', coalesce(p_fecha_hoja_ruta, CURRENT_DATE);
    END IF;

    IF p_id_hoja_ruta IS NULL THEN
        -- Crear nueva hoja de ruta en estado_hoja_ruta = 'P'
        INSERT INTO logistica.hoja_ruta (
            fecha_hoja_ruta,
            observaciones,
            estado,
            estado_hoja_ruta,
            usu_alta
        ) VALUES (
            coalesce(p_fecha_hoja_ruta, CURRENT_DATE),
            nullif(trim(coalesce(p_observaciones, '')), ''),
            'A',
            'P',
            v_actor.usuario_login
        )
        RETURNING id_hoja_ruta, nro_hoja_ruta
        INTO v_id_hoja_ruta, v_nro_hoja_ruta;
    ELSE
        -- Validar que exista y esté pendiente ('P')
        SELECT h.id_hoja_ruta, h.nro_hoja_ruta, h.estado_hoja_ruta
        INTO v_id_hoja_ruta, v_nro_hoja_ruta, v_estado_hoja_ruta
        FROM logistica.hoja_ruta h
        WHERE h.id_hoja_ruta = p_id_hoja_ruta
          AND h.estado = 'A'
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'No se encontró la hoja de ruta #%.', p_id_hoja_ruta;
        END IF;

        IF trim(coalesce(v_estado_hoja_ruta, 'P')) <> 'P' THEN
            RAISE EXCEPTION 'Solo se pueden editar hojas de ruta en estado Pendiente (P).';
        END IF;

        UPDATE logistica.hoja_ruta
        SET fecha_hoja_ruta  = coalesce(p_fecha_hoja_ruta, fecha_hoja_ruta),
            observaciones    = nullif(trim(coalesce(p_observaciones, '')), ''),
            estado_hoja_ruta = 'P',
            usu_mod          = v_actor.usuario_login,
            fec_mod          = CURRENT_TIMESTAMP
        WHERE id_hoja_ruta = v_id_hoja_ruta;

        -- Limpiar entregas, paradas y detalles previos de esta hoja para reconstruir el recorrido limpio
        DELETE FROM transporte.entrega e
        USING logistica.parada_hoja_ruta phr
        WHERE e.id_parada = phr.id_parada
          AND phr.id_hoja_ruta = v_id_hoja_ruta;

        DELETE FROM logistica.parada_hoja_ruta
        WHERE id_hoja_ruta = v_id_hoja_ruta;

        DELETE FROM logistica.detalle_hoja_ruta
        WHERE id_hoja_ruta = v_id_hoja_ruta;
    END IF;

    -- Registrar o actualizar la asignación de transporte activa para esta hoja de ruta
    IF EXISTS (
        SELECT 1
        FROM logistica.asignacion_transporte
        WHERE id_hoja_ruta = v_id_hoja_ruta
          AND estado = 'A'
    ) THEN
        UPDATE logistica.asignacion_transporte
        SET id_vehiculo      = p_id_vehiculo,
            legajo_conductor = v_legajo,
            observaciones    = nullif(trim(coalesce(p_observaciones, '')), ''),
            usu_mod          = v_actor.usuario_login,
            fec_mod          = CURRENT_TIMESTAMP
        WHERE id_hoja_ruta = v_id_hoja_ruta
          AND estado = 'A';
    ELSE
        INSERT INTO logistica.asignacion_transporte (
            id_hoja_ruta,
            id_vehiculo,
            legajo_conductor,
            observaciones,
            estado,
            usu_alta
        ) VALUES (
            v_id_hoja_ruta,
            p_id_vehiculo,
            v_legajo,
            nullif(trim(coalesce(p_observaciones, '')), ''),
            'A',
            v_actor.usuario_login
        );
    END IF;

    -- Insertar los pedidos seleccionados y sus paradas con su orden de ruta
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_paradas)
    LOOP
        v_idx        := v_idx + 1;
        v_id_pedido  := (v_item->>'id_pedido')::INTEGER;
        v_orden      := coalesce((v_item->>'orden_parada')::INTEGER, v_idx);
        v_domicilio  := nullif(left(trim(coalesce(v_item->>'domicilio', '')), 200), '');
        v_localidad  := nullif(left(trim(coalesce(v_item->>'localidad', '')), 100), '');
        v_provincia  := nullif(left(trim(coalesce(v_item->>'provincia', '')), 100), '');
        v_obs_parada := nullif(left(trim(coalesce(v_item->>'observaciones', '')), 1000), '');

        -- Si algún pedido tenía un detalle inactivo/eliminado histórico en otra hoja, limpiarlo por la restricción UNIQUE(id_pedido)
        DELETE FROM transporte.entrega e
        USING logistica.parada_hoja_ruta phr, logistica.detalle_hoja_ruta dhr
        WHERE e.id_parada = phr.id_parada
          AND phr.id_detalle_hoja_ruta = dhr.id_detalle_hoja_ruta
          AND dhr.id_pedido = v_id_pedido
          AND dhr.estado <> 'A';

        DELETE FROM logistica.parada_hoja_ruta phr
        USING logistica.detalle_hoja_ruta dhr
        WHERE phr.id_detalle_hoja_ruta = dhr.id_detalle_hoja_ruta
          AND dhr.id_pedido = v_id_pedido
          AND dhr.estado <> 'A';

        DELETE FROM logistica.detalle_hoja_ruta
        WHERE id_pedido = v_id_pedido
          AND estado <> 'A';

        -- Completar dirección desde administracion.pedido / cliente si no vino en el JSON
        IF v_domicilio IS NULL OR v_localidad IS NULL OR v_provincia IS NULL THEN
            SELECT
                coalesce(v_domicilio, nullif(trim(p.domicilio_entrega), ''), c.domicilio),
                coalesce(v_localidad, nullif(trim(p.localidad_entrega), ''), c.localidad),
                coalesce(v_provincia, nullif(trim(p.provincia_entrega), ''), c.provincia)
            INTO v_domicilio, v_localidad, v_provincia
            FROM administracion.pedido p
            JOIN administracion.cliente c ON c.id_cliente = p.id_cliente
            WHERE p.id_pedido = v_id_pedido;
        END IF;

        INSERT INTO logistica.detalle_hoja_ruta (
            id_hoja_ruta,
            id_pedido,
            observaciones,
            estado,
            usu_alta
        ) VALUES (
            v_id_hoja_ruta,
            v_id_pedido,
            v_obs_parada,
            'A',
            v_actor.usuario_login
        )
        RETURNING id_detalle_hoja_ruta INTO v_id_detalle_hoja_ruta;

        INSERT INTO logistica.parada_hoja_ruta (
            id_hoja_ruta,
            id_detalle_hoja_ruta,
            orden_parada,
            domicilio,
            localidad,
            provincia,
            observaciones,
            estado,
            usu_alta
        ) VALUES (
            v_id_hoja_ruta,
            v_id_detalle_hoja_ruta,
            v_orden,
            v_domicilio,
            v_localidad,
            v_provincia,
            v_obs_parada,
            'A',
            v_actor.usuario_login
        )
        RETURNING id_parada INTO v_id_parada;

        INSERT INTO transporte.entrega (
            id_parada,
            estado_entrega,
            estado,
            usu_alta
        ) VALUES (
            v_id_parada,
            'P',
            'A',
            v_actor.usuario_login
        );
    END LOOP;

    RETURN jsonb_build_object(
        'id_hoja_ruta', v_id_hoja_ruta,
        'nro_hoja_ruta', v_nro_hoja_ruta,
        'estado_hoja_ruta', 'P'
    );
END;
$$;

-- 4.5. Despachar Pedido / Hoja de Ruta (Pasa estado_hoja_ruta a 'D' y los pedidos a 'D' en administracion.pedido)
CREATE OR REPLACE FUNCTION usuarios.despachar_hoja_ruta_expedicion(
    p_token        UUID,
    p_id_hoja_ruta INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'logistica', 'transporte', 'administracion', 'deposito', 'usuarios', 'public'
AS $$
DECLARE
    v_actor            RECORD;
    v_estado_hoja_ruta CHAR(1);
    v_nro_hoja_ruta    VARCHAR(20);
    v_ped              RECORD;
    v_dpp              RECORD;
    v_id_stock         INTEGER;
    v_id_pos           INTEGER;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_expedicion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    SELECT h.nro_hoja_ruta, h.estado_hoja_ruta
    INTO v_nro_hoja_ruta, v_estado_hoja_ruta
    FROM logistica.hoja_ruta h
    WHERE h.id_hoja_ruta = p_id_hoja_ruta
      AND h.estado = 'A'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró la hoja de ruta #%.', p_id_hoja_ruta;
    END IF;

    IF trim(coalesce(v_estado_hoja_ruta, 'P')) = 'D' THEN
        RAISE EXCEPTION 'La hoja de ruta % ya fue despachada.', v_nro_hoja_ruta;
    END IF;

    -- 1. Pasar cada pedido de la hoja de ruta a estado = 'D' en administracion.pedido
    FOR v_ped IN
        SELECT dhr.id_pedido, phr.id_parada
        FROM logistica.detalle_hoja_ruta dhr
        LEFT JOIN logistica.parada_hoja_ruta phr
            ON phr.id_detalle_hoja_ruta = dhr.id_detalle_hoja_ruta
           AND phr.estado = 'A'
        WHERE dhr.id_hoja_ruta = p_id_hoja_ruta
          AND dhr.estado = 'A'
    LOOP
        UPDATE administracion.pedido
        SET estado       = 'D',
            usu_despacho = v_actor.usuario_login,
            fec_despacho = CURRENT_TIMESTAMP,
            usu_mod      = v_actor.usuario_login,
            fec_mod      = CURRENT_TIMESTAMP
        WHERE id_pedido = v_ped.id_pedido;

        -- Actualizar entregas asociadas a la parada
        IF v_ped.id_parada IS NOT NULL THEN
            UPDATE transporte.entrega
            SET estado_entrega = 'E',
                fecha_entrega  = CURRENT_TIMESTAMP,
                usu_mod        = v_actor.usuario_login,
                fec_mod        = CURRENT_TIMESTAMP
            WHERE id_parada = v_ped.id_parada
              AND estado = 'A';
        END IF;

        -- Consumir stock reservado del pedido en deposito.stock y registrar movimiento DESPACHO
        FOR v_dpp IN
            SELECT dpp.*
            FROM deposito.preparacion_pedido pp
            JOIN deposito.detalle_preparacion_pedido dpp ON dpp.id_preparacion = pp.id_preparacion
            WHERE pp.id_pedido = v_ped.id_pedido
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
                    cantidad_consumida = coalesce(cantidad_consumida, 0) + v_dpp.cantidad,
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
                    v_ped.id_pedido,
                    v_dpp.id_detalle_preparacion,
                    'DESPACHO',
                    v_dpp.cantidad,
                    v_id_pos,
                    'Despacho de pedido en Hoja de Ruta ' || v_nro_hoja_ruta,
                    v_actor.usuario_login
                );
            END IF;
        END LOOP;
    END LOOP;

    -- 2. Actualizar estado_hoja_ruta = 'D' en logistica.hoja_ruta
    UPDATE logistica.hoja_ruta
    SET estado_hoja_ruta = 'D',
        usu_mod          = v_actor.usuario_login,
        fec_mod          = CURRENT_TIMESTAMP
    WHERE id_hoja_ruta = p_id_hoja_ruta;

    -- 3. Liberar bloqueo de asignación activa (pasa a 'I' conservando el vínculo histórico con la hoja)
    UPDATE logistica.asignacion_transporte
    SET estado  = 'I',
        usu_mod = v_actor.usuario_login,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_hoja_ruta = p_id_hoja_ruta
      AND estado = 'A';

    RETURN TRUE;
END;
$$;

-- 4.6. Eliminar Hoja de Ruta (Solo hojas en estado_hoja_ruta = 'P', libera pedidos en 'L', vehículo y chofer)
CREATE OR REPLACE FUNCTION usuarios.eliminar_hoja_ruta_expedicion(
    p_token        UUID,
    p_id_hoja_ruta INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'logistica', 'transporte', 'administracion', 'usuarios', 'public'
AS $$
DECLARE
    v_actor            RECORD;
    v_estado_hoja_ruta CHAR(1);
    v_nro_hoja_ruta    VARCHAR(20);
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_expedicion(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado o sesión inválida';
    END IF;

    SELECT h.nro_hoja_ruta, h.estado_hoja_ruta
    INTO v_nro_hoja_ruta, v_estado_hoja_ruta
    FROM logistica.hoja_ruta h
    WHERE h.id_hoja_ruta = p_id_hoja_ruta
      AND h.estado = 'A'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró la hoja de ruta #%.', p_id_hoja_ruta;
    END IF;

    IF trim(coalesce(v_estado_hoja_ruta, 'P')) = 'D' THEN
        RAISE EXCEPTION 'No se puede eliminar la hoja de ruta % porque ya fue despachada.', v_nro_hoja_ruta;
    END IF;

    -- 1. Eliminar entregas, paradas y detalles asociados para liberar los pedidos en estado 'L' (uq_detalle_hoja_ruta_pedido)
    DELETE FROM transporte.entrega e
    USING logistica.parada_hoja_ruta phr
    WHERE e.id_parada = phr.id_parada
      AND phr.id_hoja_ruta = p_id_hoja_ruta;

    DELETE FROM logistica.parada_hoja_ruta
    WHERE id_hoja_ruta = p_id_hoja_ruta;

    DELETE FROM logistica.detalle_hoja_ruta
    WHERE id_hoja_ruta = p_id_hoja_ruta;

    -- 2. Dar de baja lógica la asignación de transporte para liberar el vehículo y el chofer
    UPDATE logistica.asignacion_transporte
    SET estado  = 'E',
        usu_mod = v_actor.usuario_login,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_hoja_ruta = p_id_hoja_ruta
      AND estado <> 'E';

    -- 3. Dar de baja lógica la hoja de ruta (estado = 'E')
    UPDATE logistica.hoja_ruta
    SET estado  = 'E',
        usu_mod = v_actor.usuario_login,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_hoja_ruta = p_id_hoja_ruta;

    RETURN TRUE;
END;
$$;

-- 5. Permisos de ejecución y esquemas
-- ---------------------------------------------------------------------
GRANT USAGE ON SCHEMA logistica TO anon, authenticated;
GRANT USAGE ON SCHEMA transporte TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA logistica TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA transporte TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA logistica TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA transporte TO anon, authenticated;

GRANT EXECUTE ON FUNCTION usuarios.fn_actor_expedicion(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_vehiculos_transporte(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.crear_vehiculo_transporte(UUID, TEXT, TEXT, TEXT, INTEGER, NUMERIC, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.actualizar_vehiculo_transporte(UUID, INTEGER, TEXT, TEXT, TEXT, INTEGER, NUMERIC, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.eliminar_vehiculo_transporte(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_choferes_expedicion(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_pedidos_listos_expedicion(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_hojas_ruta_expedicion(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.guardar_hoja_ruta_expedicion(UUID, INTEGER, DATE, INTEGER, TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.despachar_hoja_ruta_expedicion(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.eliminar_hoja_ruta_expedicion(UUID, INTEGER) TO anon, authenticated;

COMMIT;
