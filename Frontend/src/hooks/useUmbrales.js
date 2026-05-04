import { useState, useEffect } from 'react'
import { API_BASE } from '../config/api'

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
    // Usar la ruta absoluta al API de acuerdo a la config del cliente (o rely en el proxy/Vite)
    fetch(`${API_BASE}/umbrales/${metrica}`)
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
        setUmbrales([])
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
  const sorted = [...umbrales].sort((a, b) => a.nivel - b.nivel);
  return sorted.find((u, i) => {
    const next = sorted[i + 1];
    if (next) {
      return valor >= u.valor_min && valor < next.valor_min;
    }
    return valor >= u.valor_min && valor <= u.valor_max;
  }) ?? null;
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

  const sorted = [...umbrales].sort((a, b) => a.nivel - b.nivel)
  const stops = []

  sorted.forEach((u, i) => {
    const next = sorted[i + 1]
    stops.push(u.valor_min, u.color_hex)
    // Solo agrega valor_max si no coincide con el valor_min del siguiente nivel
    // (evita stops duplicados que Mapbox rechaza)
    if (!next || u.valor_max < next.valor_min) {
      stops.push(u.valor_max, u.color_hex)
    }
  })

  return ['interpolate', ['linear'], ['get', propertyName], ...stops]
}

/**
 * Genera la expresión de color para la capa heatmap nativa de Mapbox.
 * Mapbox heatmap solo expone `heatmap-density` [0,1] para colorear,
 * por eso normalizamos los rangos de umbrales a ese intervalo.
 *
 * @param {Array} umbrales
 * @returns {Array} expresión Mapbox interpolate sobre heatmap-density
 */
export function buildHeatmapDensityColor(umbrales) {
  if (!umbrales.length) {
    return ['interpolate', ['linear'], ['heatmap-density'],
      0, 'rgba(0,0,0,0)', 1, '#7e0023',
    ]
  }

  const sorted = [...umbrales].sort((a, b) => a.nivel - b.nivel)
  const min    = sorted[0].valor_min
  const max    = sorted[sorted.length - 1].valor_max
  const range  = max - min || 1

  const stops = [0, 'rgba(0,0,0,0)']
  sorted.forEach(u => {
    const t = Math.max(0.01, (u.valor_min - min) / range)
    stops.push(t, u.color_hex)
  })
  stops.push(1, sorted[sorted.length - 1].color_hex)

  return ['interpolate', ['linear'], ['heatmap-density'], ...stops]
}
