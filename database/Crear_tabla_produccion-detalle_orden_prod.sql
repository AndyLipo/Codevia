CREATE TABLE produccion.detalle_orden_produccion (
    id_detalle_orden INTEGER GENERATED ALWAYS AS IDENTITY,

    id_orden_produccion INTEGER NOT NULL,

    id_producto INTEGER NOT NULL,

    cantidad_solicitada NUMERIC(15,3) NOT NULL,

    cantidad_producida NUMERIC(15,3) NOT NULL DEFAULT 0,

    fecha_limite DATE NOT NULL,

    estado_detalle CHAR(1) NOT NULL DEFAULT 'P',

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(50) NOT NULL,

    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    usu_mod VARCHAR(50),

    fec_mod TIMESTAMP,

    CONSTRAINT pk_detalle_orden_produccion
        PRIMARY KEY (id_detalle_orden),

    CONSTRAINT fk_detalle_orden
        FOREIGN KEY (id_orden_produccion)
        REFERENCES produccion.orden_produccion(id_orden_produccion),

    CONSTRAINT fk_detalle_producto
        FOREIGN KEY (id_producto)
        REFERENCES produccion.producto(id_producto),

    CONSTRAINT uq_detalle_orden_producto
        UNIQUE (id_orden_produccion, id_producto),

    CONSTRAINT ck_detalle_cantidad_solicitada
        CHECK (cantidad_solicitada > 0),

    CONSTRAINT ck_detalle_cantidad_producida
        CHECK (cantidad_producida >= 0),

    CONSTRAINT ck_detalle_estado
        CHECK (estado_detalle IN ('P','E','I','C','A'));

    CONSTRAINT ck_detalle_estado_registro
        CHECK (estado IN ('A','I','E'))
);