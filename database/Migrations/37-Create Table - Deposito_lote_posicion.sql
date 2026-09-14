CREATE TABLE deposito.lote_posicion (
    id_lote_posicion INTEGER GENERATED ALWAYS AS IDENTITY,

    id_lote_producto INTEGER NOT NULL,
    id_posicion INTEGER NOT NULL,

    fecha_asignacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(50) NOT NULL,
    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    usu_mod VARCHAR(50),
    fec_mod TIMESTAMP,

    CONSTRAINT pk_lote_posicion
        PRIMARY KEY (id_lote_posicion),

    CONSTRAINT fk_lote_posicion_lote
        FOREIGN KEY (id_lote_producto)
        REFERENCES produccion.lote_producto(id_lote_producto),

    CONSTRAINT fk_lote_posicion_posicion
        FOREIGN KEY (id_posicion)
        REFERENCES deposito.posicion(id_posicion),

    CONSTRAINT ck_lote_posicion_estado
        CHECK (estado IN ('A', 'I'))
);