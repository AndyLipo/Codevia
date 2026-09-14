CREATE TABLE deposito.posicion (
    id_posicion INTEGER GENERATED ALWAYS AS IDENTITY,

    id_nivel INTEGER NOT NULL,

    codigo VARCHAR(30) NOT NULL,

    capacidad_kg NUMERIC(15,3),
    capacidad_m3 NUMERIC(15,3),

    estado_posicion CHAR(1) NOT NULL DEFAULT 'D',

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(50) NOT NULL,
    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    usu_mod VARCHAR(50),
    fec_mod TIMESTAMP,

    CONSTRAINT pk_posicion
        PRIMARY KEY (id_posicion),

    CONSTRAINT fk_posicion_nivel
        FOREIGN KEY (id_nivel)
        REFERENCES deposito.nivel(id_nivel),

    CONSTRAINT uq_posicion_nivel_codigo
        UNIQUE (id_nivel, codigo),

    CONSTRAINT ck_posicion_capacidad_kg
        CHECK (
            capacidad_kg IS NULL
            OR capacidad_kg > 0
        ),

    CONSTRAINT ck_posicion_capacidad_m3
        CHECK (
            capacidad_m3 IS NULL
            OR capacidad_m3 > 0
        ),

    CONSTRAINT ck_posicion_estado
        CHECK (
            estado_posicion IN ('D', 'O', 'R', 'B', 'M')
        ),

    CONSTRAINT ck_posicion_estado_admin
        CHECK (
            estado IN ('A', 'I', 'E')
        )
);