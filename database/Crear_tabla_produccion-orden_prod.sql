CREATE TABLE produccion.orden_produccion (
    id_orden_produccion INTEGER GENERATED ALWAYS AS IDENTITY,

    nro_orden VARCHAR(15) NOT NULL,

    fecha_orden TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    id_solicitante INTEGER NOT NULL,

    estado_op CHAR(1) NOT NULL DEFAULT 'P',

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(50) NOT NULL,

    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    usu_mod VARCHAR(50),

    fec_mod TIMESTAMP,

    CONSTRAINT pk_orden_produccion
        PRIMARY KEY (id_orden_produccion),

    CONSTRAINT uq_orden_produccion_nro
        UNIQUE (nro_orden),

    CONSTRAINT fk_orden_produccion_solicitante
        FOREIGN KEY (id_solicitante)
        REFERENCES usuarios.usuarios(id_usuario),

    CONSTRAINT ck_orden_produccion_estado_op
		CHECK (estado_op IN ('P','T','D','E','I','C','A'));
    CONSTRAINT ck_orden_produccion_estado
        CHECK (estado IN ('A','I','E'))
);