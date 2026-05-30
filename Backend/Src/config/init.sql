-- Ejecutar este script en tu base de datos PostgreSQL
-- Base de datos: sistema_ambiental

CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  apellido      VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  activo        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuarios_plantillas (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre_plantilla VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- Ej: 'ESTANDAR_LOGISTICA', 'PERSONALIZADA'
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    configuracion JSONB NOT NULL
);
