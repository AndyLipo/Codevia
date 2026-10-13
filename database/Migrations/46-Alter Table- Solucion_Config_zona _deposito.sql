ALTER TABLE deposito.configuracion_zona
DROP CONSTRAINT ck_configuracion_zona_codigo;
//

ALTER TABLE deposito.configuracion_zona
ADD CONSTRAINT ck_configuracion_zona_codigo
CHECK (codigo_zona ~ '^[A-Z]$');