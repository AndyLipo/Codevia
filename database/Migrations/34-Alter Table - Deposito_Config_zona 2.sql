ALTER TABLE deposito.configuracion_zona
ADD CONSTRAINT ck_configuracion_zona_posiciones
CHECK (
    posiciones_por_pasillo IS NULL
    OR posiciones_por_pasillo > 0
);