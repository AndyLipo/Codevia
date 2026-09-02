CREATE TRIGGER trg_fecha_inicio_produccion
BEFORE UPDATE OF estado_produccion
ON produccion.produccion
FOR EACH ROW
EXECUTE FUNCTION produccion.fn_fecha_inicio_produccion();