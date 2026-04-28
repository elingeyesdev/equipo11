/**
 * alertas.service.js
 * ------------------
 * Módulo de detección y persistencia de alertas ambientales.
 *
 * Responsabilidades (SRP):
 *  1. cargarUmbralesCache()  — pre-carga umbrales de BD en memoria al arranque.
 *  2. evaluarTick(tickData)  — compara cada valor del tick con los umbrales;
 *                              aplica lógica anti-tormenta (solo alerta si cambia de nivel).
 *  3. guardarAlertas([])     — inserta alertas nuevas en batch en la tabla `alertas`.
 *  4. reconocerAlerta(id, usuarioId) — marca una alerta como reconocida.
 *
 * Anti-tormenta:
 *  El Map `estadoNivelActual` guarda el último nivel activo por `(localidadId:metricaClave)`.
 *  Solo se genera una alerta cuando el nivel cambia — no por cada tick en el mismo nivel.
 *
 * Filtro de severidad:
 *  Solo se persisten alertas con severidad 'advertencia', 'critica' o 'emergencia'.
 *  Los niveles 'informativa' se descartan para no saturar la tabla.
 */

const db = require('../../config/db')

// ─── CACHÉ DE UMBRALES ────────────────────────────────────────────────────────
// Map<metricaClave, [{ id, nivel, valor_min, valor_max, label, severidad }]>
// Ordenados por nivel ASC para búsqueda lineal eficiente.
let umbralesCache = new Map()

// ─── MAPPING DB (nombre localidad → id, clave métrica → id) ──────────────────
let dbMapping = { localidades: {}, metricas: {} }

/**
 * Carga los umbrales de la BD en memoria.
 * Debe llamarse al iniciar el servidor (antes del primer tick).
 */
async function cargarUmbralesCache() {
  try {
    // Cargar mapping de localidades y métricas
    const locRes = await db.query('SELECT id, nombre FROM localidades')
    locRes.rows.forEach(r => { dbMapping.localidades[r.nombre.toLowerCase()] = r.id })

    const metRes = await db.query('SELECT id, clave FROM metricas')
    metRes.rows.forEach(r => { dbMapping.metricas[r.clave] = r.id })

    // Cargar umbrales en caché
    const { rows } = await db.query(`
      SELECT
        u.id,
        u.nivel,
        u.valor_min,
        u.valor_max,
        u.label,
        u.severidad,
        m.clave   AS metrica_clave,
        m.id      AS metrica_id,
        un.simbolo AS unidad
      FROM umbrales u
      JOIN metricas m  ON m.id = u.metrica_id
      JOIN unidades un ON un.id = m.unidad_base_id
      ORDER BY m.clave, u.nivel ASC
    `)

    umbralesCache.clear()
    for (const row of rows) {
      if (!umbralesCache.has(row.metrica_clave)) {
        umbralesCache.set(row.metrica_clave, [])
      }
      umbralesCache.get(row.metrica_clave).push({
        id:         row.id,
        nivel:      row.nivel,
        valor_min:  parseFloat(row.valor_min),
        valor_max:  parseFloat(row.valor_max),
        label:      row.label,
        severidad:  row.severidad,
        metrica_id: row.metrica_id,
        unidad:     row.unidad,
      })
    }

    console.log(`[Alertas] Caché cargada: ${umbralesCache.size} métricas con umbrales definidos`)
  } catch (err) {
    console.error('[Alertas] Error cargando caché de umbrales:', err.message)
  }
}

// ─── ESTADO ANTI-TORMENTA ─────────────────────────────────────────────────────
// Map<`${localidadId}:${metricaClave}`, nivelActual>
const estadoNivelActual = new Map()

/**
 * Busca el umbral que contiene el valor dado para una métrica.
 * Retorna el objeto umbral o null si no hay match.
 * @param {string} metricaClave
 * @param {number} valor
 */
function encontrarUmbral(metricaClave, valor) {
  const niveles = umbralesCache.get(metricaClave)
  if (!niveles) return null

  // Los rangos son inclusivos en valor_min y valor_max
  for (const umbral of niveles) {
    if (valor >= umbral.valor_min && valor <= umbral.valor_max) {
      return umbral
    }
  }
  // Si el valor supera el último umbral, asignar el mayor nivel disponible
  return niveles[niveles.length - 1] || null
}

/**
 * Evalúa un tick completo de simulación.
 * Retorna un array de objetos alerta para las parejas (ciudad, métrica) que
 * cambiaron de nivel de severidad no-informativa.
 *
 * @param {{ cities: Array<{ id, name, data: {[metrica]: number} }> }} tickData
 * @returns {Array<{ localidad_id, metrica_id, umbral_id, valor, severidad, label, ciudad_nombre, metrica_clave }>}
 */
function evaluarTick(tickData) {
  if (umbralesCache.size === 0) return []  // Caché no cargada aún

  const alertasNuevas = []

  for (const city of tickData.cities) {
    const localidadId = dbMapping.localidades[city.name.toLowerCase()]
    if (!localidadId) continue

    for (const [metricaClave, valor] of Object.entries(city.data)) {
      const metricaId = dbMapping.metricas[metricaClave]
      if (!metricaId) continue

      const umbral = encontrarUmbral(metricaClave, valor)
      if (!umbral) continue

      const clave = `${localidadId}:${metricaClave}`
      const nivelAnterior = estadoNivelActual.get(clave)

      // Anti-tormenta: solo actuar si el nivel cambió
      if (umbral.nivel === nivelAnterior) continue

      // Actualizar estado interno siempre (para todos los niveles)
      estadoNivelActual.set(clave, umbral.nivel)

      // Solo generar alerta si la severidad es relevante (no informativa)
      if (umbral.severidad === 'informativa') continue

      alertasNuevas.push({
        localidad_id:  localidadId,
        metrica_id:    metricaId,
        umbral_id:     umbral.id,
        valor:         valor,
        severidad:     umbral.severidad,
        label:         umbral.label,
        ciudad_nombre: city.name,
        metrica_clave: metricaClave,
      })
    }
  }

  return alertasNuevas
}

/**
 * Inserta en batch las alertas nuevas en la tabla `alertas`.
 * @param {Array} alertas
 */
async function guardarAlertas(alertas) {
  if (!alertas.length) return

  try {
    const values = []
    const params = []
    let idx = 1

    for (const a of alertas) {
      values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, NOW())`)
      params.push(a.localidad_id, a.metrica_id, a.umbral_id, a.valor)
    }

    await db.query(
      `INSERT INTO alertas (localidad_id, metrica_id, umbral_id, valor, tiempo)
       VALUES ${values.join(', ')}`,
      params
    )

    console.log(`[Alertas] ${alertas.length} alerta(s) guardada(s)`)
  } catch (err) {
    console.error('[Alertas] Error guardando alertas:', err.message)
  }
}

/**
 * Marca una alerta como reconocida.
 * @param {number} id - ID de la alerta
 * @param {number} usuarioId - ID del usuario que la reconoce
 */
async function reconocerAlerta(id, usuarioId) {
  const { rowCount } = await db.query(
    `UPDATE alertas
     SET reconocida = TRUE, reconocida_por = $2, reconocida_en = NOW()
     WHERE id = $1 AND reconocida = FALSE`,
    [id, usuarioId]
  )
  return rowCount > 0
}

/**
 * Devuelve true si la caché ya fue cargada (al menos 1 métrica disponible).
 */
function cacheCargada() {
  return umbralesCache.size > 0
}

module.exports = {
  cargarUmbralesCache,
  evaluarTick,
  guardarAlertas,
  reconocerAlerta,
  cacheCargada,
}
