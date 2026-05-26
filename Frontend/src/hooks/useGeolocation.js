import { useState, useEffect, useCallback, useRef } from 'react'

const PERMISSION_MESSAGES = {
  denied: 'Activa la ubicación en la configuración de tu dispositivo.',
  unavailable: 'Tu dispositivo no soporta geolocalización.',
  timeout: 'No se pudo obtener tu ubicación. Intenta de nuevo.',
}

export default function useGeolocation() {
  const [coords, setCoords] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const retryId = useRef(0)

  const requestPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError(PERMISSION_MESSAGES.unavailable)
      setLoading(false)
      return
    }

    const current = ++retryId.current
    setLoading(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (current !== retryId.current) return
        setCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
        setLoading(false)
      },
      (err) => {
        if (current !== retryId.current) return
        const message =
          err.code === 1
            ? PERMISSION_MESSAGES.denied
            : err.code === 3
              ? PERMISSION_MESSAGES.timeout
              : PERMISSION_MESSAGES.unavailable
        setError(message)
        setLoading(false)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  }, [])

  useEffect(() => {
    requestPosition()
  }, [requestPosition])

  return { coords, loading, error, retry: requestPosition }
}
