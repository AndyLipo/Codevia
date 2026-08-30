CREATE TABLE produccion.producto (
    id_producto INTEGER GENERATED ALWAYS AS IDENTITY,

    codigo VARCHAR(20) NOT NULL,

    nombre VARCHAR(100) NOT NULL,

    id_tipo_producto INTEGER NOT NULL,

    id_material INTEGER NOT NULL,

    id_unidad_medida INTEGER NOT NULL,

    es_biodegradable BOOLEAN NOT NULL DEFAULT FALSE,

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(20) NOT NULL,

    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    usu_mod VARCHAR(20),

    fec_mod TIMESTAMP,

    CONSTRAINT pk_producto
        PRIMARY KEY (id_producto),

    CONSTRAINT uq_producto_codigo
        UNIQUE (codigo),

    CONSTRAINT fk_producto_tipo
        FOREIGN KEY (id_tipo_producto)
        REFERENCES produccion.tipo_producto (id_tipo_producto),

    CONSTRAINT fk_producto_material
        FOREIGN KEY (id_material)
        REFERENCES produccion.material (id_material),

    CONSTRAINT fk_producto_unidad
        FOREIGN KEY (id_unidad_medida)
        REFERENCES produccion.unidad_medida (id_unidad_medida),

    CONSTRAINT chk_producto_estado
        CHECK (estado IN ('A', 'I', 'E'))
);