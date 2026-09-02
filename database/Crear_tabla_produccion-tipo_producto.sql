CREATE TABLE produccion.tipo_producto (
    id_tipo_producto INTEGER GENERATED ALWAYS AS IDENTITY,

    codigo VARCHAR(20) NOT NULL,

    nombre VARCHAR(100) NOT NULL,

    descripcion VARCHAR(255),

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(20) NOT NULL,

    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    usu_mod VARCHAR(20),

    fec_mod TIMESTAMP,

    CONSTRAINT pk_tipo_producto
        PRIMARY KEY (id_tipo_producto),

    CONSTRAINT uq_tipo_producto_codigo
        UNIQUE (codigo),

    CONSTRAINT chk_tipo_producto_estado
        CHECK (estado IN ('A', 'I', 'E'))
);