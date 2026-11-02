-- =====================================================================
-- 55 - Gestión de Pedidos y Seguimiento de Pedidos con TOKEN
-- Requiere haber ejecutado antes los scripts 50 y 53.
--
-- Reglas de negocio y seguridad implementadas:
--  1. Acceso exclusivo para roles 1, 9 y 16 (validado en backend por token).
--  2. Rol 9: solo puede generar pedidos y consultar sus propios pedidos.
--     No puede confirmar ni modificar.
--  3. Roles 1 y 16: pueden generar, consultar todos los pedidos, confirmar
--     y modificar pedidos en estado P o C (si no inició preparación/picking).
--  4. Precios obtenidos automáticamente de administracion.precio_producto
--     (vigentes y activos).
--  5. Disponibilidad calculada sobre lotes con estado_lote = 'U', lote activo,
--     stock activo, lote_posicion activo, posicion activa y ocupada ('O') y
--     lote no vencido.
--  6. Confirmación de pedidos en estado 'P' reutilizando íntegramente
--     administracion.fn_confirmar_pedido(p_id_pedido, p_usuario).
--  7. Modificación transaccional de pedidos manteniendo reservas sin cambios,
--     liberando excedentes y dejando el pedido en estado 'M' hasta su
--     reconfirmación por un supervisor (rol 1 o 16).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Habilitar los módulos 'pedidos-gestion' y 'pedidos-seguimiento'
--    en usuarios.roles.modulos exclusivamente para los roles 1, 9 y 16.
-- ---------------------------------------------------------------------
UPDATE usuarios.roles
SET modulos = array_append(coalesce(modulos, ARRAY['overview']::TEXT[]), 'pedidos-gestion')
WHERE id_rol IN (1, 9, 16)
  AND NOT ('pedidos-gestion' = ANY(coalesce(modulos, ARRAY[]::TEXT[])));

UPDATE usuarios.roles
SET modulos = array_append(coalesce(modulos, ARRAY['overview']::TEXT[]), 'pedidos-seguimiento')
WHERE id_rol IN (1, 9, 16)
  AND NOT ('pedidos-seguimiento' = ANY(coalesce(modulos, ARRAY[]::TEXT[])));

-- ---------------------------------------------------------------------
-- 2. Helper de validación de token y rol para Pedidos (Roles 1, 9 y 16)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.fn_actor_pedidos(p_token UUID)
RETURNS TABLE(
    id_usuario    integer,
    usuario_login text,
    id_rol        integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'usuarios', 'public'
AS $$
    SELECT
        u.id_usuario::integer,
        u.usuario_login::text,
        u.id_rol::integer
    FROM usuarios.usuarios u
    WHERE u.id_usuario = usuarios.fn_usuario_de_token(p_token)
      AND u.estado = 'A'
      AND u.id_rol IN (1, 9, 16);
$$;

REVOKE ALL ON FUNCTION usuarios.fn_actor_pedidos(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. LISTAR CLIENTES ACTIVOS PARA EL SELECTOR DE NUEVO/EDITAR PEDIDO
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.listar_clientes_activos_pedido(p_token UUID)
RETURNS TABLE(
    id_cliente          integer,
    tipo_cliente        text,
    nombre_razon_social text,
    tipo_documento      text,
    nro_documento       text,
    cuit                text,
    telefono            text,
    email               text,
    domicilio           text,
    localidad           text,
    provincia           text,
    codigo_postal       text,
    categoria_cliente   text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'usuarios', 'public'
AS $$
    SELECT
        c.id_cliente::integer,
        trim(c.tipo_cliente)::text,
        c.nombre_razon_social::text,
        c.tipo_documento::text,
        c.nro_documento::text,
        c.cuit::text,
        c.telefono::text,
        c.email::text,
        c.domicilio::text,
        c.localidad::text,
        c.provincia::text,
        c.codigo_postal::text,
        trim(c.categoria_cliente)::text
    FROM administracion.cliente c
    WHERE EXISTS (SELECT 1 FROM usuarios.fn_actor_pedidos(p_token))
      AND c.estado = 'A'
    ORDER BY c.nombre_razon_social ASC;
$$;

-- ---------------------------------------------------------------------
-- 4. LISTAR PRODUCTOS CON PRECIO VIGENTE Y STOCK ELEGIBLE PARA RESERVA
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.listar_productos_disponibles_pedido(p_token UUID)
RETURNS TABLE(
    id_producto              integer,
    codigo                   text,
    nombre                   text,
    unidad_codigo            text,
    unidad_nombre            text,
    es_biodegradable         boolean,
    precio_unitario          numeric,
    moneda                   text,
    fecha_precio_desde       date,
    stock_disponible         numeric,
    cantidad_lotes_elegibles integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'deposito', 'produccion', 'usuarios', 'public'
AS $$
    SELECT
        p.id_producto::integer,
        p.codigo::text,
        p.nombre::text,
        coalesce(um.codigo, '')::text AS unidad_codigo,
        coalesce(um.nombre, '')::text AS unidad_nombre,
        coalesce(p.es_biodegradable, false) AS es_biodegradable,
        coalesce(pr.precio_unitario, 0)::numeric AS precio_unitario,
        coalesce(pr.moneda, 'ARS')::text AS moneda,
        pr.fecha_desde AS fecha_precio_desde,
        coalesce(stk.disponible, 0)::numeric AS stock_disponible,
        coalesce(stk.cant_lotes, 0)::integer AS cantidad_lotes_elegibles
    FROM produccion.producto p
    LEFT JOIN produccion.unidad_medida um
        ON um.id_unidad_medida = p.id_unidad_medida
    LEFT JOIN LATERAL (
        SELECT
            pp.precio_unitario,
            trim(pp.moneda) AS moneda,
            pp.fecha_desde
        FROM administracion.precio_producto pp
        WHERE pp.id_producto = p.id_producto
          AND pp.estado = 'A'
          AND pp.fecha_desde <= CURRENT_DATE
          AND (pp.fecha_hasta IS NULL OR pp.fecha_hasta >= CURRENT_DATE)
        ORDER BY pp.fecha_desde DESC, pp.id_precio_producto DESC
        LIMIT 1
    ) pr ON true
    LEFT JOIN LATERAL (
        SELECT
            SUM(l.cantidad_total - s.cantidad_reservada - s.cantidad_consumida) AS disponible,
            COUNT(DISTINCT l.id_lote_producto) AS cant_lotes
        FROM produccion.lote_producto l
        JOIN deposito.stock s
            ON s.id_lote_producto = l.id_lote_producto
        JOIN deposito.lote_posicion lp
            ON lp.id_lote_producto = l.id_lote_producto
           AND lp.estado = 'A'
        JOIN deposito.posicion pos
            ON pos.id_posicion = lp.id_posicion
        WHERE l.id_producto = p.id_producto
          AND l.estado_lote = 'U'
          AND l.estado = 'A'
          AND s.estado = 'A'
          AND pos.estado = 'A'
          AND pos.estado_posicion = 'O'
          AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURRENT_DATE)
          AND (l.cantidad_total - s.cantidad_reservada - s.cantidad_consumida) > 0
    ) stk ON true
    WHERE EXISTS (SELECT 1 FROM usuarios.fn_actor_pedidos(p_token))
      AND p.estado = 'A'
    ORDER BY p.nombre ASC;
$$;

-- ---------------------------------------------------------------------
-- 5. GENERAR PEDIDO (Estado 'P' - Roles 1, 9 y 16)
--    No reserva stock ni genera preparación. Guarda el precio vigente
--    de administracion.precio_producto en detalle_pedido.precio_unitario.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.crear_pedido_cliente(
    p_token             UUID,
    p_id_cliente        INTEGER,
    p_modalidad_entrega TEXT,
    p_domicilio_entrega TEXT DEFAULT NULL,
    p_localidad_entrega TEXT DEFAULT NULL,
    p_provincia_entrega TEXT DEFAULT NULL,
    p_observaciones     TEXT DEFAULT NULL,
    p_items             JSONB DEFAULT '[]'::JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'deposito', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_actor            RECORD;
    v_modalidad        CHAR(1) := upper(trim(coalesce(p_modalidad_entrega, '')));
    v_id_pedido        INTEGER;
    v_item             JSONB;
    v_id_producto      INTEGER;
    v_cantidad         NUMERIC;
    v_precio_vigente   NUMERIC;
    v_stock_disponible NUMERIC;
    v_prod_nombre      TEXT;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_pedidos(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No tiene permisos para generar pedidos (requiere rol 1, 9 o 16)';
    END IF;

    IF p_id_cliente IS NULL OR NOT EXISTS (
        SELECT 1 FROM administracion.cliente c
        WHERE c.id_cliente = p_id_cliente AND c.estado = 'A'
    ) THEN
        RAISE EXCEPTION 'Debe seleccionar un cliente activo válido';
    END IF;

    IF v_modalidad NOT IN ('P', 'T', 'R') THEN
        RAISE EXCEPTION 'La modalidad de entrega es inválida (valores permitidos: P, T, R)';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'El pedido debe incluir al menos un producto';
    END IF;

    -- Insertar cabecera del pedido en estado 'P' (Pendiente)
    INSERT INTO administracion.pedido (
        id_cliente,
        fecha_pedido,
        modalidad_entrega,
        domicilio_entrega,
        localidad_entrega,
        provincia_entrega,
        observaciones,
        estado,
        usu_alta,
        fec_alta
    ) VALUES (
        p_id_cliente,
        CURRENT_TIMESTAMP,
        v_modalidad,
        nullif(trim(coalesce(p_domicilio_entrega, '')), ''),
        nullif(trim(coalesce(p_localidad_entrega, '')), ''),
        nullif(trim(coalesce(p_provincia_entrega, '')), ''),
        nullif(trim(coalesce(p_observaciones, '')), ''),
        'P',
        v_actor.usuario_login,
        CURRENT_TIMESTAMP
    )
    RETURNING id_pedido INTO v_id_pedido;

    -- Procesar e insertar cada línea validando producto, stock elegible y precio vigente
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_id_producto := (v_item->>'id_producto')::integer;
        v_cantidad    := (v_item->>'cantidad')::numeric;

        IF v_id_producto IS NULL OR v_cantidad IS NULL OR v_cantidad <= 0 THEN
            RAISE EXCEPTION 'Cantidad inválida para el producto seleccionado';
        END IF;

        SELECT p.nombre INTO v_prod_nombre
        FROM produccion.producto p
        WHERE p.id_producto = v_id_producto
          AND p.estado = 'A';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto ID % no existe o no está activo', v_id_producto;
        END IF;

        -- Obtener automáticamente el precio vigente desde administracion.precio_producto
        SELECT pp.precio_unitario
        INTO v_precio_vigente
        FROM administracion.precio_producto pp
        WHERE pp.id_producto = v_id_producto
          AND pp.estado = 'A'
          AND pp.fecha_desde <= CURRENT_DATE
          AND (pp.fecha_hasta IS NULL OR pp.fecha_hasta >= CURRENT_DATE)
        ORDER BY pp.fecha_desde DESC, pp.id_precio_producto DESC
        LIMIT 1;

        IF v_precio_vigente IS NULL OR v_precio_vigente <= 0 THEN
            RAISE EXCEPTION 'El producto "%" no posee un precio vigente activo en administracion.precio_producto', v_prod_nombre;
        END IF;

        -- Verificar disponibilidad elegible al momento de la carga
        SELECT coalesce(SUM(l.cantidad_total - s.cantidad_reservada - s.cantidad_consumida), 0)
        INTO v_stock_disponible
        FROM produccion.lote_producto l
        JOIN deposito.stock s
            ON s.id_lote_producto = l.id_lote_producto
        JOIN deposito.lote_posicion lp
            ON lp.id_lote_producto = l.id_lote_producto
           AND lp.estado = 'A'
        JOIN deposito.posicion pos
            ON pos.id_posicion = lp.id_posicion
        WHERE l.id_producto = v_id_producto
          AND l.estado_lote = 'U'
          AND l.estado = 'A'
          AND s.estado = 'A'
          AND pos.estado = 'A'
          AND pos.estado_posicion = 'O'
          AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURRENT_DATE)
          AND (l.cantidad_total - s.cantidad_reservada - s.cantidad_consumida) > 0;

        IF v_cantidad > v_stock_disponible THEN
            RAISE EXCEPTION 'La cantidad solicitada (%) para "%" supera el stock elegible disponible (%)',
                v_cantidad, v_prod_nombre, v_stock_disponible;
        END IF;

        -- Insertar detalle (importe_total se calcula automáticamente por ser columna GENERATED ALWAYS)
        INSERT INTO administracion.detalle_pedido (
            id_pedido,
            id_producto,
            cantidad,
            precio_unitario,
            usu_alta,
            fec_alta
        ) VALUES (
            v_id_pedido,
            v_id_producto,
            v_cantidad,
            v_precio_vigente,
            v_actor.usuario_login,
            CURRENT_TIMESTAMP
        );
    END LOOP;

    RETURN v_id_pedido;
END;
$$;

-- ---------------------------------------------------------------------
-- 6. CONFIRMAR PEDIDO (Exclusivo Roles 1 y 16)
--    - Si el pedido está en 'P': invoca directamente administracion.fn_confirmar_pedido.
--    - Si el pedido está en 'M' (Modificado):
--        * Si aún no tenía preparación, pasa a 'P' e invoca administracion.fn_confirmar_pedido.
--        * Si ya tenía preparación (modificado desde 'C'), reserva únicamente
--          las diferencias faltantes por FIFO y pasa el pedido a 'C'.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.confirmar_pedido_autorizado(
    p_token     UUID,
    p_id_pedido INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'deposito', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_actor                  RECORD;
    v_estado_pedido          CHAR(1);
    v_id_preparacion         INTEGER;
    v_id_detalle_preparacion INTEGER;
    v_linea                  RECORD;
    v_lote                   RECORD;
    v_ya_reservado           NUMERIC;
    v_pendiente              NUMERIC;
    v_disponible             NUMERIC;
    v_cantidad_reservar      NUMERIC;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_pedidos(p_token);
    IF NOT FOUND OR v_actor.id_rol NOT IN (1, 16) THEN
        RAISE EXCEPTION 'Permiso denegado: solo los roles 1 y 16 pueden confirmar pedidos';
    END IF;

    SELECT p.estado
    INTO v_estado_pedido
    FROM administracion.pedido p
    WHERE p.id_pedido = p_id_pedido
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el pedido #%', p_id_pedido;
    END IF;

    IF v_estado_pedido NOT IN ('P', 'M') THEN
        RAISE EXCEPTION 'Solo se pueden confirmar pedidos en estado Pendiente (P) o Modificado (M). Estado actual: %', v_estado_pedido;
    END IF;

    SELECT pp.id_preparacion
    INTO v_id_preparacion
    FROM deposito.preparacion_pedido pp
    WHERE pp.id_pedido = p_id_pedido
    FOR UPDATE;

    -- Caso 1: No existe preparación previa -> usar directamente administracion.fn_confirmar_pedido
    IF v_id_preparacion IS NULL THEN
        IF v_estado_pedido = 'M' THEN
            UPDATE administracion.pedido
            SET estado = 'P'
            WHERE id_pedido = p_id_pedido;
        END IF;

        PERFORM administracion.fn_confirmar_pedido(p_id_pedido, v_actor.usuario_login);
        RETURN true;
    END IF;

    -- Caso 2: Reconfirmación de un pedido en estado 'M' que ya poseía reservas parciales/previas
    FOR v_linea IN
        SELECT
            d.id_detalle_pedido,
            d.id_producto,
            d.cantidad
        FROM administracion.detalle_pedido d
        WHERE d.id_pedido = p_id_pedido
        ORDER BY d.id_producto, d.id_detalle_pedido
        FOR UPDATE OF d
    LOOP
        SELECT coalesce(SUM(dpp.cantidad), 0)
        INTO v_ya_reservado
        FROM deposito.detalle_preparacion_pedido dpp
        WHERE dpp.id_preparacion = v_id_preparacion
          AND dpp.id_detalle_pedido = v_linea.id_detalle_pedido
          AND dpp.estado = 'A';

        v_pendiente := v_linea.cantidad - v_ya_reservado;

        IF v_pendiente <= 0 THEN
            CONTINUE;
        END IF;

        -- Buscar lotes elegibles por FIFO para cubrir la diferencia v_pendiente
        FOR v_lote IN
            SELECT
                l.id_lote_producto,
                l.fecha_fabricacion,
                l.cantidad_total,
                s.id_stock,
                s.cantidad_reservada,
                s.cantidad_consumida,
                lp.id_posicion
            FROM produccion.lote_producto l
            JOIN deposito.stock s
                ON s.id_lote_producto = l.id_lote_producto
            JOIN deposito.lote_posicion lp
                ON lp.id_lote_producto = l.id_lote_producto
               AND lp.estado = 'A'
            JOIN deposito.posicion pos
                ON pos.id_posicion = lp.id_posicion
            WHERE l.id_producto = v_linea.id_producto
              AND l.estado_lote = 'U'
              AND l.estado = 'A'
              AND s.estado = 'A'
              AND pos.estado = 'A'
              AND pos.estado_posicion = 'O'
              AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURRENT_DATE)
              AND (l.cantidad_total - s.cantidad_reservada - s.cantidad_consumida) > 0
            ORDER BY l.fecha_fabricacion ASC, l.id_lote_producto ASC
            FOR UPDATE OF l, s, lp, pos
        LOOP
            EXIT WHEN v_pendiente <= 0;

            v_disponible := v_lote.cantidad_total - v_lote.cantidad_reservada - v_lote.cantidad_consumida;
            IF v_disponible <= 0 THEN
                CONTINUE;
            END IF;

            v_cantidad_reservar := LEAST(v_pendiente, v_disponible);

            -- Verificar si el lote ya tenía una reserva activa en esta preparación
            SELECT dpp.id_detalle_preparacion
            INTO v_id_detalle_preparacion
            FROM deposito.detalle_preparacion_pedido dpp
            WHERE dpp.id_preparacion = v_id_preparacion
              AND dpp.id_lote_producto = v_lote.id_lote_producto
            FOR UPDATE;

            IF FOUND THEN
                UPDATE deposito.detalle_preparacion_pedido
                SET cantidad          = cantidad + v_cantidad_reservar,
                    id_detalle_pedido = v_linea.id_detalle_pedido,
                    estado            = 'A',
                    usu_mod           = v_actor.usuario_login,
                    fec_mod           = CURRENT_TIMESTAMP
                WHERE id_detalle_preparacion = v_id_detalle_preparacion;
            ELSE
                INSERT INTO deposito.detalle_preparacion_pedido (
                    id_preparacion,
                    id_lote_producto,
                    id_detalle_pedido,
                    cantidad,
                    estado,
                    cantidad_recogida,
                    estado_picking,
                    usu_alta
                ) VALUES (
                    v_id_preparacion,
                    v_lote.id_lote_producto,
                    v_linea.id_detalle_pedido,
                    v_cantidad_reservar,
                    'A',
                    0,
                    'P',
                    v_actor.usuario_login
                )
                RETURNING id_detalle_preparacion INTO v_id_detalle_preparacion;
            END IF;

            UPDATE deposito.stock
            SET cantidad_reservada = cantidad_reservada + v_cantidad_reservar,
                usu_mod            = v_actor.usuario_login,
                fec_mod            = CURRENT_TIMESTAMP
            WHERE id_stock = v_lote.id_stock
              AND estado = 'A';

            INSERT INTO deposito.movimiento_stock_pedido (
                id_stock,
                id_lote_producto,
                id_pedido,
                id_detalle_preparacion,
                tipo_movimiento,
                cantidad,
                id_posicion_origen,
                observacion,
                usu_alta
            ) VALUES (
                v_lote.id_stock,
                v_lote.id_lote_producto,
                p_id_pedido,
                v_id_detalle_preparacion,
                'RESERVA',
                v_cantidad_reservar,
                v_lote.id_posicion,
                'Reserva diferencial FIFO al reconfirmar pedido modificado',
                v_actor.usuario_login
            );

            v_pendiente := v_pendiente - v_cantidad_reservar;
        END LOOP;

        IF v_pendiente > 0 THEN
            RAISE EXCEPTION 'Stock insuficiente para el producto %. Pedido: %. Cantidad faltante: %',
                v_linea.id_producto, p_id_pedido, v_pendiente;
        END IF;
    END LOOP;

    UPDATE deposito.preparacion_pedido
    SET usu_mod = v_actor.usuario_login,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_preparacion = v_id_preparacion;

    UPDATE administracion.pedido
    SET estado  = 'C',
        usu_mod = v_actor.usuario_login,
        fec_mod = CURRENT_TIMESTAMP
    WHERE id_pedido = p_id_pedido;

    RETURN true;
END;
$$;

-- ---------------------------------------------------------------------
-- 7. MODIFICAR PEDIDO (Exclusivo Roles 1 y 16)
--    - Permitido solo en estados P, C o M siempre que no haya iniciado
--      el picking/preparación.
--    - Mantiene reservas de productos/cantidades que no cambiaron,
--      libera cantidades reducidas o productos eliminados y pasa el
--      pedido a estado 'M' (Modificado), requiriendo reconfirmación.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.modificar_pedido_autorizado(
    p_token             UUID,
    p_id_cliente        INTEGER,
    p_id_pedido         INTEGER,
    p_modalidad_entrega TEXT,
    p_domicilio_entrega TEXT DEFAULT NULL,
    p_localidad_entrega TEXT DEFAULT NULL,
    p_provincia_entrega TEXT DEFAULT NULL,
    p_observaciones     TEXT DEFAULT NULL,
    p_items             JSONB DEFAULT '[]'::JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'deposito', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_actor              RECORD;
    v_pedido             administracion.pedido%ROWTYPE;
    v_modalidad          CHAR(1) := upper(trim(coalesce(p_modalidad_entrega, '')));
    v_id_preparacion     INTEGER;
    v_estado_preparacion CHAR(1);
    v_old_linea          RECORD;
    v_dpp                RECORD;
    v_item               JSONB;
    v_id_producto        INTEGER;
    v_nueva_cantidad     NUMERIC;
    v_reservado_linea    NUMERIC;
    v_a_liberar          NUMERIC;
    v_liberar_lote       NUMERIC;
    v_id_stock           INTEGER;
    v_id_pos             INTEGER;
    v_precio_vigente     NUMERIC;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_pedidos(p_token);
    IF NOT FOUND OR v_actor.id_rol NOT IN (1, 16) THEN
        RAISE EXCEPTION 'Permiso denegado: solo los roles 1 y 16 pueden modificar pedidos';
    END IF;

    SELECT * INTO v_pedido
    FROM administracion.pedido p
    WHERE p.id_pedido = p_id_pedido
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el pedido #%', p_id_pedido;
    END IF;

    IF v_pedido.estado NOT IN ('P', 'C', 'M') THEN
        RAISE EXCEPTION 'No se permite modificar un pedido en estado % (solo P, C o M antes de iniciar preparación)', v_pedido.estado;
    END IF;

    IF p_id_cliente IS NULL OR NOT EXISTS (
        SELECT 1 FROM administracion.cliente c
        WHERE c.id_cliente = p_id_cliente AND c.estado = 'A'
    ) THEN
        RAISE EXCEPTION 'Debe seleccionar un cliente activo válido';
    END IF;

    IF v_modalidad NOT IN ('P', 'T', 'R') THEN
        RAISE EXCEPTION 'Modalidad de entrega inválida (P, T o R)';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'El pedido debe contener al menos un producto';
    END IF;

    -- Verificar si existe preparación y que no haya comenzado el picking
    SELECT pp.id_preparacion, pp.estado
    INTO v_id_preparacion, v_estado_preparacion
    FROM deposito.preparacion_pedido pp
    WHERE pp.id_pedido = p_id_pedido
    FOR UPDATE;

    IF v_id_preparacion IS NOT NULL THEN
        IF v_estado_preparacion <> 'P' OR EXISTS (
            SELECT 1
            FROM deposito.detalle_preparacion_pedido dpp
            WHERE dpp.id_preparacion = v_id_preparacion
              AND (dpp.cantidad_recogida > 0 OR dpp.estado_picking <> 'P')
        ) THEN
            RAISE EXCEPTION 'No se puede modificar el pedido #% porque ya comenzó su preparación/picking en depósito', p_id_pedido;
        END IF;
    END IF;

    -- 1. Procesar líneas actuales del pedido que fueron quitadas o cuya cantidad disminuyó
    FOR v_old_linea IN
        SELECT d.*
        FROM administracion.detalle_pedido d
        WHERE d.id_pedido = p_id_pedido
        FOR UPDATE
    LOOP
        SELECT (elem->>'cantidad')::numeric
        INTO v_nueva_cantidad
        FROM jsonb_array_elements(p_items) elem
        WHERE (elem->>'id_producto')::integer = v_old_linea.id_producto
        LIMIT 1;

        IF v_nueva_cantidad IS NULL THEN
            -- Producto quitado del pedido: liberar todas sus reservas si tenía
            IF v_id_preparacion IS NOT NULL THEN
                FOR v_dpp IN
                    SELECT *
                    FROM deposito.detalle_preparacion_pedido dpp
                    WHERE dpp.id_preparacion = v_id_preparacion
                      AND dpp.id_detalle_pedido = v_old_linea.id_detalle_pedido
                      AND dpp.estado = 'A'
                    FOR UPDATE
                LOOP
                    SELECT s.id_stock INTO v_id_stock
                    FROM deposito.stock s
                    WHERE s.id_lote_producto = v_dpp.id_lote_producto
                      AND s.estado = 'A'
                    FOR UPDATE;

                    SELECT lp.id_posicion INTO v_id_pos
                    FROM deposito.lote_posicion lp
                    WHERE lp.id_lote_producto = v_dpp.id_lote_producto
                      AND lp.estado = 'A'
                    LIMIT 1;

                    UPDATE deposito.stock
                    SET cantidad_reservada = GREATEST(0, cantidad_reservada - v_dpp.cantidad),
                        usu_mod            = v_actor.usuario_login,
                        fec_mod            = CURRENT_TIMESTAMP
                    WHERE id_stock = v_id_stock;

                    INSERT INTO deposito.movimiento_stock_pedido (
                        id_stock,
                        id_lote_producto,
                        id_pedido,
                        id_detalle_preparacion,
                        tipo_movimiento,
                        cantidad,
                        id_posicion_origen,
                        observacion,
                        usu_alta
                    ) VALUES (
                        v_id_stock,
                        v_dpp.id_lote_producto,
                        p_id_pedido,
                        NULL,
                        'LIBERACION',
                        v_dpp.cantidad,
                        v_id_pos,
                        'Liberación de reserva por quita de producto al modificar pedido',
                        v_actor.usuario_login
                    );

                    DELETE FROM deposito.detalle_preparacion_pedido
                    WHERE id_detalle_preparacion = v_dpp.id_detalle_preparacion;
                END LOOP;
            END IF;

            DELETE FROM administracion.detalle_pedido
            WHERE id_detalle_pedido = v_old_linea.id_detalle_pedido;

        ELSE
            -- El producto continúa en el pedido
            IF v_nueva_cantidad <= 0 THEN
                RAISE EXCEPTION 'La cantidad de cada producto debe ser mayor a cero';
            END IF;

            IF v_id_preparacion IS NOT NULL THEN
                SELECT coalesce(SUM(dpp.cantidad), 0)
                INTO v_reservado_linea
                FROM deposito.detalle_preparacion_pedido dpp
                WHERE dpp.id_preparacion = v_id_preparacion
                  AND dpp.id_detalle_pedido = v_old_linea.id_detalle_pedido
                  AND dpp.estado = 'A';

                -- Si la nueva cantidad es menor a lo que ya tenía reservado, liberar sólo el excedente
                IF v_nueva_cantidad < v_reservado_linea THEN
                    v_a_liberar := v_reservado_linea - v_nueva_cantidad;

                    FOR v_dpp IN
                        SELECT *
                        FROM deposito.detalle_preparacion_pedido dpp
                        WHERE dpp.id_preparacion = v_id_preparacion
                          AND dpp.id_detalle_pedido = v_old_linea.id_detalle_pedido
                          AND dpp.estado = 'A'
                        ORDER BY dpp.id_detalle_preparacion DESC
                        FOR UPDATE
                    LOOP
                        EXIT WHEN v_a_liberar <= 0;

                        v_liberar_lote := LEAST(v_a_liberar, v_dpp.cantidad);

                        SELECT s.id_stock INTO v_id_stock
                        FROM deposito.stock s
                        WHERE s.id_lote_producto = v_dpp.id_lote_producto
                          AND s.estado = 'A'
                        FOR UPDATE;

                        SELECT lp.id_posicion INTO v_id_pos
                        FROM deposito.lote_posicion lp
                        WHERE lp.id_lote_producto = v_dpp.id_lote_producto
                          AND lp.estado = 'A'
                        LIMIT 1;

                        UPDATE deposito.stock
                        SET cantidad_reservada = GREATEST(0, cantidad_reservada - v_liberar_lote),
                            usu_mod            = v_actor.usuario_login,
                            fec_mod            = CURRENT_TIMESTAMP
                        WHERE id_stock = v_id_stock;

                        IF v_liberar_lote >= v_dpp.cantidad THEN
                            INSERT INTO deposito.movimiento_stock_pedido (
                                id_stock,
                                id_lote_producto,
                                id_pedido,
                                id_detalle_preparacion,
                                tipo_movimiento,
                                cantidad,
                                id_posicion_origen,
                                observacion,
                                usu_alta
                            ) VALUES (
                                v_id_stock,
                                v_dpp.id_lote_producto,
                                p_id_pedido,
                                NULL,
                                'LIBERACION',
                                v_liberar_lote,
                                v_id_pos,
                                'Liberación de lote por reducción de cantidad al modificar pedido',
                                v_actor.usuario_login
                            );

                            DELETE FROM deposito.detalle_preparacion_pedido
                            WHERE id_detalle_preparacion = v_dpp.id_detalle_preparacion;
                        ELSE
                            UPDATE deposito.detalle_preparacion_pedido
                            SET cantidad = cantidad - v_liberar_lote,
                                usu_mod  = v_actor.usuario_login,
                                fec_mod  = CURRENT_TIMESTAMP
                            WHERE id_detalle_preparacion = v_dpp.id_detalle_preparacion;

                            INSERT INTO deposito.movimiento_stock_pedido (
                                id_stock,
                                id_lote_producto,
                                id_pedido,
                                id_detalle_preparacion,
                                tipo_movimiento,
                                cantidad,
                                id_posicion_origen,
                                observacion,
                                usu_alta
                            ) VALUES (
                                v_id_stock,
                                v_dpp.id_lote_producto,
                                p_id_pedido,
                                v_dpp.id_detalle_preparacion,
                                'LIBERACION',
                                v_liberar_lote,
                                v_id_pos,
                                'Liberación parcial por reducción de cantidad al modificar pedido',
                                v_actor.usuario_login
                            );
                        END IF;

                        v_a_liberar := v_a_liberar - v_liberar_lote;
                    END LOOP;
                END IF;
            END IF;

            IF v_nueva_cantidad <> v_old_linea.cantidad THEN
                UPDATE administracion.detalle_pedido
                SET cantidad = v_nueva_cantidad,
                    usu_mod  = v_actor.usuario_login,
                    fec_mod  = CURRENT_TIMESTAMP
                WHERE id_detalle_pedido = v_old_linea.id_detalle_pedido;
            END IF;
        END IF;
    END LOOP;

    -- 2. Insertar productos nuevos agregados en la edición
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_id_producto    := (v_item->>'id_producto')::integer;
        v_nueva_cantidad := (v_item->>'cantidad')::numeric;

        IF NOT EXISTS (
            SELECT 1
            FROM administracion.detalle_pedido d
            WHERE d.id_pedido = p_id_pedido
              AND d.id_producto = v_id_producto
        ) THEN
            SELECT pp.precio_unitario
            INTO v_precio_vigente
            FROM administracion.precio_producto pp
            WHERE pp.id_producto = v_id_producto
              AND pp.estado = 'A'
              AND pp.fecha_desde <= CURRENT_DATE
              AND (pp.fecha_hasta IS NULL OR pp.fecha_hasta >= CURRENT_DATE)
            ORDER BY pp.fecha_desde DESC, pp.id_precio_producto DESC
            LIMIT 1;

            IF v_precio_vigente IS NULL OR v_precio_vigente <= 0 THEN
                RAISE EXCEPTION 'El producto ID % no posee un precio vigente activo', v_id_producto;
            END IF;

            INSERT INTO administracion.detalle_pedido (
                id_pedido,
                id_producto,
                cantidad,
                precio_unitario,
                usu_alta,
                fec_alta
            ) VALUES (
                p_id_pedido,
                v_id_producto,
                v_nueva_cantidad,
                v_precio_vigente,
                v_actor.usuario_login,
                CURRENT_TIMESTAMP
            );
        END IF;
    END LOOP;

    -- 3. Actualizar cabecera del pedido estableciendo el estado 'M' (Modificado)
    UPDATE administracion.pedido
    SET id_cliente        = p_id_cliente,
        modalidad_entrega = v_modalidad,
        domicilio_entrega = nullif(trim(coalesce(p_domicilio_entrega, '')), ''),
        localidad_entrega = nullif(trim(coalesce(p_localidad_entrega, '')), ''),
        provincia_entrega = nullif(trim(coalesce(p_provincia_entrega, '')), ''),
        observaciones     = nullif(trim(coalesce(p_observaciones, '')), ''),
        estado            = 'M',
        usu_mod           = v_actor.usuario_login,
        fec_mod           = CURRENT_TIMESTAMP
    WHERE id_pedido = p_id_pedido;

    RETURN true;
END;
$$;

-- ---------------------------------------------------------------------
-- 8. LISTAR PEDIDOS (Para Gestión de Pedidos y Seguimiento de Pedidos)
--    - Roles 1 y 16: ven todos los pedidos.
--    - Rol 9: ve únicamente los pedidos donde p.usu_alta = su usuario_login.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.listar_pedidos_gestion(p_token UUID)
RETURNS TABLE(
    id_pedido                integer,
    fecha_pedido             timestamp,
    id_cliente               integer,
    cliente_nombre           text,
    cliente_cuit             text,
    cliente_tipo             text,
    modalidad_entrega        text,
    domicilio_entrega        text,
    localidad_entrega        text,
    provincia_entrega        text,
    observaciones            text,
    estado                   text,
    cantidad_lineas          integer,
    cantidad_productos       numeric,
    importe_total            numeric,
    usu_alta                 text,
    fec_alta                 timestamp,
    usu_mod                  text,
    fec_mod                  timestamp,
    usu_despacho             text,
    fec_despacho             timestamp,
    usu_anulacion            text,
    fec_anulacion            timestamp,
    motivo_anulacion         text,
    id_preparacion           integer,
    estado_preparacion       text,
    finalizada_con_excepcion boolean,
    observacion_excepcion    text,
    usu_finalizacion         text,
    fec_finalizacion         timestamp,
    total_reservado          numeric,
    total_recogido           numeric,
    lineas_verificadas       integer,
    picking_iniciado         boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'deposito', 'produccion', 'usuarios', 'public'
AS $$
    WITH actor AS (
        SELECT * FROM usuarios.fn_actor_pedidos(p_token)
    )
    SELECT
        p.id_pedido::integer,
        p.fecha_pedido,
        p.id_cliente::integer,
        c.nombre_razon_social::text AS cliente_nombre,
        coalesce(c.cuit, '')::text AS cliente_cuit,
        trim(c.tipo_cliente)::text AS cliente_tipo,
        trim(p.modalidad_entrega)::text AS modalidad_entrega,
        p.domicilio_entrega::text,
        p.localidad_entrega::text,
        p.provincia_entrega::text,
        p.observaciones::text,
        trim(p.estado)::text AS estado,
        coalesce(det.cant_lineas, 0)::integer AS cantidad_lineas,
        coalesce(det.cant_productos, 0)::numeric AS cantidad_productos,
        coalesce(det.imp_total, 0)::numeric AS importe_total,
        p.usu_alta::text,
        p.fec_alta,
        p.usu_mod::text,
        p.fec_mod,
        p.usu_despacho::text,
        p.fec_despacho,
        p.usu_anulacion::text,
        p.fec_anulacion,
        p.motivo_anulacion::text,
        prep.id_preparacion::integer,
        trim(coalesce(prep.estado, ''))::text AS estado_preparacion,
        coalesce(prep.finalizada_con_excepcion, false) AS finalizada_con_excepcion,
        prep.observacion_excepcion::text,
        prep.usu_finalizacion::text,
        prep.fec_finalizacion,
        coalesce(prep_tot.tot_reservado, 0)::numeric AS total_reservado,
        coalesce(prep_tot.tot_recogido, 0)::numeric AS total_recogido,
        coalesce(verif.cant_verificadas, 0)::integer AS lineas_verificadas,
        (
            coalesce(prep.estado, 'P') <> 'P'
            OR coalesce(prep_tot.tot_recogido, 0) > 0
            OR coalesce(prep_tot.alguno_pickeado, false)
        ) AS picking_iniciado
    FROM administracion.pedido p
    JOIN actor a ON (a.id_rol IN (1, 16) OR p.usu_alta = a.usuario_login)
    JOIN administracion.cliente c ON c.id_cliente = p.id_cliente
    LEFT JOIN LATERAL (
        SELECT
            COUNT(*) AS cant_lineas,
            SUM(dp.cantidad) AS cant_productos,
            SUM(dp.importe_total) AS imp_total
        FROM administracion.detalle_pedido dp
        WHERE dp.id_pedido = p.id_pedido
    ) det ON true
    LEFT JOIN deposito.preparacion_pedido prep
        ON prep.id_pedido = p.id_pedido
    LEFT JOIN LATERAL (
        SELECT
            SUM(dpp.cantidad) FILTER (WHERE dpp.estado = 'A') AS tot_reservado,
            SUM(dpp.cantidad_recogida) FILTER (WHERE dpp.estado = 'A') AS tot_recogido,
            BOOL_OR(dpp.estado_picking <> 'P' OR dpp.cantidad_recogida > 0) AS alguno_pickeado
        FROM deposito.detalle_preparacion_pedido dpp
        WHERE dpp.id_preparacion = prep.id_preparacion
    ) prep_tot ON true
    LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cant_verificadas
        FROM administracion.detalle_pedido dp2
        JOIN deposito.verificacion_detalle_pedido vdp
            ON vdp.id_detalle_pedido = dp2.id_detalle_pedido
           AND vdp.verificado = true
        WHERE dp2.id_pedido = p.id_pedido
    ) verif ON true
    ORDER BY p.id_pedido DESC;
$$;

-- ---------------------------------------------------------------------
-- 9. OBTENER DETALLE COMPLETO Y SEGUIMIENTO DE UN PEDIDO (JSONB)
--    Incluye cabecera, cliente, preparación, líneas de producto con sus
--    cantidades solicitadas/reservadas/recogidas, verificación, lotes
--    asignados y movimientos de stock del pedido.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION usuarios.obtener_detalle_seguimiento_pedido(
    p_token     UUID,
    p_id_pedido INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'administracion', 'deposito', 'produccion', 'usuarios', 'public'
AS $$
DECLARE
    v_actor  RECORD;
    v_pedido RECORD;
    v_lineas JSONB;
    v_movs   JSONB;
BEGIN
    SELECT * INTO v_actor FROM usuarios.fn_actor_pedidos(p_token);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado para consultar pedidos';
    END IF;

    SELECT
        p.id_pedido,
        p.fecha_pedido,
        p.id_cliente,
        c.nombre_razon_social AS cliente_nombre,
        c.cuit AS cliente_cuit,
        trim(c.tipo_cliente) AS cliente_tipo,
        c.telefono AS cliente_telefono,
        c.email AS cliente_email,
        c.domicilio AS cliente_domicilio,
        c.localidad AS cliente_localidad,
        c.provincia AS cliente_provincia,
        trim(p.modalidad_entrega) AS modalidad_entrega,
        p.domicilio_entrega,
        p.localidad_entrega,
        p.provincia_entrega,
        p.observaciones,
        trim(p.estado) AS estado,
        p.usu_alta,
        p.fec_alta,
        p.usu_mod,
        p.fec_mod,
        p.usu_despacho,
        p.fec_despacho,
        p.usu_anulacion,
        p.fec_anulacion,
        p.motivo_anulacion,
        prep.id_preparacion,
        trim(coalesce(prep.estado, '')) AS estado_preparacion,
        prep.usu_alta AS prep_usu_alta,
        prep.fec_alta AS prep_fec_alta,
        prep.usu_mod AS prep_usu_mod,
        prep.fec_mod AS prep_fec_mod,
        coalesce(prep.finalizada_con_excepcion, false) AS finalizada_con_excepcion,
        prep.observacion_excepcion,
        prep.usu_finalizacion,
        prep.fec_finalizacion
    INTO v_pedido
    FROM administracion.pedido p
    JOIN administracion.cliente c ON c.id_cliente = p.id_cliente
    LEFT JOIN deposito.preparacion_pedido prep ON prep.id_pedido = p.id_pedido
    WHERE p.id_pedido = p_id_pedido
      AND (v_actor.id_rol IN (1, 16) OR p.usu_alta = v_actor.usuario_login);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el pedido #% o no tiene permisos para visualizarlo', p_id_pedido;
    END IF;

    -- Líneas del pedido con su estado de reserva, picking, verificación y desglose por lotes
    SELECT coalesce(jsonb_agg(
        jsonb_build_object(
            'id_detalle_pedido', dp.id_detalle_pedido,
            'id_producto', dp.id_producto,
            'producto_codigo', pr.codigo,
            'producto_nombre', pr.nombre,
            'unidad_codigo', coalesce(um.codigo, 'un.'),
            'cantidad_solicitada', dp.cantidad,
            'precio_unitario', dp.precio_unitario,
            'importe_total', dp.importe_total,
            'stock_disponible_actual', coalesce(stk.disponible, 0),
            'cantidad_reservada', coalesce(lotes_agg.cant_reservada, 0),
            'cantidad_recogida', coalesce(lotes_agg.cant_recogida, 0),
            'estado_picking_linea', CASE
                WHEN coalesce(lotes_agg.cant_lotes, 0) = 0 THEN 'SIN_RESERVA'
                WHEN coalesce(lotes_agg.todos_pickeados, false) THEN 'COMPLETO'
                WHEN coalesce(lotes_agg.cant_recogida, 0) > 0 THEN 'PARCIAL'
                ELSE 'PENDIENTE'
            END,
            'verificado', coalesce(vdp.verificado, false),
            'usu_verificacion', vdp.usu_verificacion,
            'fec_verificacion', vdp.fec_verificacion,
            'lotes', coalesce(lotes_agg.lotes_json, '[]'::jsonb)
        ) ORDER BY dp.id_detalle_pedido ASC
    ), '[]'::jsonb)
    INTO v_lineas
    FROM administracion.detalle_pedido dp
    JOIN produccion.producto pr ON pr.id_producto = dp.id_producto
    LEFT JOIN produccion.unidad_medida um ON um.id_unidad_medida = pr.id_unidad_medida
    LEFT JOIN deposito.verificacion_detalle_pedido vdp
        ON vdp.id_detalle_pedido = dp.id_detalle_pedido
    LEFT JOIN LATERAL (
        SELECT SUM(l.cantidad_total - s.cantidad_reservada - s.cantidad_consumida) AS disponible
        FROM produccion.lote_producto l
        JOIN deposito.stock s ON s.id_lote_producto = l.id_lote_producto
        JOIN deposito.lote_posicion lp ON lp.id_lote_producto = l.id_lote_producto AND lp.estado = 'A'
        JOIN deposito.posicion pos ON pos.id_posicion = lp.id_posicion
        WHERE l.id_producto = dp.id_producto
          AND l.estado_lote = 'U'
          AND l.estado = 'A'
          AND s.estado = 'A'
          AND pos.estado = 'A'
          AND pos.estado_posicion = 'O'
          AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURRENT_DATE)
          AND (l.cantidad_total - s.cantidad_reservada - s.cantidad_consumida) > 0
    ) stk ON true
    LEFT JOIN LATERAL (
        SELECT
            COUNT(*) AS cant_lotes,
            SUM(dpp.cantidad) AS cant_reservada,
            SUM(dpp.cantidad_recogida) AS cant_recogida,
            BOOL_AND(dpp.estado_picking = 'L') AS todos_pickeados,
            jsonb_agg(
                jsonb_build_object(
                    'id_detalle_preparacion', dpp.id_detalle_preparacion,
                    'id_lote_producto', dpp.id_lote_producto,
                    'nro_lote', lp_prod.nro_lote,
                    'fecha_fabricacion', lp_prod.fecha_fabricacion,
                    'fecha_vencimiento', lp_prod.fecha_vencimiento,
                    'posicion_codigo', coalesce(pos.codigo, '—'),
                    'cantidad_reservada', dpp.cantidad,
                    'cantidad_recogida', dpp.cantidad_recogida,
                    'estado_detalle_prep', trim(dpp.estado),
                    'estado_picking', trim(dpp.estado_picking),
                    'usu_picking', dpp.usu_picking,
                    'fec_picking', dpp.fec_picking
                ) ORDER BY lp_prod.fecha_fabricacion ASC, dpp.id_detalle_preparacion ASC
            ) AS lotes_json
        FROM deposito.detalle_preparacion_pedido dpp
        JOIN produccion.lote_producto lp_prod
            ON lp_prod.id_lote_producto = dpp.id_lote_producto
        LEFT JOIN deposito.lote_posicion lpos
            ON lpos.id_lote_producto = dpp.id_lote_producto
           AND lpos.estado = 'A'
        LEFT JOIN deposito.posicion pos
            ON pos.id_posicion = lpos.id_posicion
        WHERE dpp.id_preparacion = v_pedido.id_preparacion
          AND (dpp.id_detalle_pedido = dp.id_detalle_pedido OR (dpp.id_detalle_pedido IS NULL AND lp_prod.id_producto = dp.id_producto))
          AND dpp.estado <> 'C'
    ) lotes_agg ON true
    WHERE dp.id_pedido = p_id_pedido;

    -- Historial de movimientos de stock del pedido (reservas, liberaciones, picking, despacho)
    SELECT coalesce(jsonb_agg(
        jsonb_build_object(
            'id_movimiento_stock', m.id_movimiento_stock,
            'tipo_movimiento', m.tipo_movimiento,
            'cantidad', m.cantidad,
            'id_lote_producto', m.id_lote_producto,
            'nro_lote', l.nro_lote,
            'producto_codigo', pr.codigo,
            'producto_nombre', pr.nombre,
            'posicion_origen', pos_orig.codigo,
            'posicion_destino', pos_dest.codigo,
            'observacion', m.observacion,
            'usu_alta', m.usu_alta,
            'fec_alta', m.fec_alta
        ) ORDER BY m.fec_alta DESC, m.id_movimiento_stock DESC
    ), '[]'::jsonb)
    INTO v_movs
    FROM deposito.movimiento_stock_pedido m
    JOIN produccion.lote_producto l ON l.id_lote_producto = m.id_lote_producto
    JOIN produccion.producto pr ON pr.id_producto = l.id_producto
    LEFT JOIN deposito.posicion pos_orig ON pos_orig.id_posicion = m.id_posicion_origen
    LEFT JOIN deposito.posicion pos_dest ON pos_dest.id_posicion = m.id_posicion_destino
    WHERE m.id_pedido = p_id_pedido;

    RETURN jsonb_build_object(
        'pedido', to_jsonb(v_pedido),
        'lineas', v_lineas,
        'movimientos', v_movs
    );
END;
$$;

GRANT EXECUTE ON FUNCTION usuarios.listar_clientes_activos_pedido(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_productos_disponibles_pedido(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.crear_pedido_cliente(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.confirmar_pedido_autorizado(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.modificar_pedido_autorizado(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.listar_pedidos_gestion(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION usuarios.obtener_detalle_seguimiento_pedido(UUID, INTEGER) TO anon, authenticated;
