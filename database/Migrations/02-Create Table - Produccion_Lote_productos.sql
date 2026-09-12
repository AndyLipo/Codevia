CREATE TABLE produccion.lote_producto (
    id_lote_producto INTEGER GENERATED ALWAYS AS IDENTITY,
    
    id_produccion INTEGER NOT NULL,
    id_producto INTEGER NOT NULL,
    
    nro_lote VARCHAR(20) NOT NULL,
    
    fecha_fabricacion TIMESTAMP NOT NULL,
    fecha_vencimiento DATE,
    
    cantidad_total NUMERIC(15,3) NOT NULL,
    
    estado_lote CHAR(1) NOT NULL DEFAULT 'P',
    estado CHAR(1) NOT NULL DEFAULT 'A',
    
    usu_alta VARCHAR(50) NOT NULL,
    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    usu_mod VARCHAR(50),
    fec_mod TIMESTAMP,
    
    CONSTRAINT pk_lote_producto
        PRIMARY KEY (id_lote_producto),
    
    CONSTRAINT uq_lote_produccion
        UNIQUE (id_produccion),
    
    CONSTRAINT uq_lote_nro_lote
        UNIQUE (nro_lote),
    
    CONSTRAINT fk_lote_produccion
        FOREIGN KEY (id_produccion)
        REFERENCES produccion.produccion(id_produccion),
    
    CONSTRAINT fk_lote_producto
        FOREIGN KEY (id_producto)
        REFERENCES produccion.producto(id_producto),
    
    CONSTRAINT ck_lote_cantidad
        CHECK (cantidad_total > 0),
    
    CONSTRAINT ck_lote_estado
        CHECK (estado_lote IN ('P', 'R', 'U', 'B', 'A')),
    
    CONSTRAINT ck_lote_estado_admin
        CHECK (estado IN ('A', 'I', 'E'))
);