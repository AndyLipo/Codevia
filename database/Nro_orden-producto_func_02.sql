CREATE OR REPLACE FUNCTION produccion.generar_nro_orden()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    NEW.nro_orden := 'OP-' ||
                     LPAD(
                         NEXTVAL('produccion.seq_nro_orden')::TEXT,
                         6,
                         '0'
                     );

    RETURN NEW;

END;
$$;