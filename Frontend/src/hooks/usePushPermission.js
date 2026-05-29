import { useState, useEffect, useCallback } from 'react';
import { getFCMToken } from '../firebase';

export default function usePushPermission() {
  const [permission, setPermission] = useState('default');
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const currentPermission = Notification.permission;
      setPermission(currentPermission);
      
      const isPushEnabled = localStorage.getItem('envirosense_push_enabled') === 'true';
      
      if (currentPermission === 'granted' && isPushEnabled) {
        setLoading(true);
        getFCMToken()
          .then((t) => {
            if (t) setToken(t);
          })
          .catch((err) => {
            console.warn('[usePushPermission] Error al obtener token inicial:', err);
          })
          .finally(() => {
            setLoading(false);
          });
      }
    } else {
      setError('Las notificaciones no están soportadas en este navegador.');
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setError('Las notificaciones no están soportadas en este navegador.');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        const currentToken = await getFCMToken();

        if (currentToken) {
          setToken(currentToken);
          localStorage.setItem('envirosense_push_enabled', 'true');
          return currentToken;
        } else {
          throw new Error('No se pudo obtener el token de registro FCM.');
        }
      } else if (result === 'denied') {
        throw new Error('El usuario rechazó los permisos de notificación.');
      }
    } catch (err) {
      console.error('[usePushPermission] Error:', err);
      setError(err.message || 'Error al solicitar permisos.');
    } finally {
      setLoading(false);
    }
    return null;
  }, []);

  return { permission, token, setToken, loading, error, requestPermission };
}
