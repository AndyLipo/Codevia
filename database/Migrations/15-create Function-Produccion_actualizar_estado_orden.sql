CREATE OR REPLACE FUNCTION produccion.fn_actualizar_estado_orden()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_id_orden INTEGER;
    v_estado_actual CHAR(1);
    v_nuevo_estado CHAR(1);
    v_id_motivo INTEGER;
BEGIN

    /*
     * Obtener la orden afectada
     */
    v_id_orden := NEW.id_orden_produccion;

    /*
     * Obtener estado actual de la orden
     */
    SELECT
        estado_op
    INTO
        v_estado_actual
    FROM produccion.orden_produccion
    WHERE id_orden_produccion = v_id_orden;

    /*
     * Si la orden fue anulada manualmente,
     * no modificarla automáticamente.
     */
    IF v_estado_actual = 'A' THEN
        RETURN NEW;
    END IF;

    /*
     * Si existe algún detalle incompleto,
     * la orden pasa a I y copia el motivo.
     */
    SELECT
        id_motivo_estado
    INTO
        v_id_motivo
    FROM produccion.detalle_orden_produccion
    WHERE id_orden_produccion = v_id_orden
      AND estado_detalle = 'I'
    ORDER BY id_detalle_orden
    LIMIT 1;

    IF v_id_motivo IS NOT NULL THEN

        v_nuevo_estado := 'I';

        UPDATE produccion.orden_produccion
        SET
            estado_op = v_nuevo_estado,
            id_motivo_estado = v_id_motivo
        WHERE id_orden_produccion = v_id_orden;

        RETURN NEW;

    END IF;

    /*
     * Si existe algún detalle en ejecución,
     * la orden pasa a E.
     */
    IF EXISTS (
        SELECT 1
        FROM produccion.detalle_orden_produccion
        WHERE id_orden_produccion = v_id_orden
          AND estado_detalle = 'E'
    )
    THEN

        v_nuevo_estado := 'E';

        UPDATE produccion.orden_produccion
        SET
            estado_op = v_nuevo_estado,
            id_motivo_estado = NULL
        WHERE id_orden_produccion = v_id_orden;

        RETURN NEW;

    END IF;

    /*
     * Si existen detalles y todos están C,
     * la orden queda C.
     */
    IF EXISTS (
        SELECT 1
        FROM produccion.detalle_orden_produccion
        WHERE id_orden_produccion = v_id_orden
    )
    AND NOT EXISTS (
        SELECT 1
        FROM produccion.detalle_orden_produccion
        WHERE id_orden_produccion = v_id_orden
          AND estado_detalle <> 'C'
    )
    THEN

        v_nuevo_estado := 'C';

        UPDATE produccion.orden_produccion
        SET
            estado_op = v_nuevo_estado,
            id_motivo_estado = NULL
        WHERE id_orden_produccion = v_id_orden;

        RETURN NEW;

    END IF;

    /*
     * Si todavía no hay producción,
     * mantenemos la orden en P/T/D.
     */
    RETURN NEW;

END;
$function$;