import { useState, useEffect } from 'react';
import axios from 'axios';
import './Notificaciones.css';

const Notificaciones = () => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/notificaciones');
      setSettings(res.data);
    } catch (err) {
      console.error('Error fetching settings:', err);
      setMessage({ text: 'Error al cargar la configuración', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (tipo) => {
    setSettings(prev => prev.map(s => 
      s.tipo === tipo ? { ...s, habilitado: !s.habilitado } : s
    ));
  };

  const handleDestinoChange = (tipo, valor) => {
    setSettings(prev => prev.map(s => 
      s.tipo === tipo ? { ...s, destino: valor } : s
    ));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.put('http://localhost:3000/api/notificaciones', { settings });
      setMessage({ text: 'Configuración guardada con éxito', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setMessage({ text: 'Error al guardar la configuración', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const getIcon = (tipo) => {
    switch (tipo) {
      case 'email': return '📧';
      case 'whatsapp': return '📱';
      case 'telegram': return '✈️';
      default: return '🔔';
    }
  };

  const getLabel = (tipo) => {
    switch (tipo) {
      case 'email': return 'Correo Electrónico';
      case 'whatsapp': return 'WhatsApp (Número)';
      case 'telegram': return 'Telegram (Chat ID)';
      default: return tipo;
    }
  };

  const getPlaceholder = (tipo) => {
    switch (tipo) {
      case 'email': return 'ejemplo@correo.com';
      case 'whatsapp': return '+591XXXXXXXX';
      case 'telegram': return '123456789';
      default: return 'Destino...';
    }
  };

  if (loading) {
    return (
      <div className="notif-container">
        <div className="notif-loading">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="notif-container">
      <div className="notif-header">
        <div className="notif-header-content">
          <span className="notif-eyebrow">Ajustes del Sistema</span>
          <h1 className="notif-title">Centro de <em>Notificaciones</em></h1>
          <p className="notif-subtitle">
            Configura los canales externos donde el sistema enviará las alertas críticas en tiempo real.
          </p>
        </div>
      </div>

      {message.text && (
        <div className={`notif-alert notif-alert--${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="notif-grid">
        {settings.map((s) => (
          <div key={s.tipo} className={`notif-card ${s.habilitado ? 'notif-card--active' : ''}`}>
            <div className="notif-card-header">
              <div className="notif-card-icon">{getIcon(s.tipo)}</div>
              <div className="notif-card-info">
                <h3>{getLabel(s.tipo)}</h3>
                <span className="notif-card-status">
                  {s.habilitado ? 'Habilitado' : 'Desactivado'}
                </span>
              </div>
              <label className="notif-switch">
                <input 
                  type="checkbox" 
                  checked={s.habilitado} 
                  onChange={() => handleToggle(s.tipo)}
                />
                <span className="notif-slider"></span>
              </label>
            </div>
            
            <div className="notif-card-body">
              <div className="notif-input-group">
                <label>Destino de alertas</label>
                <input 
                  type="text" 
                  value={s.destino || ''} 
                  onChange={(e) => handleDestinoChange(s.tipo, e.target.value)}
                  placeholder={getPlaceholder(s.tipo)}
                  disabled={!s.habilitado}
                />
              </div>
              {s.tipo === 'telegram' && (
                <div className="notif-telegram-help">
                  <div className="notif-qr-container">
                    <img 
                      src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://t.me/envirosense_e11_bot" 
                      alt="QR Telegram"
                      className="notif-qr-image"
                    />
                    <div className="notif-qr-text">
                      <p><strong>Escanea para iniciar</strong></p>
                      <a href="https://t.me/envirosense_e11_bot" target="_blank" rel="noreferrer">@envirosense_e11_bot</a>
                    </div>
                  </div>
                  <div className="notif-hint-alert">
                    ⚠️ Dale a <strong>"Iniciar"</strong> y el bot te dirá tu ID automáticamente.
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="notif-actions">
        <button 
          className="notif-btn-save" 
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
      
      <div className="notif-info-box">
        <div className="notif-info-icon">💡</div>
        <div className="notif-info-text">
          <strong>¿Cómo funcionan las alertas?</strong> Las notificaciones se disparan automáticamente cuando un sensor supera los umbrales de nivel <em>crítico</em> o <em>emergencia</em> configurados en el panel de umbrales.
        </div>
      </div>
    </div>
  );
};

export default Notificaciones;
