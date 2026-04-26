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

-- ============================================================
-- EXTENSIÓN DE SERIES DE TIEMPO
-- ============================================================
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================================
-- GEOGRAFÍA / LOCALIDADES
-- ============================================================
CREATE TABLE IF NOT EXISTS paises (
  id        SERIAL PRIMARY KEY,
  nombre    VARCHAR(100) NOT NULL,
  codigo_iso2 CHAR(2) UNIQUE NOT NULL,
  geojson   JSONB
);

CREATE TABLE IF NOT EXISTS regiones (
  id         SERIAL PRIMARY KEY,
  pais_id    INT REFERENCES paises(id),
  nombre     VARCHAR(150) NOT NULL,
  nivel      VARCHAR(50),
  geojson    JSONB
);

CREATE TABLE IF NOT EXISTS localidades (
  id          SERIAL PRIMARY KEY,
  region_id   INT REFERENCES regiones(id),
  nombre      VARCHAR(150) NOT NULL,
  latitud     DECIMAL(10, 7) NOT NULL,
  longitud    DECIMAL(10, 7) NOT NULL,
  altitud_m   INT,
  activa      BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_localidades_coords ON localidades(latitud, longitud);

-- ============================================================
-- MÉTRICAS Y UMBRALES
-- ============================================================
CREATE TABLE IF NOT EXISTS metricas (
  id          SERIAL PRIMARY KEY,
  clave       VARCHAR(50) UNIQUE NOT NULL,
  nombre      VARCHAR(100) NOT NULL,
  descripcion TEXT,
  activa      BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS unidades (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(50) NOT NULL,
  simbolo     VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS metrica_unidades (
  metrica_id   INT REFERENCES metricas(id),
  unidad_id    INT REFERENCES unidades(id),
  es_principal BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (metrica_id, unidad_id)
);

CREATE TABLE IF NOT EXISTS umbrales (
  id          SERIAL PRIMARY KEY,
  metrica_id  INT REFERENCES metricas(id),
  nivel       INT NOT NULL,
  label       VARCHAR(50) NOT NULL,
  valor_min   DECIMAL(10,3) NOT NULL,
  valor_max   DECIMAL(10,3) NOT NULL,
  color_hex   CHAR(7) NOT NULL,
  severidad   VARCHAR(20) DEFAULT 'informativa',
  UNIQUE (metrica_id, nivel)
);

-- ============================================================
-- LECTURAS (Hypertable)
-- ============================================================
CREATE TABLE IF NOT EXISTS lecturas (
  tiempo      TIMESTAMPTZ NOT NULL,
  localidad_id INT REFERENCES localidades(id),
  metrica_id  INT REFERENCES metricas(id),
  valor       DECIMAL(10,4) NOT NULL,
  fuente_datos_id INT,
  PRIMARY KEY (tiempo, localidad_id, metrica_id)
);

SELECT create_hypertable('lecturas', 'tiempo', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_lecturas_localidad_tiempo ON lecturas(localidad_id, tiempo DESC);
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
