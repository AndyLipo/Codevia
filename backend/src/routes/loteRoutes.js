const express = require('express');
const router = express.Router();
const {
    obtenerLotes,
    registrarLoteExterno,
    confirmarRecepcion,
    ubicarLote,
    trasladarLote,
    obtenerHistorialLote,
    eliminarLoteAgotado
} = require('../controllers/loteController');

// Rutas de Lotes
router.get('/', obtenerLotes);
router.post('/externo', registrarLoteExterno);
router.post('/recibir', confirmarRecepcion);
router.post('/ubicar', ubicarLote);
router.post('/trasladar', trasladarLote);
router.get('/:id/historial', obtenerHistorialLote);
router.delete('/:id', eliminarLoteAgotado);

module.exports = router;
