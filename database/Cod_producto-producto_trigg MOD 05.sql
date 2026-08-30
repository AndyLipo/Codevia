CREATE OR REPLACE FUNCTION produccion.generar_codigo_producto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    NEW.codigo := 'PBP-' ||
                  LPAD(
                      NEXTVAL('produccion.seq_codigo_producto')::TEXT,
                      6,
                      '0'
                  );

    RETURN NEW;

END;
$$;