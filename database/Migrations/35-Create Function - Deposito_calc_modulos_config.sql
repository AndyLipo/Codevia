CREATE OR REPLACE FUNCTION deposito.fn_calcular_modulos_configuracion(
    p_id_configuracion_zona INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = deposito, pg_temp
AS $function$
DECLARE
    v_posiciones_por_pasillo INTEGER;
    v_cantidad_niveles INTEGER;
    v_modulos_totales INTEGER;
    v_modulos_por_lado INTEGER;
BEGIN

    SELECT
        posiciones_por_pasillo,
        cantidad_niveles
    INTO
        v_posiciones_por_pasillo,
        v_cantidad_niveles
    FROM deposito.configuracion_zona
    WHERE id_configuracion_zona = p_id_configuracion_zona
      AND estado = 'A';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No existe una configuración activa con ID %',
            p_id_configuracion_zona;
    END IF;

    IF v_posiciones_por_pasillo IS NULL THEN
        RAISE EXCEPTION
            'La configuración % no tiene posiciones por pasillo',
            p_id_configuracion_zona;
    END IF;

    IF v_cantidad_niveles <= 0 THEN
        RAISE EXCEPTION
            'La cantidad de niveles debe ser mayor que cero';
    END IF;

    IF v_posiciones_por_pasillo % v_cantidad_niveles <> 0 THEN
        RAISE EXCEPTION
            'Las posiciones por pasillo (%) no son divisibles exactamente por los niveles (%)',
            v_posiciones_por_pasillo,
            v_cantidad_niveles;
    END IF;

    v_modulos_totales :=
        v_posiciones_por_pasillo / v_cantidad_niveles;

    IF v_modulos_totales % 2 <> 0 THEN
        RAISE EXCEPTION
            'La cantidad calculada de módulos por pasillo (%) no puede dividirse entre izquierda y derecha',
            v_modulos_totales;
    END IF;

    v_modulos_por_lado :=
        v_modulos_totales / 2;

    UPDATE deposito.configuracion_zona
    SET
        modulos_lado_izquierdo = v_modulos_por_lado,
        modulos_lado_derecho = v_modulos_por_lado,
        usu_mod = usu_alta,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_configuracion_zona = p_id_configuracion_zona;

END;
$function$;