CREATE TABLE sistema.motivo_estado (
    id_motivo_estado INTEGER GENERATED ALWAYS AS IDENTITY,

    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(250),

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(50) NOT NULL,
    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    usu_mod VARCHAR(50),
    fec_mod TIMESTAMP,

    CONSTRAINT pk_motivo_estado
        PRIMARY KEY (id_motivo_estado),

    CONSTRAINT uq_motivo_estado_codigo
        UNIQUE (codigo),

    CONSTRAINT ck_motivo_estado_estado
        CHECK (estado IN ('A','I','E'))
);