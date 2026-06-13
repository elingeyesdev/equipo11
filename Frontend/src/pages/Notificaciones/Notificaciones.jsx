import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import httpClient from '../../config/httpClient';
import { useTheme } from '../../context/ThemeContext';
import { del } from 'idb-keyval';
import './Notificaciones.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const Notificaciones = () => {
  const { theme } = useTheme();
  
  const [form, setForm] = useState({
    latitud: null,
    longitud: null,
    notif_email: false,
    notif_whatsapp: false,
    whatsapp_destino: '',
    notif_telegram: false,
    telegram_destino: '',
    email: '' // Read-only
  });
  const [originalForm, setOriginalForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isQrZoomed, setIsQrZoomed] = useState(false);
  const saveTimerRef = useRef(null);

  // Vista del mapa
  const [viewState, setViewState] = useState({
    longitude: -63.5887,
    latitude: -16.2902,
    zoom: 3.5
  });

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
    return JSON.stringify(form) !== JSON.stringify(originalForm);
  }, [form, originalForm]);

  // Cargar preferencias del usuario
  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await httpClient.get('/usuarios/preferencias', { cacheTTL: false });
      const userPrefs = data.data || data;
      const initialForm = {
        latitud: userPrefs.latitud !== null ? parseFloat(userPrefs.latitud) : null,
        longitud: userPrefs.longitud !== null ? parseFloat(userPrefs.longitud) : null,
        notif_email: !!userPrefs.notif_email,
        notif_whatsapp: !!userPrefs.notif_whatsapp,
        whatsapp_destino: userPrefs.whatsapp_destino || '',
        notif_telegram: !!userPrefs.notif_telegram,
        telegram_destino: userPrefs.telegram_destino || '',
        email: userPrefs.email || ''
      };
      setForm(initialForm);
      setOriginalForm(initialForm);

      // Centrar el mapa en la ubicación del usuario si ya está configurada
      if (initialForm.latitud !== null && initialForm.longitud !== null) {
        setViewState({
          latitude: initialForm.latitud,
          longitude: initialForm.longitud,
          zoom: 7
        });
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setMessage({ text: 'Error al cargar la configuración de usuario', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSettings();
  }, [fetchSettings]);

  // Guardar preferencias del usuario (manual o silencioso)
  const handleSave = useCallback(async (silent = false) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      // Si no tiene ubicación válida, forzar notificaciones a false
      if (payload.latitud === null || payload.longitud === null) {
        payload.notif_email = false;
        payload.notif_whatsapp = false;
        payload.notif_telegram = false;
      }
      const { data } = await httpClient.put('/usuarios/preferencias', payload);
      if (data.ok) {
        try {
          await del('http_cache:/usuarios/preferencias:{}');
        } catch (cacheErr) {
          console.warn('Error invalidating preferences cache:', cacheErr);
        }
        const updatedUser = data.data?.usuario || data.usuario || payload;
        const updatedForm = {
          latitud: updatedUser.latitud !== null ? parseFloat(updatedUser.latitud) : null,
          longitud: updatedUser.longitud !== null ? parseFloat(updatedUser.longitud) : null,
          notif_email: !!updatedUser.notif_email,
          notif_whatsapp: !!updatedUser.notif_whatsapp,
          whatsapp_destino: updatedUser.whatsapp_destino || '',
          notif_telegram: !!updatedUser.notif_telegram,
          telegram_destino: updatedUser.telegram_destino || '',
          email: form.email // mantener email original
        };
        setForm(updatedForm);
        setOriginalForm(updatedForm);
        if (!silent) {
          setMessage({ text: 'Configuración guardada exitosamente.', type: 'success' });
          setTimeout(() => setMessage({ text: '', type: '' }), 4000);
        }
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setMessage({ text: 'Error al guardar la configuración.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [form]);

  // Auto-guardado al cambiar la configuración
  useEffect(() => {
    if (loading) return;
    if (!hasChanges) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      handleSave(true);
    }, 1500); // Guardado automático después de 1.5 segundos de inactividad

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [loading, hasChanges, handleSave]);

  const handleToggle = (field) => {
    if (form.latitud === null || form.longitud === null) {
      setMessage({ text: 'Debes configurar tu ubicación en el mapa para habilitar notificaciones.', type: 'error' });
      setTimeout(() => setMessage({ text: '', type: '' }), 4000);
      return;
    }
    setForm(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleInputChange = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleMapClick = (evt) => {
    const { lng, lat } = evt.lngLat;
    setForm(prev => ({
      ...prev,
      latitud: lat,
      longitud: lng
    }));
  };

  const handleClearLocation = () => {
    setForm(prev => ({
      ...prev,
      latitud: null,
      longitud: null,
      notif_email: false,
      notif_whatsapp: false,
      notif_telegram: false
    }));
  };

  const handleWhatsAppChange = (prefix, number) => {
    const cleanNumber = number.replace(/\D/g, '');
    setForm(prev => ({
      ...prev,
      whatsapp_destino: prefix + cleanNumber
    }));
  };

  const splitWhatsApp = (destino) => {
    if (!destino) return { prefix: '+591', number: '' };
    const found = CODES.find(c => destino.startsWith(c.code));
    if (found) {
      return { prefix: found.code, number: destino.replace(found.code, '') };
    }
    return { prefix: '+591', number: destino.startsWith('+') ? destino.substring(4) : destino };
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

  const hasLocation = form.latitud !== null && form.longitud !== null;

  const channels = [
    {
      tipo: 'email',
      label: 'Correo Electrónico (Gmail)',
      icon: '📧',
      habilitado: form.notif_email,
      destino: form.email,
      placeholder: 'ejemplo@correo.com',
      disabledDestino: true,
      fieldName: 'notif_email',
    },
    {
      tipo: 'whatsapp',
      label: 'WhatsApp',
      icon: '📱',
      habilitado: form.notif_whatsapp,
      destino: form.whatsapp_destino,
      placeholder: '70000000',
      fieldName: 'notif_whatsapp',
    },
    {
      tipo: 'telegram',
      label: 'Telegram',
      icon: '✈️',
      habilitado: form.notif_telegram,
      destino: form.telegram_destino,
      placeholder: '123456789',
      fieldName: 'notif_telegram',
    }
  ];

  const mapStyle = theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12';

  return (
    <div className="notif-container">
      <div className="notif-header">
        <div className="notif-header-content">
          <span className="notif-eyebrow">Perfil de Usuario</span>
          <h1 className="notif-title">Preferencias y <em>Localidad</em></h1>
          <p className="notif-subtitle">
            Ubica tu área de interés en el mapa y activa los canales para recibir alertas climáticas regionales en tiempo real.
          </p>
        </div>

        <div className="notif-header-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="notif-status-indicator">
            {saving ? (
              <span className="notif-status-saving">
                <span className="notif-spinner"></span> Guardando...
              </span>
            ) : hasChanges ? (
              <span className="notif-status-pending">⏳ Cambios pendientes...</span>
            ) : (
              <span className="notif-status-saved">✅ Guardado automáticamente</span>
            )}
          </div>

          <button
            type="button"
            className={`notif-btn-save-header ${hasChanges ? 'notif-btn-save--pending' : ''}`}
            onClick={() => handleSave(false)}
            disabled={saving || !hasChanges}
          >
            <span className="notif-btn-content">
              {saving ? (
                <>
                  <span className="notif-spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}></span>
                  Guardando...
                </>
              ) : (
                <>
                  💾 Guardar Cambios
                </>
              )}
            </span>
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`notif-alert notif-alert--${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="notif-grid">
        {/* Tarjeta de Localización */}
        <div className="notif-location-card">
          <div className="notif-card-header" style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: '1rem' }}>
            <div className="notif-card-icon">📍</div>
            <div className="notif-card-info">
              <h3>Ubicación en el Mapa</h3>
              <span className="notif-card-status">
                {hasLocation ? '✓ Ubicación Configurada' : '⚠ Ubicación Requerida (Alertas deshabilitadas)'}
              </span>
            </div>
          </div>
          
          <div className="notif-location-grid">
            <div>
              <p style={{ fontSize: '13px', color: 'var(--ink-mute)', marginBottom: '10px', lineHeight: '1.4' }}>
                Haz clic en el mapa para marcar tus coordenadas. Recibirás alertas sobre focos peligrosos que ocurran en un radio de 50 Km.
              </p>
              
              {!MAPBOX_TOKEN ? (
                <div className="notif-hint-alert" style={{ color: '#ef4444' }}>
                  ⚠️ Token de Mapbox no configurado en variables de entorno.
                </div>
              ) : (
                <div style={{ width: '100%', height: '240px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--line-soft)', position: 'relative' }}>
                  <Map
                    {...viewState}
                    onMove={evt => setViewState(evt.viewState)}
                    onClick={handleMapClick}
                    mapStyle={mapStyle}
                    mapboxAccessToken={MAPBOX_TOKEN}
                    style={{ width: '100%', height: '100%' }}
                  >
                    {form.latitud !== null && form.longitud !== null && (
                      <Marker
                        latitude={form.latitud}
                        longitude={form.longitud}
                        anchor="bottom"
                      >
                        <div style={{ fontSize: '26px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>📍</div>
                      </Marker>
                    )}
                  </Map>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem' }}>
              <div className="notif-input-group">
                <label>Latitud</label>
                <input
                  type="text"
                  readOnly
                  value={form.latitud !== null ? form.latitud.toFixed(6) : ''}
                  placeholder="Haz clic en el mapa"
                />
              </div>
              <div className="notif-input-group">
                <label>Longitud</label>
                <input
                  type="text"
                  readOnly
                  value={form.longitud !== null ? form.longitud.toFixed(6) : ''}
                  placeholder="Haz clic en el mapa"
                />
              </div>
              {hasLocation && (
                <button
                  type="button"
                  onClick={handleClearLocation}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    width: 'fit-content'
                  }}
                >
                  Limpiar Ubicación
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Banner informativo de ubicación */}
        {!hasLocation && (
          <div className="notif-info-box" style={{ gridColumn: '1 / -1', background: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217, 119, 6, 0.2)', color: '#d97706', marginBottom: '2rem' }}>
            <div className="notif-info-icon">⚠️</div>
            <div className="notif-info-text">
              <strong>Ubicación Requerida:</strong> Debes ingresar tus coordenadas marcando el mapa para habilitar los canales de notificación.
            </div>
          </div>
        )}

        {channels.map((s) => (
          <div key={s.tipo} className={`notif-card ${s.habilitado ? 'notif-card--active' : ''} ${!hasLocation ? 'notif-card--disabled' : ''}`} style={{ opacity: hasLocation ? 1 : 0.6 }}>
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
                  onChange={() => handleToggle(s.fieldName)}
                  disabled={!hasLocation}
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
                        onChange={(e) => handleWhatsAppChange(e.target.value, splitWhatsApp(s.destino).number)}
                        disabled={!s.habilitado || !hasLocation}
                      >
                        {CODES.map(c => (
                          <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={splitWhatsApp(s.destino).number}
                      onChange={(e) => handleWhatsAppChange(splitWhatsApp(s.destino).prefix, e.target.value)}
                      placeholder="70000000"
                      disabled={!s.habilitado || !hasLocation}
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={s.destino || ''}
                    onChange={(e) => handleInputChange(s.tipo === 'email' ? 'email' : 'telegram_destino', e.target.value)}
                    placeholder={getPlaceholder(s.tipo)}
                    disabled={s.disabledDestino || !s.habilitado || !hasLocation}
                  />
                )}
              </div>


              {s.tipo === 'telegram' && (
                <div className="notif-telegram-help">
                  <div className="notif-qr-container">
                    <div className="notif-qr-wrapper" onClick={() => hasLocation && setIsQrZoomed(true)} title="Click para agrandar">
                      <img
                        src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://t.me/envirosense_e11_bot"
                        alt="QR Telegram"
                        className="notif-qr-image"
                        style={{ filter: hasLocation ? 'none' : 'grayscale(100%)' }}
                      />
                      {hasLocation && <div className="notif-qr-overlay">🔍</div>}
                    </div>
                    <div className="notif-qr-text">
                      <p><strong>Escanea para iniciar</strong></p>
                      <a href="https://t.me/envirosense_e11_bot" target="_blank" rel="noreferrer" style={{ pointerEvents: hasLocation ? 'auto' : 'none' }}>@envirosense_e11_bot</a>
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
          <strong>¿Cómo funcionan las alertas?</strong> Las notificaciones se disparan automáticamente cuando un sensor o una simulación de zona supera los umbrales de nivel <em>crítico</em> o <em>emergencia</em> en un radio de 50 Km de tus coordenadas registradas.
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
