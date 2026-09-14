CREATE OR REPLACE FUNCTION produccion.fn_control_vencimiento_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_es_biodegradable BOOLEAN;
    v_vida_util_meses INTEGER;
BEGIN

    SELECT
        es_biodegradable,
        vida_util_meses
    INTO
        v_es_biodegradable,
        v_vida_util_meses
    FROM produccion.producto
    WHERE id_producto = NEW.id_producto;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El producto % no existe.',
            NEW.id_producto;
    END IF;

    -- Producto biodegradable
    IF v_es_biodegradable = TRUE THEN

        IF v_vida_util_meses IS NULL OR v_vida_util_meses <= 0 THEN
            RAISE EXCEPTION
                'El producto % es biodegradable pero no tiene una vida útil válida.',
                NEW.id_producto;
        END IF;

        NEW.fecha_vencimiento :=
            (NEW.fecha_fabricacion + 
             (v_vida_util_meses || ' months')::INTERVAL)::DATE;

    -- Producto no biodegradable
    ELSE
        NEW.fecha_vencimiento := NULL;
    END IF;

    RETURN NEW;
END;
$$;