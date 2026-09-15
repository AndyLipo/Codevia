CREATE TABLE deposito.movimiento_lote (
    id_movimiento_lote INTEGER GENERATED ALWAYS AS IDENTITY,
    id_lote_producto INTEGER NOT NULL,

    tipo_movimiento VARCHAR(20) NOT NULL,

    id_posicion_origen INTEGER,
    id_posicion_destino INTEGER,

    fecha_movimiento TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    observacion VARCHAR(250),

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(50) NOT NULL,
    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usu_mod VARCHAR(50),
    fec_mod TIMESTAMP,

    CONSTRAINT pk_movimiento_lote
        PRIMARY KEY (id_movimiento_lote),

    CONSTRAINT fk_movimiento_lote_lote
        FOREIGN KEY (id_lote_producto)
        REFERENCES produccion.lote_producto(id_lote_producto),

    CONSTRAINT fk_movimiento_lote_origen
        FOREIGN KEY (id_posicion_origen)
        REFERENCES deposito.posicion(id_posicion),

    CONSTRAINT fk_movimiento_lote_destino
        FOREIGN KEY (id_posicion_destino)
        REFERENCES deposito.posicion(id_posicion),

    CONSTRAINT ck_movimiento_lote_tipo
        CHECK (
            tipo_movimiento IN (
                'INGRESO',
                'TRASLADO',
                'AGOTAMIENTO',
                'AJUSTE'
            )
        ),

    CONSTRAINT ck_movimiento_lote_estado
        CHECK (estado IN ('A','I','E'))
);