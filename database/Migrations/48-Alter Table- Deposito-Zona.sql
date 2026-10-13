ALTER TABLE deposito.zona
DROP CONSTRAINT ck_zona_codigo;

ALTER TABLE deposito.zona
ADD CONSTRAINT ck_zona_codigo
CHECK (codigo ~ '^[A-Z]$');