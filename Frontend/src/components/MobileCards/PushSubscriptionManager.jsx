import React, { useState, useEffect } from 'react';
import usePushPermission from '../../hooks/usePushPermission';
import httpClient from '../../config/httpClient';
import './PushSubscriptionManager.css';

export default function PushSubscriptionManager() {
  const { permission, token, loading: hookLoading, error: hookError, requestPermission } = usePushPermission();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Sincronizar el estado del switch con el permiso del navegador
  useEffect(() => {
    if (permission === 'granted' && token) {
      setIsSubscribed(true);
    } else {
      setIsSubscribed(false);
    }
  }, [permission, token]);

  const handleToggle = async () => {
    if (loading || hookLoading) return;
    setError('');
    setMessage('');

    if (!isSubscribed) {
      // Intentar suscribirse
      setLoading(true);
      try {
        const activeToken = await requestPermission();
        if (activeToken) {
          // Enviar token al backend
          await httpClient.post('/notificaciones/subscribe', { token: activeToken });
          setIsSubscribed(true);
          setMessage('¡Notificaciones activadas con éxito! Recibirás alertas importantes.');
        } else {
          setError('No se pudo obtener el token de notificaciones.');
        }
      } catch (err) {
        console.error('[PushSubscriptionManager] Error al suscribirse:', err);
        setError(err.response?.data?.mensaje || err.message || 'Error al conectar con el servidor.');
        setIsSubscribed(false);
      } finally {
        setLoading(false);
      }
    } else {
      // Desactivar notificaciones
      setLoading(true);
      try {
        if (token) {
          await httpClient.post('/notificaciones/unsubscribe', { token });
        }
        setIsSubscribed(false);
        setMessage('Notificaciones desactivadas. Puedes volver a activarlas en cualquier momento.');
      } catch (err) {
        console.error('[PushSubscriptionManager] Error al desuscribirse:', err);
        setIsSubscribed(false);
        setMessage('Notificaciones desactivadas localmente.');
      } finally {
        setLoading(false);
      }
    }
  };

  const getStatusText = () => {
    if (hookLoading || loading) return 'Procesando...';
    if (permission === 'denied') return 'Permiso denegado por el navegador';
    if (permission === 'granted') return 'Notificaciones activas';
    return 'Notificaciones desactivadas';
  };

  return (
    <div className="push-manager-card">
      <div className="push-manager-header">
        <div className="push-icon-wrapper">
          <svg className="push-bell-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22ZM18 16V11C18 7.93 16.36 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.63 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z" fill="currentColor"/>
          </svg>
        </div>
        <div className="push-info">
          <h3>Notificaciones Push</h3>
          <p className="push-status-label">{getStatusText()}</p>
        </div>
        <div className="push-switch-wrapper">
          <label className="push-switch">
            <input 
              type="checkbox" 
              checked={isSubscribed} 
              onChange={handleToggle}
              disabled={permission === 'denied' || loading || hookLoading}
            />
            <span className="push-slider"></span>
          </label>
        </div>
      </div>

      {permission === 'denied' && (
        <div className="push-alert push-alert--error">
          <strong>⚠️ Permisos bloqueados:</strong> Has bloqueado las notificaciones en este navegador. Restablécelos en la configuración de privacidad del navegador para poder recibir alertas.
        </div>
      )}

      {error && <div className="push-alert push-alert--error">{error}</div>}
      {hookError && <div className="push-alert push-alert--error">{hookError}</div>}
      {message && <div className="push-alert push-alert--success">{message}</div>}
    </div>
  );
}
