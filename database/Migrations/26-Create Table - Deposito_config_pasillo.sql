CREATE TABLE deposito.configuracion_pasillo (
    id_configuracion_pasillo INTEGER GENERATED ALWAYS AS IDENTITY,

    id_configuracion_zona INTEGER NOT NULL,

    numero_pasillo INTEGER NOT NULL,

    lado_izquierdo BOOLEAN NOT NULL DEFAULT TRUE,
    lado_derecho BOOLEAN NOT NULL DEFAULT TRUE,

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(50) NOT NULL,
    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    usu_mod VARCHAR(50),
    fec_mod TIMESTAMP,

    CONSTRAINT pk_configuracion_pasillo
        PRIMARY KEY (id_configuracion_pasillo),

    CONSTRAINT fk_configuracion_pasillo_config_zona
        FOREIGN KEY (id_configuracion_zona)
        REFERENCES deposito.configuracion_zona(id_configuracion_zona),

    CONSTRAINT uq_configuracion_pasillo_numero
        UNIQUE (id_configuracion_zona, numero_pasillo),

    CONSTRAINT ck_configuracion_pasillo_numero
        CHECK (numero_pasillo > 0),

    CONSTRAINT ck_configuracion_pasillo_algun_lado
        CHECK (
            lado_izquierdo = TRUE
            OR
            lado_derecho = TRUE
        ),

    CONSTRAINT ck_configuracion_pasillo_estado
        CHECK (estado IN ('A', 'I', 'E'))
);