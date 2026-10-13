CREATE OR REPLACE FUNCTION deposito.fn_trasladar_lote(
    p_id_lote_producto INTEGER,
    p_id_posicion_destino INTEGER,
    p_usuario VARCHAR(50)
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = deposito, pg_temp
AS $function$
DECLARE
    v_id_posicion_origen INTEGER;
    v_estado_lote CHAR(1);
    v_estado_posicion_destino CHAR(1);
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

    IF v_estado_lote <> 'U' THEN
        RAISE EXCEPTION
            'El lote % no puede ser trasladado porque su estado actual es %',
            p_id_lote_producto,
            v_estado_lote;
    END IF;


    -- 2. Obtener posición actual
    SELECT id_posicion
    INTO v_id_posicion_origen
    FROM deposito.lote_posicion
    WHERE id_lote_producto = p_id_lote_producto
      AND estado = 'A';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El lote % no posee una posición activa',
            p_id_lote_producto;
    END IF;


    -- 3. No permitir traslado a la misma posición
    IF v_id_posicion_origen = p_id_posicion_destino THEN
        RAISE EXCEPTION
            'La posición destino es la misma que la posición actual del lote';
    END IF;


    -- 4. Verificar posición destino
    SELECT estado_posicion, estado
    INTO v_estado_posicion_destino, v_estado_admin
    FROM deposito.posicion
    WHERE id_posicion = p_id_posicion_destino;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No existe la posición destino con ID %',
            p_id_posicion_destino;
    END IF;

    IF v_estado_admin <> 'A' THEN
        RAISE EXCEPTION
            'La posición destino % no está activa',
            p_id_posicion_destino;
    END IF;

    IF v_estado_posicion_destino <> 'D' THEN
        RAISE EXCEPTION
            'La posición destino % no está disponible. Estado actual: %',
            p_id_posicion_destino,
            v_estado_posicion_destino;
    END IF;


    -- 5. Desactivar ubicación anterior
    UPDATE deposito.lote_posicion
    SET
        estado = 'I',
        usu_mod = p_usuario,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_lote_producto = p_id_lote_producto
      AND id_posicion = v_id_posicion_origen
      AND estado = 'A';


    -- 6. Liberar posición origen
    UPDATE deposito.posicion
    SET
        estado_posicion = 'D',
        usu_mod = p_usuario,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_posicion = v_id_posicion_origen;


    -- 7. Crear nueva ubicación
    INSERT INTO deposito.lote_posicion (
        id_lote_producto,
        id_posicion,
        fecha_asignacion,
        estado,
        usu_alta
    )
    VALUES (
        p_id_lote_producto,
        p_id_posicion_destino,
        CURRENT_TIMESTAMP,
        'A',
        p_usuario
    );


    -- 8. Ocupar posición destino
    UPDATE deposito.posicion
    SET
        estado_posicion = 'O',
        usu_mod = p_usuario,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_posicion = p_id_posicion_destino;


    -- 9. Registrar movimiento
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
        'TRASLADO',
        v_id_posicion_origen,
        p_id_posicion_destino,
        CURRENT_TIMESTAMP,
        'Traslado del lote entre posiciones',
        'A',
        p_usuario
    );

END;
$function$;