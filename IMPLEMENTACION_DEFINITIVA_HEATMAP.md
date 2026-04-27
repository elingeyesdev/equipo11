# Implementación Definitiva — Mapas de Calor EnviroSense (Global)

**Fecha:** 26 de abril de 2026
**Alcance:** Plan técnico completo y unificado para Claude Code
**Contexto:** Este documento fusiona `PROPUESTA_MAPAS_DE_CALOR.md` y `database_uso_actual.md` en un único plan de ejecución ordenado por las tareas del sprint activo.
**Escala del proyecto:** ⚠️ EnviroSense es una plataforma de monitoreo **a nivel global**, no restringida a Bolivia. Todo GeoJSON, API, endpoint de geografía y sistema de umbrales debe estar diseñado para soportar múltiples países y regiones.

---

## Contexto técnico del proyecto

| Capa | Stack |
|---|---|
| Frontend | React 19 + react-map-gl 7 + Mapbox GL JS + Socket.IO |
| Backend | Node.js + Express + módulos desacoplados |
| Base de datos | PostgreSQL 16 + TimescaleDB (`timescale/timescaledb:latest-pg16`) |
| ORM/Query | `pg` directo (no ORM) |
| Infra | Docker Compose |

**Problema raíz del heatmap:** La capa actual usa `heatmap-density` (densidad de puntos) en lugar de `heatmap-weight` / valor de la métrica. Con estaciones dispersas globalmente, la densidad es espuria y los colores no representan calidad ambiental real.

**Estado de la base de datos:** El esquema `database/esquema_envirosense.sql` ya existe con las tablas `paises`, `regiones`, `localidades`, `metricas`, `umbrales`, `lecturas`. La tabla `lecturas` debe ser convertida a hypertable de TimescaleDB. El frontend aún usa datos hardcodeados (`departamentos.data.js`, umbrales fijos en `MapaMonitoreo.jsx`).

---

## TAREA 1 — Definición de umbrales mejorado por colores

> **Objetivo:** Eliminar todos los umbrales hardcodeados del frontend y el backend. La única fuente de verdad para colores, rangos y etiquetas de severidad es la tabla `umbrales` de la base de datos.

### 1.1 Verificación del estado de TimescaleDB

Antes de cualquier migración, confirmar que el contenedor de Postgres usa la imagen correcta:

```yaml
# docker-compose.yml — asegurarse que este sea el servicio de base de datos
services:
  db:
    image: timescale/timescaledb:latest-pg16   # NO usar "postgres" genérico
    environment:
      POSTGRES_DB: envirosense
      POSTGRES_USER: envirosense
      POSTGRES_PASSWORD: envirosense
    volumes:
      - ./database/esquema_envirosense.sql:/docker-entrypoint-initdb.d/01_schema.sql
      - ./database/seeds:/docker-entrypoint-initdb.d/seeds/
```

Verificación manual dentro del contenedor: `\dx` debe listar `timescaledb`.

### 1.2 Conversión de `lecturas` a hypertable

Agregar al final de `database/esquema_envirosense.sql` si no existe todavía:

```sql
-- Convertir lecturas a hypertable de TimescaleDB para series de tiempo
SELECT create_hypertable('lecturas', 'tiempo', if_not_exists => TRUE);

-- Índice compuesto para consultas típicas: por localidad + tiempo
CREATE INDEX IF NOT EXISTS idx_lecturas_localidad_tiempo
  ON lecturas (localidad_id, tiempo DESC);
```

### 1.3 Seed de umbrales globales (INSERT definitivos)

Crear archivo `database/seeds/02_umbrales.sql`. Este archivo debe contener los breakpoints canónicos para **todas las métricas** del sistema. Es la única fuente de verdad de colores:

```sql
-- ============================================================
-- SEED: Umbrales por métrica (estándares EPA 2024, OMS, NIOSH)
-- Aplica globalmente — no dependen del país/región
-- ============================================================

-- AQI (EPA 2024 — actualización mayo 2024, PM2.5 ajustado)
INSERT INTO umbrales (metrica_id, nivel, label, valor_min, valor_max, color_hex, severidad)
SELECT m.id, 1, 'Bueno',                   0,   50,  '#00e400', 'informativa'  FROM metricas m WHERE m.clave = 'aqi'
UNION ALL
SELECT m.id, 2, 'Moderado',               51,  100,  '#ffff00', 'informativa'  FROM metricas m WHERE m.clave = 'aqi'
UNION ALL
SELECT m.id, 3, 'Dañino para sensibles', 101,  150,  '#ff7e00', 'advertencia'  FROM metricas m WHERE m.clave = 'aqi'
UNION ALL
SELECT m.id, 4, 'No saludable',          151,  200,  '#ff0000', 'critica'      FROM metricas m WHERE m.clave = 'aqi'
UNION ALL
SELECT m.id, 5, 'Muy no saludable',      201,  300,  '#8f3f97', 'critica'      FROM metricas m WHERE m.clave = 'aqi'
UNION ALL
SELECT m.id, 6, 'Peligroso',             301,  500,  '#7e0023', 'emergencia'   FROM metricas m WHERE m.clave = 'aqi'
ON CONFLICT (metrica_id, nivel) DO UPDATE
  SET label = EXCLUDED.label, valor_min = EXCLUDED.valor_min,
      valor_max = EXCLUDED.valor_max, color_hex = EXCLUDED.color_hex,
      severidad = EXCLUDED.severidad;

-- Temperatura (°C — confort OMS + riesgo clínico)
INSERT INTO umbrales (metrica_id, nivel, label, valor_min, valor_max, color_hex, severidad)
SELECT m.id, 1, 'Frío extremo',   -100,  -10,  '#08306b', 'emergencia'  FROM metricas m WHERE m.clave = 'temperatura'
UNION ALL
SELECT m.id, 2, 'Frío',            -10,    5,  '#2171b5', 'advertencia' FROM metricas m WHERE m.clave = 'temperatura'
UNION ALL
SELECT m.id, 3, 'Fresco',            5,   18,  '#6baed6', 'informativa' FROM metricas m WHERE m.clave = 'temperatura'
UNION ALL
SELECT m.id, 4, 'Confortable',      18,   26,  '#74c476', 'informativa' FROM metricas m WHERE m.clave = 'temperatura'
UNION ALL
SELECT m.id, 5, 'Cálido',           26,   32,  '#fee08b', 'informativa' FROM metricas m WHERE m.clave = 'temperatura'
UNION ALL
SELECT m.id, 6, 'Calor',            32,   38,  '#fd8d3c', 'advertencia' FROM metricas m WHERE m.clave = 'temperatura'
UNION ALL
SELECT m.id, 7, 'Calor extremo',    38,  100,  '#bd0026', 'emergencia'  FROM metricas m WHERE m.clave = 'temperatura'
ON CONFLICT (metrica_id, nivel) DO UPDATE
  SET label = EXCLUDED.label, valor_min = EXCLUDED.valor_min,
      valor_max = EXCLUDED.valor_max, color_hex = EXCLUDED.color_hex,
      severidad = EXCLUDED.severidad;

-- ICA — Calidad del Agua (NSF/CCME 0–100, INVERTIDO: más alto = mejor)
INSERT INTO umbrales (metrica_id, nivel, label, valor_min, valor_max, color_hex, severidad)
SELECT m.id, 1, 'Muy mala',   0,  25,  '#6d4c41', 'emergencia'  FROM metricas m WHERE m.clave = 'ica'
UNION ALL
SELECT m.id, 2, 'Mala',      26,  50,  '#f57c00', 'critica'     FROM metricas m WHERE m.clave = 'ica'
UNION ALL
SELECT m.id, 3, 'Regular',   51,  70,  '#fbc02d', 'advertencia' FROM metricas m WHERE m.clave = 'ica'
UNION ALL
SELECT m.id, 4, 'Buena',     71,  90,  '#1976d2', 'informativa' FROM metricas m WHERE m.clave = 'ica'
UNION ALL
SELECT m.id, 5, 'Excelente', 91, 100,  '#0d47a1', 'informativa' FROM metricas m WHERE m.clave = 'ica'
ON CONFLICT (metrica_id, nivel) DO UPDATE
  SET label = EXCLUDED.label, valor_min = EXCLUDED.valor_min,
      valor_max = EXCLUDED.valor_max, color_hex = EXCLUDED.color_hex,
      severidad = EXCLUDED.severidad;

-- Ruido (dB — NIOSH + OMS 2018)
INSERT INTO umbrales (metrica_id, nivel, label, valor_min, valor_max, color_hex, severidad)
SELECT m.id, 1, 'Silencio',   0,  30,  '#1a9850', 'informativa' FROM metricas m WHERE m.clave = 'ruido'
UNION ALL
SELECT m.id, 2, 'Tranquilo', 30,  55,  '#91cf60', 'informativa' FROM metricas m WHERE m.clave = 'ruido'
UNION ALL
SELECT m.id, 3, 'Moderado',  55,  70,  '#ffffbf', 'informativa' FROM metricas m WHERE m.clave = 'ruido'
UNION ALL
SELECT m.id, 4, 'Ruidoso',   70,  85,  '#fc8d59', 'advertencia' FROM metricas m WHERE m.clave = 'ruido'
UNION ALL
SELECT m.id, 5, 'Dañino',    85, 100,  '#d73027', 'critica'     FROM metricas m WHERE m.clave = 'ruido'
UNION ALL
SELECT m.id, 6, 'Peligroso', 100, 200, '#7f0000', 'emergencia'  FROM metricas m WHERE m.clave = 'ruido'
ON CONFLICT (metrica_id, nivel) DO UPDATE
  SET label = EXCLUDED.label, valor_min = EXCLUDED.valor_min,
      valor_max = EXCLUDED.valor_max, color_hex = EXCLUDED.color_hex,
      severidad = EXCLUDED.severidad;

-- Humedad (% — zonas de confort)
INSERT INTO umbrales (metrica_id, nivel, label, valor_min, valor_max, color_hex, severidad)
SELECT m.id, 1, 'Muy seco',    0,  20,  '#fdae61', 'advertencia' FROM metricas m WHERE m.clave = 'humedad'
UNION ALL
SELECT m.id, 2, 'Seco',       20,  40,  '#fee090', 'informativa' FROM metricas m WHERE m.clave = 'humedad'
UNION ALL
SELECT m.id, 3, 'Confortable',40,  60,  '#abd9e9', 'informativa' FROM metricas m WHERE m.clave = 'humedad'
UNION ALL
SELECT m.id, 4, 'Húmedo',     60,  80,  '#74add1', 'informativa' FROM metricas m WHERE m.clave = 'humedad'
UNION ALL
SELECT m.id, 5, 'Muy húmedo', 80, 100,  '#313695', 'advertencia' FROM metricas m WHERE m.clave = 'humedad'
ON CONFLICT (metrica_id, nivel) DO UPDATE
  SET label = EXCLUDED.label, valor_min = EXCLUDED.valor_min,
      valor_max = EXCLUDED.valor_max, color_hex = EXCLUDED.color_hex,
      severidad = EXCLUDED.severidad;
```

### 1.4 Módulo backend: `umbrales`

**Crear** `Backend/src/modules/umbrales/umbrales.routes.js`:

```js
// Backend/src/modules/umbrales/umbrales.routes.js
const router = require('express').Router()
const db = require('../../config/db')

/**
 * GET /api/umbrales
 * Retorna umbrales de todas las métricas agrupados.
 *
 * GET /api/umbrales/:metrica
 * Retorna umbrales de una métrica específica (ej: "aqi", "temperatura").
 * Ordenados por nivel ascendente.
 */
router.get('/:metrica?', async (req, res) => {
  try {
    const { metrica } = req.params

    const sql = metrica
      ? `SELECT
           u.nivel,
           u.label,
           u.valor_min,
           u.valor_max,
           u.color_hex,
           u.severidad,
           m.clave   AS metrica,
           m.nombre  AS metrica_nombre,
           un.simbolo AS unidad
         FROM umbrales u
         JOIN metricas m  ON m.id = u.metrica_id
         LEFT JOIN metrica_unidades mu ON mu.metrica_id = m.id AND mu.es_principal = TRUE
         LEFT JOIN unidades un         ON un.id = mu.unidad_id
         WHERE m.clave = $1
         ORDER BY u.nivel ASC`
      : `SELECT
           u.nivel,
           u.label,
           u.valor_min,
           u.valor_max,
           u.color_hex,
           u.severidad,
           m.clave   AS metrica,
           m.nombre  AS metrica_nombre,
           un.simbolo AS unidad
         FROM umbrales u
         JOIN metricas m  ON m.id = u.metrica_id
         LEFT JOIN metrica_unidades mu ON mu.metrica_id = m.id AND mu.es_principal = TRUE
         LEFT JOIN unidades un         ON un.id = mu.unidad_id
         ORDER BY m.clave, u.nivel ASC`

    const { rows } = await db.query(sql, metrica ? [metrica] : [])

    if (metrica && rows.length === 0) {
      return res.status(404).json({ error: `Métrica '${metrica}' no encontrada` })
    }

    res.json(rows)
  } catch (err) {
    console.error('[umbrales] Error:', err)
    res.status(500).json({ error: 'Error interno al obtener umbrales' })
  }
})

module.exports = router
```

**Registrar** en `Backend/src/app.js` o donde se montan las rutas:

```js
const umbralesRoutes = require('./modules/umbrales/umbrales.routes')
app.use('/api/umbrales', umbralesRoutes)
```

**Respuesta esperada** de `GET /api/umbrales/aqi`:

```json
[
  { "nivel": 1, "label": "Bueno", "valor_min": 0, "valor_max": 50, "color_hex": "#00e400", "severidad": "informativa", "metrica": "aqi", "unidad": "AQI" },
  { "nivel": 2, "label": "Moderado", "valor_min": 51, "valor_max": 100, "color_hex": "#ffff00", "severidad": "informativa", "metrica": "aqi", "unidad": "AQI" },
  ...
]
```

### 1.5 Módulo backend: `geografia` (scope global)

⚠️ **Escala global:** El endpoint de geografía debe retornar estaciones/localidades de cualquier país, no sólo Bolivia.

**Crear** `Backend/src/modules/geografia/geografia.routes.js`:

```js
// Backend/src/modules/geografia/geografia.routes.js
const router = require('express').Router()
const db = require('../../config/db')

/**
 * GET /api/geografia/localidades
 * Query params opcionales:
 *   - pais_codigo   (ISO 3166-1 alpha-2, ej: "BO", "AR", "US")
 *   - region_id     (UUID o INT de la región)
 *   - bbox          (minLng,minLat,maxLng,maxLat — para optimizar viewport)
 *   - limit         (default 500, max 2000)
 *
 * Retorna coordenadas lat/lng de cada localidad para alimentar Mapbox.
 */
router.get('/localidades', async (req, res) => {
  try {
    const { pais_codigo, region_id, bbox, limit = 500 } = req.query
    const params = []
    const conditions = []

    if (pais_codigo) {
      params.push(pais_codigo.toUpperCase())
      conditions.push(`p.codigo_iso2 = $${params.length}`)
    }
    if (region_id) {
      params.push(region_id)
      conditions.push(`l.region_id = $${params.length}`)
    }
    if (bbox) {
      const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number)
      params.push(minLng, minLat, maxLng, maxLat)
      conditions.push(
        `l.longitud BETWEEN $${params.length - 3} AND $${params.length - 1}`,
        `l.latitud  BETWEEN $${params.length - 2} AND $${params.length}`
      )
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(Math.min(Number(limit), 2000))

    const sql = `
      SELECT
        l.id,
        l.nombre,
        l.latitud,
        l.longitud,
        r.nombre  AS region,
        p.nombre  AS pais,
        p.codigo_iso2
      FROM localidades l
      JOIN regiones r ON r.id = l.region_id
      JOIN paises   p ON p.id = r.pais_id
      ${where}
      ORDER BY l.nombre
      LIMIT $${params.length}
    `

    const { rows } = await db.query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error('[geografia] Error:', err)
    res.status(500).json({ error: 'Error al obtener localidades' })
  }
})

module.exports = router
```

**Registrar** en `Backend/src/app.js`:

```js
const geografiaRoutes = require('./modules/geografia/geografia.routes')
app.use('/api/geografia', geografiaRoutes)
```

### 1.6 Refactorizar `simulacion.service.js` para insertar en `lecturas`

**Modificar** `Backend/src/modules/simulacion/simulacion.service.js`. El motor de simulación debe:
1. Leer las localidades desde la base de datos (no desde `departamentos.data.js`).
2. Insertar cada tick en la hypertable `lecturas`.

```js
// Dentro de simulacion.service.js — función de tick

const db = require('../../config/db')

/**
 * Inserta un batch de lecturas en la hypertable.
 * @param {Array} readings - [{ localidad_id, metrica_id, valor, fuente_datos_id }]
 */
async function persistReadings(readings) {
  if (!readings.length) return

  // Bulk insert con unnest para eficiencia
  const localidadIds  = readings.map(r => r.localidad_id)
  const metricaIds    = readings.map(r => r.metrica_id)
  const valores       = readings.map(r => r.valor)
  const fuenteIds     = readings.map(r => r.fuente_datos_id)

  await db.query(`
    INSERT INTO lecturas (localidad_id, metrica_id, valor, fuente_datos_id, tiempo)
    SELECT
      unnest($1::int[]),
      unnest($2::int[]),
      unnest($3::float[]),
      unnest($4::int[]),
      NOW()
  `, [localidadIds, metricaIds, valores, fuenteIds])
}

// En el tick de simulación, después de calcular los valores:
// await persistReadings(generatedReadings)
```

**Consultar lecturas recientes** para alimentar el socket (reemplaza el estado en memoria):

```js
// Obtener el último valor de cada localidad para una métrica — optimizado con hypertable
async function getLatestReadings(metricaClave) {
  const { rows } = await db.query(`
    SELECT DISTINCT ON (l.id)
      l.id           AS localidad_id,
      l.nombre,
      l.latitud,
      l.longitud,
      r.nombre       AS region,
      p.codigo_iso2  AS pais,
      lec.valor,
      lec.tiempo,
      m.clave        AS metrica
    FROM lecturas lec
    JOIN localidades l ON l.id = lec.localidad_id
    JOIN regiones    r ON r.id = l.region_id
    JOIN paises      p ON p.id = r.pais_id
    JOIN metricas    m ON m.id = lec.metrica_id
    WHERE m.clave = $1
    ORDER BY l.id, lec.tiempo DESC
  `, [metricaClave])

  return rows
}
```

---

## TAREA 2 — Corrección de pigmentación de mapas de calor ✅ (completado — documentado aquí para referencia)

> Esta tarea ya fue marcada como completada. Se documenta para trazabilidad.

**Bug corregido:** Se reemplazó `heatmap-density` (densidad de puntos) por una expresión que usa `['get', 'val']` (valor real de la métrica) en la función de color de Mapbox.

**Corrección adicional pendiente de validar:**

```js
// MapaMonitoreo.jsx — verificar que MAX_METRICS esté corregido a:
const MAX_METRICS = {
  aqi:         500,   // EPA va hasta 500, no 200
  temperatura:  60,
  humedad:     100,
  ruido:       140,
  ica:         100,
}
```

---

## TAREA 3 — Implementación de leyenda para el mapa de calor

> **Objetivo:** Añadir una leyenda visual dinámica que consuma `/api/umbrales` y muestre los rangos de color de la métrica actualmente activa en el mapa.

### 3.1 Hook `useUmbrales`

**Crear** `Frontend/src/hooks/useUmbrales.js`:

```js
// Frontend/src/hooks/useUmbrales.js
import { useState, useEffect } from 'react'

// Cache en módulo para evitar refetches entre re-renders
const _cache = new Map()

/**
 * Fetcha los umbrales de una métrica desde el backend.
 * Incluye caché por métrica para evitar requests repetidos.
 *
 * @param {string} metrica - clave de la métrica ("aqi", "temperatura", etc.)
 * @returns {{ umbrales: Array, loading: boolean, error: string|null }}
 */
export function useUmbrales(metrica) {
  const [umbrales, setUmbrales] = useState(_cache.get(metrica) ?? [])
  const [loading, setLoading]   = useState(!_cache.has(metrica))
  const [error, setError]       = useState(null)

  useEffect(() => {
    if (!metrica) return
    if (_cache.has(metrica)) {
      setUmbrales(_cache.get(metrica))
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`/api/umbrales/${metrica}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(rows => {
        _cache.set(metrica, rows)
        setUmbrales(rows)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [metrica])

  return { umbrales, loading, error }
}

/**
 * Encuentra el umbral al que pertenece un valor.
 * @param {Array} umbrales
 * @param {number} valor
 * @returns {Object|null}
 */
export function umbralPorValor(umbrales, valor) {
  return umbrales.find(u => valor >= u.valor_min && valor <= u.valor_max) ?? null
}

/**
 * Retorna el color hex del umbral para un valor dado.
 * @param {Array} umbrales
 * @param {number} valor
 * @returns {string} color hex, por defecto '#666' si no encuentra
 */
export function colorPorValor(umbrales, valor) {
  return umbralPorValor(umbrales, valor)?.color_hex ?? '#666'
}

/**
 * Genera la expresión de color para Mapbox GL a partir de los umbrales.
 * Usa ['get', propertyName] para leer el valor de cada feature.
 *
 * @param {Array} umbrales
 * @param {string} propertyName - propiedad del GeoJSON feature que contiene el valor
 * @returns {Array} expresión Mapbox interpolate
 */
export function buildMapboxColorExpr(umbrales, propertyName = 'val') {
  if (!umbrales.length) return ['rgba', 100, 100, 100, 0.3]

  const stops = umbrales.flatMap(u => [
    u.valor_min, u.color_hex,
    u.valor_max, u.color_hex,
  ])
  return ['interpolate', ['linear'], ['get', propertyName], ...stops]
}
```

### 3.2 Componente `HeatmapLegend`

**Crear** `Frontend/src/pages/MapaMonitoreo/components/HeatmapLegend.jsx`:

```jsx
// Frontend/src/pages/MapaMonitoreo/components/HeatmapLegend.jsx
import React, { useState } from 'react'
import { useUmbrales } from '../../../hooks/useUmbrales'

/**
 * Leyenda contextual del heatmap activo.
 * Se autoactiva cuando el heatmap está ON.
 *
 * Props:
 *   metrica      {string}   - clave activa ("aqi", "temperatura", etc.)
 *   onRangeClick {Function} - callback(umbral|null) para filtrar el mapa
 *   visible      {boolean}  - mostrar/ocultar la leyenda
 */
export default function HeatmapLegend({ metrica, onRangeClick, visible }) {
  const { umbrales, loading } = useUmbrales(metrica)
  const [activeRange, setActiveRange] = useState(null)

  if (!visible) return null

  // Título amigable por métrica
  const titulos = {
    aqi:         'Calidad del Aire (AQI)',
    temperatura: 'Temperatura (°C)',
    ica:         'Calidad del Agua (ICA)',
    ruido:       'Nivel de Ruido (dB)',
    humedad:     'Humedad Relativa (%)',
  }

  // Fuente estándar de referencia por métrica
  const fuentes = {
    aqi:         'EPA 2024',
    temperatura: 'OMS / confort',
    ica:         'NSF / CCME',
    ruido:       'OMS 2018 · NIOSH',
    humedad:     'ASHRAE 55',
  }

  const handleRangeClick = (umbral) => {
    const next = activeRange?.nivel === umbral.nivel ? null : umbral
    setActiveRange(next)
    onRangeClick?.(next)
  }

  return (
    <div className="heatmap-legend" style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>{titulos[metrica] ?? metrica}</span>
        {fuentes[metrica] && (
          <span style={styles.source}>Fuente: {fuentes[metrica]}</span>
        )}
      </div>

      {loading && <div style={styles.loading}>Cargando...</div>}

      <div style={styles.list}>
        {umbrales.map(u => (
          <button
            key={u.nivel}
            onClick={() => handleRangeClick(u)}
            title={`Filtrar mapa: ${u.label}`}
            style={{
              ...styles.row,
              opacity: activeRange && activeRange.nivel !== u.nivel ? 0.4 : 1,
              outline: activeRange?.nivel === u.nivel ? `2px solid ${u.color_hex}` : 'none',
            }}
          >
            <span style={{ ...styles.swatch, background: u.color_hex }} />
            <span style={styles.range}>
              {u.valor_min} – {u.valor_max}
            </span>
            <span style={styles.label}>{u.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

const styles = {
  container: {
    position: 'absolute',
    bottom: '2rem',
    left: '1rem',
    background: 'rgba(15, 15, 20, 0.88)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    padding: '0.85rem 1rem',
    minWidth: '240px',
    maxWidth: '280px',
    zIndex: 10,
    fontFamily: 'inherit',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '0.6rem',
  },
  title: {
    color: '#fff',
    fontSize: '0.78rem',
    fontWeight: 600,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
  },
  source: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: '0.68rem',
    marginTop: '0.1rem',
  },
  loading: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '0.75rem',
    padding: '0.4rem 0',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.2rem 0.3rem',
    borderRadius: '5px',
    transition: 'opacity 0.2s, outline 0.15s',
    width: '100%',
    textAlign: 'left',
  },
  swatch: {
    width: '20px',
    height: '12px',
    borderRadius: '3px',
    flexShrink: 0,
  },
  range: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: '0.7rem',
    width: '70px',
    flexShrink: 0,
  },
  label: {
    color: '#fff',
    fontSize: '0.72rem',
  },
}
```

### 3.3 Integrar `HeatmapLegend` en `MapaMonitoreo.jsx`

**Modificar** `Frontend/src/pages/MapaMonitoreo/MapaMonitoreo.jsx`:

```jsx
// 1. Importar al inicio del archivo
import HeatmapLegend from './components/HeatmapLegend'

// 2. Agregar estado para el filtro de rango activo
const [activeUmbralFilter, setActiveUmbralFilter] = useState(null)

// 3. Handler que recibe el umbral seleccionado en la leyenda
const handleLegendRangeClick = useCallback((umbral) => {
  setActiveUmbralFilter(umbral)
  // Si hay una capa de coropletas, actualizar su filtro
  if (mapRef.current) {
    const map = mapRef.current.getMap()
    if (umbral) {
      map.setFilter('depto-fill', [
        'all',
        ['>=', ['get', 'val'], umbral.valor_min],
        ['<=', ['get', 'val'], umbral.valor_max],
      ])
    } else {
      map.setFilter('depto-fill', null)  // quitar filtro
    }
  }
}, [])

// 4. Renderizar la leyenda dentro del return, al mismo nivel que el mapa
// (dentro del contenedor del mapa, NO fuera de él)
<HeatmapLegend
  metrica={heatmapMetric}          // estado que ya existe en el componente
  visible={showHeatmap}            // estado que ya existe en el componente
  onRangeClick={handleLegendRangeClick}
/>
```

---

## TAREA 4 — Mejora en la visibilidad del mapa de calor (Todo el mapa completo)

> **Objetivo:** Que el heatmap cubra todo el viewport de forma continua, sin huecos ni manchas. Cambiar el paradigma de densidad a valor real usando coropletas + IDW. Adaptado para escala global.

### 4.1 GeoJSON de polígonos administrativos (escala global)

⚠️ **Diferencia crítica con el plan original:** El proyecto es global. No se usa solo el GeoJSON de Bolivia.

**Estrategia por nivel de zoom:**

| Zoom | Vista | Fuente GeoJSON | Qué se renderiza |
|---|---|---|---|
| 0 – 3 | Mundo completo | Natural Earth Admin 0 (países) | Polígonos de países coloreados |
| 4 – 6 | Continente/región | Natural Earth Admin 1 (estados/depto) | Polígonos de regiones |
| 7 – 10 | Vista regional | Puntos + IDW | Gradiente continuo interpolado |
| 11+ | Vista urbana | Marcadores + heatmap density | Concentración de sensores |

**Fuentes GeoJSON recomendadas (gratuitas, sin API key):**
- Países: `https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson`
- Regiones admin-1: [Natural Earth 10m Admin 1](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/) — descargar y simplificar con `mapshaper` a < 200 KB.

**Crear** `Frontend/public/geojson/world-admin0.geojson` y `world-admin1.geojson` (simplificados).

### 4.2 Capa de coropletas — `ChoroplethLayer.jsx`

**Crear** `Frontend/src/pages/MapaMonitoreo/layers/ChoroplethLayer.jsx`:

```jsx
// Frontend/src/pages/MapaMonitoreo/layers/ChoroplethLayer.jsx
import React, { useEffect, useState } from 'react'
import { Source, Layer } from 'react-map-gl'
import { buildMapboxColorExpr } from '../../../hooks/useUmbrales'

/**
 * Capa de coropletas.
 * Une los polígonos GeoJSON con los valores de las estaciones más cercanas.
 * Válida a escala global.
 *
 * Props:
 *   metrica   {string}  - clave de la métrica activa
 *   umbrales  {Array}   - array de umbrales del hook useUmbrales
 *   cities    {Array}   - array de { id, latitude, longitude, data: { [metrica]: valor } }
 *   zoom      {number}  - zoom actual del mapa
 */
export default function ChoroplethLayer({ metrica, umbrales, cities, zoom }) {
  const [geoData, setGeoData] = useState(null)

  // Seleccionar GeoJSON según zoom (global vs regional)
  const geojsonUrl = zoom < 4
    ? '/geojson/world-admin0.geojson'
    : '/geojson/world-admin1.geojson'

  useEffect(() => {
    fetch(geojsonUrl)
      .then(r => r.json())
      .then(data => {
        // Enriquecer cada polígono con el valor de la estación más cercana
        const enriched = enrichGeoJSON(data, cities, metrica)
        setGeoData(enriched)
      })
  }, [geojsonUrl, cities, metrica])

  if (!geoData || !umbrales.length) return null

  const colorExpr = buildMapboxColorExpr(umbrales, 'val')

  return (
    <Source id="choropleth-source" type="geojson" data={geoData}>
      <Layer
        id="depto-fill"
        type="fill"
        paint={{
          'fill-color': colorExpr,
          'fill-opacity': [
            'case', ['boolean', ['feature-state', 'hover'], false], 0.85, 0.60
          ],
          'fill-color-transition': { duration: 600, delay: 0 },
          'fill-opacity-transition': { duration: 400 },
        }}
      />
      <Layer
        id="depto-outline"
        type="line"
        paint={{
          'line-color': 'rgba(255,255,255,0.15)',
          'line-width': 0.5,
        }}
      />
    </Source>
  )
}

/**
 * Asigna a cada feature del GeoJSON el valor de la ciudad más cercana.
 * Algoritmo: para el centroide del polígono, busca la estación más cercana
 * por distancia euclidiana (suficiente para colores globales).
 *
 * @param {Object} geojson
 * @param {Array}  cities
 * @param {string} metrica
 * @returns {Object} GeoJSON enriquecido con propiedad 'val'
 */
function enrichGeoJSON(geojson, cities, metrica) {
  if (!cities?.length) return geojson

  return {
    ...geojson,
    features: geojson.features.map(feature => {
      const centroid = getCentroid(feature.geometry)
      const nearest  = getNearestCity(centroid, cities)
      const val      = nearest?.data?.[metrica] ?? null

      return {
        ...feature,
        properties: { ...feature.properties, val },
      }
    }),
  }
}

function getCentroid(geometry) {
  // Sólo para Polygon y MultiPolygon
  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates[0]
    const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length
    const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length
    return { lng, lat }
  }
  if (geometry.type === 'MultiPolygon') {
    const ring = geometry.coordinates[0][0]
    const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length
    const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length
    return { lng, lat }
  }
  return { lng: 0, lat: 0 }
}

function getNearestCity(centroid, cities) {
  let best = null, bestDist = Infinity
  for (const city of cities) {
    const d = Math.hypot(city.longitude - centroid.lng, city.latitude - centroid.lat)
    if (d < bestDist) { bestDist = d; best = city }
  }
  return best
}
```

### 4.3 Capa IDW para zoom regional — `IDWHeatmapLayer.jsx`

**Crear** `Frontend/src/pages/MapaMonitoreo/layers/IDWHeatmapLayer.jsx`:

```jsx
// Frontend/src/pages/MapaMonitoreo/layers/IDWHeatmapLayer.jsx
// Requiere: npm install mapbox-gl-interpolate-heatmap
import React, { useEffect, useRef } from 'react'
import { useMap } from 'react-map-gl'

/**
 * Capa IDW (Inverse Distance Weighting) para zoom 7–10.
 * Pinta cada píxel del viewport como promedio ponderado de las estaciones cercanas.
 * Visualmente equivalente a lo que usa Windy para temperatura.
 *
 * Props:
 *   cities  {Array}  - { latitude, longitude, data: { [metrica]: valor } }
 *   metrica {string}
 *   umbrales {Array}
 *   visible {boolean}
 */
export default function IDWHeatmapLayer({ cities, metrica, umbrales, visible }) {
  const { current: mapRef } = useMap()
  const layerRef = useRef(null)

  useEffect(() => {
    if (!mapRef || !visible || !cities?.length || !umbrales.length) return

    const map = mapRef.getMap()

    // Limpiar capa anterior si existe
    if (layerRef.current) {
      try { map.removeLayer('idw-layer') } catch (_) {}
      layerRef.current = null
    }

    import('mapbox-gl-interpolate-heatmap').then(({ default: InterpolateHeatmapLayer }) => {
      const points = cities
        .filter(c => c.data?.[metrica] != null)
        .map(c => ({ lat: c.latitude, lon: c.longitude, val: c.data[metrica] }))

      if (!points.length) return

      const minValue = umbrales[0]?.valor_min ?? 0
      const maxValue = umbrales[umbrales.length - 1]?.valor_max ?? 500

      // Construir gradiente desde los umbrales
      const colorStops = umbrales
        .map(u => {
          const t = (u.valor_min - minValue) / (maxValue - minValue)
          return `${u.color_hex} ${(t * 100).toFixed(1)}%`
        })
        .join(', ')

      const layer = new InterpolateHeatmapLayer({
        id: 'idw-layer',
        data: points,
        framebufferFactor: 0.3,
        p: 3,
        opacity: 0.55,
        minValue,
        maxValue,
        colorRange: colorStops,
      })

      map.addLayer(layer)
      layerRef.current = layer
    })

    return () => {
      if (layerRef.current && mapRef) {
        try { mapRef.getMap().removeLayer('idw-layer') } catch (_) {}
        layerRef.current = null
      }
    }
  }, [mapRef, cities, metrica, umbrales, visible])

  return null
}
```

### 4.4 Modo oscuro por defecto cuando el heatmap está activo

**Modificar** `MapaMonitoreo.jsx` — cambiar el mapStyle cuando se activa el heatmap:

```jsx
// Reemplazar la prop mapStyle estática del mapa por un valor dinámico
const mapStyle = showHeatmap
  ? 'mapbox://styles/mapbox/dark-v11'    // mejor contraste para colores EPA
  : 'mapbox://styles/mapbox/light-v11'   // modo normal

// En el componente Map:
<Map
  mapStyle={mapStyle}
  // ... otras props
/>
```

### 4.5 Selector de modo de renderizado por zoom

**Añadir** en `MapaMonitoreo.jsx` el hook de selección automática de capa:

```jsx
import { useMemo } from 'react'

// Dentro del componente:
const heatmapMode = useMemo(() => {
  if (!showHeatmap) return 'none'
  if (viewState.zoom < 4)  return 'choropleth-countries'  // vista mundial
  if (viewState.zoom < 7)  return 'choropleth-regions'    // vista continental
  if (viewState.zoom < 11) return 'idw'                   // vista regional
  return 'native-density'                                  // vista urbana (futuro)
}, [showHeatmap, viewState.zoom])
```

### 4.6 Marcadores rediseñados con color de umbral

**Modificar** los `Marker` existentes en `MapaMonitoreo.jsx` para mostrar valor + color del umbral:

```jsx
// Importar las utilidades del hook
import { colorPorValor, umbralPorValor } from '../../hooks/useUmbrales'

// Dentro del map de ciudades en el render:
{cities.map(city => {
  const valor      = city.data?.[heatmapMetric] ?? 0
  const color      = colorPorValor(umbrales, valor)
  const umbral     = umbralPorValor(umbrales, valor)
  const isCritical = ['critica', 'emergencia'].includes(umbral?.severidad)

  return (
    <Marker key={city.id} latitude={city.latitude} longitude={city.longitude}>
      <div
        className={`city-marker ${isCritical ? 'city-marker--pulse' : ''}`}
        style={{ '--marker-color': color }}
        onClick={() => setSelectedCity(city)}
      >
        <span className="city-marker__value">{Math.round(valor)}</span>
      </div>
    </Marker>
  )
})}
```

**CSS** (agregar a los estilos globales o al módulo CSS del componente):

```css
.city-marker {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--marker-color, #666);
  border: 2px solid rgba(255,255,255,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s;
}

.city-marker__value {
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.city-marker--pulse {
  animation: markerPulse 2s infinite;
}

@keyframes markerPulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--marker-color) 70%, transparent); }
  50%       { box-shadow: 0 0 0 10px transparent; }
}
```

### 4.7 Estructura final de archivos

La estructura de `MapaMonitoreo/` debe quedar así (guía para Claude Code):

```
Frontend/src/pages/MapaMonitoreo/
├── MapaMonitoreo.jsx                 ← orquestador (< 300 líneas)
├── MapaMonitoreo.module.css          ← estilos scoped
├── layers/
│   ├── ChoroplethLayer.jsx           ← Tarea 4.2
│   ├── IDWHeatmapLayer.jsx           ← Tarea 4.3
│   └── MarkersLayer.jsx              ← marcadores rediseñados (Tarea 4.6)
├── components/
│   └── HeatmapLegend.jsx             ← Tarea 3.2
└── hooks/
    └── (reusar useUmbrales de src/hooks/)

Frontend/src/hooks/
└── useUmbrales.js                    ← Tarea 3.1

Frontend/public/geojson/
├── world-admin0.geojson              ← países (Natural Earth)
└── world-admin1.geojson              ← regiones/estados (Natural Earth)

Backend/src/modules/
├── umbrales/
│   └── umbrales.routes.js            ← Tarea 1.4
└── geografia/
    └── geografia.routes.js           ← Tarea 1.5

database/
├── esquema_envirosense.sql           ← agregar create_hypertable al final (Tarea 1.2)
└── seeds/
    └── 02_umbrales.sql               ← Tarea 1.3
```

---

## Orden de ejecución para Claude Code

Ejecutar en este orden exacto para no romper el sistema en ningún paso intermedio:

1. **DB:** Verificar imagen Docker TimescaleDB → agregar `create_hypertable` a `esquema_envirosense.sql` → crear y ejecutar `seeds/02_umbrales.sql`
2. **Backend:** Crear `umbrales.routes.js` → crear `geografia.routes.js` → registrar ambas rutas en `app.js`
3. **Frontend — hooks:** Crear `useUmbrales.js`
4. **Frontend — leyenda:** Crear `HeatmapLegend.jsx` → integrarlo en `MapaMonitoreo.jsx`
5. **Frontend — capas:** Crear `ChoroplethLayer.jsx` → crear `IDWHeatmapLayer.jsx` → agregar GeoJSON en `/public/geojson/`
6. **Frontend — orquestador:** Modificar `MapaMonitoreo.jsx` para usar modo de renderizado dinámico + modo oscuro + marcadores rediseñados
7. **Simulación:** Modificar `simulacion.service.js` para persistir en `lecturas`

---

## Verificación por tarea (plan de pruebas)

| Tarea | Verificación | Criterio de éxito |
|---|---|---|
| 1 — Umbrales DB | `GET /api/umbrales/aqi` | Retorna 6 objetos con `color_hex` y `valor_min/max` correctos |
| 1 — Umbrales DB | `GET /api/umbrales/temperatura` | Retorna 7 niveles con paleta azul→verde→rojo |
| 1 — Geografía | `GET /api/geografia/localidades?pais_codigo=BO` | Lista con `latitud`, `longitud`, `nombre` para estaciones bolivianas |
| 1 — Geografía | `GET /api/geografia/localidades?pais_codigo=AR` | Misma estructura para Argentina (prueba de escala global) |
| 1 — TimescaleDB | `\dx` dentro del contenedor Postgres | Extensión `timescaledb` listada |
| 1 — Simulación | Iniciar simulación + revisar tabla `lecturas` | Registros aumentan en tiempo real |
| 2 — Pigmentación ✅ | Inyectar AQI=450 en una estación | Marcador y polígono se pintan `#7e0023` |
| 3 — Leyenda | Activar heatmap → ver panel inferior izquierdo | Leyenda muestra colores y rangos de la métrica activa |
| 3 — Filtro leyenda | Click en fila "Peligroso" | Solo polígonos con AQI > 300 se mantienen visibles |
| 4 — Visibilidad | Zoom < 4 (vista mundial) | Polígonos de países coloreados sin huecos |
| 4 — Visibilidad | Zoom 7–10 (vista regional) | Gradiente IDW continuo visible |
| 4 — Modo oscuro | Activar heatmap toggle | Estilo del mapa cambia a `dark-v11` automáticamente |
| 4 — Marcadores | Estación con AQI 380 visible | Marcador con fondo `#7e0023` y anillo pulsante |

---

## Notas importantes para Claude Code

- **No usar `departamentos.data.js`** ni ningún archivo local de ciudades bolivianas como fuente de coordenadas. Toda geografía viene de `/api/geografia/localidades`.
- **No hardcodear colores ni rangos** en ningún componente. Usar siempre `useUmbrales` + `buildMapboxColorExpr`.
- **`mapbox-gl-interpolate-heatmap`** debe instalarse como dependencia: `npm install mapbox-gl-interpolate-heatmap`.
- Los GeoJSON de Natural Earth se descargan una vez, se simplifican con `mapshaper` (objetivo < 200 KB c/u) y se sirven como archivos estáticos desde `/public/geojson/`.
- La función `enrichGeoJSON` en `ChoroplethLayer.jsx` es intencional y suficiente para la escala actual. Para miles de estaciones futuras, mover el enriquecimiento al backend como un endpoint `/api/heatmap/geojson?metrica=aqi`.
- El panel flotante de ciudad **no debe cerrarse** cuando el heatmap está activo. Eliminar o condicionar las líneas de `MapaMonitoreo.jsx` que llaman `setSelectedCity(null)` al activar el heatmap.
