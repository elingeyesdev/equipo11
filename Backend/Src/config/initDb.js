const db = require('./db');
const logger = require('../utils/logger');

/**
 * Inicializa datos esenciales si las tablas están vacías.
 * Esto asegura que en producción (Portainer) la app siempre sea funcional.
 */
async function initDatabase() {
  const ensureColumn = async (table, colDef) => {
    try {
      await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${colDef}`);
      logger.info(`[DB Init] Columna asegurada: ${table}.${colDef.trim().split(/\s+/)[0]}`);
    } catch (err) {
      logger.warn(`[DB Init] No se pudo asegurar columna ${table}: ${err.message}`);
    }
  };

  // Asegurar columnas para localización y notificaciones de usuario
  await ensureColumn('usuarios', 'pais VARCHAR(100)');
  await ensureColumn('usuarios', 'ciudad VARCHAR(100)');
  await ensureColumn('usuarios', 'latitud DOUBLE PRECISION');
  await ensureColumn('usuarios', 'longitud DOUBLE PRECISION');
  await ensureColumn('usuarios', 'notif_email BOOLEAN DEFAULT FALSE');
  await ensureColumn('usuarios', 'notif_whatsapp BOOLEAN DEFAULT FALSE');
  await ensureColumn('usuarios', 'whatsapp_destino VARCHAR(100)');
  await ensureColumn('usuarios', 'notif_telegram BOOLEAN DEFAULT FALSE');
  await ensureColumn('usuarios', 'telegram_destino VARCHAR(100)');
  await ensureColumn('alertas', "tipo VARCHAR(20) NOT NULL DEFAULT 'real' CHECK (tipo IN ('real', 'prediccion', 'simulacion'))");

  // Hot-migration: actualizar el check constraint de tipo en alertas si ya existía la versión anterior
  try {
    const checkConstraintQuery = `
      SELECT tc.constraint_name 
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name 
        AND tc.table_schema = ccu.table_schema
        AND tc.table_name = ccu.table_name
      WHERE tc.table_name = 'alertas' 
        AND ccu.column_name = 'tipo' 
        AND tc.constraint_type = 'CHECK'
    `;
    const { rows: constraints } = await db.query(checkConstraintQuery);
    
    for (const r of constraints) {
      await db.query(`ALTER TABLE alertas DROP CONSTRAINT IF EXISTS ${r.constraint_name}`);
      logger.info(`[DB Init] Removiendo check constraint anterior: ${r.constraint_name}`);
    }
    
    await db.query(`
      ALTER TABLE alertas 
      ADD CONSTRAINT alertas_tipo_check 
      CHECK (tipo IN ('real', 'prediccion', 'simulacion'))
    `);
    logger.info('✅ Check constraint para alertas.tipo actualizado exitosamente.');
  } catch (err) {
    logger.warn('⚠️ No se pudo migrar el check constraint de alertas.tipo (puede no existir la tabla aún):', err.message);
  }

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
        cape DECIMAL(8,2),
        hlcy DECIMAL(8,2),
        refc DECIMAL(8,2),
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
        wind_speed   DECIMAL(5,2),
        wind_direction INT,
        actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS fcm_tokens (
        id SERIAL PRIMARY KEY,
        usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS usuarios_plantillas (
        id SERIAL PRIMARY KEY,
        usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
        nombre_plantilla VARCHAR(255) NOT NULL,
        tipo VARCHAR(50) NOT NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        configuracion JSONB NOT NULL
      );
    `);
    logger.info('✅ Tablas de caché y fcm_tokens verificadas/creadas.');
  } catch (err) {
    logger.error('❌ Error creando tablas de caché/fcm_tokens:', err.message);
  }

  // 0.2 Crear tablas para Módulo de Simulación de Escenarios (What-If)
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS simulaciones (
        id            BIGSERIAL       PRIMARY KEY,
        creado_por    INT             REFERENCES usuarios(id) ON DELETE SET NULL,
        nombre        VARCHAR(200)    NOT NULL,
        descripcion   TEXT,
        tipo_evento   VARCHAR(50)     NOT NULL,  -- 'tormenta', 'ola_calor', 'incendio', 'inundacion', 'custom'
        area_geo      JSONB           NOT NULL,
        localidad_id  INT             REFERENCES localidades(id) ON DELETE CASCADE,
        parametros    JSONB           NOT NULL,
        estado        VARCHAR(20)     NOT NULL DEFAULT 'activa' 
                      CHECK (estado IN ('activa', 'finalizada', 'cancelada')),
        creado_en     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        finalizada_en TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS simulaciones_datos (
        id              BIGSERIAL     PRIMARY KEY,
        simulacion_id   BIGINT        NOT NULL REFERENCES simulaciones(id) ON DELETE CASCADE,
        latitud         DECIMAL(10,6) NOT NULL,
        longitud        DECIMAL(10,6) NOT NULL,
        metrica_clave   VARCHAR(50)   NOT NULL,
        valor           DECIMAL(12,4) NOT NULL,
        tiempo          TIMESTAMPTZ   NOT NULL,
        UNIQUE (simulacion_id, latitud, longitud, metrica_clave, tiempo)
      );

      CREATE INDEX IF NOT EXISTS idx_sim_datos_sim ON simulaciones_datos(simulacion_id);
      CREATE INDEX IF NOT EXISTS idx_sim_datos_tiempo ON simulaciones_datos(simulacion_id, tiempo);
    `);
    logger.info('✅ Tablas de simulación de escenarios (What-If) verificadas/creadas.');
  } catch (err) {
    logger.error('❌ Error creando tablas de simulación de escenarios:', err.message);
  }

  // 1. Verificar Notificaciones
  try {
    const { rows: notifs } = await db.query('SELECT count(*) FROM configuracion_notificaciones');
    if (parseInt(notifs[0].count) === 0) {
      logger.info('📦 Poblando tabla configuracion_notificaciones...');
      await db.query(`
        INSERT INTO configuracion_notificaciones (tipo, habilitado, destino) VALUES
        ('email', false, ''),
        ('whatsapp', false, ''),
        ('telegram', false, '')
      `);
    }
  } catch (err) {
    logger.warn('⚠️ No se pudo inicializar configuracion_notificaciones (posiblemente la tabla no existe aún):', err.message);
  }

  // 2. Verificar Umbrales
  try {
    const { rows: umbrales } = await db.query('SELECT count(*) FROM umbrales');
    if (parseInt(umbrales[0].count) === 0) {
      logger.info('📦 Poblando tabla umbrales con valores por defecto...');
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
    logger.warn('⚠️ No se pudo inicializar umbrales (posiblemente la tabla o métricas no existen aún):', err.message);
  }
}

module.exports = { initDatabase };
