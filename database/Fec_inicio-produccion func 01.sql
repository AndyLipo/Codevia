CREATE OR REPLACE FUNCTION produccion.fn_fecha_inicio_produccion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    IF NEW.estado_produccion = 'E'
       AND OLD.estado_produccion <> 'E' THEN

        NEW.fecha_inicio := CURRENT_TIMESTAMP;

    END IF;

    RETURN NEW;

END;
$$;