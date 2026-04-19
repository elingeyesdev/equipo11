/**
 * Servicio de Simulación de Datos Ambientales
 * 
 * Principios aplicados:
 * - SRP: Solo se encarga de generar y gestionar datos simulados.
 * - KISS: Lógica de variación gradual simple (clamp + random delta).
 * - DRY: Función clamp y generateDelta reutilizadas para todas las métricas.
 * - OCP: Agregar una nueva métrica solo requiere añadirla al objeto METRIC_CONFIG.
 */
const DEPARTAMENTOS = require('./departamentos.data')

// Configuración de variación por métrica (delta máximo por tick)
const METRIC_CONFIG = {
  temperature: { delta: 2 },
  aqi:          { delta: 12 },
  waterQuality: { delta: 6 },
  noise:        { delta: 5 },
  humidity:     { delta: 4 }
}

// Rangos válidos absolutos por métrica (para validar inyección manual)
const METRIC_LIMITS = {
  temperature:  { min: -40, max: 60 },   // Permite negativos (frío intenso)
  aqi:          { min: 0,   max: 500 },
  waterQuality: { min: 0,   max: 100 },
  noise:        { min: 0,   max: 140 },
  humidity:     { min: 0,   max: 100 },
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
  return DEPARTAMENTOS.map(dept => {
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
 * Genera el siguiente tick de datos aplicando variación gradual
 * sobre el estado previo. Cada métrica varía ±delta y se mantiene
 * dentro de su rango geográfico.
 */
function generateNextTick(previousState) {
  return previousState.map(city => {
    const dept = DEPARTAMENTOS.find(d => d.id === city.id)
    const newData = {}

    METRIC_KEYS.forEach(metric => {
      const [min, max] = dept.ranges[metric]
      const delta = generateDelta(METRIC_CONFIG[metric].delta)
      newData[metric] = clamp(Math.round(city.data[metric] + delta), min, max)
    })

    return { ...city, data: newData }
  })
}

// --- Estado interno del servicio ---
let currentState = createInitialState()
let intervalId = null
let tickCount = 0

/**
 * Inicia la simulación. Llama a onTick cada `intervalMs` milisegundos.
 * Si ya está corriendo, no hace nada (idempotente).
 */
function start(intervalMs, onTick) {
  if (intervalId) return false // Ya está corriendo

  tickCount = 0
  currentState = createInitialState()

  intervalId = setInterval(() => {
    currentState = generateNextTick(currentState)
    tickCount++
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
 * No clampea: el usuario puede probar valores extremos a propósito.
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
  return true
}

module.exports = { start, stop, isRunning, getCurrentState, injectData }
