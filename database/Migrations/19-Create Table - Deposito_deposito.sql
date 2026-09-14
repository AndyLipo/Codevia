CREATE TABLE deposito.deposito (
    id_deposito INTEGER GENERATED ALWAYS AS IDENTITY,
    
    codigo VARCHAR(20) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(250),

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(50) NOT NULL,
    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    usu_mod VARCHAR(50),
    fec_mod TIMESTAMP,

    CONSTRAINT pk_deposito
        PRIMARY KEY (id_deposito),

    CONSTRAINT uq_deposito_codigo
        UNIQUE (codigo),

    CONSTRAINT ck_deposito_estado
        CHECK (estado IN ('A', 'I', 'E'))
);