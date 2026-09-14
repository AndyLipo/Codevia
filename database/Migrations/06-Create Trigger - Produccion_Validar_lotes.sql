CREATE TRIGGER trg_validar_lote
BEFORE INSERT OR UPDATE OF id_produccion, id_producto, cantidad_total, fecha_fabricacion
ON produccion.lote_producto
FOR EACH ROW
EXECUTE FUNCTION produccion.fn_validar_lote();