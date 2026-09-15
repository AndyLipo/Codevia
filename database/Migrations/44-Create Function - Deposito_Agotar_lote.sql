CREATE OR REPLACE FUNCTION deposito.fn_agotar_lote(
    p_id_lote_producto INTEGER,
    p_usuario VARCHAR(50)
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = deposito, pg_temp
AS $function$
DECLARE
    v_estado_lote CHAR(1);
    v_id_posicion INTEGER;
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
            'El lote % no puede ser agotado porque su estado actual es %',
            p_id_lote_producto,
            v_estado_lote;
    END IF;


    -- 2. Obtener posición actual
    SELECT id_posicion
    INTO v_id_posicion
    FROM deposito.lote_posicion
    WHERE id_lote_producto = p_id_lote_producto
      AND estado = 'A';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El lote % no posee una posición activa',
            p_id_lote_producto;
    END IF;


    -- 3. Registrar movimiento de agotamiento
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
        'AGOTAMIENTO',
        v_id_posicion,
        NULL,
        CURRENT_TIMESTAMP,
        'Agotamiento total del lote',
        'A',
        p_usuario
    );


    -- 4. Desactivar ubicación del lote
    UPDATE deposito.lote_posicion
    SET
        estado = 'I',
        usu_mod = p_usuario,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_lote_producto = p_id_lote_producto
      AND estado = 'A';


    -- 5. Liberar posición
    UPDATE deposito.posicion
    SET
        estado_posicion = 'D',
        usu_mod = p_usuario,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_posicion = v_id_posicion;


    -- 6. Cambiar estado del lote a agotado
    UPDATE produccion.lote_producto
    SET
        estado_lote = 'A',
        usu_mod = p_usuario,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_lote_producto = p_id_lote_producto;

END;
$function$;