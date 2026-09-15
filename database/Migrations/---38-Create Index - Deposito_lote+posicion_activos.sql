CREATE UNIQUE INDEX uq_lote_posicion_lote_activo
ON deposito.lote_posicion (id_lote_producto)
WHERE estado = 'A';


CREATE UNIQUE INDEX uq_lote_posicion_posicion_activa
ON deposito.lote_posicion (id_posicion)
WHERE estado = 'A';