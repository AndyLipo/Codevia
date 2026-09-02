CREATE TRIGGER trg_actualizar_detalle_produccion
AFTER INSERT OR UPDATE OF cantidad_producida, estado_produccion
OR DELETE
ON produccion.produccion
FOR EACH ROW
EXECUTE FUNCTION produccion.fn_actualizar_detalle_produccion();