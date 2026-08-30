ALTER TABLE produccion.produccion
ADD CONSTRAINT ck_produccion_motivo_anulacion
CHECK (
    estado_produccion <> 'A'
    OR id_motivo_estado IS NOT NULL
);

//

ALTER TABLE produccion.detalle_orden_produccion
ADD CONSTRAINT ck_detalle_motivo_estado
CHECK (
    estado_detalle NOT IN ('I','A')
    OR id_motivo_estado IS NOT NULL
);

//

ALTER TABLE produccion.orden_produccion
ADD CONSTRAINT ck_orden_motivo_estado
CHECK (
    estado_op NOT IN ('I','A')
    OR id_motivo_estado IS NOT NULL
);