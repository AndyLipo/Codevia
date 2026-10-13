CREATE OR REPLACE FUNCTION deposito.fn_configurar_y_generar_zona(
p_id_deposito INTEGER,
p_codigo_zona CHAR(1),
p_cantidad_pasillos INTEGER,
p_posiciones_por_pasillo INTEGER,
p_cantidad_niveles INTEGER,
p_capacidad_kg NUMERIC,
p_capacidad_m3 NUMERIC,
p_usuario VARCHAR(50)
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path TO 'deposito', 'pg_temp'
AS $function$

DECLARE
v_id_configuracion_zona INTEGER;

BEGIN


-- 1. VALIDACIONES

IF p_id_deposito IS NULL THEN
    RAISE EXCEPTION 'Debe indicar el depósito.';
END IF;

IF p_codigo_zona IS NULL
   OR NOT (UPPER(TRIM(p_codigo_zona)) ~ '^[A-Z]$') THEN
    RAISE EXCEPTION
        'El código de zona debe ser una única letra entre A y Z.';
END IF;

IF p_cantidad_pasillos IS NULL
   OR p_cantidad_pasillos <= 0 THEN
    RAISE EXCEPTION
        'La cantidad de pasillos debe ser mayor a 0.';
END IF;

IF p_posiciones_por_pasillo IS NULL
   OR p_posiciones_por_pasillo <= 0 THEN
    RAISE EXCEPTION
        'La cantidad de posiciones por pasillo debe ser mayor a 0.';
END IF;

IF p_cantidad_niveles IS NULL
   OR p_cantidad_niveles <= 0 THEN
    RAISE EXCEPTION
        'La cantidad de niveles debe ser mayor a 0.';
END IF;

IF p_usuario IS NULL
   OR TRIM(p_usuario) = '' THEN
    RAISE EXCEPTION
        'Debe indicar el usuario que realiza la configuración.';
END IF;


-- 2. VALIDAR DEPÓSITO

IF NOT EXISTS (
    SELECT 1
    FROM deposito
    WHERE id_deposito = p_id_deposito
      AND estado = 'A'
) THEN
    RAISE EXCEPTION
        'El depósito % no existe o no se encuentra activo.',
        p_id_deposito;
END IF;


-- 3. VERIFICAR CONFIGURACIÓN EXISTENTE

SELECT id_configuracion_zona
  INTO v_id_configuracion_zona
  FROM configuracion_zona
 WHERE id_deposito = p_id_deposito
   AND codigo_zona = UPPER(TRIM(p_codigo_zona))
   AND estado = 'A'
 LIMIT 1;


-- 4. EVITAR DUPLICAR CONFIGURACIÓN ACTIVA

IF v_id_configuracion_zona IS NOT NULL THEN
    RAISE EXCEPTION
        'Ya existe una configuración activa para el depósito % y zona % (ID %).',
        p_id_deposito,
        UPPER(TRIM(p_codigo_zona)),
        v_id_configuracion_zona;
END IF;


-- 5. CREAR CONFIGURACIÓN

INSERT INTO configuracion_zona (
    id_deposito,
    codigo_zona,
    cantidad_pasillos,
    posiciones_por_pasillo,
    cantidad_niveles,
    capacidad_kg,
    capacidad_m3,
    estado,
    usu_alta,
    fec_alta
)
VALUES (
    p_id_deposito,
    UPPER(TRIM(p_codigo_zona)),
    p_cantidad_pasillos,
    p_posiciones_por_pasillo,
    p_cantidad_niveles,
    p_capacidad_kg,
    p_capacidad_m3,
    'A',
    p_usuario,
    CURRENT_TIMESTAMP
)
RETURNING id_configuracion_zona
INTO v_id_configuracion_zona;


-- 6. GENERAR TODA LA ESTRUCTURA

PERFORM deposito.fn_generar_estructura_zona(
    v_id_configuracion_zona
);


-- 7. ACTUALIZAR AUDITORÍA

UPDATE configuracion_zona
   SET usu_mod = p_usuario,
       fec_mod = CURRENT_TIMESTAMP
 WHERE id_configuracion_zona = v_id_configuracion_zona;


-- 8. DEVOLVER ID

RETURN v_id_configuracion_zona;


END;

$function$;
