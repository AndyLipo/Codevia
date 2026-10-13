CREATE OR REPLACE FUNCTION deposito.fn_eliminar_zona(
    p_id_deposito INTEGER,
    p_codigo_zona CHAR(1),
    p_usuario VARCHAR(50)
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path TO 'deposito', 'pg_temp'
AS $function$

DECLARE
    v_id_zona INTEGER;
    v_id_configuracion_zona INTEGER;
BEGIN

    ------------------------------------------------------------
    -- 1. VALIDACIONES
    ------------------------------------------------------------

    IF p_id_deposito IS NULL THEN
        RAISE EXCEPTION 'Debe indicar el depósito.';
    END IF;

    IF p_codigo_zona IS NULL
       OR NOT (UPPER(TRIM(p_codigo_zona)) ~ '^[A-Z]$') THEN
        RAISE EXCEPTION
            'El código de zona debe ser una única letra entre A y Z.';
    END IF;

    IF p_usuario IS NULL
       OR TRIM(p_usuario) = '' THEN
        RAISE EXCEPTION
            'Debe indicar el usuario que realiza la eliminación.';
    END IF;


    ------------------------------------------------------------
    -- 2. BUSCAR ZONA
    ------------------------------------------------------------

    SELECT id_zona
      INTO v_id_zona
      FROM zona
     WHERE id_deposito = p_id_deposito
       AND codigo = UPPER(TRIM(p_codigo_zona))
     LIMIT 1;


    IF v_id_zona IS NULL THEN
        RAISE EXCEPTION
            'No existe la zona % en el depósito %.',
            UPPER(TRIM(p_codigo_zona)),
            p_id_deposito;
    END IF;


    ------------------------------------------------------------
    -- 3. BUSCAR CONFIGURACIÓN
    ------------------------------------------------------------

    SELECT id_configuracion_zona
      INTO v_id_configuracion_zona
      FROM configuracion_zona
     WHERE id_deposito = p_id_deposito
       AND codigo_zona = UPPER(TRIM(p_codigo_zona))
     LIMIT 1;


    IF v_id_configuracion_zona IS NULL THEN
        RAISE EXCEPTION
            'La zona % existe físicamente pero no posee configuración.',
            UPPER(TRIM(p_codigo_zona));
    END IF;


    ------------------------------------------------------------
    -- 4. VERIFICAR LOTES ASOCIADOS A LAS POSICIONES
    ------------------------------------------------------------

    IF EXISTS (
        SELECT 1
        FROM lote_posicion lp
        JOIN posicion pos
          ON pos.id_posicion = lp.id_posicion
        JOIN nivel n
          ON n.id_nivel = pos.id_nivel
        JOIN modulo m
          ON m.id_modulo = n.id_modulo
        JOIN pasillo p
          ON p.id_pasillo = m.id_pasillo
        WHERE p.id_zona = v_id_zona
    ) THEN

        RAISE EXCEPTION
            'No se puede eliminar la zona %. Existen registros de lotes asociados a sus posiciones.',
            UPPER(TRIM(p_codigo_zona));

    END IF;


    ------------------------------------------------------------
    -- 5. VERIFICAR HISTORIAL DE MOVIMIENTOS
    ------------------------------------------------------------

    IF EXISTS (
        SELECT 1
        FROM movimiento_lote ml
        WHERE ml.id_posicion_origen IN (
            SELECT pos.id_posicion
            FROM posicion pos
            JOIN nivel n
              ON n.id_nivel = pos.id_nivel
            JOIN modulo m
              ON m.id_modulo = n.id_modulo
            JOIN pasillo p
              ON p.id_pasillo = m.id_pasillo
            WHERE p.id_zona = v_id_zona
        )
        OR ml.id_posicion_destino IN (
            SELECT pos.id_posicion
            FROM posicion pos
            JOIN nivel n
              ON n.id_nivel = pos.id_nivel
            JOIN modulo m
              ON m.id_modulo = n.id_modulo
            JOIN pasillo p
              ON p.id_pasillo = m.id_pasillo
            WHERE p.id_zona = v_id_zona
        )
    ) THEN

        RAISE EXCEPTION
            'No se puede eliminar la zona %. Existen movimientos registrados sobre sus posiciones.',
            UPPER(TRIM(p_codigo_zona));

    END IF;


    ------------------------------------------------------------
    -- 6. ELIMINAR POSICIONES
    ------------------------------------------------------------

    DELETE FROM posicion
    WHERE id_nivel IN (
        SELECT n.id_nivel
        FROM nivel n
        JOIN modulo m
          ON m.id_modulo = n.id_modulo
        JOIN pasillo p
          ON p.id_pasillo = m.id_pasillo
        WHERE p.id_zona = v_id_zona
    );


    ------------------------------------------------------------
    -- 7. ELIMINAR NIVELES
    ------------------------------------------------------------

    DELETE FROM nivel
    WHERE id_modulo IN (
        SELECT m.id_modulo
        FROM modulo m
        JOIN pasillo p
          ON p.id_pasillo = m.id_pasillo
        WHERE p.id_zona = v_id_zona
    );


    ------------------------------------------------------------
    -- 8. ELIMINAR MÓDULOS
    ------------------------------------------------------------

    DELETE FROM modulo
    WHERE id_pasillo IN (
        SELECT id_pasillo
        FROM pasillo
        WHERE id_zona = v_id_zona
    );


    ------------------------------------------------------------
    -- 9. ELIMINAR PASILLOS
    ------------------------------------------------------------

    DELETE FROM pasillo
    WHERE id_zona = v_id_zona;


    ------------------------------------------------------------
    -- 10. ELIMINAR CONFIGURACIÓN DE PASILLOS
    ------------------------------------------------------------

    DELETE FROM configuracion_pasillo
    WHERE id_configuracion_zona = v_id_configuracion_zona;


    ------------------------------------------------------------
    -- 11. ELIMINAR ZONA
    ------------------------------------------------------------

    DELETE FROM zona
    WHERE id_zona = v_id_zona;


    ------------------------------------------------------------
    -- 12. ELIMINAR CONFIGURACIÓN
    ------------------------------------------------------------

    DELETE FROM configuracion_zona
    WHERE id_configuracion_zona = v_id_configuracion_zona;


END;

$function$;