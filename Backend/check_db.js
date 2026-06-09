const { Pool } = require('pg');

const pool = new Pool({
  host: 'db',
  port: 5432,
  database: 'sistema_ambiental',
  user: 'admin',
  password: 'admin123',
});

async function main() {
  try {
    const resLoc = await pool.query("SELECT id, nombre FROM localidades ORDER BY id DESC LIMIT 10");
    console.log("LAST 10 LOCALITIES:");
    console.table(resLoc.rows);

    const resHistorial = await pool.query(`
      SELECT
        date_trunc('second', l.tiempo)  AS ts,
        loc.id                          AS localidad_id,
        loc.nombre                      AS ciudad,
        m.clave                         AS metrica,
        l.valor
      FROM lecturas l
      JOIN localidades loc ON loc.id = l.localidad_id
      JOIN metricas    m   ON m.id   = l.metrica_id
      ORDER BY ts ASC, loc.id
    `);
    console.log("TOTAL ROWS IN HISTORIAL QUERY:", resHistorial.rows.length);
    const uniqueCities = [...new Set(resHistorial.rows.map(r => r.ciudad))];
    console.log("UNIQUE CITIES IN HISTORIAL QUERY:", uniqueCities);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
