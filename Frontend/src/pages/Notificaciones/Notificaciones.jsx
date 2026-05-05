import { useState, useEffect, useMemo } from 'react';
import { useBlocker } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../../config/api';
import './Notificaciones.css';

const Notificaciones = () => {
  const [settings, setSettings] = useState([]);
  const [originalSettings, setOriginalSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isQrZoomed, setIsQrZoomed] = useState(false);

  const CODES = [
    { code: '+591', name: 'Bolivia 🇧🇴' },
    { code: '+54', name: 'Argentina 🇦🇷' },
    { code: '+55', name: 'Brasil 🇧🇷' },
    { code: '+56', name: 'Chile 🇨🇱' },
    { code: '+57', name: 'Colombia 🇨🇴' },
    { code: '+51', name: 'Perú 🇵🇪' },
    { code: '+593', name: 'Ecuador 🇪🇨' },
    { code: '+595', name: 'Paraguay 🇵y' },
    { code: '+598', name: 'Uruguay 🇺🇾' },
    { code: '+58', name: 'Venezuela 🇻🇪' },
    { code: '+52', name: 'México 🇲🇽' },
    { code: '+34', name: 'España 🇪🇸' },
  ];

  // Detectar si hay cambios comparando con el estado original
  const hasChanges = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  }, [settings, originalSettings]);

  // Bloqueador de navegación de React Router
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasChanges && currentLocation.pathname !== nextLocation.pathname
  );

  // Manejar el bloqueo de navegación
  useEffect(() => {
    if (blocker.state === "blocked") {
      const proceed = window.confirm(
        "Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?"
      );
      if (proceed) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  // Bloqueador de cierre/recarga de pestaña del navegador
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_BASE}/notificaciones`);
      setSettings(res.data);
      setOriginalSettings(res.data);
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

  const handleWhatsAppChange = (tipo, prefix, number) => {
    const cleanNumber = number.replace(/\D/g, '');
    setSettings(prev => prev.map(s =>
      s.tipo === tipo ? { ...s, destino: prefix + cleanNumber } : s
    ));
  };

  const splitWhatsApp = (destino) => {
    if (!destino) return { prefix: '+591', number: '' };
    const found = CODES.find(c => destino.startsWith(c.code));
    if (found) {
      return { prefix: found.code, number: destino.replace(found.code, '') };
    }
    return { prefix: '+591', number: destino.startsWith('+') ? destino.substring(4) : destino };
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_BASE}/notificaciones`, { settings });
      setOriginalSettings(settings);
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

        <div className="notif-header-actions">
          <button
            className={`notif-btn-save-header ${hasChanges ? 'notif-btn-save--pending' : ''}`}
            onClick={saveSettings}
            disabled={saving || !hasChanges}
          >
            {saving ? (
              <span className="notif-btn-content">
                <span className="notif-spinner"></span> Guardando...
              </span>
            ) : (
              <span className="notif-btn-content">
                {hasChanges ? '💾 Guardar Cambios' : '✅ Guardado'}
              </span>
            )}
          </button>
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
                {s.tipo === 'whatsapp' ? (
                  <div className="notif-phone-group">
                    <div className="notif-country-wrapper">
                      <div className="notif-country-display">
                        {splitWhatsApp(s.destino).prefix}
                        <span className="notif-select-arrow">▼</span>
                      </div>
                      <select
                        className="notif-country-select"
                        value={splitWhatsApp(s.destino).prefix}
                        onChange={(e) => handleWhatsAppChange(s.tipo, e.target.value, splitWhatsApp(s.destino).number)}
                        disabled={!s.habilitado}
                      >
                        {CODES.map(c => (
                          <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={splitWhatsApp(s.destino).number}
                      onChange={(e) => handleWhatsAppChange(s.tipo, splitWhatsApp(s.destino).prefix, e.target.value)}
                      placeholder="70000000"
                      disabled={!s.habilitado}
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={s.destino || ''}
                    onChange={(e) => handleDestinoChange(s.tipo, e.target.value)}
                    placeholder={getPlaceholder(s.tipo)}
                    disabled={!s.habilitado}
                  />
                )}
              </div>
              {s.tipo === 'telegram' && (
                <div className="notif-telegram-help">
                  <div className="notif-qr-container">
                    <div className="notif-qr-wrapper" onClick={() => setIsQrZoomed(true)} title="Click para agrandar">
                      <img
                        src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://t.me/envirosense_e11_bot"
                        alt="QR Telegram"
                        className="notif-qr-image"
                      />
                      <div className="notif-qr-overlay">🔍</div>
                    </div>
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

      <div className="notif-info-box">
        <div className="notif-info-icon">💡</div>
        <div className="notif-info-text">
          <strong>¿Cómo funcionan las alertas?</strong> Las notificaciones se disparan automáticamente cuando un sensor supera los umbrales de nivel <em>crítico</em> o <em>emergencia</em> configurados en el panel de umbrales.
        </div>
      </div>

      {/* Modal Zoom QR */}
      {isQrZoomed && (
        <div className="notif-zoom-overlay" onClick={() => setIsQrZoomed(false)}>
          <div className="notif-zoom-content" onClick={e => e.stopPropagation()}>
            <button className="notif-zoom-close" onClick={() => setIsQrZoomed(false)}>×</button>
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https://t.me/envirosense_e11_bot"
              alt="QR Telegram Enorme"
            />
            <h3>Bot de Telegram EnviroSense</h3>
            <p>Escanea este código con tu cámara para registrarte y recibir alertas.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notificaciones;
