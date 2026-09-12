ALTER TABLE produccion.produccion
DROP CONSTRAINT ck_produccion_estado;

ALTER TABLE produccion.produccion
ADD CONSTRAINT ck_produccion_estado
CHECK (
    estado_produccion IN ('P', 'E', 'I', 'C', 'A')
);