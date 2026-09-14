CREATE OR REPLACE FUNCTION deposito.fn_generar_pasillos_configurados(
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
    v_id_zona INTEGER;

    v_numero_pasillo INTEGER;
BEGIN

    /*
     * Obtener la configuración de la zona.
     */
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
     * Buscar la zona física.
     */
    SELECT id_zona
    INTO v_id_zona
    FROM deposito.zona
    WHERE id_deposito = v_id_deposito
      AND codigo = v_codigo_zona
      AND estado = 'A';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No existe la zona física % para el depósito %',
            v_codigo_zona,
            v_id_deposito;
    END IF;


    /*
     * Recorrer los pasillos configurados.
     */
    FOR v_numero_pasillo IN
        SELECT numero_pasillo
        FROM deposito.configuracion_pasillo
        WHERE id_configuracion_zona = p_id_configuracion_zona
          AND estado = 'A'
        ORDER BY numero_pasillo
    LOOP

        /*
         * Crear el pasillo si todavía no existe.
         */
        IF NOT EXISTS (
            SELECT 1
            FROM deposito.pasillo
            WHERE id_zona = v_id_zona
              AND codigo = 'P' || v_numero_pasillo
        ) THEN

            INSERT INTO deposito.pasillo (
                id_zona,
                codigo,
                nombre,
                descripcion,
                estado,
                usu_alta
            )
            VALUES (
                v_id_zona,
                'P' || v_numero_pasillo,
                'Pasillo ' || v_numero_pasillo,
                'Pasillo generado automáticamente desde la configuración',
                'A',
                v_usu_alta
            );

        END IF;

    END LOOP;

END;
$function$;