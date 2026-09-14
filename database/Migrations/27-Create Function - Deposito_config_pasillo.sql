CREATE OR REPLACE FUNCTION deposito.fn_generar_configuracion_pasillos(
    p_id_configuracion_zona INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = deposito, pg_temp
AS $function$
DECLARE
    v_cantidad_pasillos INTEGER;
    v_id_pasillo INTEGER;
    v_numero INTEGER;
BEGIN

    /*
     * Obtener la cantidad de pasillos configurada
     */
    SELECT cantidad_pasillos
    INTO v_cantidad_pasillos
    FROM deposito.configuracion_zona
    WHERE id_configuracion_zona = p_id_configuracion_zona;

    /*
     * Validar que exista la configuración
     */
    IF v_cantidad_pasillos IS NULL THEN
        RAISE EXCEPTION
            'No existe la configuración de zona con ID %',
            p_id_configuracion_zona;
    END IF;

    /*
     * Generar los pasillos configurados.
     */
    FOR v_numero IN 1..v_cantidad_pasillos LOOP

        INSERT INTO deposito.configuracion_pasillo (
            id_configuracion_zona,
            numero_pasillo,
            lado_izquierdo,
            lado_derecho,
            estado,
            usu_alta
        )
        SELECT
            p_id_configuracion_zona,
            v_numero,
            TRUE,
            TRUE,
            'A',
            cz.usu_alta
        FROM deposito.configuracion_zona cz
        WHERE cz.id_configuracion_zona = p_id_configuracion_zona
        ON CONFLICT (
            id_configuracion_zona,
            numero_pasillo
        )
        DO NOTHING;

    END LOOP;

END;
$function$;