CREATE TABLE deposito.zona (
    id_zona INTEGER GENERATED ALWAYS AS IDENTITY,

    id_deposito INTEGER NOT NULL,

    codigo VARCHAR(10) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(250),

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(50) NOT NULL,
    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    usu_mod VARCHAR(50),
    fec_mod TIMESTAMP,

    CONSTRAINT pk_zona
        PRIMARY KEY (id_zona),

    CONSTRAINT fk_zona_deposito
        FOREIGN KEY (id_deposito)
        REFERENCES deposito.deposito(id_deposito),

    CONSTRAINT uq_zona_deposito_codigo
        UNIQUE (id_deposito, codigo),

    CONSTRAINT ck_zona_codigo
        CHECK (codigo IN ('A', 'B', 'C')),

    CONSTRAINT ck_zona_estado
        CHECK (estado IN ('A', 'I', 'E'))
);