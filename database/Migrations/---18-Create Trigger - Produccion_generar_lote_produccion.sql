CREATE TRIGGER trg_generar_lote_produccion
AFTER UPDATE OF estado_produccion
ON produccion.produccion
FOR EACH ROW
EXECUTE FUNCTION produccion.fn_generar_lote_produccion();