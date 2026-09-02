CREATE TABLE produccion.produccion (
    id_produccion INTEGER GENERATED ALWAYS AS IDENTITY,

    id_detalle_orden INTEGER NOT NULL,

    id_responsable INTEGER NOT NULL,

    fecha_inicio TIMESTAMP,

    fecha_fin TIMESTAMP,

    cantidad_producida NUMERIC(15,3) NOT NULL DEFAULT 0,

    estado_produccion CHAR(1) NOT NULL DEFAULT 'P',

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(50) NOT NULL,

    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    usu_mod VARCHAR(50),

    fec_mod TIMESTAMP,

    CONSTRAINT pk_produccion
        PRIMARY KEY (id_produccion),

    CONSTRAINT fk_produccion_detalle
        FOREIGN KEY (id_detalle_orden)
        REFERENCES produccion.detalle_orden_produccion(id_detalle_orden),

    CONSTRAINT fk_produccion_responsable
        FOREIGN KEY (id_responsable)
        REFERENCES usuarios.usuarios(id_usuario),

    CONSTRAINT ck_produccion_cantidad
        CHECK (cantidad_producida > 0);

    CONSTRAINT ck_produccion_estado
        CHECK (estado_produccion IN ('P','E','C','A')),

    CONSTRAINT ck_produccion_estado_registro
        CHECK (estado IN ('A','I','E'))
);