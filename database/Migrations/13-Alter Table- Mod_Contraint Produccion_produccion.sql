ALTER TABLE produccion.produccion
DROP CONSTRAINT ck_produccion_motivo_anulacion;
//
ALTER TABLE produccion.produccion
ADD CONSTRAINT ck_produccion_motivo_estado
CHECK (
    estado_produccion NOT IN ('I', 'A')
    OR id_motivo_estado IS NOT NULL
);