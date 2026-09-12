CREATE TABLE deposito.modulo (
    id_modulo INTEGER GENERATED ALWAYS AS IDENTITY,

    id_pasillo INTEGER NOT NULL,

    numero INTEGER NOT NULL,
    lado CHAR(1) NOT NULL,

    nombre VARCHAR(100),
    descripcion VARCHAR(250),

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(50) NOT NULL,
    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    usu_mod VARCHAR(50),
    fec_mod TIMESTAMP,

    CONSTRAINT pk_modulo
        PRIMARY KEY (id_modulo),

    CONSTRAINT fk_modulo_pasillo
        FOREIGN KEY (id_pasillo)
        REFERENCES deposito.pasillo(id_pasillo),

    CONSTRAINT uq_modulo_pasillo_numero
        UNIQUE (id_pasillo, numero),

    CONSTRAINT ck_modulo_numero
        CHECK (numero > 0),

    CONSTRAINT ck_modulo_lado
        CHECK (lado IN ('I', 'D')),

    CONSTRAINT ck_modulo_paridad_lado
        CHECK (
            (lado = 'I' AND numero % 2 <> 0)
            OR
            (lado = 'D' AND numero % 2 = 0)
        ),

    CONSTRAINT ck_modulo_estado
        CHECK (estado IN ('A', 'I', 'E'))
);