CREATE OR REPLACE FUNCTION produccion.generar_codigo_producto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    IF NEW.codigo IS NULL OR TRIM(NEW.codigo) = '' THEN

        NEW.codigo := 'PBP-' ||
                      LPAD(
                          NEXTVAL('produccion.seq_codigo_producto')::TEXT,
                          6,
                          '0'
                      );

    END IF;

    RETURN NEW;

END;
$$;