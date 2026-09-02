CREATE TABLE produccion.unidad_medida (
    id_unidad_medida INTEGER GENERATED ALWAYS AS IDENTITY,

    codigo VARCHAR(20) NOT NULL,

    nombre VARCHAR(100) NOT NULL,

    descripcion VARCHAR(255),

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(20) NOT NULL,

    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    usu_mod VARCHAR(20),

    fec_mod TIMESTAMP,

    CONSTRAINT pk_unidad_medida
        PRIMARY KEY (id_unidad_medida),

    CONSTRAINT uq_unidad_medida_codigo
        UNIQUE (codigo),

    CONSTRAINT chk_unidad_medida_estado
        CHECK (estado IN ('A', 'I', 'E'))
);