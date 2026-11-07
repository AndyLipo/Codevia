ALTER TABLE logistica.hoja_ruta
ADD COLUMN estado_hoja_ruta CHAR(1) NOT NULL DEFAULT 'P';

ALTER TABLE logistica.hoja_ruta
ADD CONSTRAINT ck_hoja_ruta_estado_operativo
CHECK (estado_hoja_ruta IN ('P', 'D'));