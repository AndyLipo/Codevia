const pool = require('../db/database');

const obtenerProductos = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM produccion.producto
            ORDER BY id_producto
        `);

        res.json(result.rows);

    } catch (error) {
        console.error('Error al obtener productos:', error);

        res.status(500).json({
            error: 'Error al obtener los productos'
        });
    }
};

const crearProducto = async (req, res) => {
    try {
        const {
            nombre,
            id_tipo_producto,
            id_material,
            id_unidad_medida,
            es_biodegradable,
            vida_util_meses,
            usu_alta
        } = req.body;

        const result = await pool.query(`
            INSERT INTO produccion.producto (
                nombre,
                id_tipo_producto,
                id_material,
                id_unidad_medida,
                es_biodegradable,
                vida_util_meses,
                usu_alta
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7
            )
            RETURNING *;
        `, [
            nombre,
            id_tipo_producto,
            id_material,
            id_unidad_medida,
            es_biodegradable ?? false,
            vida_util_meses,
            usu_alta
        ]);

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error('Error al crear producto:', error);

        res.status(500).json({
            error: 'Error al crear el producto',
            detalle: error.message
        });
    }
};

const obtenerProductoPorId = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT *
            FROM produccion.producto
            WHERE id_producto = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Producto no encontrado'
            });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Error al obtener producto:', error);

        res.status(500).json({
            error: 'Error al obtener el producto',
            detalle: error.message
        });
    }
};

const actualizarProducto = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            nombre,
            id_tipo_producto,
            id_material,
            id_unidad_medida,
            es_biodegradable,
            estado,
            usu_mod
        } = req.body;

        const result = await pool.query(`
            UPDATE produccion.producto
            SET
                nombre = $1,
                id_tipo_producto = $2,
                id_material = $3,
                id_unidad_medida = $4,
                es_biodegradable = $5,
                estado = $6,
                usu_mod = $7,
                fec_mod = CURRENT_TIMESTAMP
            WHERE id_producto = $8
            RETURNING *;
        `, [
            nombre,
            id_tipo_producto,
            id_material,
            id_unidad_medida,
            es_biodegradable,
            estado,
            usu_mod,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Producto no encontrado'
            });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Error al actualizar producto:', error);

        res.status(500).json({
            error: 'Error al actualizar el producto',
            detalle: error.message
        });
    }
};

const eliminarProducto = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            DELETE FROM produccion.producto
            WHERE id_producto = $1
            RETURNING *;
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Producto no encontrado'
            });
        }

        res.json({
            mensaje: 'Producto eliminado correctamente',
            producto: result.rows[0]
        });

    } catch (error) {
        console.error('Error al eliminar producto:', error);

        res.status(500).json({
            error: 'Error al eliminar el producto',
            detalle: error.message
        });
    }
};

const obtenerTiposProducto = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id_tipo_producto,
                descripcion
            FROM produccion.tipo_producto
            WHERE estado = 'A'
            ORDER BY descripcion
        `);

        res.json(result.rows);

    } catch (error) {
        console.error('Error al obtener tipos de producto:', error);

        res.status(500).json({
            error: 'Error al obtener los tipos de producto',
            detalle: error.message
        });
    }
};


const obtenerMateriales = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id_material,
                descripcion
            FROM produccion.material
            WHERE estado = 'A'
            ORDER BY descripcion
        `);

        res.json(result.rows);

    } catch (error) {
        console.error('Error al obtener materiales:', error);

        res.status(500).json({
            error: 'Error al obtener los materiales',
            detalle: error.message
        });
    }
};


const obtenerUnidadesMedida = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id_unidad_medida,
                codigo,
                descripcion
            FROM produccion.unidad_medida
            WHERE estado = 'A'
            ORDER BY descripcion
        `);

        res.json(result.rows);

    } catch (error) {
        console.error('Error al obtener unidades de medida:', error);

        res.status(500).json({
            error: 'Error al obtener las unidades de medida',
            detalle: error.message
        });
    }
};

module.exports = {
    obtenerProductos,
    obtenerProductoPorId,
    crearProducto,
    actualizarProducto,
    eliminarProducto,
    obtenerTiposProducto,
    obtenerMateriales,
    obtenerUnidadesMedida
};