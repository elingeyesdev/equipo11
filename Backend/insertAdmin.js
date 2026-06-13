const { Pool } = require('pg');
const logger = require('./Src/utils/logger');

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'sistema_ambiental',
  user: 'admin',
  password: 'admin123',
});

async function main() {
  try {
    const res = await pool.query(`
      INSERT INTO usuarios (rol_id, nombre, apellido, email, password_hash, email_verificado)
      VALUES (
        (SELECT id FROM roles WHERE clave = 'admin'),
        'Admin', 'Sistema', 'luiyimateoencinas@gmail.com',
        '$2b$10$hXd0FIB0cZYfcLAthJ.pqOkPoU0VWoTtIruM69gfOwcK8F8dLxFsa',
        TRUE
      )
      ON CONFLICT (email) DO UPDATE SET 
        rol_id = EXCLUDED.rol_id, 
        password_hash = EXCLUDED.password_hash, 
        nombre = EXCLUDED.nombre;
    `);
    logger.info('Usuario admin insertado/actualizado correctamente:', res.rowCount);
  } catch (err) {
    logger.error('Error insertando usuario:', err);
  } finally {
    await pool.end();
  }
}

main();
