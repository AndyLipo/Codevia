CREATE OR REPLACE FUNCTION produccion.fn_actualizar_detalle_produccion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_detalle INTEGER;
    v_cantidad_solicitada NUMERIC;
    v_cantidad_producida NUMERIC;
    v_estado_actual CHAR(1);
    v_estado_producciones CHAR(1);
    v_id_motivo INTEGER;
BEGIN

    /*
     * Determinar el detalle afectado
     */
    IF TG_OP = 'DELETE' THEN
        v_id_detalle := OLD.id_detalle_orden;
    ELSE
        v_id_detalle := NEW.id_detalle_orden;
    END IF;


    /*
     * Obtener información del detalle
     */
    SELECT
        cantidad_solicitada,
        estado_detalle
    INTO
        v_cantidad_solicitada,
        v_estado_actual
    FROM produccion.detalle_orden_produccion
    WHERE id_detalle_orden = v_id_detalle;


    /*
     * Cantidad producida:
     * solamente cuentan producciones E o C.
     * Las producciones P y A no cuentan.
     */
    SELECT
        COALESCE(SUM(cantidad_producida), 0)
    INTO
        v_cantidad_producida
    FROM produccion.produccion
    WHERE id_detalle_orden = v_id_detalle
      AND estado_produccion IN ('E', 'C');


    /*
     * Si existe alguna producción en estado I,
     * el detalle pasa a I y copia el motivo.
     */
    SELECT
        id_motivo_estado
    INTO
        v_id_motivo
    FROM produccion.produccion
    WHERE id_detalle_orden = v_id_detalle
      AND estado_produccion = 'I'
    ORDER BY id_produccion
    LIMIT 1;


    IF v_id_motivo IS NOT NULL THEN

        UPDATE produccion.detalle_orden_produccion
        SET
            cantidad_producida = v_cantidad_producida,
            estado_detalle = 'I',
            id_motivo_estado = v_id_motivo
        WHERE id_detalle_orden = v_id_detalle;

        RETURN COALESCE(NEW, OLD);

    END IF;


    /*
     * Si el detalle fue anulado manualmente,
     * no modificamos su estado automáticamente.
     */
    IF v_estado_actual = 'A' THEN

        UPDATE produccion.detalle_orden_produccion
        SET
            cantidad_producida = v_cantidad_producida
        WHERE id_detalle_orden = v_id_detalle;

        RETURN COALESCE(NEW, OLD);

    END IF;


    /*
     * Si todas las producciones están C
     * y se alcanzó la cantidad solicitada,
     * el detalle queda C.
     */
    IF v_cantidad_producida >= v_cantidad_solicitada
       AND NOT EXISTS (
            SELECT 1
            FROM produccion.produccion
            WHERE id_detalle_orden = v_id_detalle
              AND estado_produccion NOT IN ('C', 'A')
       )
    THEN

        v_estado_producciones := 'C';

    /*
     * Si existe al menos una producción E,
     * el detalle está en ejecución.
     */
    ELSIF EXISTS (
        SELECT 1
        FROM produccion.produccion
        WHERE id_detalle_orden = v_id_detalle
          AND estado_produccion = 'E'
    )
    THEN

        v_estado_producciones := 'E';

    /*
     * Si existe producción C pero todavía
     * no se alcanzó la cantidad solicitada,
     * el detalle continúa en ejecución.
     */
    ELSIF EXISTS (
        SELECT 1
        FROM produccion.produccion
        WHERE id_detalle_orden = v_id_detalle
          AND estado_produccion = 'C'
    )
    THEN

        v_estado_producciones := 'E';

    ELSE

        v_estado_producciones := 'P';

    END IF;


    /*
     * Actualizar detalle.
     */
    UPDATE produccion.detalle_orden_produccion
    SET
        cantidad_producida = v_cantidad_producida,
        estado_detalle = v_estado_producciones
    WHERE id_detalle_orden = v_id_detalle;


    RETURN COALESCE(NEW, OLD);

END;
$$;