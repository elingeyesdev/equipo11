/**
 * simulacion-zona.service.js — v2
 *
 * CORRECCIÓN PRINCIPAL: Los umbrales se cargan desde la BD al iniciar la sesión
 * y el color se calcula en el backend para cada tick. Esto elimina la dependencia
 * del hook useUmbrales del frontend (que tiene timing asíncrono).
 *
 * Cada evento 'zona:tick' ahora incluye: valor, color, umbralLabel, severidad, unidad.
 */

const db = require('../../config/db');

// ─── Estado interno ─────────────────────────────────────────────────────────
let tickIntervalId = null;
let tickData = [];
let tickIndex = 0;
let currentSesionId = null;
let currentMetricaClave = null;
let currentEscenario = null;

const METRIC_META = {
  temperatura: { unidad: '°C',  nombre: 'Temperatura'  },
  aqi:         { unidad: 'AQI', nombre: 'Calidad del Aire' },
  ica:         { unidad: 'ICA', nombre: 'Calidad del Agua' },
  ruido:       { unidad: 'dB',  nombre: 'Ruido'         },
  humedad:     { unidad: '%',   nombre: 'Humedad'        },
};

const METRIC_LIMITS = {
  temperatura: { min: -50, max: 60  },
  aqi:         { min: 0,   max: 500 },
  ica:         { min: 0,   max: 100 },
  ruido:       { min: 0,   max: 140 },
  humedad:     { min: 0,   max: 100 },
};

// ─── Helpers matemáticos ─────────────────────────────────────────────────────

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function calcCentroide(puntos) {
  const n = puntos.length;
  return {
    lng: puntos.reduce((s, p) => s + p.lng, 0) / n,
    lat: puntos.reduce((s, p) => s + p.lat, 0) / n,
  };
}

function gaussianNoise(stdDev) {
  const u1 = Math.random() || 1e-10;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * stdDev;
}

function applyCurve(t, curva) {
  if (curva === 'exponencial') return Math.pow(t, 2);
  if (curva === 'pico') return t <= 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
  return t; // lineal
}

// ─── Umbrales desde BD ───────────────────────────────────────────────────────

async function loadUmbrales(metricaClave) {
  const { rows } = await db.query(
    `SELECT u.nivel, u.label, u.valor_min::float AS valor_min,
            u.valor_max::float AS valor_max, u.color_hex, u.severidad
     FROM umbrales u
     JOIN metricas m ON m.id = u.metrica_id
     WHERE m.clave = $1
     ORDER BY u.nivel ASC`,
    [metricaClave]
  );
  return rows;
}

/**
 * Busca el umbral que corresponde a un valor numérico.
 * Retorna { color, label, severidad }.
 */
function getColorForValue(umbrales, valor) {
  if (!umbrales.length) return { color: '#38bdf8', label: 'Sin umbral', severidad: 'informativa' };

  for (const u of umbrales) {
    if (valor >= u.valor_min && valor <= u.valor_max) {
      return { color: u.color_hex, label: u.label, severidad: u.severidad };
    }
  }
  // Fuera de rango → primer o último nivel
  if (valor < umbrales[0].valor_min) {
    return { color: umbrales[0].color_hex, label: umbrales[0].label, severidad: umbrales[0].severidad };
  }
  const last = umbrales[umbrales.length - 1];
  return { color: last.color_hex, label: last.label, severidad: last.severidad };
}

// ─── Generación de datos ──────────────────────────────────────────────────────

function generarDatos(escenario, metricaClave, dias, intervalMinutos, fechaInicio, umbrales) {
  const limits = METRIC_LIMITS[metricaClave] || { min: 0, max: 100 };
  const totalPuntos = Math.floor((dias * 24 * 60) / intervalMinutos) + 1;
  const rango = Math.abs(escenario.fin - escenario.inicio);
  const stdDev = rango * 0.04;

  return Array.from({ length: totalPuntos }, (_, i) => {
    const t = i / Math.max(totalPuntos - 1, 1);
    const progreso = applyCurve(t, escenario.curva);
    const valorBase = lerp(escenario.inicio, escenario.fin, progreso);
    const valor = Math.round(clamp(valorBase + gaussianNoise(stdDev), limits.min, limits.max) * 100) / 100;
    const tiempo = new Date(fechaInicio.getTime() + i * intervalMinutos * 60 * 1000).toISOString();
    const { color, label, severidad } = getColorForValue(umbrales, valor);
    return { tiempo, valor, color, umbralLabel: label, severidad };
  });
}

// ─── Base de datos ────────────────────────────────────────────────────────────

async function crearLocalidadTemporal(centroide, nombre) {
  const regRes = await db.query('SELECT id FROM regiones LIMIT 1');
  const regionId = regRes.rows[0]?.id || 1;
  const nombreUnico = `Zona Sim. ${nombre} ${Date.now()}`;
  const res = await db.query(
    `INSERT INTO localidades (region_id, nombre, latitud, longitud) VALUES ($1, $2, $3, $4) RETURNING id`,
    [regionId, nombreUnico, centroide.lat, centroide.lng]
  );
  return res.rows[0].id;
}

async function getMetricaId(clave) {
  const res = await db.query('SELECT id FROM metricas WHERE clave = $1', [clave]);
  if (!res.rows.length) throw new Error(`Métrica '${clave}' no encontrada en BD`);
  return res.rows[0].id;
}

async function getFuenteSimulacionId() {
  const res = await db.query("SELECT id FROM fuentes_datos WHERE clave = 'simulacion'");
  return res.rows[0]?.id || 1;
}

async function crearSesion(usuarioId, configuracion, intervalSimMs) {
  const res = await db.query(
    `INSERT INTO sesiones_simulacion (usuario_id, intervalo_ms, configuracion) VALUES ($1, $2, $3) RETURNING id`,
    [usuarioId, intervalSimMs, JSON.stringify(configuracion)]
  );
  return res.rows[0].id;
}

async function guardarLecturas(lecturas, localidadId, metricaId, fuenteId, sesionId) {
  if (!lecturas.length) return 0;
  const tiempos   = lecturas.map(l => l.tiempo);
  const locIds    = lecturas.map(() => localidadId);
  const metIds    = lecturas.map(() => metricaId);
  const valores   = lecturas.map(l => l.valor);
  const fuenteIds = lecturas.map(() => fuenteId);
  const sesionIds = lecturas.map(() => sesionId);

  const result = await db.query(
    `INSERT INTO lecturas (tiempo, localidad_id, metrica_id, valor, fuente_id, sesion_simulacion_id)
     SELECT unnest($1::timestamptz[]), unnest($2::int[]), unnest($3::int[]),
            unnest($4::numeric[]),    unnest($5::int[]), unnest($6::int[])
     ON CONFLICT DO NOTHING`,
    [tiempos, locIds, metIds, valores, fuenteIds, sesionIds]
  );
  return result.rowCount;
}

async function finalizarSesion(sesionId, totalTicks) {
  await db.query(
    `UPDATE sesiones_simulacion SET fin = NOW(), total_ticks = $1 WHERE id = $2`,
    [totalTicks, sesionId]
  );
}

// ─── API pública ──────────────────────────────────────────────────────────────

async function iniciarSimulacionZona(config, onTick) {
  if (tickIntervalId) throw new Error('Ya hay una simulación de zona activa');

  const { metricaClave, escenario, dias, intervalMinutos, intervalSimSeg,
          puntos, nombreZona = 'Área', usuarioId = 1 } = config;

  const meta = METRIC_META[metricaClave] || { unidad: '', nombre: metricaClave };
  const centroide = calcCentroide(puntos);

  // Cargar umbrales desde BD — fuente única de verdad para colores
  const umbrales = await loadUmbrales(metricaClave);
  console.log(`[Zona] Umbrales cargados para '${metricaClave}': ${umbrales.length} niveles`);

  const localidadId = await crearLocalidadTemporal(centroide, nombreZona);
  const metricaId   = await getMetricaId(metricaClave);
  const fuenteId    = await getFuenteSimulacionId();

  const fechaInicio = new Date();
  const lecturas = generarDatos(escenario, metricaClave, dias, intervalMinutos, fechaInicio, umbrales);
  console.log(`[Zona] ${lecturas.length} lecturas generadas`);

  const configuracionSnapshot = {
    metricaClave, metricaNombre: meta.nombre, unidad: meta.unidad,
    escenarioId: escenario.id, escenarioNombre: escenario.nombre,
    dias, intervalMinutos, intervalSimSeg, puntos, centroide,
  };
  const sesionId = await crearSesion(usuarioId, configuracionSnapshot, intervalSimSeg * 1000);
  const rowsInserted = await guardarLecturas(lecturas, localidadId, metricaId, fuenteId, sesionId);
  console.log(`[Zona] BD: sesionId=${sesionId} | lecturas insertadas=${rowsInserted}`);

  // Preparar tick visual
  tickData = lecturas;
  tickIndex = 0;
  currentSesionId = sesionId;
  currentMetricaClave = metricaClave;
  currentEscenario = escenario;

  tickIntervalId = setInterval(() => {
    if (tickIndex >= tickData.length) tickIndex = 0; // loop
    const punto = tickData[tickIndex];
    onTick({
      sesionId,
      metricaClave,
      metricaNombre: meta.nombre,
      unidad: meta.unidad,
      escenarioNombre: escenario.nombre,
      valor: punto.valor,
      color: punto.color,           // ← Color directo desde BD (no depende del frontend)
      umbralLabel: punto.umbralLabel,
      severidad: punto.severidad,
      tiempo: punto.tiempo,
      tickIdx: tickIndex,
      totalTicks: tickData.length,
      progreso: Math.round((tickIndex / Math.max(tickData.length - 1, 1)) * 100),
    });
    tickIndex++;
  }, intervalSimSeg * 1000);

  return { sesionId, localidadId, totalLecturas: lecturas.length, centroide, fechaInicio: fechaInicio.toISOString() };
}

async function detenerSimulacionZona() {
  if (!tickIntervalId) return false;
  clearInterval(tickIntervalId);
  tickIntervalId = null;
  const sesionId = currentSesionId;
  const ticks = tickIndex;
  tickData = []; tickIndex = 0;
  currentSesionId = null; currentMetricaClave = null; currentEscenario = null;
  if (sesionId) await finalizarSesion(sesionId, ticks);
  return true;
}

function isRunning() { return tickIntervalId !== null; }

function getEstado() {
  return {
    running: isRunning(),
    sesionId: currentSesionId,
    metricaClave: currentMetricaClave,
    escenario: currentEscenario,
    tickIdx: tickIndex,
    totalTicks: tickData.length,
  };
}

module.exports = { iniciarSimulacionZona, detenerSimulacionZona, isRunning, getEstado };
