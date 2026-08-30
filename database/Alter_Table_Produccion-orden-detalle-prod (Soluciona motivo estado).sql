ALTER TABLE produccion.orden_produccion
ADD COLUMN id_motivo_estado INTEGER;
/
ALTER TABLE produccion.orden_produccion
ADD CONSTRAINT fk_orden_produccion_motivo_estado
FOREIGN KEY (id_motivo_estado)
REFERENCES sistema.motivo_estado(id_motivo_estado);
//
ALTER TABLE produccion.detalle_orden_produccion
ADD COLUMN id_motivo_estado INTEGER;
/
ALTER TABLE produccion.detalle_orden_produccion
ADD CONSTRAINT fk_detalle_orden_motivo_estado
FOREIGN KEY (id_motivo_estado)
REFERENCES sistema.motivo_estado(id_motivo_estado);
//
ALTER TABLE produccion.produccion
ADD COLUMN id_motivo_estado INTEGER;
/
ALTER TABLE produccion.produccion
ADD CONSTRAINT fk_produccion_motivo_estado
FOREIGN KEY (id_motivo_estado)
REFERENCES sistema.motivo_estado(id_motivo_estado);