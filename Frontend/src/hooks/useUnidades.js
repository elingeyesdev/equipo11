import { useState } from 'react'
import { METRICAS_UNIDADES } from '../utils/unidades'

function leerEstadoInicial() {
  const estado = {}
  for (const [key, cfg] of Object.entries(METRICAS_UNIDADES)) {
    const guardado = localStorage.getItem(`unidad_${key}`)
    const valido = cfg.unidades.find(u => u.key === guardado)
    estado[key] = valido ? guardado : cfg.defecto
  }
  return estado
}

/**
 * Hook para manejar las unidades de medida seleccionadas por el usuario.
 * Persiste la selección en localStorage entre sesiones.
 */
export function useUnidades() {
  const [unidades, setUnidades] = useState(leerEstadoInicial)

  function cambiarUnidad(metricKey, unitKey) {
    setUnidades(prev => ({ ...prev, [metricKey]: unitKey }))
    localStorage.setItem(`unidad_${metricKey}`, unitKey)
  }

  return { unidades, cambiarUnidad }
}
