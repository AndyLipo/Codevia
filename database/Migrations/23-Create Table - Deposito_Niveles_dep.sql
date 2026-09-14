CREATE TABLE deposito.nivel (
    id_nivel INTEGER GENERATED ALWAYS AS IDENTITY,

    id_modulo INTEGER NOT NULL,

    numero INTEGER NOT NULL,

    nombre VARCHAR(100),
    descripcion VARCHAR(250),

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(50) NOT NULL,
    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    usu_mod VARCHAR(50),
    fec_mod TIMESTAMP,

    CONSTRAINT pk_nivel
        PRIMARY KEY (id_nivel),

    CONSTRAINT fk_nivel_modulo
        FOREIGN KEY (id_modulo)
        REFERENCES deposito.modulo(id_modulo),

    CONSTRAINT uq_nivel_modulo_numero
        UNIQUE (id_modulo, numero),

    CONSTRAINT ck_nivel_numero
        CHECK (numero > 0),

    CONSTRAINT ck_nivel_estado
        CHECK (estado IN ('A', 'I', 'E'))
);