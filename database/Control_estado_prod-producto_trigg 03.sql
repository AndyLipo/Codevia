CREATE TRIGGER trg_control_estado_produccion
BEFORE UPDATE OF estado_produccion
ON produccion.produccion
FOR EACH ROW
EXECUTE FUNCTION produccion.fn_control_estado_produccion();