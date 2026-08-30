CREATE TRIGGER trg_producto_codigo
BEFORE INSERT
ON produccion.producto
FOR EACH ROW
EXECUTE FUNCTION produccion.generar_codigo_producto();