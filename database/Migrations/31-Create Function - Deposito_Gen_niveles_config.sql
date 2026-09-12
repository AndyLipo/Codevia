CREATE OR REPLACE FUNCTION deposito.fn_generar_niveles_configurados(
    p_id_configuracion_zona INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = deposito, pg_temp
AS $function$
DECLARE
    v_cantidad_niveles INTEGER;
    v_usu_alta VARCHAR(50);

    v_id_modulo INTEGER;
    v_numero_nivel INTEGER;
BEGIN

    /*
     * Obtener la configuración de niveles de la zona.
     */
    SELECT
        cantidad_niveles,
        usu_alta
    INTO
        v_cantidad_niveles,
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
     * Recorrer todos los módulos físicos de la zona.
     */
    FOR v_id_modulo IN
        SELECT m.id_modulo
        FROM deposito.modulo m
        JOIN deposito.pasillo p
            ON p.id_pasillo = m.id_pasillo
        JOIN deposito.zona z
            ON z.id_zona = p.id_zona
        JOIN deposito.configuracion_zona cz
            ON cz.id_deposito = z.id_deposito
           AND cz.codigo_zona = z.codigo
        WHERE cz.id_configuracion_zona = p_id_configuracion_zona
          AND m.estado = 'A'
        ORDER BY
            p.codigo,
            m.numero
    LOOP

        /*
         * Generar los niveles del módulo.
         */
        FOR v_numero_nivel IN 1..v_cantidad_niveles LOOP

            INSERT INTO deposito.nivel (
                id_modulo,
                numero,
                nombre,
                descripcion,
                estado,
                usu_alta
            )
            VALUES (
                v_id_modulo,
                v_numero_nivel,
                'Nivel ' || v_numero_nivel,
                CASE
                    WHEN v_numero_nivel = 1
                        THEN 'Nivel de piso'
                    ELSE
                        'Nivel elevado ' || (v_numero_nivel - 1)
                END,
                'A',
                v_usu_alta
            )
            ON CONFLICT (
                id_modulo,
                numero
            )
            DO NOTHING;

        END LOOP;

    END LOOP;

END;
$function$;