const db = require('./db');

/**
 * Inicializa datos esenciales si las tablas están vacías.
 * Esto asegura que en producción (Portainer) la app siempre sea funcional.
 */
async function initDatabase() {
  try {
    // 0. Crear tablas que podrían faltar si el esquema inicial falló o es parcial
    await db.query(`
      CREATE TABLE IF NOT EXISTS radar_grid_cache (
        latitud DECIMAL(10,4) NOT NULL,
        longitud DECIMAL(10,4) NOT NULL,
        weather_code INT,
        temperatura DECIMAL(5,2),
        actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (latitud, longitud)
      );

      CREATE TABLE IF NOT EXISTS sensores_cache (
        id SERIAL PRIMARY KEY,
        localidad_id INT,
        data JSONB,
        actualizado_en TIMESTAMPTZ DEFAULT NOW()
      );
    `);

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
        INSERT INTO umbrales (metrica_id, nivel, valor_min, valor_max, color_hex, label) VALUES
        ((SELECT id FROM metricas WHERE clave='aqi'), 1, 0, 50, '#00e400', 'Bueno'),
        ((SELECT id FROM metricas WHERE clave='aqi'), 2, 51, 100, '#ffff00', 'Moderado'),
        ((SELECT id FROM metricas WHERE clave='aqi'), 3, 101, 150, '#ff7e00', 'Dañino Sensibles'),
        ((SELECT id FROM metricas WHERE clave='aqi'), 4, 151, 200, '#ff0000', 'Dañino'),
        ((SELECT id FROM metricas WHERE clave='aqi'), 5, 201, 300, '#8f3f97', 'Muy Dañino'),
        ((SELECT id FROM metricas WHERE clave='aqi'), 6, 301, 500, '#7e0023', 'Peligroso'),
        
        ((SELECT id FROM metricas WHERE clave='temperatura'), 1, -10, 10, '#0066ff', 'Frío'),
        ((SELECT id FROM metricas WHERE clave='temperatura'), 2, 11, 25, '#00cc66', 'Fresco'),
        ((SELECT id FROM metricas WHERE clave='temperatura'), 3, 26, 35, '#ff9900', 'Cálido'),
        ((SELECT id FROM metricas WHERE clave='temperatura'), 4, 36, 50, '#cc0000', 'Calor')
      `);
    }
  } catch (err) {
    throw err;
  }
}

module.exports = { initDatabase };
