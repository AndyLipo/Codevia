CREATE TRIGGER trg_validar_cantidad_producida
BEFORE INSERT OR UPDATE OF cantidad_producida, estado_produccion
ON produccion.produccion
FOR EACH ROW
EXECUTE FUNCTION produccion.fn_validar_cantidad_producida();