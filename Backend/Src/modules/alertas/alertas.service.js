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
const logger = require('../../utils/logger')
const { getDbMapping } = require('../../utils/dbMapping')

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
    dbMapping = await getDbMapping();

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
    estadoNivelActual.clear()
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

    logger.info(`[Alertas] Caché cargada: ${umbralesCache.size} métricas con umbrales definidos`)
  } catch (err) {
    logger.error('[Alertas] Error cargando caché de umbrales:', err.message)
  }
}

// ─── ESTADO ANTI-TORMENTA ─────────────────────────────────────────────────────
/**
 * Mapa de estado global modificable a nivel de módulo.
 * 
 * Clave:   `${localidadId}:${metricaClave}`
 * Valor:   nivel actual del umbral (number)
 * 
 * Propósito: Cache del último nivel de alerta activo por (localidad, métrica).
 * Solo se emite una alerta cuando el nivel CAMBIA respecto al estado anterior,
 * evitando tormentas de alertas repetidas para el mismo nivel en ticks consecutivos.
 * 
 * ⚠️  Estado mutable global — hace que evaluarTick() no sea pura.
 *     Si se necesita testing, mover este Map como parámetro de evaluarTick().
 *     Se limpia automáticamente al recargar umbrales (cargarUmbralesCache).
 */
const estadoNivelActual = new Map()

// Cooldown de emisión: una vez que (ciudad, métrica) emite una alerta de
// severidad relevante, se silencia durante COOLDOWN_MS para evitar que la
// oscilación de valores en la frontera (advertencia ↔ critica ↔ emergencia)
// genere docenas de toasts por minuto. Se persiste en BD igual; sólo se
// throttea la emisión hacia el cliente.
const ultimoEmitTime = new Map()
const COOLDOWN_MS = 3 * 60 * 1000  // 3 minutos por pareja (ciudad, métrica)

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
async function evaluarTick(tickData) {
  if (umbralesCache.size === 0) {
    logger.warn('[Alertas] La caché de umbrales está vacía. Intentando cargar bajo demanda...');
    await cargarUmbralesCache();
    if (umbralesCache.size === 0) {
      logger.error('[Alertas] No se pudo inicializar la caché de umbrales. Omitiendo evaluación de tick.');
      return [];
    }
  }

  const alertasNuevas = []

  for (const city of tickData.cities) {
    const localidadId = city.localidadId || dbMapping.localidades[city.name.toLowerCase()]
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

      const esPrimerRegistro = nivelAnterior === undefined
      estadoNivelActual.set(clave, umbral.nivel)
      
      // Permitir alertas en el primer registro SI la severidad es crítica o emergencia
      // (Para que el usuario reciba la notificación inmediatamente al probar)
      if (esPrimerRegistro && umbral.severidad !== 'critica' && umbral.severidad !== 'emergencia') continue

      // Solo generar alerta si la severidad es relevante (no informativa).
      // Las advertencias se filtran aquí: ni se persisten ni se emiten —
      // sólo critica + emergencia generan registro y notificación, en línea
      // con el filtro del socket. La saturación venía de evaluar y persistir
      // todas las advertencias aunque luego no se emitieran.
      if (umbral.severidad !== 'critica' && umbral.severidad !== 'emergencia') continue

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
 * Filtra las alertas que pueden emitirse al cliente respetando el cooldown.
 * No mutamos el array de entrada — devolvemos sólo las "frescas" y registramos
 * el timestamp de emisión sólo para esas. La idea: aunque el nivel oscile en
 * la frontera, el operador recibe a lo sumo una notificación cada COOLDOWN_MS
 * por (ciudad, métrica).
 *
 * @param {Array} alertas - retorno de evaluarTick()
 * @returns {Array} subconjunto que debe emitirse
 */
function filtrarParaEmision(alertas) {
  if (!alertas.length) return alertas
  const ahora = Date.now()
  const emisibles = []
  for (const a of alertas) {
    const clave = `${a.localidad_id}:${a.metrica_clave}`
    const ultimo = ultimoEmitTime.get(clave) || 0
    if (ahora - ultimo < COOLDOWN_MS) continue
    ultimoEmitTime.set(clave, ahora)
    emisibles.push(a)
  }
  return emisibles
}

/**
 * Inserta en batch las alertas nuevas en la tabla `alertas`.
 * @param {Array} alertas
 */
async function guardarAlertas(alertas, options = {}) {
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

    logger.info(`[Alertas] ${alertas.length} alerta(s) guardada(s)`)

    // Integración de Notificaciones Push (FCM)
    const { sendPushNotification } = require('../notifications/notification.service')
    const { getSubscriberTokens } = require('../notifications/notification.model')

    for (const a of alertas) {
      if (a.severidad === 'critica' || a.severidad === 'emergencia') {
        try {
          const tokens = await getSubscriberTokens(a.localidad_id)
          if (tokens.length > 0) {
            let title, body;
            const cityName = a.ciudad_nombre || 'Localidad';

            if (options.isManual) {
              title = `Inyección Manual: ${cityName}`;
              body = `Valor inyectado de ${a.metrica_clave} (${a.valor}) a ${cityName} es muy peligroso y alcanzó nivel ${a.label.toLowerCase()}.`;
            } else {
              title = `Simulación: ${cityName}`;
              body = `La simulación en ${cityName} detectó ${a.metrica_clave} en ${a.valor}, por lo tanto es muy peligroso (${a.label.toLowerCase()}).`;
            }

            await sendPushNotification(tokens, {
              title,
              body,
              data: {
                localidadId: String(a.localidad_id),
                metricaClave: a.metrica_clave,
                valor: String(a.valor),
                severidad: a.severidad
              }
            })
          }
        } catch (pushErr) {
          logger.error('[Alertas] Error al procesar envío de push para alerta:', pushErr.message)
        }
      }
    }
  } catch (err) {
    logger.error('[Alertas] Error guardando alertas:', err.message)
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
 * Obtiene alertas paginadas con filtros dinámicos.
 * @param {Object} filters — { desde, hasta, metrica, severidad, reconocida, page, limit }
 * @returns {{ total, rows }}
 */
async function getAlertas(filters) {
  const { desde, hasta, metrica, severidad, reconocida, page, limit } = filters;
  const limitNum = limit;
  const offset   = (page - 1) * limitNum;

  const conditions = [];
  const params     = [];
  let idx = 1;

  if (desde)       { conditions.push(`a.tiempo >= $${idx++}`); params.push(desde); }
  if (hasta)       { conditions.push(`a.tiempo <= $${idx++}`); params.push(hasta); }
  if (metrica)     { conditions.push(`m.clave = $${idx++}`);   params.push(metrica); }
  if (severidad)   { conditions.push(`u.severidad = $${idx++}`); params.push(severidad); }
  if (reconocida !== undefined) { conditions.push(`a.reconocida = $${idx++}`); params.push(reconocida === 'true'); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: countRows } = await db.query(`
    SELECT COUNT(*) AS total
    FROM alertas a
    JOIN localidades l ON l.id = a.localidad_id
    JOIN metricas m    ON m.id = a.metrica_id
    JOIN umbrales u    ON u.id = a.umbral_id
    ${where}
  `, params);
  const total = parseInt(countRows[0].total);

  const { rows } = await db.query(`
    SELECT
      a.id, a.tiempo, a.valor, a.reconocida, a.reconocida_en,
      l.nombre           AS ciudad,
      m.clave            AS metrica,
      m.nombre           AS metrica_nombre,
      un.simbolo         AS unidad,
      u.label, u.severidad, u.color_hex,
      ur.nombre          AS reconocida_por
    FROM alertas a
    JOIN localidades l  ON l.id = a.localidad_id
    JOIN metricas m     ON m.id = a.metrica_id
    JOIN umbrales u     ON u.id = a.umbral_id
    JOIN unidades un    ON un.id = m.unidad_base_id
    LEFT JOIN usuarios ur ON ur.id = a.reconocida_por
    ${where}
    ORDER BY a.tiempo DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `, [...params, limitNum, offset]);

  return { total, rows };
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
  filtrarParaEmision,
  guardarAlertas,
  reconocerAlerta,
  getAlertas,
  cacheCargada,
}
