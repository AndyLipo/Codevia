INSERT INTO deposito.configuracion_zona (
    id_deposito,
    codigo_zona,
    cantidad_pasillos,
    posiciones_por_pasillo,
    cantidad_niveles,
    estado,
    usu_alta
)
VALUES (
    1,
    'A',
    7,
    96,
    4,
    'A',
    'BP38636078'
)
RETURNING
    id_configuracion_zona,
    id_deposito,
    codigo_zona,
    cantidad_pasillos,
    posiciones_por_pasillo,
    cantidad_niveles;