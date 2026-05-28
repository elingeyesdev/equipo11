import { useState, useEffect, useCallback } from 'react';
import { getToken } from 'firebase/messaging';
import { messaging } from '../firebase';

export default function usePushPermission() {
  const [permission, setPermission] = useState('default');
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sincronizar estado del permiso y auto-obtener el token si ya está otorgado
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const currentPermission = Notification.permission;
      setPermission(currentPermission);

      if (currentPermission === 'granted') {
        // Auto-obtener el token en segundo plano sin bloquear el estado de carga inicial
        const autoFetchToken = async () => {
          try {
            const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
            const currentToken = await getToken(messaging, { vapidKey });
            if (currentToken) {
              setToken(currentToken);
            }
          } catch (err) {
            console.warn('[usePushPermission] Error al auto-obtener token FCM:', err);
          }
        };
        autoFetchToken();
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
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
        const currentToken = await getToken(messaging, { vapidKey });
        
        if (currentToken) {
          setToken(currentToken);
          setLoading(false);
          return currentToken;
        } else {
          throw new Error('No se pudo obtener el token de registro FCM.');
        }
      } else if (result === 'denied') {
        throw new Error('El usuario rechazó los permisos de notificación.');
      }
    } catch (err) {
      console.error('[usePushPermission] Error al solicitar permisos:', err);
      setError(err.message || 'Error al solicitar permisos.');
    } finally {
      setLoading(false);
    }
    return null;
  }, []);

  return { permission, token, loading, error, requestPermission };
}
