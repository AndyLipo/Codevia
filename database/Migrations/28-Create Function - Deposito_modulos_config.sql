CREATE OR REPLACE FUNCTION deposito.fn_generar_modulos_configurados(
    p_id_configuracion_zona INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = deposito, pg_temp
AS $function$
DECLARE
    v_id_configuracion_pasillo INTEGER;
    v_numero_pasillo INTEGER;

    v_id_pasillo INTEGER;

    v_modulos_izquierda INTEGER;
    v_modulos_derecha INTEGER;

    v_numero_modulo INTEGER;
BEGIN

    /*
     * Obtener cantidad de módulos definida para la zona.
     */
    SELECT
        modulos_lado_izquierdo,
        modulos_lado_derecho
    INTO
        v_modulos_izquierda,
        v_modulos_derecha
    FROM deposito.configuracion_zona
    WHERE id_configuracion_zona = p_id_configuracion_zona;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No existe la configuración de zona con ID %',
            p_id_configuracion_zona;
    END IF;


    /*
     * Recorrer cada pasillo configurado.
     */
    FOR
        v_id_configuracion_pasillo,
        v_numero_pasillo
    IN
        SELECT
            id_configuracion_pasillo,
            numero_pasillo
        FROM deposito.configuracion_pasillo
        WHERE id_configuracion_zona = p_id_configuracion_zona
          AND estado = 'A'
        ORDER BY numero_pasillo
    LOOP

        /*
         * Buscar el pasillo físico.
         *
         * Por ahora se busca por:
         * Zona → Pasillo.
         */
        SELECT p.id_pasillo
        INTO v_id_pasillo
        FROM deposito.pasillo p
        JOIN deposito.zona z
            ON z.id_zona = p.id_zona
        JOIN deposito.configuracion_zona cz
            ON cz.id_deposito = z.id_deposito
        WHERE cz.id_configuracion_zona = p_id_configuracion_zona
          AND z.codigo = cz.codigo_zona
          AND p.codigo = 'P' || v_numero_pasillo
        LIMIT 1;


        /*
         * Si todavía no existe el pasillo físico,
         * no podemos generar sus módulos.
         */
        IF v_id_pasillo IS NULL THEN
            CONTINUE;
        END IF;


        /*
         * ============================
         * LADO IZQUIERDO
         * ============================
         */
        IF (
            SELECT lado_izquierdo
            FROM deposito.configuracion_pasillo
            WHERE id_configuracion_pasillo =
                  v_id_configuracion_pasillo
        )
        THEN

            FOR v_numero_modulo IN 1..v_modulos_izquierda LOOP

                INSERT INTO deposito.modulo (
                    id_pasillo,
                    numero,
                    lado,
                    estado,
                    usu_alta
                )
                VALUES (
                    v_id_pasillo,
                    (v_numero_modulo * 2) - 1,
                    'I',
                    'A',
                    (
                        SELECT usu_alta
                        FROM deposito.configuracion_zona
                        WHERE id_configuracion_zona =
                              p_id_configuracion_zona
                    )
                )
                ON CONFLICT (
                    id_pasillo,
                    numero
                )
                DO NOTHING;

            END LOOP;

        END IF;


        /*
         * ============================
         * LADO DERECHO
         * ============================
         */
        IF (
            SELECT lado_derecho
            FROM deposito.configuracion_pasillo
            WHERE id_configuracion_pasillo =
                  v_id_configuracion_pasillo
        )
        THEN

            FOR v_numero_modulo IN 1..v_modulos_derecha LOOP

                INSERT INTO deposito.modulo (
                    id_pasillo,
                    numero,
                    lado,
                    estado,
                    usu_alta
                )
                VALUES (
                    v_id_pasillo,
                    v_numero_modulo * 2,
                    'D',
                    'A',
                    (
                        SELECT usu_alta
                        FROM deposito.configuracion_zona
                        WHERE id_configuracion_zona =
                              p_id_configuracion_zona
                    )
                )
                ON CONFLICT (
                    id_pasillo,
                    numero
                )
                DO NOTHING;

            END LOOP;

        END IF;

    END LOOP;

END;
$function$;