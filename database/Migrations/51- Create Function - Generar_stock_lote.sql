CREATE OR REPLACE FUNCTION deposito.fn_generar_stock_lote(
    p_id_lote_producto INTEGER,
    p_usuario VARCHAR(50)
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = deposito, pg_temp
AS $function$
BEGIN

    -- Validar que el lote exista
    IF NOT EXISTS (
        SELECT 1
        FROM produccion.lote_producto
        WHERE id_lote_producto = p_id_lote_producto
    ) THEN
        RAISE EXCEPTION
            'No existe el lote de producto con ID %',
            p_id_lote_producto;
    END IF;

    -- Validar usuario
    IF p_usuario IS NULL OR TRIM(p_usuario) = '' THEN
        RAISE EXCEPTION
            'El usuario es obligatorio para generar el stock';
    END IF;

    -- Evitar duplicar stock
    IF EXISTS (
        SELECT 1
        FROM deposito.stock
        WHERE id_lote_producto = p_id_lote_producto
    ) THEN
        RAISE EXCEPTION
            'El lote % ya posee un registro de stock',
            p_id_lote_producto;
    END IF;

    -- Crear stock inicial
    INSERT INTO deposito.stock (
        id_lote_producto,
        cantidad_reservada,
        cantidad_consumida,
        estado,
        usu_alta
    )
    VALUES (
        p_id_lote_producto,
        0,
        0,
        'A',
        p_usuario
    );

END;
$function$;