-- =============================================================================
-- MIGRACIÓN 002 — Compresión, Continuous Aggregate e Índice GIN
-- Proyecto  : EnviroSense
-- Fecha     : 2026-04-29
-- Requiere  : PostgreSQL 16 + TimescaleDB >= 2.x
--
-- Aplica tres mejoras de rendimiento independientes:
--   1. Compresión automática en `lecturas` para chunks > 7 días
--   2. Continuous Aggregate `lecturas_diarias_resumen` (diario × localidad × métrica)
--   3. Índice GIN en `sesiones_simulacion.configuracion` para búsquedas JSONB
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 1 — Compresión en la hypertable `lecturas`
-- ─────────────────────────────────────────────────────────────────────────────
--
-- segmentby : localidad_id + metrica_id agrupan los datos dentro de cada chunk
--             comprimido; las consultas filtradas por estos campos evitan
--             descomprimir chunks innecesarios.
-- orderby   : tiempo DESC optimiza la lectura de datos recientes dentro de
--             cada segmento comprimido.
--
-- NOTA: La política se activa sobre chunks cuya ventana de tiempo ya cerró
-- hace más de 7 días, de modo que el chunk "activo" (writes frecuentes) nunca
-- se comprime mientras está caliente.

ALTER TABLE lecturas
  SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'localidad_id, metrica_id',
    timescaledb.compress_orderby   = 'tiempo DESC'
  );

SELECT add_compression_policy(
  'lecturas',
  compress_after => INTERVAL '7 days'
);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 2 — Continuous Aggregate `lecturas_diarias_resumen`
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Precalcula estadísticas diarias por localidad y métrica.
-- materialized_only = FALSE permite que las consultas combinen datos
-- materializados (históricos) con datos aún no refrescados (recientes),
-- garantizando que el aggregate nunca devuelva un rango temporal vacío.

CREATE MATERIALIZED VIEW lecturas_diarias_resumen
  WITH (timescaledb.continuous, timescaledb.materialized_only = FALSE)
AS
SELECT
  time_bucket('1 day', tiempo)  AS dia,
  localidad_id,
  metrica_id,
  AVG(valor)::DECIMAL(12,4)     AS promedio,
  MIN(valor)                    AS minimo,
  MAX(valor)                    AS maximo,
  COUNT(*)                      AS total_lecturas
FROM lecturas
GROUP BY
  time_bucket('1 day', tiempo),
  localidad_id,
  metrica_id
WITH NO DATA;

-- Refresca el aggregate diariamente: procesa el día anterior completo y
-- mantiene un lag de 1 hora para absorber escrituras tardías.
SELECT add_continuous_aggregate_policy(
  'lecturas_diarias_resumen',
  start_offset  => INTERVAL '3 days',   -- re-procesa los últimos 3 días por si hay correcciones
  end_offset    => INTERVAL '1 hour',   -- deja 1 h de margen para escrituras tardías
  schedule_interval => INTERVAL '1 day'
);

-- Índices sobre la vista materializada para acelerar consultas analíticas.
CREATE INDEX ON lecturas_diarias_resumen (localidad_id, dia DESC);
CREATE INDEX ON lecturas_diarias_resumen (metrica_id,   dia DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 3 — Índice GIN en `sesiones_simulacion.configuracion`
-- ─────────────────────────────────────────────────────────────────────────────
--
-- jsonb_path_ops es el operador class más eficiente para búsquedas de
-- contenido (@>, @@, @?). Reduce el tamaño del índice respecto al default
-- jsonb_ops porque sólo indexa valores, no pares clave-valor completos.
-- Úsalo cuando las consultas buscan por valor ("¿alguna sesión con
-- intervalo_ms=500?") y no por existencia de clave.

CREATE INDEX idx_sesiones_configuracion_gin
  ON sesiones_simulacion
  USING GIN (configuracion jsonb_path_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación rápida (comentar en producción si no se desea output)
-- ─────────────────────────────────────────────────────────────────────────────

-- Confirma que la política de compresión quedó registrada:
-- SELECT * FROM timescaledb_information.compression_settings WHERE hypertable_name = 'lecturas';
-- SELECT * FROM timescaledb_information.jobs WHERE application_name ILIKE '%compress%';

-- Confirma el continuous aggregate y su política:
-- SELECT * FROM timescaledb_information.continuous_aggregates WHERE view_name = 'lecturas_diarias_resumen';
-- SELECT * FROM timescaledb_information.jobs WHERE application_name ILIKE '%policy%';

-- Confirma el índice GIN:
-- SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename = 'sesiones_simulacion' AND indexname = 'idx_sesiones_configuracion_gin';
