-- =============================================
-- EnviroSense — Esquema inicial de base de datos
-- Se ejecuta automáticamente al levantar Docker
-- =============================================

-- Tabla de usuarios (módulo auth existente)
CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  apellido      VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  activo        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Tabla de métricas ambientales (histórico)
CREATE TABLE IF NOT EXISTS metricas_ambientales (
  id                  SERIAL PRIMARY KEY,
  latitud             DECIMAL(9,6) NOT NULL,
  longitud            DECIMAL(9,6) NOT NULL,
  ciudad              VARCHAR(150) NOT NULL,
  temperatura         DECIMAL(5,2),
  aqi                 INTEGER,
  condicion_climatica VARCHAR(50),
  detalles            JSONB,
  fecha_registro      TIMESTAMP DEFAULT NOW()
);
