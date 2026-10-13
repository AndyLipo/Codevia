const express = require('express');

const {
    obtenerProductos,
    obtenerProductoPorId,
    crearProducto,
    actualizarProducto,
    eliminarProducto,
    obtenerTiposProducto,
    obtenerMateriales,
    obtenerUnidadesMedida
} = require('../controllers/productoController');

const router = express.Router();

router.get('/', obtenerProductos);

router.get('/tipos-producto', obtenerTiposProducto);

router.get('/materiales', obtenerMateriales);

router.get('/unidades-medida', obtenerUnidadesMedida);

router.get('/:id', obtenerProductoPorId);

router.post('/', crearProducto);

router.put('/:id', actualizarProducto);

router.delete('/:id', eliminarProducto);

module.exports = router;