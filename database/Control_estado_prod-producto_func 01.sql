CREATE OR REPLACE FUNCTION produccion.fn_control_estado_produccion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    -- Cuando comienza la producción
    IF NEW.estado_produccion = 'E'
       AND OLD.estado_produccion <> 'E' THEN

        NEW.fecha_inicio := CURRENT_TIMESTAMP;
        NEW.fecha_fin := NULL;

    END IF;

    -- Cuando finaliza la producción
    IF NEW.estado_produccion = 'C'
       AND OLD.estado_produccion <> 'C' THEN

        IF NEW.fecha_inicio IS NULL THEN
            NEW.fecha_inicio := CURRENT_TIMESTAMP;
        END IF;

        NEW.fecha_fin := CURRENT_TIMESTAMP;

    END IF;

    RETURN NEW;

END;
$$;