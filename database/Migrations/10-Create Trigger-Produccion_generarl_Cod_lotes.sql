CREATE TRIGGER trg_generar_codigo_lote
BEFORE INSERT
ON produccion.lote_producto
FOR EACH ROW
EXECUTE FUNCTION produccion.fn_generar_codigo_lote();