CREATE OR REPLACE FUNCTION produccion.fn_validar_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_producto INTEGER;
    v_cantidad_producida NUMERIC;
    v_estado_produccion CHAR(1);
    v_fecha_fin TIMESTAMP;
BEGIN

    SELECT
        id_detalle_orden,
        cantidad_producida,
        estado_produccion,
        fecha_fin
    INTO
        v_id_producto,
        v_cantidad_producida,
        v_estado_produccion,
        v_fecha_fin
    FROM produccion.produccion
    WHERE id_produccion = NEW.id_produccion;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'La producción % no existe.',
            NEW.id_produccion;
    END IF;

    -- La producción debe estar completada
    IF v_estado_produccion <> 'C' THEN
        RAISE EXCEPTION
            'No se puede generar el lote. La producción % no está completada.',
            NEW.id_produccion;
    END IF;

    -- Validar producto
    SELECT d.id_producto
    INTO v_id_producto
    FROM produccion.produccion pr
    INNER JOIN produccion.detalle_orden_produccion d
        ON d.id_detalle_orden = pr.id_detalle_orden
    WHERE pr.id_produccion = NEW.id_produccion;

    IF NEW.id_producto <> v_id_producto THEN
        RAISE EXCEPTION
            'El producto del lote no coincide con el producto de la producción %.',
            NEW.id_produccion;
    END IF;

    -- Validar cantidad
    IF NEW.cantidad_total <> v_cantidad_producida THEN
        RAISE EXCEPTION
            'La cantidad del lote (%) no coincide con la cantidad producida (%).',
            NEW.cantidad_total,
            v_cantidad_producida;
    END IF;

    -- La fecha de fabricación debe ser la fecha de finalización
    IF v_fecha_fin IS NULL THEN
        RAISE EXCEPTION
            'La producción % está completada pero no posee fecha de finalización.',
            NEW.id_produccion;
    END IF;

    NEW.fecha_fabricacion := v_fecha_fin;

    RETURN NEW;
END;
$$;