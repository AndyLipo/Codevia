CREATE OR REPLACE FUNCTION produccion.fn_validar_cantidad_producida()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_cantidad_solicitada NUMERIC;
    v_cantidad_acumulada NUMERIC;
    v_cantidad_anterior NUMERIC;
BEGIN

    -- Obtener la cantidad solicitada del detalle
    SELECT cantidad_solicitada
    INTO v_cantidad_solicitada
    FROM produccion.detalle_orden_produccion
    WHERE id_detalle_orden = NEW.id_detalle_orden;

    -- Si se está modificando una producción existente,
    -- quitamos su cantidad anterior del acumulado.
    v_cantidad_anterior := 0;

    IF TG_OP = 'UPDATE' THEN
        v_cantidad_anterior := OLD.cantidad_producida;
    END IF;

    -- Calcular cuánto se produjo hasta ahora
    SELECT COALESCE(SUM(cantidad_producida), 0)
    INTO v_cantidad_acumulada
    FROM produccion.produccion
    WHERE id_detalle_orden = NEW.id_detalle_orden
      AND estado_produccion <> 'A'
      AND id_produccion <> COALESCE(NEW.id_produccion, -1);

    -- Validar que no se supere lo solicitado
    IF v_cantidad_acumulada + NEW.cantidad_producida
       > v_cantidad_solicitada THEN

        RAISE EXCEPTION
            'La cantidad producida supera la cantidad solicitada. Solicitada: %, acumulada: %, nueva cantidad: %',
            v_cantidad_solicitada,
            v_cantidad_acumulada,
            NEW.cantidad_producida;

    END IF;

    RETURN NEW;
END;
$$;