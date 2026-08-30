CREATE TRIGGER trg_orden_produccion_nro
BEFORE INSERT
ON produccion.orden_produccion
FOR EACH ROW
EXECUTE FUNCTION produccion.generar_nro_orden();