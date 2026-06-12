import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSimulacion } from '../../context/SimulacionContext'
import { useToast } from '../../components/Toast/Toast'
import httpClient from '../../config/httpClient'
import { formatCityName, formatDateTime } from '../../utils/formatters'
import './Simulacion.css'

const METRICAS_OPTS = [
  { value: 'temperatura', label: 'Temperatura' },
  { value: 'humedad', label: 'Humedad' },
  { value: 'aqi', label: 'Calidad del Aire (AQI)' },
  { value: 'precipitacion', label: 'Lluvia (Precipitación)' },
  { value: 'viento', label: 'Velocidad del Viento' },
  { value: 'ica', label: 'Calidad del Agua (ICA)' },
  { value: 'ruido', label: 'Ruido' }
];

const DEFAULT_METRICS_BY_EVENT = {
  tormenta: ['precipitacion', 'viento', 'humedad'],
  ola_calor: ['temperatura', 'humedad', 'aqi'],
  incendio: ['temperatura', 'aqi', 'ruido'],
  inundacion: ['precipitacion', 'humedad', 'ica']
};

export default function Simulacion({ 
  localidadesList, 
  activeCityName, 
  setActiveCityName, 
  onLoadResults 
}) {
  const { addToast } = useToast()
  const navigate = useNavigate()
  const { 
    setIsSimMode,
    setActiveDrawingZone,
    restSimPoints, setRestSimPoints
  } = useSimulacion()

  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipoEvento, setTipoEvento] = useState('tormenta')
  const [intensidad, setIntensidad] = useState(2.0)
  const [duracion, setDuracion] = useState(24)
  const [metricasAfectadas, setMetricasAfectadas] = useState(DEFAULT_METRICS_BY_EVENT.tormenta)
  const [loading, setLoading] = useState(false)
  const [simulaciones, setSimulaciones] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Sincronizar checkboxes por defecto al cambiar tipo de evento
  useEffect(() => {
    if (DEFAULT_METRICS_BY_EVENT[tipoEvento]) {
      setMetricasAfectadas(DEFAULT_METRICS_BY_EVENT[tipoEvento]);
    }
  }, [tipoEvento]);

  // Cargar historial de simulaciones al montar
  const fetchSimulaciones = async () => {
    setLoadingHistory(true);
    try {
      const res = await httpClient.get('/simulaciones');
      if (res.data && res.data.data) {
        setSimulaciones(res.data.data);
      }
    } catch (err) {
      console.error('Error cargando simulaciones pasadas:', err);
      addToast('Error al cargar historial de simulaciones', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchSimulaciones();
  }, []);

  const handleStartDrawing = () => {
    setIsSimMode(true);
    setActiveDrawingZone('rest');
    addToast('Modo de dibujo activado. Haz clic en el mapa para marcar el polígono.', 'info');
    navigate('/mapa-monitoreo');
  };

  const handleClearPoints = () => {
    setRestSimPoints([]);
    addToast('Área de simulación limpiada.', 'info');
  };

  const handleCheckboxChange = (value) => {
    setMetricasAfectadas(prev => 
      prev.includes(value) 
        ? prev.filter(m => m !== value) 
        : [...prev, value]
    );
  };

  const handleExecute = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) {
      return addToast('El nombre de la simulación es requerido', 'warning');
    }
    if (restSimPoints.length < 3) {
      return addToast('Debes dibujar un polígono en el mapa (mínimo 3 puntos)', 'warning');
    }

    setLoading(true);

    const activeCityObj = localidadesList.find(loc => loc.nombre.toLowerCase() === activeCityName.toLowerCase());
    const localidad_id = activeCityObj ? activeCityObj.id : 1;

    // Crear polígono cerrado para GeoJSON
    const closedPoints = [...restSimPoints, restSimPoints[0]];
    const areaGeo = {
      type: 'Polygon',
      coordinates: [closedPoints]
    };

    const payload = {
      nombre,
      descripcion,
      localidad_id,
      tipo_evento: tipoEvento,
      area_geo: areaGeo,
      parametros: {
        intensidad: Number(intensidad),
        duracion_horas: Number(duracion),
        metricas_afectadas: metricasAfectadas
      }
    };

    try {
      const res = await httpClient.post('/simulaciones', payload);
      addToast('Simulación de escenario ejecutada con éxito', 'success');
      
      // Limpiar puntos del dibujo
      setRestSimPoints([]);
      setIsSimMode(false);
      setActiveDrawingZone(null);

      // Cargar los resultados en la vista
      if (res.data && res.data.data) {
        onLoadResults(res.data.data);
      }
    } catch (err) {
      console.error('Error al ejecutar simulación REST:', err);
      addToast(err.response?.data?.message || 'Error al iniciar la simulación', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas cancelar/eliminar esta simulación?')) return;
    try {
      await httpClient.delete(`/simulaciones/${id}`);
      addToast('Simulación cancelada con éxito', 'success');
      fetchSimulaciones();
    } catch (err) {
      console.error(err);
      addToast('Error al cancelar la simulación', 'error');
    }
  };

  const handleLoadPast = async (id) => {
    try {
      const res = await httpClient.get(`/simulaciones/${id}`);
      if (res.data && res.data.data) {
        onLoadResults(res.data.data);
        addToast('Resultados de simulación cargados', 'success');
      }
    } catch (err) {
      console.error(err);
      addToast('Error al cargar la simulación', 'error');
    }
  };

  return (
    <div className="sim-panel-container">
      <div className="sim-grid">
        {/* Formulario de Configuración */}
        <form onSubmit={handleExecute} className="sim-form bg-slate-800/40 backdrop-blur border border-slate-700 p-6 rounded-xl">
          <h2 className="sim-form-title text-lg font-bold mb-4 text-white">⚙️ Configurar Nueva Simulación</h2>
          
          <div className="sim-control-group mb-4">
            <label className="sim-label">Nombre de la Simulación</label>
            <input 
              type="text" 
              className="sim-input" 
              placeholder="Ej: Tormenta Extrema en La Paz" 
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
            />
          </div>

          <div className="sim-control-group mb-4">
            <label className="sim-label">Descripción / Notas</label>
            <textarea 
              className="sim-textarea" 
              placeholder="Notas opcionales del escenario simulado..."
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
            />
          </div>

          <div className="sim-control-row grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="sim-control-group">
              <label className="sim-label">Ciudad de Referencia</label>
              <select 
                className="sim-select" 
                value={activeCityName} 
                onChange={e => setActiveCityName(e.target.value)}
              >
                {localidadesList.map(loc => (
                  <option key={loc.id} value={loc.nombre}>{formatCityName(loc.nombre)}</option>
                ))}
              </select>
            </div>

            <div className="sim-control-group">
              <label className="sim-label">Tipo de Evento</label>
              <select 
                className="sim-select" 
                value={tipoEvento} 
                onChange={e => setTipoEvento(e.target.value)}
              >
                <option value="tormenta">⚡ Tormenta / Temporal</option>
                <option value="ola_calor">🔥 Ola de Calor</option>
                <option value="incendio">🌲 Incendio Forestal</option>
                <option value="inundacion">🌊 Inundación</option>
              </select>
            </div>
          </div>

          <div className="sim-control-group mb-4">
            <div className="flex justify-between items-center mb-1">
              <label className="sim-label">Intensidad del Evento</label>
              <span className="sim-badge intensity-badge">{intensidad.toFixed(1)} / 10.0</span>
            </div>
            <input 
              type="range" 
              className="sim-slider" 
              min="1.0" 
              max="10.0" 
              step="0.5" 
              value={intensidad}
              onChange={e => setIntensidad(parseFloat(e.target.value))}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Leve (1.0)</span>
              <span>Moderado (5.0)</span>
              <span>Extremo (10.0)</span>
            </div>
          </div>

          <div className="sim-control-group mb-4">
            <div className="flex justify-between items-center mb-1">
              <label className="sim-label">Duración Proyectada</label>
              <span className="sim-badge duration-badge">{duracion} Horas</span>
            </div>
            <input 
              type="range" 
              className="sim-slider" 
              min="1" 
              max="48" 
              step="1" 
              value={duracion}
              onChange={e => setDuracion(parseInt(e.target.value, 10))}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1 Hora</span>
              <span>24 Horas</span>
              <span>48 Horas</span>
            </div>
          </div>

          <div className="sim-control-group mb-4">
            <label className="sim-label mb-2 block">Métricas a Afectar</label>
            <div className="sim-checkbox-grid grid grid-cols-2 gap-2 bg-slate-900/40 p-3 rounded-lg border border-slate-700/50">
              {METRICAS_OPTS.map(opt => (
                <label key={opt.value} className="sim-checkbox-label flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white">
                  <input 
                    type="checkbox" 
                    className="sim-checkbox"
                    checked={metricasAfectadas.includes(opt.value)}
                    onChange={() => handleCheckboxChange(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Selector de Polígono */}
          <div className="sim-polygon-panel bg-amber-500/5 border border-amber-500/25 p-4 rounded-lg mb-6">
            <span className="block text-xs font-semibold text-amber-400 mb-2">🗺️ Delimitación del Área Geográfica</span>
            <p className="text-xs text-gray-400 leading-relaxed mb-3">
              Para simular el alcance espacial del evento, debes dibujar un polígono cerrado en el mapa de monitoreo meteorológico.
            </p>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-300">Puntos dibujados en mapa:</span>
              <strong className={`text-sm ${restSimPoints.length >= 3 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {restSimPoints.length} {restSimPoints.length < 3 && '(mínimo 3 para cerrar)'}
              </strong>
            </div>
            <div className="flex gap-2">
              <button 
                type="button" 
                className="sim-btn-outline flex-1 py-2 text-xs" 
                onClick={handleStartDrawing}
              >
                ✏️ Dibujar en el mapa
              </button>
              <button 
                type="button" 
                className="sim-btn-clear py-2 px-3 text-xs bg-slate-700/40 border border-slate-600 rounded text-gray-300 hover:bg-slate-700"
                onClick={handleClearPoints}
                disabled={restSimPoints.length === 0}
              >
                🗑️ Limpiar
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="sim-btn-submit w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg transition-colors flex justify-center items-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px', borderTopColor: '#0f172a' }}></div>
                <span>Calculando Simulación...</span>
              </>
            ) : (
              <>
                <span>⚡ Ejecutar Simulación REST</span>
              </>
            )}
          </button>
        </form>

        {/* Historial de Simulaciones */}
        <div className="sim-history bg-slate-800/40 backdrop-blur border border-slate-700 p-6 rounded-xl flex flex-col max-h-[710px]">
          <h2 className="sim-history-title text-lg font-bold mb-4 text-white">📋 Simulaciones Recientes</h2>
          
          <div className="sim-history-table-wrap overflow-y-auto flex-1 border border-slate-700/60 rounded-lg">
            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <div className="spinner mb-2"></div>
                <span>Cargando simulaciones pasadas...</span>
              </div>
            ) : simulaciones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <span className="text-3xl mb-2">📂</span>
                <span>No hay simulaciones creadas en el sistema.</span>
              </div>
            ) : (
              <table className="sim-history-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/60 border-b border-slate-700 text-xs text-gray-400 font-semibold uppercase">
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Evento</th>
                    <th className="p-3">Parámetros</th>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="text-xs text-gray-300 divide-y divide-slate-700/50">
                  {simulaciones.map(sim => (
                    <tr key={sim.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="p-3 font-semibold text-white max-w-[150px] truncate">{sim.nombre}</td>
                      <td className="p-3 capitalize">{sim.tipo_evento?.replace('_', ' ')}</td>
                      <td className="p-3 text-gray-400">
                        Int: {sim.parametros?.intensidad?.toFixed(1)} | {sim.parametros?.duracion_horas}h
                      </td>
                      <td className="p-3 text-gray-400">{formatDateTime(sim.creado_en)}</td>
                      <td className="p-3">
                        <span className={`sim-status-badge ${sim.estado}`}>
                          {sim.estado}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button 
                            className="sim-btn-load px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded"
                            onClick={() => handleLoadPast(sim.id)}
                          >
                            👁️ Ver
                          </button>
                          {sim.estado === 'activa' && (
                            <button 
                              className="sim-btn-cancel px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded"
                              onClick={() => handleDelete(sim.id)}
                            >
                              🛑 Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
