CREATE OR REPLACE FUNCTION deposito.fn_generar_zona_configurada(
    p_id_configuracion_zona INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = deposito, pg_temp
AS $function$
DECLARE
    v_id_deposito INTEGER;
    v_codigo_zona CHAR(1);
    v_usu_alta VARCHAR(50);
BEGIN

    SELECT
        id_deposito,
        codigo_zona,
        usu_alta
    INTO
        v_id_deposito,
        v_codigo_zona,
        v_usu_alta
    FROM deposito.configuracion_zona
    WHERE id_configuracion_zona = p_id_configuracion_zona
      AND estado = 'A';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No existe una configuración activa de zona con ID %',
            p_id_configuracion_zona;
    END IF;


    /*
     * Verificar que el depósito exista.
     */
    IF NOT EXISTS (
        SELECT 1
        FROM deposito.deposito
        WHERE id_deposito = v_id_deposito
          AND estado = 'A'
    ) THEN
        RAISE EXCEPTION
            'El depósito % no existe o no está activo',
            v_id_deposito;
    END IF;


    /*
     * Crear la zona si todavía no existe.
     */
    IF NOT EXISTS (
        SELECT 1
        FROM deposito.zona
        WHERE id_deposito = v_id_deposito
          AND codigo = v_codigo_zona
    ) THEN

        INSERT INTO deposito.zona (
            id_deposito,
            codigo,
            nombre,
            descripcion,
            estado,
            usu_alta
        )
        VALUES (
            v_id_deposito,
            v_codigo_zona,
            'Zona ' || v_codigo_zona,
            'Zona generada automáticamente desde la configuración',
            'A',
            v_usu_alta
        );

    END IF;

END;
$function$;