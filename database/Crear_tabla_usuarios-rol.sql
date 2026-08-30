CREATE TABLE usuarios.roles (
    id_rol INTEGER GENERATED ALWAYS AS IDENTITY,

    nombre VARCHAR(100) NOT NULL,

    descripcion VARCHAR(255),

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(20) NOT NULL,

    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    usu_mod VARCHAR(20),

    fec_mod TIMESTAMP,

    CONSTRAINT pk_rol
        PRIMARY KEY (id_rol),

    CONSTRAINT chk_rol_estado
        CHECK (estado IN ('A', 'I', 'E'))
);