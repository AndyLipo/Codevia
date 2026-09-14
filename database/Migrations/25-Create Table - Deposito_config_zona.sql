CREATE TABLE deposito.configuracion_zona (
    id_configuracion_zona INTEGER GENERATED ALWAYS AS IDENTITY,

    id_deposito INTEGER NOT NULL,

    codigo_zona CHAR(1) NOT NULL,

    cantidad_pasillos INTEGER NOT NULL,
    modulos_lado_izquierdo INTEGER NOT NULL,
    modulos_lado_derecho INTEGER NOT NULL,
    cantidad_niveles INTEGER NOT NULL,

    capacidad_kg NUMERIC(15,3),
    capacidad_m3 NUMERIC(15,3),

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(50) NOT NULL,
    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    usu_mod VARCHAR(50),
    fec_mod TIMESTAMP,

    CONSTRAINT pk_configuracion_zona
        PRIMARY KEY (id_configuracion_zona),

    CONSTRAINT fk_configuracion_zona_deposito
        FOREIGN KEY (id_deposito)
        REFERENCES deposito.deposito(id_deposito),

    CONSTRAINT uq_configuracion_zona
        UNIQUE (id_deposito, codigo_zona),

    CONSTRAINT ck_configuracion_zona_codigo
        CHECK (codigo_zona IN ('A', 'B', 'C')),

    CONSTRAINT ck_configuracion_zona_pasillos
        CHECK (cantidad_pasillos > 0),

    CONSTRAINT ck_configuracion_zona_modulos_izq
        CHECK (modulos_lado_izquierdo >= 0),

    CONSTRAINT ck_configuracion_zona_modulos_der
        CHECK (modulos_lado_derecho >= 0),

    CONSTRAINT ck_configuracion_zona_niveles
        CHECK (cantidad_niveles > 0),

    CONSTRAINT ck_configuracion_zona_algun_lado
        CHECK (
            modulos_lado_izquierdo > 0
            OR
            modulos_lado_derecho > 0
        ),

    CONSTRAINT ck_configuracion_zona_capacidad_kg
        CHECK (
            capacidad_kg IS NULL
            OR capacidad_kg > 0
        ),

    CONSTRAINT ck_configuracion_zona_capacidad_m3
        CHECK (
            capacidad_m3 IS NULL
            OR capacidad_m3 > 0
        ),

    CONSTRAINT ck_configuracion_zona_estado
        CHECK (estado IN ('A', 'I', 'E'))
);