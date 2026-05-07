/**
 * Generador de seeds GeoJSON por país (ADM1) desde geoBoundaries.org
 *
 * Uso:  node database/seeds/generate_geojson_seeds.js
 *
 * Descarga los polígonos simplificados de cada país sudamericano y genera
 * archivos .sql con INSERT/UPDATE para la columna regiones.geojson.
 *
 * Salida: database/seeds/geojson/{pais}_geojson.sql
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

// ─── Configuración ───────────────────────────────────────────────────────────

const GEOBOUNDARIES_API = 'https://www.geoboundaries.org/api/current/gbOpen'

const OUT_DIR = path.join(__dirname, 'geojson')

// Precisión de coordenadas: 4 decimales ≈ 11 m a nivel del ecuador
const COORD_PRECISION = 4

const PAISES = [
  { name: 'Argentina',       iso2: 'AR', gbISO: 'ARG', nivel: 'provincia',    numDB:  8 },
  { name: 'Bolivia',         iso2: 'BO', gbISO: 'BOL', nivel: 'departamento', numDB:  9 },
  { name: 'Brasil',          iso2: 'BR', gbISO: 'BRA', nivel: 'estado',       numDB:  9 },
  { name: 'Chile',           iso2: 'CL', gbISO: 'CHL', nivel: 'region',       numDB:  6 },
  { name: 'Colombia',        iso2: 'CO', gbISO: 'COL', nivel: 'departamento', numDB:  6 },
  { name: 'Ecuador',         iso2: 'EC', gbISO: 'ECU', nivel: 'provincia',    numDB:  4 },
  { name: 'Guyana',          iso2: 'GY', gbISO: 'GUY', nivel: 'region',       numDB:  1 },
  { name: 'Paraguay',        iso2: 'PY', gbISO: 'PRY', nivel: 'departamento', numDB:  3 },
  { name: 'Peru',            iso2: 'PE', gbISO: 'PER', nivel: 'region',       numDB:  6 },
  { name: 'Surinam',         iso2: 'SR', gbISO: 'SUR', nivel: 'region',       numDB:  1 },
  { name: 'Uruguay',         iso2: 'UY', gbISO: 'URY', nivel: 'departamento', numDB:  3 },
  { name: 'Venezuela',       iso2: 'VE', gbISO: 'VEN', nivel: 'estado',       numDB:  4 },
]

// ─── Helpers HTTP ────────────────────────────────────────────────────────────

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJSON(res.headers.location).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      }
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error(`JSON parse error for ${url}: ${e.message}`)) }
      })
    }).on('error', reject)
  })
}

// ─── Redondeo de coordenadas ─────────────────────────────────────────────────

function roundCoord(val) {
  return Number(val.toFixed(COORD_PRECISION))
}

function simplifyGeometry(geometry) {
  if (!geometry || !geometry.coordinates) return geometry
  const simplifyRing = (ring) =>
    ring.map(([lng, lat]) => [roundCoord(lng), roundCoord(lat)])
  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geometry.coordinates.map(simplifyRing) }
  }
  if (geometry.type === 'MultiPolygon') {
    return { type: 'MultiPolygon', coordinates: geometry.coordinates.map(poly => poly.map(simplifyRing)) }
  }
  return geometry
}

// ─── Normalización de nombres ────────────────────────────────────────────────

/**
 * Convierte nombres de región a formato normalizado:
 * - "ASUNCION"         → "Asuncion"
 * - "SAN PEDRO"        → "San Pedro"
 * - "PDTE HAYES"       → "Pdte Hayes"
 * - "Región de Arica"  → "Región de Arica"
 * - "BUENOS AIRES"     → "Buenos Aires"
 */
function normalizeRegionName(name) {
  if (!name) return name
  // Quitar prefijos comunes para matchear con la BD existente
  let cleaned = name.trim()
    .replace(/^Regi(o|ó)n (de(l)?\s*)?/i, '')  // "Región de Antofagasta" → "Antofagasta"
    .replace(/^Departamento (de(l)?\s*)?/i, '') // "Departamento de X" → "X"
    .replace(/^Provincia (de(l)?\s*)?/i, '')    // "Provincia de X" → "X"
    .replace(/^Estado (de(l)?\s*)?/i, '')       // "Estado de X" → "X"
    .replace(/\s+/g, ' ')

  // Si ya está en title-case-ish (detecta mezcla de mayúsculas/minúsculas), mantener
  const hasLower = /[a-záéíóúüñ]/.test(cleaned)
  const hasUpper = /[A-ZÁÉÍÓÚÜÑ]/.test(cleaned)
  if (hasLower && hasUpper) {
    return cleaned.trim()
  }
  // Está en MAYÚSCULAS → title case palabra por palabra
  return cleaned.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase())
}

// ─── Escapado SQL ────────────────────────────────────────────────────────────

function sqlStr(s) {
  return s.replace(/'/g, "''")
}

function escapeJsonb(obj) {
  const json = JSON.stringify(obj)
  // JSON no contiene comillas simples, no necesita escape
  return `'${json}'::jsonb`
}

// ─── Generador principal ─────────────────────────────────────────────────────

function buildHeader(pais, meta) {
  return `-- =============================================================================
-- Seeder: GeoJSON ADM1 — ${pais.name}
-- Archivo: database/seeds/geojson/${pais.name.toLowerCase()}_geojson.sql
-- Fuente:  geoBoundaries.org  (${meta.boundaryID})
-- Licencia: ${meta.boundaryLicense || 'Ver geoBoundaries.org'}
-- Fecha:   ${new Date().toISOString().split('T')[0]}
-- Divisiones: ${meta.admUnitCount} ${pais.nivel}(s)
-- Vértices:  mean=${meta.meanVertices}, min=${meta.minVertices}, max=${meta.maxVertices}
-- =============================================================================
`
}

function buildUpsert(pais, shapeName, geometry) {
  return `INSERT INTO regiones (pais_id, nombre, nivel, geojson)
SELECT p.id, '${sqlStr(shapeName)}', '${pais.nivel}', ${escapeJsonb(geometry)}
FROM paises p
WHERE p.codigo = '${pais.iso2}'
ON CONFLICT (pais_id, nombre)
DO UPDATE SET geojson = EXCLUDED.geojson;\n`
}

async function processCountry(pais) {
  const nameSlug = pais.name.toLowerCase().replace(/ /g, '_')

  console.log(`\n📡 ${pais.name} (${pais.gbISO}) — consultando geoBoundaries...`)

  let meta
  try {
    meta = await fetchJSON(`${GEOBOUNDARIES_API}/${pais.gbISO}/ADM1/`)
  } catch (err) {
    console.error(`  ✗ Error en metadata de ${pais.name}: ${err.message}`)
    return null
  }

  if (!meta.simplifiedGeometryGeoJSON) {
    console.error(`  ✗ ${pais.name}: no tiene simplifiedGeometryGeoJSON`)
    return null
  }

  console.log(`  ⬇ Descargando GeoJSON simplificado (${meta.admUnitCount} divisiones)...`)
  let geojson
  try {
    geojson = await fetchJSON(meta.simplifiedGeometryGeoJSON)
  } catch (err) {
    console.error(`  ✗ Error descargando GeoJSON de ${pais.name}: ${err.message}`)
    return null
  }

  if (!geojson.features || !geojson.features.length) {
    console.error(`  ✗ ${pais.name}: GeoJSON sin features`)
    return null
  }

  // Validar nombres de features
  const featNames = geojson.features.map(f => f.properties?.shapeName).filter(Boolean)
  console.log(`  📋 Features: ${geojson.features.length} (con shapeName: ${featNames.length})`)
  console.log(`     Nombres: ${featNames.slice(0, 5).join(', ')}${featNames.length > 5 ? '...' : ''}`)

  // Construir SQL
  let sql = buildHeader(pais, meta)
  let count = 0
  let skipped = 0

  for (const feat of geojson.features) {
    const rawName = feat.properties?.shapeName
    if (!rawName) {
      skipped++
      continue
    }
    if (!feat.geometry) {
      skipped++
      continue
    }
    const shapeName = normalizeRegionName(rawName)
    const simplifiedGeom = simplifyGeometry(feat.geometry)
    sql += buildUpsert(pais, shapeName, simplifiedGeom)
    count++
  }

  if (count === 0) {
    console.error(`  ✗ ${pais.name}: 0 features válidas`)
    return null
  }

  // Escribir archivo
  const outPath = path.join(OUT_DIR, `${nameSlug}_geojson.sql`)
  fs.writeFileSync(outPath, sql, 'utf-8')
  const sizeKB = (Buffer.byteLength(sql, 'utf-8') / 1024).toFixed(1)
  console.log(`  ✅ ${outPath}  (${count} inserts, ${sizeKB} KB)`)
  if (skipped > 0) console.log(`     ⚠ ${skipped} features sin shapeName — omitidas`)
  return { pais: pais.name, count, sizeKB }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  // Crear directorio de salida
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true })
  }

  console.log('═══════════════════════════════════════════')
  console.log('  Generador de Seeds GeoJSON — Sudamérica')
  console.log('═══════════════════════════════════════════')

  const results = []
  for (const pais of PAISES) {
    const res = await processCountry(pais)
    if (res) results.push(res)
    // Pequeña pausa para no saturar la API
    await new Promise(r => setTimeout(r, 500))
  }

  // Resumen final
  console.log('\n═══════════════════════════════════════════')
  console.log('  RESUMEN')
  console.log('═══════════════════════════════════════════')
  for (const r of results) {
    console.log(`  ${r.pais.padEnd(16)} ${String(r.count).padStart(3)} inserts  ${r.sizeKB.padStart(6)} KB`)
  }
  console.log(`  ─────────────────────────────────────`)
  console.log(`  TOTAL: ${results.length} países generados`)
  console.log(`\nArchivos en: ${OUT_DIR}`)
}

main().catch(err => {
  console.error('\n💥 Error fatal:', err.message)
  process.exit(1)
})
