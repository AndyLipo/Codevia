CREATE OR REPLACE FUNCTION deposito.fn_ubicar_lote(
    p_id_lote_producto INTEGER,
    p_id_posicion INTEGER,
    p_usuario VARCHAR(50)
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = deposito, pg_temp
AS $function$
DECLARE
    v_estado_lote CHAR(1);
    v_estado_posicion CHAR(1);
    v_estado_admin CHAR(1);
BEGIN

    -- 1. Verificar el lote
    SELECT estado_lote
    INTO v_estado_lote
    FROM produccion.lote_producto
    WHERE id_lote_producto = p_id_lote_producto;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No existe el lote con ID %',
            p_id_lote_producto;
    END IF;

    IF v_estado_lote <> 'R' THEN
        RAISE EXCEPTION
            'El lote % no puede ser ubicado porque su estado actual es %',
            p_id_lote_producto,
            v_estado_lote;
    END IF;


    -- 2. Verificar la posición
    SELECT estado_posicion, estado
    INTO v_estado_posicion, v_estado_admin
    FROM deposito.posicion
    WHERE id_posicion = p_id_posicion;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No existe la posición con ID %',
            p_id_posicion;
    END IF;

    IF v_estado_admin <> 'A' THEN
        RAISE EXCEPTION
            'La posición % no está activa',
            p_id_posicion;
    END IF;

    IF v_estado_posicion <> 'D' THEN
        RAISE EXCEPTION
            'La posición % no está disponible. Estado actual: %',
            p_id_posicion,
            v_estado_posicion;
    END IF;


    -- 3. Verificar que el lote no tenga otra posición activa
    IF EXISTS (
        SELECT 1
        FROM deposito.lote_posicion
        WHERE id_lote_producto = p_id_lote_producto
          AND estado = 'A'
    ) THEN
        RAISE EXCEPTION
            'El lote % ya posee una posición activa',
            p_id_lote_producto;
    END IF;


    -- 4. Verificar que la posición no tenga otro lote
    IF EXISTS (
        SELECT 1
        FROM deposito.lote_posicion
        WHERE id_posicion = p_id_posicion
          AND estado = 'A'
    ) THEN
        RAISE EXCEPTION
            'La posición % ya tiene un lote asignado',
            p_id_posicion;
    END IF;


    -- 5. Registrar ubicación actual
    INSERT INTO deposito.lote_posicion (
        id_lote_producto,
        id_posicion,
        fecha_asignacion,
        estado,
        usu_alta
    )
    VALUES (
        p_id_lote_producto,
        p_id_posicion,
        CURRENT_TIMESTAMP,
        'A',
        p_usuario
    );


    -- 6. Registrar movimiento de ingreso
    INSERT INTO deposito.movimiento_lote (
        id_lote_producto,
        tipo_movimiento,
        id_posicion_origen,
        id_posicion_destino,
        fecha_movimiento,
        observacion,
        estado,
        usu_alta
    )
    VALUES (
        p_id_lote_producto,
        'INGRESO',
        NULL,
        p_id_posicion,
        CURRENT_TIMESTAMP,
        'Ingreso y ubicación inicial del lote en depósito',
        'A',
        p_usuario
    );


    -- 7. Ocupar posición
    UPDATE deposito.posicion
    SET
        estado_posicion = 'O',
        usu_mod = p_usuario,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_posicion = p_id_posicion;


    -- 8. Cambiar estado del lote
    UPDATE produccion.lote_producto
    SET
        estado_lote = 'U',
        usu_mod = p_usuario,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_lote_producto = p_id_lote_producto;

END;
$function$;