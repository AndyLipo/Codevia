CREATE OR REPLACE FUNCTION produccion.fn_generar_codigo_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.nro_lote IS NULL OR NEW.nro_lote = '' THEN
        NEW.nro_lote :=
            'LOT-' || LPAD(
                nextval('produccion.seq_codigo_lote')::TEXT,
                6,
                '0'
            );
    END IF;

    RETURN NEW;
END;
$$;