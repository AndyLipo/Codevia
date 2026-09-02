CREATE OR REPLACE FUNCTION produccion.fn_actualizar_detalle_produccion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_detalle INTEGER;
    v_cantidad_solicitada NUMERIC;
    v_cantidad_producida NUMERIC;
    v_estado_actual CHAR(1);
    v_nuevo_estado CHAR(1);
BEGIN

    -- Determinar qué detalle debemos actualizar
    IF TG_OP = 'DELETE' THEN
        v_id_detalle := OLD.id_detalle_orden;
    ELSE
        v_id_detalle := NEW.id_detalle_orden;
    END IF;

    -- Obtener información actual del detalle
    SELECT
        cantidad_solicitada,
        estado_detalle
    INTO
        v_cantidad_solicitada,
        v_estado_actual
    FROM produccion.detalle_orden_produccion
    WHERE id_detalle_orden = v_id_detalle;

    -- Calcular producción acumulada
    SELECT COALESCE(SUM(cantidad_producida), 0)
    INTO v_cantidad_producida
    FROM produccion.produccion
    WHERE id_detalle_orden = v_id_detalle
      AND estado_produccion <> 'A';

    -- Determinar nuevo estado
    IF v_cantidad_producida = 0 THEN
        v_nuevo_estado := 'P';

    ELSIF v_cantidad_producida >= v_cantidad_solicitada THEN
        v_nuevo_estado := 'C';

    ELSIF v_estado_actual = 'I' THEN
        -- Mantener incompleto hasta que un responsable
        -- lo vuelva a habilitar explícitamente.
        v_nuevo_estado := 'I';

    ELSE
        v_nuevo_estado := 'E';
    END IF;

    -- Actualizar el detalle
    UPDATE produccion.detalle_orden_produccion
    SET
        cantidad_producida = v_cantidad_producida,
        estado_detalle = v_nuevo_estado
    WHERE id_detalle_orden = v_id_detalle;

    RETURN COALESCE(NEW, OLD);
END;
$$;