CREATE OR REPLACE FUNCTION deposito.fn_recibir_lote(
    p_id_lote_producto INTEGER,
    p_usuario VARCHAR(50)
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = deposito, pg_temp
AS $function$
DECLARE
    v_estado_lote CHAR(1);
BEGIN

    -- Buscar el estado actual del lote
    SELECT estado_lote
    INTO v_estado_lote
    FROM produccion.lote_producto
    WHERE id_lote_producto = p_id_lote_producto;

    -- Validar existencia
    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No existe el lote con ID %',
            p_id_lote_producto;
    END IF;

    -- El lote debe estar pendiente de ingreso
    IF v_estado_lote <> 'P' THEN
        RAISE EXCEPTION
            'El lote % no puede ser recibido porque su estado actual es %',
            p_id_lote_producto,
            v_estado_lote;
    END IF;

    -- Registrar recepción
    UPDATE produccion.lote_producto
    SET
        estado_lote = 'R',
        usu_mod = p_usuario,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_lote_producto = p_id_lote_producto;

END;
$function$;