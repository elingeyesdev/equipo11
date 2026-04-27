#!/usr/bin/env node
/**
 * generate_historial.js
 * 
 * Genera 7 días de lecturas horarias para todas las localidades
 * con variación diurna realista y correlaciones entre métricas.
 *
 * Uso (dentro del contenedor backend):
 *   node /app/database/seeds/generate_historial.js
 *
 * O desde el host:
 *   docker exec sistemadatosambientales-backend-1 node /app/database/seeds/generate_historial.js
 */

const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST     || 'db',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'sistema_ambiental',
  user:     process.env.DB_USER     || 'admin',
  password: process.env.DB_PASSWORD || 'admin123',
})

// Rangos realistas por ciudad (subset de localidades.data.js)
// Si la ciudad no está aquí, usa rangos genéricos por zona climática
const CITY_RANGES = {
  // Bolivia
  'la paz':      { temperatura: [5,  18],  aqi: [30,  80],  ica: [55, 85], ruido: [40, 70], humedad: [40, 75] },
  'cochabamba':  { temperatura: [12, 26],  aqi: [50, 120],  ica: [45, 80], ruido: [45, 78], humedad: [25, 55] },
  'santa cruz':  { temperatura: [22, 36],  aqi: [60, 140],  ica: [35, 70], ruido: [50, 82], humedad: [55, 85] },
  'oruro':       { temperatura: [2,  14],  aqi: [20,  60],  ica: [60, 90], ruido: [30, 60], humedad: [30, 60] },
  'potosí':      { temperatura: [-2, 12],  aqi: [15,  55],  ica: [65, 92], ruido: [25, 55], humedad: [25, 55] },
  'sucre':       { temperatura: [10, 24],  aqi: [25,  75],  ica: [55, 85], ruido: [35, 65], humedad: [35, 65] },
  'tarija':      { temperatura: [14, 28],  aqi: [20,  70],  ica: [50, 82], ruido: [30, 62], humedad: [40, 70] },
  'trinidad':    { temperatura: [24, 36],  aqi: [40, 110],  ica: [40, 70], ruido: [40, 72], humedad: [70, 92] },
  'cobija':      { temperatura: [22, 34],  aqi: [35, 100],  ica: [35, 65], ruido: [35, 68], humedad: [75, 95] },
  // Argentina
  'buenos aires':{ temperatura: [14, 30],  aqi: [50, 120],  ica: [45, 75], ruido: [55, 85], humedad: [55, 80] },
  'córdoba':     { temperatura: [12, 28],  aqi: [40, 110],  ica: [48, 78], ruido: [48, 78], humedad: [45, 72] },
  'mendoza':     { temperatura: [10, 28],  aqi: [25,  80],  ica: [52, 82], ruido: [38, 68], humedad: [20, 45] },
  'salta':       { temperatura: [16, 32],  aqi: [30,  90],  ica: [50, 80], ruido: [38, 68], humedad: [38, 68] },
  'bariloche':   { temperatura: [-2, 18],  aqi: [8,   40],  ica: [70, 95], ruido: [20, 50], humedad: [45, 75] },
  'ushuaia':     { temperatura: [-5, 12],  aqi: [5,   25],  ica: [80, 98], ruido: [15, 45], humedad: [60, 82] },
  // Brasil
  'são paulo':   { temperatura: [16, 30],  aqi: [80, 180],  ica: [30, 65], ruido: [60, 92], humedad: [60, 85] },
  'rio de janeiro':{ temperatura: [22, 36],aqi: [70, 160],  ica: [32, 68], ruido: [58, 90], humedad: [65, 88] },
  'manaus':      { temperatura: [24, 36],  aqi: [40, 100],  ica: [28, 62], ruido: [40, 72], humedad: [80, 96] },
  'fortaleza':   { temperatura: [24, 34],  aqi: [50, 130],  ica: [35, 70], ruido: [48, 80], humedad: [68, 88] },
  'porto alegre':{ temperatura: [12, 28],  aqi: [40, 110],  ica: [40, 72], ruido: [45, 78], humedad: [58, 82] },
  // Chile
  'santiago':    { temperatura: [10, 28],  aqi: [60, 150],  ica: [45, 78], ruido: [50, 80], humedad: [30, 60] },
  'antofagasta': { temperatura: [12, 24],  aqi: [20,  70],  ica: [55, 85], ruido: [30, 60], humedad: [8,  30] },
  'punta arenas':{ temperatura: [-2, 10],  aqi: [5,   30],  ica: [72, 95], ruido: [18, 48], humedad: [55, 78] },
  // Colombia
  'bogotá':      { temperatura: [8,  20],  aqi: [60, 140],  ica: [38, 72], ruido: [55, 85], humedad: [60, 82] },
  'medellín':    { temperatura: [16, 28],  aqi: [65, 150],  ica: [35, 70], ruido: [55, 85], humedad: [60, 82] },
  'cartagena':   { temperatura: [26, 36],  aqi: [45, 120],  ica: [32, 68], ruido: [48, 80], humedad: [68, 90] },
  // Perú
  'lima':        { temperatura: [14, 26],  aqi: [50, 130],  ica: [42, 75], ruido: [52, 82], humedad: [70, 90] },
  'cusco':       { temperatura: [4,  20],  aqi: [25,  80],  ica: [55, 85], ruido: [30, 62], humedad: [38, 68] },
  'iquitos':     { temperatura: [22, 34],  aqi: [30,  90],  ica: [30, 65], ruido: [35, 68], humedad: [80, 96] },
  // Ecuador
  'quito':       { temperatura: [8,  22],  aqi: [35, 110],  ica: [45, 80], ruido: [42, 75], humedad: [52, 78] },
  'guayaquil':   { temperatura: [22, 34],  aqi: [50, 130],  ica: [35, 68], ruido: [50, 82], humedad: [65, 88] },
  // Paraguay
  'asunción':    { temperatura: [20, 36],  aqi: [45, 120],  ica: [38, 70], ruido: [45, 78], humedad: [55, 80] },
  // Uruguay
  'montevideo':  { temperatura: [10, 26],  aqi: [35,  95],  ica: [48, 80], ruido: [40, 72], humedad: [60, 82] },
  // Venezuela
  'caracas':     { temperatura: [16, 28],  aqi: [60, 150],  ica: [32, 68], ruido: [52, 85], humedad: [60, 82] },
  'maracaibo':   { temperatura: [28, 40],  aqi: [55, 140],  ica: [30, 62], ruido: [48, 82], humedad: [65, 85] },
  // Otros
  'georgetown':  { temperatura: [24, 34],  aqi: [30,  90],  ica: [35, 68], ruido: [38, 70], humedad: [72, 92] },
  'paramaribo':  { temperatura: [24, 34],  aqi: [25,  85],  ica: [38, 70], ruido: [35, 68], humedad: [72, 92] },
}

const DEFAULT_RANGES = {
  temperatura: [15, 30], aqi: [40, 100], ica: [40, 80], ruido: [40, 70], humedad: [50, 75]
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
function rand(min, max) { return min + Math.random() * (max - min) }

/**
 * Factor diurno para una hora dada: seno normalizado.
 * Pico al mediodía (hora 14), mínimo a las 4am.
 */
function diurnal(hour) {
  return Math.sin((hour - 6) * Math.PI / 12)  // -1 a +1
}

function isRushHour(hour) {
  return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20)
}

/**
 * Genera un snapshot de datos para una ciudad a una hora específica.
 */
function generateSnapshot(cityName, hour, ranges) {
  const d = diurnal(hour)
  const rush = isRushHour(hour)

  const [tMin, tMax] = ranges.temperatura
  const tCenter = (tMin + tMax) / 2
  const tAmp    = (tMax - tMin) / 2
  const temperatura = clamp(Math.round(tCenter + d * tAmp * 0.45 + rand(-1.5, 1.5)), tMin, tMax)

  const [hMin, hMax] = ranges.humedad
  const tNorm   = (temperatura - tMin) / (tMax - tMin + 0.01)
  const humedad = clamp(Math.round(hMax - tNorm * (hMax - hMin) * 0.60 + rand(-3, 3)), hMin, hMax)

  const [aMin, aMax] = ranges.aqi
  const aCenter = (aMin + aMax) / 2
  const aAmp    = (aMax - aMin) / 2
  const aqi     = clamp(Math.round(aCenter + d * aAmp * 0.20 + (rush ? aAmp * 0.15 : 0) + rand(-5, 5)), aMin, aMax)

  const [iMin, iMax] = ranges.ica
  const aqiNorm = (aqi - aMin) / (aMax - aMin + 0.01)
  const ica     = clamp(Math.round(iMax - aqiNorm * (iMax - iMin) * 0.50 + rand(-3, 3)), iMin, iMax)

  const [rMin, rMax] = ranges.ruido
  const ruido   = clamp(Math.round(rand(rMin, rMax) + (rush ? 8 : 0)), rMin, rMax)

  return { temperatura, aqi, ica, ruido, humedad }
}

async function main() {
  const client = await pool.connect()
  console.log('✅ Conectado a PostgreSQL')

  try {
    // Cargar localidades y métricas
    const { rows: localidades } = await client.query('SELECT id, nombre FROM localidades')
    const { rows: metricas }    = await client.query('SELECT id, clave FROM metricas')
    
    // Intentar obtener fuente 'simulacion'
    let { rows: fuentes } = await client.query(
      "SELECT id FROM fuentes_datos WHERE clave = 'simulacion' LIMIT 1"
    )
    if (!fuentes.length) {
      // Si no existe la clave 'simulacion', tomar la primera fuente disponible
      const fb = await client.query('SELECT id FROM fuentes_datos LIMIT 1')
      fuentes = fb.rows
    }
    // Fallback final: fuente_id = 1
    const fuenteId = fuentes[0]?.id || 1

    console.log(`📦 Localidades: ${localidades.length}, Métricas: ${metricas.length}, Fuente ID: ${fuenteId}`)

    // Verificar cuántas filas hay ya
    const { rows: [countRow] } = await client.query('SELECT COUNT(*) FROM lecturas')
    console.log(`📊 Lecturas existentes: ${countRow.count}`)

    const metricaMap = {}
    metricas.forEach(m => { metricaMap[m.clave] = m.id })

    const DIAS    = 7
    const HORAS   = 24
    const now     = new Date()
    const inserts = []

    console.log(`⏳ Generando ${DIAS} días × ${HORAS} horas × ${localidades.length} ciudades...`)

    for (let dOffset = DIAS - 1; dOffset >= 0; dOffset--) {
      for (let h = 0; h < HORAS; h++) {
        const ts = new Date(now)
        ts.setDate(ts.getDate() - dOffset)
        ts.setHours(h, 0, 0, 0)
        const isoTs = ts.toISOString()

        for (const loc of localidades) {
          const name   = loc.nombre.toLowerCase()
          const ranges = CITY_RANGES[name] || DEFAULT_RANGES
          const snap   = generateSnapshot(name, h, ranges)

          for (const [metricKey, val] of Object.entries(snap)) {
            const metId = metricaMap[metricKey]
            if (!metId) continue
            inserts.push(`('${isoTs}', ${loc.id}, ${metId}, ${val}, ${fuenteId})`)
          }
        }
      }
    }

    console.log(`💾 Insertando ${inserts.length} lecturas en lotes de 5000...`)

    // Insertar en lotes para no agotar la memoria
    const BATCH = 5000
    let inserted = 0
    for (let i = 0; i < inserts.length; i += BATCH) {
      const batch = inserts.slice(i, i + BATCH)
      await client.query(`
        INSERT INTO lecturas (tiempo, localidad_id, metrica_id, valor, fuente_id)
        VALUES ${batch.join(',')}
        ON CONFLICT DO NOTHING
      `)
      inserted += batch.length
      process.stdout.write(`\r   ${inserted}/${inserts.length} (${Math.round(inserted/inserts.length*100)}%)`)
    }

    console.log(`\n✅ Historial generado: ${inserted} lecturas de ${DIAS * HORAS} snapshots horarios`)

    const { rows: [newCount] } = await client.query('SELECT COUNT(*) FROM lecturas')
    console.log(`📊 Total lecturas ahora: ${newCount.count}`)

  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
