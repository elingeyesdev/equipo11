const db = require('./db');

/**
 * Inicializa datos esenciales si las tablas están vacías.
 * Esto asegura que en producción (Portainer) la app siempre sea funcional.
 */
async function initDatabase() {
  try {
    // 1. Verificar Notificaciones
    const { rows: notifs } = await db.query('SELECT count(*) FROM configuracion_notificaciones');
    if (parseInt(notifs[0].count) === 0) {
      console.log('📦 Poblando tabla configuracion_notificaciones...');
      await db.query(`
        INSERT INTO configuracion_notificaciones (tipo, habilitado, destino) VALUES
        ('email', false, ''),
        ('whatsapp', false, ''),
        ('telegram', false, '')
      `);
    }

    // 2. Verificar Umbrales (Mínimo para el mapa de calor)
    const { rows: umbrales } = await db.query('SELECT count(*) FROM umbrales');
    if (parseInt(umbrales[0].count) === 0) {
      console.log('📦 Poblando tabla umbrales con valores por defecto...');
      // Insertar escala básica de AQI
      await db.query(`
        INSERT INTO umbrales (metrica, nivel, valor_min, valor_max, color_hex, label) VALUES
        ('aqi', 1, 0, 50, '#00e400', 'Bueno'),
        ('aqi', 2, 51, 100, '#ffff00', 'Moderado'),
        ('aqi', 3, 101, 150, '#ff7e00', 'Dañino Sensibles'),
        ('aqi', 4, 151, 200, '#ff0000', 'Dañino'),
        ('aqi', 5, 201, 300, '#8f3f97', 'Muy Dañino'),
        ('aqi', 6, 301, 500, '#7e0023', 'Peligroso'),
        
        ('temperatura', 1, -10, 10, '#0066ff', 'Frío'),
        ('temperatura', 2, 11, 25, '#00cc66', 'Fresco'),
        ('temperatura', 3, 26, 35, '#ff9900', 'Cálido'),
        ('temperatura', 4, 36, 50, '#cc0000', 'Calor')
      `);
    }
  } catch (err) {
    throw err;
  }
}

module.exports = { initDatabase };
