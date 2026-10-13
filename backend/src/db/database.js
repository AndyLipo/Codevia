const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.query("SHOW client_encoding")
    .then(result => console.log("CLIENT ENCODING:", result.rows))
    .catch(error => console.error("ERROR ENCODING:", error));

module.exports = pool;