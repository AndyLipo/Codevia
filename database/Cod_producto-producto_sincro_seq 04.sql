SELECT setval(
    'produccion.seq_codigo_producto',
    (
        SELECT COALESCE(MAX(id_producto), 0)
        FROM produccion.producto
    )
);