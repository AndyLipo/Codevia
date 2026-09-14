CREATE TRIGGER trg_actualizar_estado_orden
AFTER INSERT OR UPDATE OF estado_detalle, cantidad_producida, id_motivo_estado
ON produccion.detalle_orden_produccion
FOR EACH ROW
EXECUTE FUNCTION produccion.fn_actualizar_estado_orden();