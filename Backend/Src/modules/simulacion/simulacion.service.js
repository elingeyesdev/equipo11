/**
 * Servicio de Simulación de Datos Ambientales
 *
 * Principios aplicados:
 * - SRP: Solo se encarga de generar y gestionar datos simulados.
 * - KISS: Lógica de variación gradual simple (clamp + random delta).
 * - DRY: Función clamp y generateDelta reutilizadas para todas las métricas.
 * - OCP: Agregar una nueva métrica solo requiere añadirla al objeto METRIC_CONFIG.
 *
 * Mejoras v2:
 * - Ciclo diurno (temperatura y AQI varían con la hora del día)
 * - Correlación entre métricas (humedad ↑ cuando temperatura ↓)
 * - Picos de ruido en hora punta (7-9am, 5-8pm)
 * - Persistencia throttled: solo 1 vez por hora para no explotar la BD
 */
const LOCALIDADES = require('./localidades.data')
const { sendEmail } = require('../../utils/mailer')

let lastAlertTimes = {}; // Para no spamear { "lapaz-aqi": timestamp }

// Configuración de variación por métrica (delta máximo por tick)
const METRIC_CONFIG = {
  temperatura: { delta: 0.8 },
  aqi: { delta: 8 },
  ica: { delta: 4 },
  ruido: { delta: 4 },
  humedad: { delta: 3 },
}

// Rangos válidos absolutos por métrica (para validar inyección manual)
const METRIC_LIMITS = {
  temperatura: { min: -40, max: 60 },
  aqi: { min: 0, max: 500 },
  ica: { min: 0, max: 100 },
  ruido: { min: 0, max: 140 },
  humedad: { min: 0, max: 100 },
}

const METRIC_KEYS = Object.keys(METRIC_CONFIG)

/**
 * Restringe un valor dentro de un rango [min, max].
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

/**
 * Genera un delta aleatorio entre -maxDelta y +maxDelta.
 */
function generateDelta(maxDelta) {
  return (Math.random() * 2 - 1) * maxDelta
}

/**
 * Genera el valor inicial de una métrica dentro de su rango.
 */
function randomInRange(min, max) {
  return Math.round(min + Math.random() * (max - min))
}

/**
 * Crea el estado inicial de todos los departamentos con valores aleatorios
 * dentro de sus rangos definidos.
 */
function createInitialState() {
  return LOCALIDADES.map(dept => {
    const data = {}
    METRIC_KEYS.forEach(metric => {
      const [min, max] = dept.ranges[metric]
      data[metric] = randomInRange(min, max)
    })

    return {
      id: dept.id,
      name: dept.name,
      latitude: dept.latitude,
      longitude: dept.longitude,
      data
    }
  })
}

/**
 * Factor diurno basado en la hora local: valor ∈ [-1, 1].
 * Pico positivo al mediodía (~14:00), negativo en la madrugada (~4:00).
 */
/**
 * Factor diurno basado en una hora específica: valor ∈ [-1, 1].
 * Pico positivo al mediodía (~14:00), negativo en la madrugada (~4:00).
 */
function getDiurnalFactor(date = new Date()) {
  const hour = date.getHours() // 0-23
  // sin crece desde hora 6 (amanecer) hasta 14 (mediodía) y baja hasta las 2am
  return Math.sin((hour - 6) * Math.PI / 12)
}

/**
 * Verdadero si es hora punta (7-9am o 17-20pm) en una fecha específica.
 */
function isRushHour(date = new Date()) {
  const hour = date.getHours()
  return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20)
}

/**
 * Genera el siguiente tick de datos con:
 * - Variación gradual aleatoria
 * - Ciclo diurno (temperatura, AQI)
 * - Correlaciones entre métricas (humedad ↔ temperatura, ICA ↔ AQI)
 * - Ruido extra en hora punta
 */
function generateNextTick(previousState, date = new Date()) {
  const diurnal = getDiurnalFactor(date)  // -1 a +1
  const rushHour = isRushHour(date)

  return previousState.map(city => {
    const dept = LOCALIDADES.find(d => d.id === city.id)
    if (!dept) return city
    const newData = {}

    // --- TEMPERATURA con ciclo diurno ---
    const [tMin, tMax] = dept.ranges.temperatura
    const tCenter = (tMin + tMax) / 2
    const tAmplitude = (tMax - tMin) / 2
    // Target diurno: más calor al mediodía, más frío de madrugada
    const tempTarget = clamp(tCenter + diurnal * tAmplitude * 0.45, tMin, tMax)
    const tempDelta = generateDelta(METRIC_CONFIG.temperatura.delta)
    // Suave atracción al target diurno (10% por tick) + ruido
    newData.temperatura = Number(clamp(
      (city.data.temperatura + tempDelta + (tempTarget - city.data.temperatura) * 0.10),
      tMin, tMax
    ).toFixed(2))

    // --- HUMEDAD inversamente correlacionada con temperatura ---
    const [hMin, hMax] = dept.ranges.humedad
    // Cuando temperatura sube → humedad relativa baja (correlación -0.6)
    const tNorm = (newData.temperatura - tMin) / (tMax - tMin + 0.001)
    const humTarget = clamp(hMax - tNorm * (hMax - hMin) * 0.60, hMin, hMax)
    const humDelta = generateDelta(METRIC_CONFIG.humedad.delta)
    newData.humedad = Number(clamp(
      (city.data.humedad + humDelta + (humTarget - city.data.humedad) * 0.08),
      hMin, hMax
    ).toFixed(2))

    // --- AQI: sube de día (tráfico, calor) y en hora punta ---
    const [aMin, aMax] = dept.ranges.aqi
    const aCenter = (aMin + aMax) / 2
    const aAmplitude = (aMax - aMin) / 2
    // Target: sube 20% en pico de día y otro 15% en hora punta
    const aqiTarget = clamp(
      aCenter + diurnal * aAmplitude * 0.20 + (rushHour ? aAmplitude * 0.15 : 0),
      aMin, aMax
    )
    const aqiDelta = generateDelta(METRIC_CONFIG.aqi.delta)
    newData.aqi = Number(clamp(
      (city.data.aqi + aqiDelta + (aqiTarget - city.data.aqi) * 0.07),
      aMin, aMax
    ).toFixed(2))

    // --- ICA inversamente correlado con AQI ---
    const [iMin, iMax] = dept.ranges.ica
    // Más contaminación → peor calidad de agua (correlación -0.5)
    const aqiNorm = (newData.aqi - aMin) / (aMax - aMin + 0.001)
    const icaTarget = clamp(iMax - aqiNorm * (iMax - iMin) * 0.50, iMin, iMax)
    const icaDelta = generateDelta(METRIC_CONFIG.ica.delta)
    newData.ica = Number(clamp(
      (city.data.ica + icaDelta + (icaTarget - city.data.ica) * 0.06),
      iMin, iMax
    ).toFixed(2))

    // --- RUIDO: pico en hora punta + variación de fondo ---
    const [rMin, rMax] = dept.ranges.ruido
    const rushBoost = rushHour ? 8 : 0
    const ruidoDelta = generateDelta(METRIC_CONFIG.ruido.delta) + rushBoost
    newData.ruido = Number(clamp((city.data.ruido + ruidoDelta), rMin, rMax).toFixed(2))

    return { ...city, id: city.id, name: city.name, data: newData }
  })
}

/**
 * Simula un rango de tiempo y persiste los datos.
 */
async function simulateRange(startTime, endTime, intervalMinutes = 60) {
  const start = new Date(startTime)
  const end = new Date(endTime)
  const intervalMs = intervalMinutes * 60 * 1000

  // 1. Validaciones básicas
  if (end <= start) throw new Error('El límite superior debe ser mayor al inferior.')
  if (end - start < intervalMs) throw new Error('Brecha muy corta para el intervalo seleccionado.')

  // 2. Verificar si ya hay datos en este rango (aproximado)
  const { rows: existing } = await db.query(
    'SELECT COUNT(*) FROM lecturas WHERE tiempo BETWEEN $1 AND $2',
    [start.toISOString(), end.toISOString()]
  )
  if (parseInt(existing[0].count) > 0) throw new Error('Dato ya simulado en este rango.')

  await loadDbMapping()

  // 3. Obtener estado inicial (última lectura conocida o inicial aleatoria)
  let state = await getLastKnownState(start)
  if (!state) state = createInitialState()

  const allLecturas = []
  let current = new Date(start)

  // 4. Generar datos por cada intervalo
  while (current <= end) {
    state = generateNextTick(state, current)
    const timestamp = current.toISOString()

    state.forEach(city => {
      const locId = dbMapping.localidades[city.name.toLowerCase()]
      if (!locId) return
      Object.entries(city.data).forEach(([metricKey, val]) => {
        const metId = dbMapping.metricas[metricKey]
        if (metId) {
          allLecturas.push({
            tiempo: timestamp,
            localidad_id: locId,
            metrica_id: metId,
            valor: val,
            fuente_id: 1 // simulacion
          })
        }
      })
    })
    current = new Date(current.getTime() + intervalMs)
  }

  // 5. Inserción masiva
  if (allLecturas.length > 0) {
    const query = `
      INSERT INTO lecturas (tiempo, localidad_id, metrica_id, valor, fuente_id)
      SELECT (unnest($1::text[]))::timestamptz, unnest($2::int[]), unnest($3::int[]), unnest($4::numeric[]), unnest($5::int[])
      ON CONFLICT DO NOTHING
    `
    const params = [
      allLecturas.map(l => l.tiempo),
      allLecturas.map(l => l.localidad_id),
      allLecturas.map(l => l.metrica_id),
      allLecturas.map(l => l.valor),
      allLecturas.map(l => l.fuente_id)
    ]
    await db.query(query, params)
  }

  return allLecturas.length / LOCALIDADES.length
}

async function getLastKnownState(beforeDate) {
  const { rows } = await db.query(`
    WITH Ultimas AS (
      SELECT DISTINCT ON (localidad_id, metrica_id)
        localidad_id, metrica_id, valor, tiempo
      FROM lecturas
      WHERE tiempo < $1
      ORDER BY localidad_id, metrica_id, tiempo DESC
    )
    SELECT u.*, loc.nombre, loc.latitud, loc.longitud, m.clave
    FROM Ultimas u
    JOIN localidades loc ON loc.id = u.localidad_id
    JOIN metricas m ON m.id = u.metrica_id
  `, [beforeDate.toISOString()])

  if (rows.length === 0) return null

  const cityMap = new Map()
  rows.forEach(r => {
    if (!cityMap.has(r.localidad_id)) {
      cityMap.set(r.localidad_id, {
        id: String(r.localidad_id),
        name: r.nombre,
        latitude: Number(r.latitud),
        longitude: Number(r.longitud),
        data: {}
      })
    }
    cityMap.get(r.localidad_id).data[r.clave] = Number(r.valor)
  })

  return [...cityMap.values()]
}

// --- Estado interno del servicio ---
let currentState = createInitialState()
let intervalId = null
let tickCount = 0

// --- Integración con Base de Datos ---
const db = require('../../config/db')
let dbMapping = { localidades: {}, metricas: {} }

// Throttle: solo persistir 1 vez por hora para no llenar la BD
let lastPersistTime = 0
const PERSIST_INTERVAL_MS = 60 * 60 * 1000  // 1 hora

async function loadDbMapping() {
  try {
    const locRes = await db.query('SELECT id, nombre FROM localidades')
    locRes.rows.forEach(r => { dbMapping.localidades[r.nombre.toLowerCase()] = r.id })

    const metRes = await db.query('SELECT id, clave FROM metricas')
    metRes.rows.forEach(r => { dbMapping.metricas[r.clave] = r.id })
  } catch (err) {
    console.error('[Simulación] Error cargando DB mapping:', err.message)
  }
}

/**
 * Persiste el estado actual en la tabla lecturas.
 */
async function persistReadings(state) {
  if (!Object.keys(dbMapping.localidades).length) await loadDbMapping()

  const now = Date.now()
  if (now - lastPersistTime < PERSIST_INTERVAL_MS) return
  lastPersistTime = now

  const localidadIds = []
  const metricaIds = []
  const valores = []

  state.forEach(city => {
    const locId = dbMapping.localidades[city.name.toLowerCase()]
    if (!locId) return
    Object.entries(city.data).forEach(([metricKey, val]) => {
      const metId = dbMapping.metricas[metricKey]
      if (metId && val !== null) {
        localidadIds.push(locId)
        metricaIds.push(metId)
        valores.push(val)
      }
    })
  })

  if (!localidadIds.length) return

  try {
    await db.query(`
      INSERT INTO lecturas (tiempo, localidad_id, metrica_id, valor, fuente_id)
      SELECT NOW(), unnest($1::int[]), unnest($2::int[]), unnest($3::numeric[]), 1
      ON CONFLICT DO NOTHING
    `, [localidadIds, metricaIds, valores])
  } catch (err) {
    console.error('[Simulación] Error guardando snapshot horario:', err.message)
  }
}

/**
 * Inicia la simulación.
 */
function start(intervalMs, onTick) {
  if (intervalId) return false
  loadDbMapping()
  tickCount = 0
  currentState = createInitialState()
  lastPersistTime = 0

  intervalId = setInterval(() => {
    currentState = generateNextTick(currentState)
    tickCount++
    persistReadings(currentState)
    onTick({
      cities: currentState,
      tickCount,
      timestamp: new Date().toISOString()
    })
  }, intervalMs)
  return true
}

function stop() {
  if (!intervalId) return false
  clearInterval(intervalId)
  intervalId = null
  return true
}

function isRunning() { return intervalId !== null }

function getCurrentState() {
  return {
    cities: currentState,
    tickCount,
    timestamp: new Date().toISOString()
  }
}

function injectData(cityId, partialData) {
  const cityIndex = currentState.findIndex(c => c.id === cityId)
  if (cityIndex === -1) return false
  const sanitized = {}
  Object.entries(partialData).forEach(([metric, value]) => {
    if (METRIC_KEYS.includes(metric) && typeof value === 'number' && !isNaN(value)) {
      const limits = METRIC_LIMITS[metric]
      sanitized[metric] = clamp(value, limits.min, limits.max)
    }
  })
  if (Object.keys(sanitized).length === 0) return false
  currentState[cityIndex] = {
    ...currentState[cityIndex],
    data: { ...currentState[cityIndex].data, ...sanitized }
  }
  persistInjection([currentState[cityIndex]])
  return true
}

async function persistInjection(state) {
  if (!Object.keys(dbMapping.localidades).length) await loadDbMapping()
  const localidadIds = []
  const metricaIds = []
  const valores = []
  state.forEach(city => {
    const locId = dbMapping.localidades[city.name.toLowerCase()]
    if (!locId) return
    Object.entries(city.data).forEach(([metricKey, val]) => {
      const metId = dbMapping.metricas[metricKey]
      if (metId && val !== null) {
        localidadIds.push(locId)
        metricaIds.push(metId)
        valores.push(val)
      }
    })
  })
  if (!localidadIds.length) return
  try {
    await db.query(`
      INSERT INTO lecturas (tiempo, localidad_id, metrica_id, valor, fuente_id)
      SELECT NOW(), unnest($1::int[]), unnest($2::int[]), unnest($3::numeric[]), 2
      ON CONFLICT DO NOTHING
    `, [localidadIds, metricaIds, valores])
  } catch (err) {
    console.error('[Simulación] Error guardando inyección manual:', err.message)
  }
}

module.exports = { start, stop, isRunning, getCurrentState, injectData, simulateRange }

