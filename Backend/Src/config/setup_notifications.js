const pool = require('./db');

async function setup() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS configuracion_notificaciones (
        id SERIAL PRIMARY KEY,
        tipo VARCHAR(50) UNIQUE NOT NULL, -- 'email', 'whatsapp', 'telegram'
        habilitado BOOLEAN DEFAULT FALSE,
        destino VARCHAR(255), -- email, phone number, or chat_id
        config_extra JSONB DEFAULT '{}', -- for things like telegram bot token if needed per user, though usually global
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default values if not exists
    const seed = [
      ['email', false, ''],
      ['whatsapp', false, ''],
      ['telegram', false, '']
    ];

    for (const [tipo, habilitado, destino] of seed) {
      await pool.query(`
        INSERT INTO configuracion_notificaciones (tipo, habilitado, destino)
        VALUES ($1, $2, $3)
        ON CONFLICT (tipo) DO NOTHING;
      `, [tipo, habilitado, destino]);
    }

    console.log('✅ Tabla configuracion_notificaciones creada y sembrada.');
  } catch (err) {
    console.error('❌ Error configurando notificaciones:', err);
  } finally {
    process.exit();
  }
}

setup();
