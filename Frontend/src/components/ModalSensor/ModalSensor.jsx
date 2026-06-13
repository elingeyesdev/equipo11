import { useState, useEffect } from 'react';
import { crearSensorIoT, getSensoresMqttList, eliminarSensorMqtt } from '../../utils/weatherApi';
import './ModalSensor.css';

function ModalSensor({ isOpen, onClose, initialCoordinates, onSelectOnMap, onSensorAdded }) {
  const [activeTab, setActiveTab] = useState('agregar'); // 'agregar' | 'lista'
  const [nombre, setNombre] = useState('');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');
  const [topicTemp, setTopicTemp] = useState('');
  const [topicHum, setTopicHum] = useState('');
  const [topicAqi, setTopicAqi] = useState('');
  const [topicRuido, setTopicRuido] = useState('');
  const [topicIca, setTopicIca] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados para la lista de sensores registrados
  const [sensoresList, setSensoresList] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  const cargarSensoresRegistrados = async () => {
    setListLoading(true);
    try {
      const list = await getSensoresMqttList();
      setSensoresList(list);
    } catch (err) {
      console.error(err);
    } finally {
      setListLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initialCoordinates) {
      setLatitud(initialCoordinates.lat.toFixed(6));
      setLongitud(initialCoordinates.lng.toFixed(6));
      // Forzar tab de agregar si venimos de seleccionar coordenadas en mapa
      setActiveTab('agregar');
    }
  }, [initialCoordinates]);

  useEffect(() => {
    if (isOpen && activeTab === 'lista') {
      cargarSensoresRegistrados();
    }
  }, [isOpen, activeTab]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!nombre.trim()) {
      setErrorMsg('El nombre del sensor es requerido.');
      return;
    }

    const lat = parseFloat(latitud);
    const lng = parseFloat(longitud);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setErrorMsg('La latitud debe ser un número entre -90 y 90.');
      return;
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      setErrorMsg('La longitud debe ser un número entre -180 y 180.');
      return;
    }

    if (
      !topicTemp.trim() &&
      !topicHum.trim() &&
      !topicAqi.trim() &&
      !topicRuido.trim() &&
      !topicIca.trim()
    ) {
      setErrorMsg('Debe configurar al menos un tópico de monitoreo MQTT.');
      return;
    }

    setLoading(true);
    try {
      const res = await crearSensorIoT({
        nombre: nombre.trim(),
        latitud: lat,
        longitud: lng,
        topic_temperatura: topicTemp.trim() || null,
        topic_humedad: topicHum.trim() || null,
        topic_aqi: topicAqi.trim() || null,
        topic_ruido: topicRuido.trim() || null,
        topic_ica: topicIca.trim() || null
      });

      // Build sensor object from API response or form values as fallback
      const createdSensor = res?.data?.sensor || {
        id: null,
        name: nombre.trim(),
        latitude: lat,
        longitude: lng
      };

      // Reset form
      setNombre('');
      setLatitud('');
      setLongitud('');
      setTopicTemp('');
      setTopicHum('');
      setTopicAqi('');
      setTopicRuido('');
      setTopicIca('');

      // Pass created sensor to parent — parent closes modal and flies map
      if (onSensorAdded) onSensorAdded(createdSensor);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Error al guardar el sensor. Intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSensor = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este sensor? Se cancelarán sus suscripciones MQTT y se borrarán sus lecturas.')) {
      return;
    }

    try {
      await eliminarSensorMqtt(id);
      cargarSensoresRegistrados();
      if (onSensorAdded) onSensorAdded();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el sensor.');
    }
  };

  return (
    <div className="msensor-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="msensor-box">
        <div className="msensor-box-header">
          <div className="msensor-tabs">
            <button
              className={`msensor-tab ${activeTab === 'agregar' ? 'active' : ''}`}
              onClick={() => setActiveTab('agregar')}
            >
              Agregar Sensor
            </button>
            <button
              className={`msensor-tab ${activeTab === 'lista' ? 'active' : ''}`}
              onClick={() => setActiveTab('lista')}
            >
              Mis Sensores
            </button>
          </div>
          <button type="button" className="msensor-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="msensor-body">
          {activeTab === 'agregar' ? (
            <>
              <p className="msensor-subtitle">
                Ingresa los detalles del sensor físico. El servidor se suscribirá a los tópicos MQTT indicados en tu Broker HiveMQ.
              </p>

              {errorMsg && <div className="msensor-error-banner">⚠️ {errorMsg}</div>}

              <form className="msensor-form" onSubmit={handleSubmit}>
                <div className="msensor-field msensor-field--full">
                  <label className="msensor-label">Nombre del Sensor</label>
                  <input
                    type="text"
                    className="msensor-input"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    placeholder="Ej. Sensor Aula 302 o ESP32-Monitoreo"
                    required
                  />
                </div>

                <div className="msensor-coords-row">
                  <div className="msensor-field">
                    <label className="msensor-label">Latitud</label>
                    <input
                      type="number"
                      step="0.000001"
                      className="msensor-input"
                      value={latitud}
                      onChange={e => setLatitud(e.target.value)}
                      placeholder="Ej. -17.3935"
                      required
                    />
                  </div>

                  <div className="msensor-field">
                    <label className="msensor-label">Longitud</label>
                    <input
                      type="number"
                      step="0.000001"
                      className="msensor-input"
                      value={longitud}
                      onChange={e => setLongitud(e.target.value)}
                      placeholder="Ej. -66.1570"
                      required
                    />
                  </div>
                </div>

                <div style={{ textAlign: 'center', margin: '4px 0' }}>
                  <button
                    type="button"
                    className="msensor-btn-map"
                    onClick={onSelectOnMap}
                  >
                    📍 Seleccionar ubicación en el mapa
                  </button>
                </div>

                <div className="msensor-section-title">Tópicos MQTT de Suscripción (HiveMQ)</div>
                <p className="msensor-helper-text">Configure solo los tópicos que publicará el sensor. El resto quedarán vacíos.</p>

                <div className="msensor-topics-grid">
                  <div className="msensor-field">
                    <label className="msensor-label">🌡️ Temp (°C)</label>
                    <input
                      type="text"
                      className="msensor-input msensor-topic-input"
                      value={topicTemp}
                      onChange={e => setTopicTemp(e.target.value)}
                      placeholder="equipo11/monitoreo/temperatura"
                    />
                  </div>

                  <div className="msensor-field">
                    <label className="msensor-label">💦 Humedad (%)</label>
                    <input
                      type="text"
                      className="msensor-input msensor-topic-input"
                      value={topicHum}
                      onChange={e => setTopicHum(e.target.value)}
                      placeholder="equipo11/monitoreo/humedad"
                    />
                  </div>

                  <div className="msensor-field">
                    <label className="msensor-label">🌫️ Aire (AQI)</label>
                    <input
                      type="text"
                      className="msensor-input msensor-topic-input"
                      value={topicAqi}
                      onChange={e => setTopicAqi(e.target.value)}
                      placeholder="equipo11/monitoreo/calidad_aire"
                    />
                  </div>

                  <div className="msensor-field">
                    <label className="msensor-label">🔊 Ruido (dB)</label>
                    <input
                      type="text"
                      className="msensor-input msensor-topic-input"
                      value={topicRuido}
                      onChange={e => setTopicRuido(e.target.value)}
                      placeholder="equipo11/monitoreo/ruido"
                    />
                  </div>

                  <div className="msensor-field msensor-field--full">
                    <label className="msensor-label">💧 Agua (ICA)</label>
                    <input
                      type="text"
                      className="msensor-input msensor-topic-input"
                      value={topicIca}
                      onChange={e => setTopicIca(e.target.value)}
                      placeholder="equipo11/monitoreo/calidad_agua"
                    />
                  </div>
                </div>

                <div className="msensor-footer">
                  <button
                    type="button"
                    className="msensor-btn-cancel"
                    onClick={onClose}
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="msensor-btn-save"
                    disabled={loading}
                  >
                    {loading ? 'Guardando...' : 'Conectar Sensor 🚀'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="msensor-list-container">
              {listLoading ? (
                <div className="msensor-list-loading">Cargando sensores...</div>
              ) : sensoresList.length === 0 ? (
                <div className="msensor-list-empty">
                  <span>📡</span>
                  <p>No tienes sensores MQTT registrados.</p>
                  <button className="msensor-btn-map" onClick={() => setActiveTab('agregar')}>
                    Registrar el primero
                  </button>
                </div>
              ) : (
                <div className="msensor-list">
                  {sensoresList.map((sensor) => (
                    <div key={sensor.id} className="msensor-item">
                      <div className="msensor-item-info">
                        <span className="msensor-item-name">{sensor.name}</span>
                        <span className="msensor-item-coords">
                          Lat: {sensor.latitude.toFixed(4)}, Lng: {sensor.longitude.toFixed(4)}
                        </span>
                        <div className="msensor-item-badges">
                          {sensor.topic_temperatura && <span className="msensor-badge" title={sensor.topic_temperatura}>🌡️ Temp</span>}
                          {sensor.topic_humedad && <span className="msensor-badge" title={sensor.topic_humedad}>💦 Hum</span>}
                          {sensor.topic_aqi && <span className="msensor-badge" title={sensor.topic_aqi}>🌫️ Aire</span>}
                          {sensor.topic_ruido && <span className="msensor-badge" title={sensor.topic_ruido}>🔊 Ruido</span>}
                          {sensor.topic_ica && <span className="msensor-badge" title={sensor.topic_ica}>💧 Agua</span>}
                        </div>
                      </div>
                      <button
                        className="msensor-item-delete-btn"
                        onClick={() => handleDeleteSensor(sensor.id)}
                        title="Eliminar Sensor"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ModalSensor;
