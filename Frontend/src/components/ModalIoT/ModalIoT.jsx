/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import httpClient from '../../config/httpClient';
import { useTheme } from '../../context/ThemeContext';
import './ModalIoT.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const EMPTY_TOPICS = {
  temperatura: '',
  humedad: '',
  aqi: '',
  ica: '',
  ruido: ''
};

export default function ModalIoT({ isOpen, onClose, onSensorChange }) {
  const { theme } = useTheme();

  // Estados del Formulario
  const [sensorId, setSensorId] = useState('');
  const [nombre, setNombre] = useState('');
  const [latitud, setLatitud] = useState(null);
  const [longitud, setLongitud] = useState(null);
  const [topics, setTopics] = useState(EMPTY_TOPICS);
  const [isEditing, setIsEditing] = useState(false);

  // Estados del listado y de UI
  const [sensorsList, setSensorsList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ text: '', type: '' });

  // Vista inicial del mini-mapa (centrado en Bolivia)
  const [viewState, setViewState] = useState({
    longitude: -63.5887,
    latitude: -16.2902,
    zoom: 3.5
  });

  const loadCustomSensors = async () => {
    setLoadingList(true);
    try {
      const res = await httpClient.get('/sensores');
      const body = res.data;
      const sensorsArray = body?.data?.data && Array.isArray(body.data.data)
        ? body.data.data
        : (body?.data && Array.isArray(body.data) ? body.data : []);

      const customOnes = sensorsArray.filter(s => s.es_custom === true);
      setSensorsList(customOnes);
    } catch (err) {
      console.error('Error al cargar sensores custom:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCustomSensors();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMapClick = (evt) => {
    const { lng, lat } = evt.lngLat;
    setLatitud(lat);
    setLongitud(lng);
  };

  const handleTopicChange = (metric, val) => {
    setTopics(prev => ({ ...prev, [metric]: val }));
  };

  const handleEditClick = (s) => {
    setIsEditing(true);
    setSensorId(s.id);
    setNombre(s.name);
    setLatitud(s.latitude);
    setLongitud(s.longitude);
    const mergedTopics = { ...EMPTY_TOPICS };
    if (s.topics) {
      Object.keys(EMPTY_TOPICS).forEach(k => {
        if (s.topics[k] !== undefined) {
          mergedTopics[k] = s.topics[k];
        }
      });
    }
    setTopics(mergedTopics);
    setViewState({
      longitude: s.longitude,
      latitude: s.latitude,
      zoom: 6.5
    });
    setAlertMsg({ text: '', type: '' });
  };

  const handleCancelEdit = () => {
    setSensorId('');
    setNombre('');
    setLatitud(null);
    setLongitud(null);
    setTopics(EMPTY_TOPICS);
    setIsEditing(false);
    setAlertMsg({ text: '', type: '' });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setAlertMsg({ text: '', type: '' });

    // Validar ID
    const cleanId = sensorId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanId) {
      setAlertMsg({ text: 'El ID del sensor es inválido (solo letras, números, guiones).', type: 'error' });
      return;
    }

    if (!nombre.trim()) {
      setAlertMsg({ text: 'El nombre del sensor es requerido.', type: 'error' });
      return;
    }

    if (latitud === null || longitud === null) {
      setAlertMsg({ text: 'Por favor, haz clic en el mapa para fijar la ubicación del sensor.', type: 'error' });
      return;
    }

    // Validar que al menos un tema esté configurado
    const hasTopic = Object.values(topics).some(t => t && t.trim() !== '');
    if (!hasTopic) {
      setAlertMsg({ text: 'Debes configurar al menos un tema MQTT.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        id: cleanId,
        name: nombre.trim(),
        latitude: latitud,
        longitude: longitud,
        topics: topics
      };

      const { data } = await httpClient.post('/sensores', payload);
      if (data.ok) {
        setAlertMsg({
          text: isEditing ? 'Sensor IoT actualizado correctamente.' : 'Sensor IoT creado y conectado a HiveMQ.',
          type: 'success'
        });
        // Limpiar form
        setSensorId('');
        setNombre('');
        setLatitud(null);
        setLongitud(null);
        setTopics(EMPTY_TOPICS);
        setIsEditing(false);
        // Recargar listado y notificar cambio a mapa principal
        await loadCustomSensors();
        if (onSensorChange) onSensorChange();
      }
    } catch (err) {
      const msg = err.response?.data?.mensaje || err.message;
      setAlertMsg({ text: 'Error al registrar sensor: ' + msg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (isEditing && sensorId === id) {
      setAlertMsg({ text: 'No puedes eliminar el sensor mientras lo estás editando.', type: 'error' });
      return;
    }
    if (!window.confirm('¿Estás seguro de que deseas eliminar este sensor IoT personalizado?')) return;
    try {
      const { data } = await httpClient.delete(`/sensores/${id}`);
      if (data.ok) {
        setAlertMsg({ text: 'Sensor IoT eliminado correctamente.', type: 'success' });
        await loadCustomSensors();
        if (onSensorChange) onSensorChange();
      }
    } catch (err) {
      setAlertMsg({ text: 'Error al eliminar sensor: ' + err.message, type: 'error' });
    }
  };

  const mapStyle = theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12';

  return (
    <div className="miot-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="miot-box">
        <div className="miot-box-header">
          <span className="miot-box-title">
            <svg width="20" height="20" fill="none" stroke="#5bc0be" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.58 16.14a6 6 0 0 1 6.84 0" />
              <circle cx="12" cy="20" r="1.5" />
            </svg>
            Gestión de Sensores IoT (HiveMQ MQTT)
          </span>
          <button type="button" className="miot-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="miot-body">
          {/* Panel Izquierdo: Crear/Editar Sensor */}
          <div className="miot-left-panel">
            <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {isEditing ? 'Editar Sensor' : 'Añadir Nuevo Sensor'}
            </span>
            <p className="miot-subtitle">
              {isEditing 
                ? 'Modifica los datos del sensor seleccionado. El identificador único no se puede cambiar.' 
                : 'Completa el nombre, selecciona la ubicación en el mapa e ingresa los temas MQTT en HiveMQ Cloud.'}
            </p>

            <form onSubmit={handleFormSubmit} className="miot-form-section">
              <div className="miot-field-row">
                <div className="miot-field">
                  <label className="miot-label">Identificador (Único)</label>
                  <input
                    type="text"
                    className="miot-input"
                    placeholder="ej: sensor_sur_1"
                    value={sensorId}
                    onChange={e => setSensorId(e.target.value)}
                    required
                    disabled={isEditing}
                  />
                </div>
                <div className="miot-field">
                  <label className="miot-label">Nombre del Sensor</label>
                  <input
                    type="text"
                    className="miot-input"
                    placeholder="ej: Estación Central"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Mapa de Bolivia para clickear */}
              <div className="miot-field">
                <label className="miot-label">
                  <svg width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  Coordenadas (Haz clic en el mapa)
                </label>
                <div className="miot-map-container">
                  {MAPBOX_TOKEN ? (
                    <Map
                      {...viewState}
                      onMove={evt => setViewState(evt.viewState)}
                      onClick={handleMapClick}
                      mapStyle={mapStyle}
                      mapboxAccessToken={MAPBOX_TOKEN}
                      style={{ width: '100%', height: '100%' }}
                    >
                      {latitud !== null && longitud !== null && (
                        <Marker latitude={latitud} longitude={longitud} anchor="bottom">
                          <div style={{ fontSize: '26px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}></div>
                        </Marker>
                      )}
                    </Map>
                  ) : (
                    <div style={{ padding: '10px', fontSize: '12px', color: 'red' }}>Token de Mapbox no configurado.</div>
                  )}
                </div>
                <div className="miot-field-row" style={{ marginTop: '4px' }}>
                  <input type="text" readOnly placeholder="Latitud" className="miot-input" value={latitud !== null ? latitud.toFixed(6) : ''} />
                  <input type="text" readOnly placeholder="Longitud" className="miot-input" value={longitud !== null ? longitud.toFixed(6) : ''} />
                </div>
              </div>

              {/* Temas MQTT */}
              <div className="miot-field">
                <label className="miot-label">Temas MQTT (HiveMQ Broker)</label>
                <div className="miot-topics-grid">
                  {[
                    { key: 'temperatura', label: 'Temperatura' },
                    { key: 'humedad',     label: 'Humedad' },
                    { key: 'aqi',         label: 'Calidad Aire (AQI)' },
                    { key: 'ica',         label: 'Calidad Agua (ICA)' },
                    { key: 'ruido',       label: 'Ruido (dB)' }
                  ].map(metric => (
                    <div key={metric.key} className="miot-topic-item">
                      <span className="miot-topic-badge">{metric.label}</span>
                      <input
                        type="text"
                        className="miot-input"
                        placeholder="ej: sensores/sensor1/temp"
                        value={topics[metric.key]}
                        onChange={e => handleTopicChange(metric.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {alertMsg.text && (
                <div className={`miot-alert-msg ${alertMsg.type}`}>
                  {alertMsg.text}
                </div>
              )}

              <div className="miot-footer">
                <button
                  type="button"
                  className="miot-btn miot-btn-secondary"
                  onClick={isEditing ? handleCancelEdit : () => {
                    setSensorId('');
                    setNombre('');
                    setLatitud(null);
                    setLongitud(null);
                    setTopics(EMPTY_TOPICS);
                    setAlertMsg({ text: '', type: '' });
                  }}
                >
                  {isEditing ? 'Cancelar' : 'Limpiar'}
                </button>
                <button
                  type="submit"
                  className="miot-btn miot-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Guardar Sensor'}
                </button>
              </div>
            </form>
          </div>

          {/* Panel Derecho: Lista de Sensores */}
          <div className="miot-right-panel">
            <div className="miot-list-header">
              <span>Mis Sensores Activos</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>({sensorsList.length})</span>
            </div>

            <div className="miot-list-container">
              {loadingList ? (
                <div style={{ textAlign: 'center', padding: '2rem', fontSize: '0.85rem' }}>Cargando sensores...</div>
              ) : sensorsList.length === 0 ? (
                <div className="miot-empty-state">
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ marginBottom: '8px', opacity: 0.5 }}>
                    <path d="M5 12h14M12 5v14" />
                  </svg>
                  <span>No tienes sensores personalizados configurados aún. Cree uno en el formulario de la izquierda.</span>
                </div>
              ) : (
                sensorsList.map(s => (
                  <div key={s.id} className="miot-card">
                    <div className="miot-card-info">
                      <div className="miot-card-title">{s.name}</div>
                      <div className="miot-card-id">ID: {s.id}</div>
                      <div className="miot-card-coords">Pos: {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}</div>
                      <div className="miot-card-topics">
                        {Object.entries(s.topics || {}).map(([metric, topic]) => {
                          if (!topic) return null;
                          return (
                            <span key={metric} className="miot-card-topic-tag">
                              {metric.toUpperCase()}: {topic}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="miot-btn-edit"
                        onClick={() => handleEditClick(s)}
                        title="Editar sensor"
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="miot-btn-delete"
                        onClick={() => handleDelete(s.id)}
                        title="Eliminar sensor"
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
