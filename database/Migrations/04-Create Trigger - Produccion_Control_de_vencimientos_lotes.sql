CREATE TRIGGER trg_control_vencimiento_lote
BEFORE INSERT OR UPDATE OF id_producto, fecha_fabricacion
ON produccion.lote_producto
FOR EACH ROW
EXECUTE FUNCTION produccion.fn_control_vencimiento_lote();