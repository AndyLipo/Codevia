const pool = require('../db/database');

/**
 * Obtener todos los lotes con producto, stock disponible, ubicación y estado
 */
const obtenerLotes = async (req, res) => {
    try {
        const query = `
            SELECT 
                lp.id_lote_producto,
                lp.id_produccion,
                lp.id_producto,
                lp.nro_lote,
                lp.fecha_fabricacion,
                lp.fecha_vencimiento,
                lp.cantidad_total,
                lp.estado_lote,
                lp.estado,
                lp.usu_alta,
                lp.fec_alta,
                lp.usu_mod,
                lp.fec_mod,
                lp.origen_lote,
                p.codigo AS producto_codigo,
                p.nombre AS producto_nombre,
                p.vida_util_meses,
                um.codigo AS unidad_codigo,
                um.nombre AS unidad_nombre,
                COALESCE(stk.cantidad_reservada, 0) AS cantidad_reservada,
                COALESCE(stk.cantidad_consumida, 0) AS cantidad_consumida,
                GREATEST(0, lp.cantidad_total - COALESCE(stk.cantidad_reservada, 0) - COALESCE(stk.cantidad_consumida, 0)) AS cantidad_disponible,
                CASE 
                    WHEN lp.estado_lote IN ('P', 'R') THEN NULL
                    ELSE pos.codigo
                END AS ubicacion_codigo,
                pos.id_posicion
            FROM produccion.lote_producto lp
            INNER JOIN produccion.producto p ON p.id_producto = lp.id_producto
            LEFT JOIN produccion.unidad_medida um ON um.id_unidad_medida = p.id_unidad_medida
            LEFT JOIN deposito.stock stk ON stk.id_lote_producto = lp.id_lote_producto AND stk.estado = 'A'
            LEFT JOIN deposito.lote_posicion lpos ON lpos.id_lote_producto = lp.id_lote_producto AND lpos.estado = 'A'
            LEFT JOIN deposito.posicion pos ON pos.id_posicion = lpos.id_posicion AND pos.estado = 'A'
            ORDER BY 
                CASE lp.estado_lote
                    WHEN 'P' THEN 1
                    WHEN 'R' THEN 2
                    WHEN 'U' THEN 3
                    WHEN 'A' THEN 4
                    ELSE 5
                END ASC,
                lp.id_lote_producto DESC;
        `;

        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener lotes:', error);
        res.status(500).json({
            error: 'Error al obtener los lotes',
            detalle: error.message
        });
    }
};

/**
 * Registrar lote externo / inicial usando la función de base de datos
 */
const registrarLoteExterno = async (req, res) => {
    try {
        const {
            id_producto,
            cantidad_total,
            usuario,
            fecha_fabricacion,
            fecha_vencimiento
        } = req.body;

        if (!id_producto || !cantidad_total) {
            return res.status(400).json({
                error: 'El producto y la cantidad son obligatorios.'
            });
        }

        const usuAlta = usuario || req.user?.usuario_login || 'SISTEMA';

        const result = await pool.query(
            `SELECT deposito.fn_registrar_lote_inicial($1, $2, $3, $4, $5) AS resultado;`,
            [
                Number(id_producto),
                Number(cantidad_total),
                usuAlta,
                fecha_fabricacion ? fecha_fabricacion : null,
                fecha_vencimiento ? fecha_vencimiento : null
            ]
        );

        res.status(201).json({
            mensaje: 'Lote externo registrado correctamente',
            resultado: result.rows[0]?.resultado
        });
    } catch (error) {
        console.error('Error al registrar lote externo:', error);
        res.status(500).json({
            error: 'Error al registrar lote externo',
            detalle: error.message
        });
    }
};

/**
 * Confirmar recepción de lote (Cambia estado P -> R)
 */
const confirmarRecepcion = async (req, res) => {
    try {
        const { id_lote_producto, usuario } = req.body;
        const usu = usuario || req.user?.usuario_login || 'SISTEMA';

        await pool.query(
            `SELECT deposito.fn_recibir_lote($1, $2);`,
            [Number(id_lote_producto), usu]
        );

        res.json({ mensaje: 'Recepción del lote confirmada correctamente' });
    } catch (error) {
        console.error('Error al confirmar recepción:', error);
        res.status(500).json({
            error: 'Error al confirmar recepción del lote',
            detalle: error.message
        });
    }
};

/**
 * Asignar ubicación al lote (Cambia estado R -> U)
 */
const ubicarLote = async (req, res) => {
    try {
        const { id_lote_producto, id_posicion, usuario } = req.body;
        const usu = usuario || req.user?.usuario_login || 'SISTEMA';

        await pool.query(
            `SELECT deposito.fn_ubicar_lote($1, $2, $3);`,
            [Number(id_lote_producto), Number(id_posicion), usu]
        );

        res.json({ mensaje: 'Lote ubicado correctamente en la posición asignada' });
    } catch (error) {
        console.error('Error al ubicar lote:', error);
        res.status(500).json({
            error: 'Error al ubicar lote',
            detalle: error.message
        });
    }
};

/**
 * Trasladar / mover lote a otra posición
 */
const trasladarLote = async (req, res) => {
    try {
        const { id_lote_producto, id_posicion_destino, usuario } = req.body;
        const usu = usuario || req.user?.usuario_login || 'SISTEMA';

        await pool.query(
            `SELECT deposito.fn_trasladar_lote($1, $2, $3);`,
            [Number(id_lote_producto), Number(id_posicion_destino), usu]
        );

        res.json({ mensaje: 'Lote trasladado correctamente' });
    } catch (error) {
        console.error('Error al trasladar lote:', error);
        res.status(500).json({
            error: 'Error al trasladar lote',
            detalle: error.message
        });
    }
};

/**
 * Obtener historial de movimientos y asignaciones de un lote
 */
const obtenerHistorialLote = async (req, res) => {
    try {
        const { id } = req.params;

        const [posicionesRes, movimientosRes] = await Promise.all([
            pool.query(`
                SELECT 
                    lp.id_lote_posicion,
                    lp.id_lote_producto,
                    lp.id_posicion,
                    p.codigo AS posicion_codigo,
                    lp.fecha_asignacion,
                    lp.estado,
                    lp.usu_alta,
                    lp.fec_alta
                FROM deposito.lote_posicion lp
                LEFT JOIN deposito.posicion p ON p.id_posicion = lp.id_posicion
                WHERE lp.id_lote_producto = $1
                ORDER BY lp.id_lote_posicion DESC;
            `, [id]),
            pool.query(`
                SELECT 
                    m.id_movimiento_lote,
                    m.tipo_movimiento,
                    m.id_posicion_origen,
                    po.codigo AS posicion_origen_codigo,
                    m.id_posicion_destino,
                    pd.codigo AS posicion_destino_codigo,
                    m.fecha_movimiento,
                    m.observacion,
                    m.usu_alta
                FROM deposito.movimiento_lote m
                LEFT JOIN deposito.posicion po ON po.id_posicion = m.id_posicion_origen
                LEFT JOIN deposito.posicion pd ON pd.id_posicion = m.id_posicion_destino
                WHERE m.id_lote_producto = $1
                ORDER BY m.fecha_movimiento DESC;
            `, [id])
        ]);

        res.json({
            ubicaciones: posicionesRes.rows,
            movimientos: movimientosRes.rows
        });
    } catch (error) {
        console.error('Error al obtener historial de lote:', error);
        res.status(500).json({
            error: 'Error al obtener historial del lote',
            detalle: error.message
        });
    }
};

/**
 * Eliminar lote agotado (cambia estado = 'E', manteniendo estado_lote = 'A')
 */
const eliminarLoteAgotado = async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = req.body.usuario || req.user?.usuario_login || 'SISTEMA';

        // Validar que el lote exista y esté en estado_lote = 'A'
        const check = await pool.query(
            `SELECT id_lote_producto, nro_lote, estado_lote, estado 
             FROM produccion.lote_producto 
             WHERE id_lote_producto = $1;`,
            [id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Lote no encontrado' });
        }

        const lote = check.rows[0];
        if (lote.estado_lote !== 'A') {
            return res.status(400).json({
                error: `Solo se pueden eliminar lotes agotados (estado_lote = 'A'). El lote actual tiene estado_lote = '${lote.estado_lote}'.`
            });
        }

        const result = await pool.query(
            `UPDATE produccion.lote_producto
             SET estado = 'E',
                 usu_mod = $1,
                 fec_mod = CURRENT_TIMESTAMP
             WHERE id_lote_producto = $2
             RETURNING *;`,
            [usuario, id]
        );

        res.json({
            mensaje: `Lote ${lote.nro_lote} eliminado correctamente`,
            lote: result.rows[0]
        });
    } catch (error) {
        console.error('Error al eliminar lote agotado:', error);
        res.status(500).json({
            error: 'Error al eliminar lote agotado',
            detalle: error.message
        });
    }
};

module.exports = {
    obtenerLotes,
    registrarLoteExterno,
    confirmarRecepcion,
    ubicarLote,
    trasladarLote,
    obtenerHistorialLote,
    eliminarLoteAgotado
};
