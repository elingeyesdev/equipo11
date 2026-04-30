const { Pool } = require('pg');

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
        '$2b$10$TPYyzFpx4etM3Da.4zVTXeSAs2sq9QAhWdCQisqAMXW8MvD8JCoGm',
        TRUE
      )
      ON CONFLICT (email) DO UPDATE SET 
        rol_id = EXCLUDED.rol_id, 
        password_hash = EXCLUDED.password_hash, 
        nombre = EXCLUDED.nombre;
    `);
    console.log('Usuario admin insertado/actualizado correctamente:', res.rowCount);
  } catch (err) {
    console.error('Error insertando usuario:', err);
  } finally {
    await pool.end();
  }
}

main();
