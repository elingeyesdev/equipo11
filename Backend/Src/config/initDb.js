const db = require('./db');

/**
 * Inicializa datos esenciales si las tablas están vacías.
 * Esto asegura que en producción (Portainer) la app siempre sea funcional.
 */
async function initDatabase() {
  // 0. Crear tablas de caché (Esenciales para el funcionamiento de los servicios)
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS radar_grid_cache (
        latitud DECIMAL(10,4) NOT NULL,
        longitud DECIMAL(10,4) NOT NULL,
        weather_code INT,
        temperatura DECIMAL(5,2),
        wind_speed DECIMAL(5,2),
        wind_direction INT,
        rafagas DECIMAL(5,2),
        presion DECIMAL(6,2),
        forecast_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (latitud, longitud, forecast_time)
      );

      CREATE TABLE IF NOT EXISTS sensores_cache (
        sensor_id   TEXT PRIMARY KEY,
        nombre      TEXT NOT NULL,
        latitud     DECIMAL(10,6) NOT NULL,
        longitud    DECIMAL(10,6) NOT NULL,
        temperatura DECIMAL(5,2),
        humedad     DECIMAL(5,2),
        aqi         DECIMAL(6,2),
        ica         DECIMAL(5,2),
        ruido       DECIMAL(5,2),
        weather_code INT,
        actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ Tablas de caché verificadas/creadas.');
  } catch (err) {
    console.error('❌ Error creando tablas de caché:', err.message);
  }

  // 1. Verificar Notificaciones
  try {
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
  } catch (err) {
    console.warn('⚠️ No se pudo inicializar configuracion_notificaciones (posiblemente la tabla no existe aún):', err.message);
  }

  // 2. Verificar Umbrales
  try {
    const { rows: umbrales } = await db.query('SELECT count(*) FROM umbrales');
    if (parseInt(umbrales[0].count) === 0) {
      console.log('📦 Poblando tabla umbrales con valores por defecto...');
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
    console.warn('⚠️ No se pudo inicializar umbrales (posiblemente la tabla o métricas no existen aún):', err.message);
  }
}

module.exports = { initDatabase };
