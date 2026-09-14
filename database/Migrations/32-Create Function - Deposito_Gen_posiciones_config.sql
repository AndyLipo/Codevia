CREATE OR REPLACE FUNCTION deposito.fn_generar_posiciones_configuradas(
    p_id_configuracion_zona INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = deposito, pg_temp
AS $function$
DECLARE
    v_codigo_zona CHAR(1);
    v_usu_alta VARCHAR(50);

    v_id_nivel INTEGER;
    v_codigo_pasillo VARCHAR(10);
    v_numero_modulo INTEGER;
    v_numero_nivel INTEGER;
BEGIN

    /*
     * Obtener datos de la configuración.
     */
    SELECT
        codigo_zona,
        usu_alta
    INTO
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
     * Recorrer todos los niveles de los módulos
     * pertenecientes a la zona configurada.
     */
    FOR
        v_id_nivel,
        v_codigo_pasillo,
        v_numero_modulo,
        v_numero_nivel
    IN
        SELECT
            n.id_nivel,
            p.codigo,
            m.numero,
            n.numero
        FROM deposito.nivel n
        JOIN deposito.modulo m
            ON m.id_modulo = n.id_modulo
        JOIN deposito.pasillo p
            ON p.id_pasillo = m.id_pasillo
        JOIN deposito.zona z
            ON z.id_zona = p.id_zona
        JOIN deposito.configuracion_zona cz
            ON cz.id_deposito = z.id_deposito
           AND cz.codigo_zona = z.codigo
        WHERE cz.id_configuracion_zona = p_id_configuracion_zona
          AND n.estado = 'A'
          AND m.estado = 'A'
          AND p.estado = 'A'
          AND z.estado = 'A'
        ORDER BY
            p.codigo,
            m.numero,
            n.numero
    LOOP

        /*
         * Crear la posición si todavía no existe.
         */
        INSERT INTO deposito.posicion (
            id_nivel,
            codigo,
            capacidad_kg,
            capacidad_m3,
            estado_posicion,
            estado,
            usu_alta
        )
        VALUES (
            v_id_nivel,

            v_codigo_zona
                || '-'
                || v_codigo_pasillo
                || '-'
                || LPAD(v_numero_modulo::TEXT, 2, '0')
                || '-N'
                || v_numero_nivel,

            NULL,
            NULL,

            'D',
            'A',

            v_usu_alta
        )
        ON CONFLICT (
            id_nivel,
            codigo
        )
        DO NOTHING;

    END LOOP;

END;
$function$;