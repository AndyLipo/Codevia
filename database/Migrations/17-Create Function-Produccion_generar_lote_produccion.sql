CREATE OR REPLACE FUNCTION produccion.fn_generar_lote_produccion()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_id_producto INTEGER;
    v_fecha_fabricacion TIMESTAMP;
BEGIN

    /*
     * Solo actuar cuando la producción
     * cambia realmente a Completa.
     */
    IF NEW.estado_produccion = 'C'
       AND OLD.estado_produccion <> 'C'
    THEN

        /*
         * Obtener producto asociado a la producción
         * a través del detalle.
         */
        SELECT
            id_producto
        INTO
            v_id_producto
        FROM produccion.detalle_orden_produccion
        WHERE id_detalle_orden = NEW.id_detalle_orden;

        /*
         * La fecha de fabricación será
         * la fecha de finalización de la producción.
         */
        v_fecha_fabricacion := NEW.fecha_fin;

        /*
         * Crear lote solamente si todavía
         * no existe uno para esta producción.
         */
        IF NOT EXISTS (
            SELECT 1
            FROM produccion.lote_producto
            WHERE id_produccion = NEW.id_produccion
        )
        THEN

            INSERT INTO produccion.lote_producto (
                id_produccion,
                id_producto,
                fecha_fabricacion,
                cantidad_total,
                usu_alta
            )
            VALUES (
                NEW.id_produccion,
                v_id_producto,
                v_fecha_fabricacion,
                NEW.cantidad_producida,
                NEW.usu_mod
            );

        END IF;

    END IF;

    RETURN NEW;

END;
$function$;