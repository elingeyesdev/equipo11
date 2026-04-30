const LOCALIDADES = require('./localidades.data')
const { sendEmail } = require('../../utils/mailer')
const db = require('../../config/db')

let alertEmail = null;
let lastAlertTimes = {};

const METRIC_CONFIG = {
  temperatura: { delta: 0.8 },
  aqi:         { delta: 8 },
  ica:         { delta: 4 },
  ruido:       { delta: 4 },
  humedad:     { delta: 3 },
}

const METRIC_LIMITS = {
  temperatura: { min: -40, max: 60 },
  aqi:         { min: 0,   max: 500 },
  ica:         { min: 0,   max: 100 },
  ruido:       { min: 0,   max: 140 },
  humedad:     { min: 0,   max: 100 },
}

const METRIC_KEYS = Object.keys(METRIC_CONFIG)

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function generateDelta(maxDelta) {
  return (Math.random() * 2 - 1) * maxDelta
}

function randomInRange(min, max) {
  return Math.round(min + Math.random() * (max - min))
}

function createInitialState() {
  return LOCALIDADES.map(dept => {
    const data = {}
    METRIC_KEYS.forEach(metric => {
      const [min, max] = dept.ranges[metric]
      data[metric] = randomInRange(min, max)
    })
    return { id: dept.id, name: dept.name, latitude: dept.latitude, longitude: dept.longitude, data }
  })
}

function getDiurnalFactor() {
  const hour = new Date().getHours()
  return Math.sin((hour - 6) * Math.PI / 12)
}

function isRushHour() {
  const hour = new Date().getHours()
  return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20)
}

function generateNextTick(previousState) {
  const diurnal  = getDiurnalFactor()
  const rushHour = isRushHour()

  return previousState.map(city => {
    const dept    = LOCALIDADES.find(d => d.id === city.id)
    const newData = {}

    const [tMin, tMax] = dept.ranges.temperatura
    const tCenter = (tMin + tMax) / 2
    const tAmplitude = (tMax - tMin) / 2
    const tempTarget = clamp(tCenter + diurnal * tAmplitude * 0.45, tMin, tMax)
    newData.temperatura = clamp(
      Math.round(city.data.temperatura + generateDelta(METRIC_CONFIG.temperatura.delta) + (tempTarget - city.data.temperatura) * 0.10),
      tMin, tMax
    )

    const [hMin, hMax] = dept.ranges.humedad
    const tNorm = (newData.temperatura - tMin) / (tMax - tMin + 0.001)
    const humTarget = clamp(hMax - tNorm * (hMax - hMin) * 0.60, hMin, hMax)
    newData.humedad = clamp(
      Math.round(city.data.humedad + generateDelta(METRIC_CONFIG.humedad.delta) + (humTarget - city.data.humedad) * 0.08),
      hMin, hMax
    )

    const [aMin, aMax] = dept.ranges.aqi
    const aCenter = (aMin + aMax) / 2
    const aAmplitude = (aMax - aMin) / 2
    const aqiTarget = clamp(
      aCenter + diurnal * aAmplitude * 0.20 + (rushHour ? aAmplitude * 0.15 : 0),
      aMin, aMax
    )
    newData.aqi = clamp(
      Math.round(city.data.aqi + generateDelta(METRIC_CONFIG.aqi.delta) + (aqiTarget - city.data.aqi) * 0.07),
      aMin, aMax
    )

    const [iMin, iMax] = dept.ranges.ica
    const aqiNorm = (newData.aqi - aMin) / (aMax - aMin + 0.001)
    const icaTarget = clamp(iMax - aqiNorm * (iMax - iMin) * 0.50, iMin, iMax)
    newData.ica = clamp(
      Math.round(city.data.ica + generateDelta(METRIC_CONFIG.ica.delta) + (icaTarget - city.data.ica) * 0.06),
      iMin, iMax
    )

    const [rMin, rMax] = dept.ranges.ruido
    const rushBoost   = rushHour ? 8 : 0
    newData.ruido = clamp(Math.round(city.data.ruido + generateDelta(METRIC_CONFIG.ruido.delta) + rushBoost), rMin, rMax)

    return { ...city, data: newData }
  })
}

// =============================================================================
// DB: mapping y normalización
// =============================================================================

let dbMapping = { localidades: {}, metricas: {} }

/**
 * Normaliza nombres eliminando tildes/diacríticos y pasando a minúsculas,
 * para que "Córdoba", "Cordoba" y "cordoba" sean equivalentes en el mapeo.
 */
function normalizeNombre(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

async function loadDbMapping() {
  try {
    const locRes = await db.query('SELECT id, nombre FROM localidades')
    locRes.rows.forEach(r => {
      dbMapping.localidades[normalizeNombre(r.nombre)] = r.id
    })

    const metRes = await db.query('SELECT id, clave FROM metricas')
    metRes.rows.forEach(r => { dbMapping.metricas[r.clave] = r.id })

    console.log(`[Simulación] DB mapping cargado: ${Object.keys(dbMapping.localidades).length} localidades, ${Object.keys(dbMapping.metricas).length} métricas`)
  } catch (err) {
    console.error('[Simulación] Error cargando DB mapping:', err.message)
  }
}

// =============================================================================
// Buffer de lecturas + Bulk Insert
// =============================================================================

// Acumula hasta 5 ticks completos (60 ciudades × 5 métricas = 300 lecturas/tick)
const BUFFER_FLUSH_SIZE = 1500
let readingsBuffer = []

/**
 * Vacía el buffer con un único INSERT ... VALUES (...), (...), ...
 * sessionId puede pasarse explícitamente (al cerrar la sesión) o tomar
 * el valor de activeSessionId.
 */
async function flushBuffer(sessionId = activeSessionId) {
  if (!readingsBuffer.length || !sessionId) return

  const batch = readingsBuffer.splice(0)   // drena atómicamente

  const params = []
  const placeholders = batch.map((r, i) => {
    const base = i * 6
    params.push(r.tiempo, r.localidadId, r.metricaId, r.valor, r.fuenteId, sessionId)
    return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6})`
  })

  try {
    await db.query(
      `INSERT INTO lecturas (tiempo, localidad_id, metrica_id, valor, fuente_id, sesion_simulacion_id)
       VALUES ${placeholders.join(',')}
       ON CONFLICT DO NOTHING`,
      params
    )
    console.log(`[Simulación] Bulk insert: ${batch.length} lecturas (sesión ${sessionId})`)
  } catch (err) {
    console.error('[Simulación] Error en bulk insert:', err.message)
  }
}

/**
 * Por cada tick, encola las lecturas en el buffer.
 * Solo ejecuta si hay una sesión activa y el mapping de BD está disponible.
 * El flush automático ocurre cuando el buffer alcanza BUFFER_FLUSH_SIZE.
 */
function persistReadings(state) {
  if (!activeSessionId || !Object.keys(dbMapping.localidades).length) return

  const timestamp = new Date()

  state.forEach(city => {
    const locId = dbMapping.localidades[normalizeNombre(city.name)]
    if (!locId) return

    Object.entries(city.data).forEach(([metricKey, val]) => {
      const metId = dbMapping.metricas[metricKey]
      if (metId && val !== null) {
        readingsBuffer.push({
          tiempo:      timestamp,
          localidadId: locId,
          metricaId:   metId,
          valor:       val,
          fuenteId:    1,    // fuente: simulacion
        })
      }
    })
  })

  if (readingsBuffer.length >= BUFFER_FLUSH_SIZE) {
    flushBuffer().catch(err =>
      console.error('[Simulación] Error en flush automático:', err.message)
    )
  }
}

/**
 * Persiste una inyección manual de forma inmediata (sin buffer).
 * Usa bulk INSERT con VALUES para consistencia con el resto del servicio.
 */
async function persistInjection(state) {
  if (!Object.keys(dbMapping.localidades).length) return

  const params = []
  const placeholders = []

  state.forEach(city => {
    const locId = dbMapping.localidades[normalizeNombre(city.name)]
    if (!locId) return

    Object.entries(city.data).forEach(([metricKey, val]) => {
      const metId = dbMapping.metricas[metricKey]
      if (metId && val !== null) {
        const i    = placeholders.length
        const base = i * 5
        params.push(locId, metId, val, 2, activeSessionId)   // fuente_id=2 (manual)
        placeholders.push(`(NOW(),$${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`)
      }
    })
  })

  if (!placeholders.length) return

  try {
    await db.query(
      `INSERT INTO lecturas (tiempo, localidad_id, metrica_id, valor, fuente_id, sesion_simulacion_id)
       VALUES ${placeholders.join(',')}
       ON CONFLICT DO NOTHING`,
      params
    )
  } catch (err) {
    console.error('[Simulación] Error guardando inyección manual:', err.message)
  }
}

// =============================================================================
// Estado interno + control de sesión
// =============================================================================

let currentState   = createInitialState()
let intervalId     = null
let tickCount      = 0
let activeSessionId = null

/**
 * Inicia la simulación.
 * Si se provee userId, crea una sesión en sesiones_simulacion y persiste cada tick.
 * La creación de sesión es no-bloqueante para no retrasar el inicio del intervalo.
 */
function start(intervalMs, onTick, userId = null) {
  if (intervalId) return false

  loadDbMapping()

  tickCount       = 0
  currentState    = createInitialState()
  readingsBuffer  = []
  activeSessionId = null

  if (userId) {
    db.query(
      `INSERT INTO sesiones_simulacion (usuario_id, intervalo_ms, configuracion)
       VALUES ($1, $2, $3) RETURNING id`,
      [userId, intervalMs, JSON.stringify({ localidades: LOCALIDADES.length, metricas: METRIC_KEYS })]
    )
      .then(res => {
        activeSessionId = res.rows[0].id
        console.log(`[Simulación] Sesión creada: ID ${activeSessionId}`)
      })
      .catch(err => console.error('[Simulación] Error creando sesión:', err.message))
  }

  intervalId = setInterval(() => {
    currentState = generateNextTick(currentState)
    tickCount++
    persistReadings(currentState)
    checkCriticalThresholds(currentState)
    onTick({ cities: currentState, tickCount, timestamp: new Date().toISOString() })
  }, intervalMs)

  return true
}

/**
 * Detiene la simulación. Vacía el buffer pendiente y cierra la sesión en BD.
 */
function stop() {
  if (!intervalId) return false
  clearInterval(intervalId)
  intervalId = null

  const sessionToClose = activeSessionId
  const finalTicks     = tickCount
  activeSessionId      = null

  if (sessionToClose) {
    flushBuffer(sessionToClose)
      .then(() => db.query(
        `UPDATE sesiones_simulacion SET fin = NOW(), total_ticks = $2 WHERE id = $1`,
        [sessionToClose, finalTicks]
      ))
      .then(() => console.log(`[Simulación] Sesión ${sessionToClose} cerrada. Ticks: ${finalTicks}`))
      .catch(err => console.error('[Simulación] Error cerrando sesión:', err.message))
  }

  return true
}

function isRunning() {
  return intervalId !== null
}

function getCurrentState() {
  return { cities: currentState, tickCount, timestamp: new Date().toISOString() }
}

function injectData(cityId, partialData) {
  const cityIndex = currentState.findIndex(c => c.id === cityId)
  if (cityIndex === -1) return false

  const sanitized = {}
  Object.entries(partialData).forEach(([metric, value]) => {
    if (METRIC_KEYS.includes(metric) && typeof value === 'number' && !isNaN(value)) {
      const limits = METRIC_LIMITS[metric]
      sanitized[metric] = clamp(Math.round(value), limits.min, limits.max)
    }
  })

  if (Object.keys(sanitized).length === 0) return false

  currentState[cityIndex] = {
    ...currentState[cityIndex],
    data: { ...currentState[cityIndex].data, ...sanitized }
  }

  persistInjection([currentState[cityIndex]])
  checkCriticalThresholds([currentState[cityIndex]])

  return true
}

// =============================================================================
// Alertas
// =============================================================================

function setAlertEmail(email) {
  alertEmail = email
}

function checkCriticalThresholds(state) {
  if (!alertEmail) return

  const CRITICAL_LIMITS = {
    aqi:         150,
    ica:         26,
    ruido:       85,
    temperatura: 40,
    humedad:     90,
  }

  const now           = Date.now()
  const ALERT_COOLDOWN = 10 * 60 * 1000

  state.forEach(city => {
    Object.entries(city.data).forEach(([metric, val]) => {
      let isCritical = false
      let condition  = ''

      if (metric === 'ica' && val <= CRITICAL_LIMITS.ica) {
        isCritical = true
        condition  = `cayó a ${val} (Crítico: <= ${CRITICAL_LIMITS.ica})`
      } else if (metric === 'temperatura' && (val >= CRITICAL_LIMITS.temperatura || val <= -10)) {
        isCritical = true
        condition  = `alcanzó ${val}°C (Crítico: >= 40 o <= -10)`
      } else if (metric !== 'ica' && metric !== 'temperatura' && val >= CRITICAL_LIMITS[metric]) {
        isCritical = true
        condition  = `alcanzó ${val} (Crítico: >= ${CRITICAL_LIMITS[metric]})`
      }

      if (isCritical) {
        const key = `${city.id}-${metric}`
        if (!lastAlertTimes[key] || now - lastAlertTimes[key] > ALERT_COOLDOWN) {
          lastAlertTimes[key] = now
          const msg = `Alerta: En la ciudad de <b>${city.name}</b>, el indicador <b>${metric.toUpperCase()}</b> ${condition}. Se requiere acción inmediata.`
          sendEmail(alertEmail, `Alerta Crítica: ${metric.toUpperCase()} en ${city.name}`, 'Alerta de Umbral Crítico', msg, 'Ver Mapa', `http://localhost:5173/mapa?city=${city.id}`)
            .catch(err => console.error('Error enviando alerta:', err))
        }
      }
    })
  })
}

module.exports = { start, stop, isRunning, getCurrentState, injectData, setAlertEmail }
