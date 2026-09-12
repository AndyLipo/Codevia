CREATE OR REPLACE FUNCTION deposito.fn_generar_estructura_zona(
    p_id_configuracion_zona INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = deposito, pg_temp
AS $function$
BEGIN

    -- 1. Calcular módulos según posiciones y niveles
    PERFORM deposito.fn_calcular_modulos_configuracion(
        p_id_configuracion_zona
    );

    -- 2. Crear la zona física
    PERFORM deposito.fn_generar_zona_configurada(
        p_id_configuracion_zona
    );

    -- 3. Generar la configuración de pasillos
    PERFORM deposito.fn_generar_configuracion_pasillos(
        p_id_configuracion_zona
    );

    -- 4. Crear los pasillos físicos
    PERFORM deposito.fn_generar_pasillos_configurados(
        p_id_configuracion_zona
    );

    -- 5. Crear los módulos
    PERFORM deposito.fn_generar_modulos_configurados(
        p_id_configuracion_zona
    );

    -- 6. Crear los niveles
    PERFORM deposito.fn_generar_niveles_configurados(
        p_id_configuracion_zona
    );

    -- 7. Crear las posiciones
    PERFORM deposito.fn_generar_posiciones_configuradas(
        p_id_configuracion_zona
    );

END;
$function$;