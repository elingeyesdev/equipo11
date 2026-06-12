const { Pool } = require('pg');
require('dotenv').config({ path: './Backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'envirosense_user',
  password: process.env.DB_PASSWORD || 'enviro_pass123',
  database: process.env.DB_NAME || 'envirosense_db'
});

async function run() {
  try {
    const res = await pool.query("SELECT clave, nombre FROM metricas;");
    console.log("Current metricas:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
