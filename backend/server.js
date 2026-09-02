const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./src/db/database');
const productoRoutes = require('./src/routes/productoRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/productos', productoRoutes);  //api para usar el router.get('/', obtenerProductos);


app.get('/', (req, res) => {
    res.json({
        mensaje: 'Backend Codevia funcionando'
    });
});

app.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');

        res.json({
            conectado: true,
            fecha_servidor: result.rows[0].now
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            conectado: false,
            error: 'No se pudo conectar a la base de datos'
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Backend ejecutándose en http://localhost:${PORT}`);
});