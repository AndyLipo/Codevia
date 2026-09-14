Select * from produccion.producto

ALTER TABLE produccion.producto
ADD COLUMN vida_util_meses INTEGER;

//

ALTER TABLE produccion.producto
ADD CONSTRAINT ck_producto_vida_util
CHECK (
    (es_biodegradable = TRUE AND vida_util_meses IS NOT NULL AND vida_util_meses > 0)
    OR
    (es_biodegradable = FALSE AND vida_util_meses IS NULL)
);