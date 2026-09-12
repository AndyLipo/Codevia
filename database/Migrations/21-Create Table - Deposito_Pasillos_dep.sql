CREATE TABLE deposito.pasillo (
    id_pasillo INTEGER GENERATED ALWAYS AS IDENTITY,

    id_zona INTEGER NOT NULL,

    codigo VARCHAR(10) NOT NULL,
    nombre VARCHAR(100),
    descripcion VARCHAR(250),

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(50) NOT NULL,
    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    usu_mod VARCHAR(50),
    fec_mod TIMESTAMP,

    CONSTRAINT pk_pasillo
        PRIMARY KEY (id_pasillo),

    CONSTRAINT fk_pasillo_zona
        FOREIGN KEY (id_zona)
        REFERENCES deposito.zona(id_zona),

    CONSTRAINT uq_pasillo_zona_codigo
        UNIQUE (id_zona, codigo),

    CONSTRAINT ck_pasillo_codigo
        CHECK (codigo ~ '^P[0-9]+$'),

    CONSTRAINT ck_pasillo_estado
        CHECK (estado IN ('A', 'I', 'E'))
);