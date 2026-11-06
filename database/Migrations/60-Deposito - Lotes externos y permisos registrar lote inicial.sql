-- =====================================================================
-- 60 - Depósito: Permisos y ejecución de fn_registrar_lote_inicial
-- =====================================================================

-- 1. Habilitar el módulo 'lotes' en usuarios.roles para el Administrador (id_rol = 1)
UPDATE usuarios.roles
SET modulos = array_append(coalesce(modulos, ARRAY[]::TEXT[]), 'lotes')
WHERE id_rol = 1
  AND NOT ('lotes' = ANY(coalesce(modulos, ARRAY[]::TEXT[])));

-- 2. Habilitar también para roles operativos si tienen la columna modulos definida
UPDATE usuarios.roles
SET modulos = array_append(coalesce(modulos, ARRAY[]::TEXT[]), 'lotes')
WHERE id_rol IN (2, 3, 4)
  AND modulos IS NOT NULL
  AND NOT ('lotes' = ANY(coalesce(modulos, ARRAY[]::TEXT[])));

-- 3. Otorgar permisos de uso sobre las secuencias de deposito y produccion
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA deposito TO anon, authenticated, public;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA produccion TO anon, authenticated, public;

-- Otorgar permisos sobre tablas requeridas
GRANT SELECT, INSERT, UPDATE ON TABLE produccion.lote_producto TO anon, authenticated, public;
GRANT SELECT, INSERT, UPDATE ON TABLE deposito.stock TO anon, authenticated, public;
GRANT SELECT, INSERT, UPDATE ON TABLE deposito.lote_posicion TO anon, authenticated, public;
GRANT SELECT ON TABLE deposito.posicion TO anon, authenticated, public;
GRANT SELECT ON TABLE produccion.producto TO anon, authenticated, public;

-- 4. Permisos de ejecución sobre funciones de depósito
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA deposito TO anon, authenticated, public;
