import { useState, useEffect } from 'react'

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
    fetch(`http://localhost:3000/api/umbrales/${metrica}`)
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
  return umbrales.find(u => valor >= u.valor_min && valor <= u.valor_max) ?? null
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

  const stops = umbrales.flatMap(u => [
    u.valor_min, u.color_hex,
    u.valor_max, u.color_hex,
  ])
  return ['interpolate', ['linear'], ['get', propertyName], ...stops]
}
