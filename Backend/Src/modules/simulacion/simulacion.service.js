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

let alertEmail = null;
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
function getDiurnalFactor() {
  const hour = new Date().getHours() // 0-23
  // sin crece desde hora 6 (amanecer) hasta 14 (mediodía) y baja hasta las 2am
  return Math.sin((hour - 6) * Math.PI / 12)
}

/**
 * Verdadero si es hora punta (7-9am o 17-20pm).
 */
function isRushHour() {
  const hour = new Date().getHours()
  return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20)
}

/**
 * Genera el siguiente tick de datos con:
 * - Variación gradual aleatoria
 * - Ciclo diurno (temperatura, AQI)
 * - Correlaciones entre métricas (humedad ↔ temperatura, ICA ↔ AQI)
 * - Ruido extra en hora punta
 */
function generateNextTick(previousState) {
  const diurnal = getDiurnalFactor()  // -1 a +1
  const rushHour = isRushHour()

  return previousState.map(city => {
    const dept = LOCALIDADES.find(d => d.id === city.id)
    const newData = {}

    // --- TEMPERATURA con ciclo diurno ---
    const [tMin, tMax] = dept.ranges.temperatura
    const tCenter = (tMin + tMax) / 2
    const tAmplitude = (tMax - tMin) / 2
    // Target diurno: más calor al mediodía, más frío de madrugada
    const tempTarget = clamp(tCenter + diurnal * tAmplitude * 0.45, tMin, tMax)
    const tempDelta = generateDelta(METRIC_CONFIG.temperatura.delta)
    // Suave atracción al target diurno (10% por tick) + ruido
    newData.temperatura = clamp(
      Math.round(city.data.temperatura + tempDelta + (tempTarget - city.data.temperatura) * 0.10),
      tMin, tMax
    )

    // --- HUMEDAD inversamente correlacionada con temperatura ---
    const [hMin, hMax] = dept.ranges.humedad
    // Cuando temperatura sube → humedad relativa baja (correlación -0.6)
    const tNorm = (newData.temperatura - tMin) / (tMax - tMin + 0.001)
    const humTarget = clamp(hMax - tNorm * (hMax - hMin) * 0.60, hMin, hMax)
    const humDelta = generateDelta(METRIC_CONFIG.humedad.delta)
    newData.humedad = clamp(
      Math.round(city.data.humedad + humDelta + (humTarget - city.data.humedad) * 0.08),
      hMin, hMax
    )

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
    newData.aqi = clamp(
      Math.round(city.data.aqi + aqiDelta + (aqiTarget - city.data.aqi) * 0.07),
      aMin, aMax
    )

    // --- ICA inversamente correlado con AQI ---
    const [iMin, iMax] = dept.ranges.ica
    // Más contaminación → peor calidad de agua (correlación -0.5)
    const aqiNorm = (newData.aqi - aMin) / (aMax - aMin + 0.001)
    const icaTarget = clamp(iMax - aqiNorm * (iMax - iMin) * 0.50, iMin, iMax)
    const icaDelta = generateDelta(METRIC_CONFIG.ica.delta)
    newData.ica = clamp(
      Math.round(city.data.ica + icaDelta + (icaTarget - city.data.ica) * 0.06),
      iMin, iMax
    )

    // --- RUIDO: pico en hora punta + variación de fondo ---
    const [rMin, rMax] = dept.ranges.ruido
    const rushBoost = rushHour ? 8 : 0
    const ruidoDelta = generateDelta(METRIC_CONFIG.ruido.delta) + rushBoost
    newData.ruido = clamp(Math.round(city.data.ruido + ruidoDelta), rMin, rMax)

    return { ...city, data: newData }
  })
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

    console.log(`[Simulación] DB mapping cargado: ${Object.keys(dbMapping.localidades).length} localidades, ${Object.keys(dbMapping.metricas).length} métricas`)
  } catch (err) {
    console.error('[Simulación] Error cargando DB mapping:', err.message)
  }
}

/**
 * Persiste el estado actual en la tabla lecturas.
 * Solo ejecuta si pasó al menos 1 hora desde el último guardado.
 */
async function persistReadings(state) {
  if (!Object.keys(dbMapping.localidades).length) return

  const now = Date.now()
  if (now - lastPersistTime < PERSIST_INTERVAL_MS) return  // Throttle horario
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

    console.log(`[Simulación] Snapshot horario guardado: ${localidadIds.length} lecturas`)
  } catch (err) {
    console.error('[Simulación] Error guardando snapshot horario:', err.message)
  }
}

/**
 * Inicia la simulación. Llama a onTick cada `intervalMs` milisegundos.
 * Si ya está corriendo, no hace nada (idempotente).
 */
function start(intervalMs, onTick) {
  if (intervalId) return false // Ya está corriendo

  loadDbMapping() // Carga de IDs para persistencia

  tickCount = 0
  currentState = createInitialState()
  lastPersistTime = 0  // Resetear throttle al iniciar

  intervalId = setInterval(() => {
    currentState = generateNextTick(currentState)
    tickCount++
    persistReadings(currentState) // Throttled — solo cada hora
    checkCriticalThresholds(currentState)
    onTick({
      cities: currentState,
      tickCount,
      timestamp: new Date().toISOString()
    })
  }, intervalMs)

  return true
}

/**
 * Detiene la simulación y limpia el intervalo.
 */
function stop() {
  if (!intervalId) return false
  clearInterval(intervalId)
  intervalId = null
  return true
}

/**
 * Indica si la simulación está activa.
 */
function isRunning() {
  return intervalId !== null
}

/**
 * Retorna el estado actual (último snapshot de datos).
 */
function getCurrentState() {
  return {
    cities: currentState,
    tickCount,
    timestamp: new Date().toISOString()
  }
}

/**
 * Inyecta datos manuales para una ciudad específica.
 * Los valores reemplazan el estado actual y la simulación continúa desde ahí.
 */
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

  // La inyección manual siempre persiste, sin throttle
  persistInjection([currentState[cityIndex]])
  checkCriticalThresholds([currentState[cityIndex]])

  return true
}

/**
 * Persiste una inyección manual inmediatamente (sin throttle).
 */
async function persistInjection(state) {
  if (!Object.keys(dbMapping.localidades).length) return

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

function setAlertEmail(email) {
  alertEmail = email;
}

function checkCriticalThresholds(state) {
  if (!alertEmail) return;

  const CRITICAL_LIMITS = {
    aqi: 150,        // > 150 (Dañino/Peligroso)
    ica: 26,         // < 26 (Muy mala)
    ruido: 85,       // > 85 (Dañino/Peligroso)
    temperatura: 40, // > 40 o < -10
    humedad: 90      // > 90
  }

  const now = Date.now();
  const ALERT_COOLDOWN = 10 * 60 * 1000; // 10 minutos por métrica y ciudad

  state.forEach(city => {
    Object.entries(city.data).forEach(([metric, val]) => {
      let isCritical = false;
      let condition = '';

      if (metric === 'ica' && val <= CRITICAL_LIMITS.ica) {
        isCritical = true;
        condition = `cayó a ${val} (Crítico: <= ${CRITICAL_LIMITS.ica})`;
      } else if (metric === 'temperatura' && (val >= CRITICAL_LIMITS.temperatura || val <= -10)) {
        isCritical = true;
        condition = `alcanzó ${val}°C (Crítico: >= 40 o <= -10)`;
      } else if (metric !== 'ica' && metric !== 'temperatura' && val >= CRITICAL_LIMITS[metric]) {
        isCritical = true;
        condition = `alcanzó ${val} (Crítico: >= ${CRITICAL_LIMITS[metric]})`;
      }

      if (isCritical) {
        const key = `${city.id}-${metric}`;
        if (!lastAlertTimes[key] || now - lastAlertTimes[key] > ALERT_COOLDOWN) {
          lastAlertTimes[key] = now;

          const msg = `Alerta: En la ciudad de <b>${city.name}</b>, el indicador <b>${metric.toUpperCase()}</b> ${condition}. Se requiere acción inmediata.`;
          sendEmail(alertEmail, `Alerta Crítica: ${metric.toUpperCase()} en ${city.name}`, 'Alerta de Umbral Crítico', msg, 'Ver Mapa', `http://localhost:5173/mapa?city=${city.id}`)
            .catch(err => console.error('Error enviando alerta:', err));
        }
      }
    });
  });
}

module.exports = { start, stop, isRunning, getCurrentState, injectData, setAlertEmail }
