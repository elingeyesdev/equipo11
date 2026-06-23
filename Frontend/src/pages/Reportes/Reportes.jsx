import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useMultiForecastData } from '../../hooks/useMultiForecastData';
import ReactECharts from 'echarts-for-react';
import { useToast } from '../../components/Toast/Toast';
import './Reportes.css';
import { useZonaSim } from '../../context/ZonaSimContext';
import MeteoroAssistant from '../../components/MeteoroAssistant/MeteoroAssistant';
import httpClient from '../../config/httpClient';

import { useUnidades } from '../../hooks/useUnidades';
import { formatearValor } from '../../utils/unidades';
import { formatDateTime, formatCityName } from '../../utils/formatters';
import LineChart from './LineChart';
import BarChart from './BarChart';
import KpiCard from './KpiCard';
import { CIUDADES, METRICAS_OPTS, RANGOS, PAGE_SIZE, calcStats } from './constants';

const CIUDADES_BOLIVIA = [
  { nombre: 'La Paz',       latitude: -16.4897, longitude: -68.1193 },
  { nombre: 'Cochabamba',   latitude: -17.3895, longitude: -66.1568 },
  { nombre: 'Santa Cruz',   latitude: -17.7833, longitude: -63.1812 },
  { nombre: 'Oruro',        latitude: -17.9624, longitude: -67.1061 },
  { nombre: 'Potosí',       latitude: -19.5836, longitude: -65.7531 },
  { nombre: 'Sucre',        latitude: -19.0353, longitude: -65.2592 },
  { nombre: 'Tarija',       latitude: -21.5355, longitude: -64.7296 },
  { nombre: 'Trinidad',     latitude: -14.8333, longitude: -64.9000 },
  { nombre: 'Cobija',       latitude: -11.0267, longitude: -68.7692 },
];

function TabDashboard() {
  const { addToast } = useToast();
  const [selectedCities, setSelectedCities] = useState(CIUDADES_BOLIVIA.map(c => c.nombre));

  const filteredCities = useMemo(() => {
    return CIUDADES_BOLIVIA.filter(c => selectedCities.includes(c.nombre));
  }, [selectedCities]);

  const { dataMap, loading, error } = useMultiForecastData(filteredCities);

  const toggleCity = (cityName) => {
    setSelectedCities(prev => 
      prev.includes(cityName) 
        ? prev.filter(c => c !== cityName) 
        : [...prev, cityName]
    );
  };

  const timeLabels = useMemo(() => {
    const firstCityName = Object.keys(dataMap)[0];
    if (!firstCityName) return [];
    return dataMap[firstCityName].map(d => 
      new Date(d.forecast_time).toLocaleDateString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    );
  }, [dataMap]);

  const tableData = useMemo(() => {
    const rows = [];
    Object.entries(dataMap).forEach(([city, forecastArray]) => {
      forecastArray.forEach(d => {
        rows.push({
          city: city,
          dateLabel: new Date(d.forecast_time).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }),
          timeLabel: new Date(d.forecast_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          t: d.temperatura !== null ? Number(d.temperatura) : 0,
          r: d.rain !== null ? Number(d.rain) : 0,
          w: d.wind_speed !== null ? Number(d.wind_speed) : 0,
          v: d.vis !== null ? Number(d.vis) : 0,
          rawTime: new Date(d.forecast_time).getTime()
        });
      });
    });
    return rows.sort((a, b) => a.rawTime - b.rawTime || a.city.localeCompare(b.city));
  }, [dataMap]);

  const handleExport = async (format) => {
    if (tableData.length === 0) {
      addToast('No hay datos para exportar', 'warning');
      return;
    }
    try {
      const columnas = [
        { header: 'Ciudad', key: 'city' },
        { header: 'Fecha', key: 'fecha' },
        { header: 'Hora', key: 'hora' },
        { header: 'Temp (°C)', key: 'temp' },
        { header: 'Lluvia (mm/h)', key: 'rain' },
        { header: 'Viento (km/h)', key: 'wind' }
      ];
      const filas = tableData.map(d => ({
        city: d.city, fecha: d.dateLabel, hora: d.timeLabel,
        temp: d.t.toFixed(2), rain: d.r.toFixed(3), wind: d.w.toFixed(2)
      }));
      const payload = { formato: format, titulo: `Reporte Analítico Global (BI) - ${new Date().toLocaleDateString()}`, columnas, datos: filas };
      
      const response = await httpClient.post('/reportes/generar', payload, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reporte_BI_${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      addToast(`Reporte ${format.toUpperCase()} generado`, 'success');
    } catch (err) {
      addToast('Error al generar el reporte', 'error');
    }
  };

  const getLineChartOption = () => {
    const series = Object.keys(dataMap).map(city => ({
      name: city, type: 'line', smooth: true, symbolSize: 6,
      data: dataMap[city].map(d => d.temperatura)
    }));
    return {
      tooltip: { trigger: 'axis', backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-color)', textStyle: { color: 'var(--text-primary)' } },
      legend: { textStyle: { color: 'var(--text-secondary)' }, type: 'scroll', top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: timeLabels, axisLabel: { color: 'var(--text-secondary)' } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: 'var(--border-color)' } }, axisLabel: { color: 'var(--text-secondary)' } },
      dataZoom: [{ type: 'inside', start: 0, end: 100 }, { start: 0, end: 100 }],
      series
    };
  };

  const getPieChartOption = () => {
    const pieData = Object.keys(dataMap).map(city => {
      const avg = dataMap[city].reduce((acc, val) => acc + val.temperatura, 0) / dataMap[city].length;
      return { name: city, value: avg.toFixed(1) };
    });
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c}°C ({d}%)', backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-color)', textStyle: { color: 'var(--text-primary)' } },
      legend: { orient: 'vertical', left: 'left', textStyle: { color: 'var(--text-secondary)' }, type: 'scroll' },
      series: [{
        name: 'Temperatura Promedio', type: 'pie', radius: ['40%', '70%'],
        avoidLabelOverlap: false, itemStyle: { borderRadius: 10, borderColor: 'var(--bg-card)', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: '20', fontWeight: 'bold', color: 'var(--text-primary)' } },
        labelLine: { show: false }, data: pieData
      }]
    };
  };

  const getBarChartOption = () => {
    const windData = [];
    const rainData = [];
    const cities = Object.keys(dataMap);
    cities.forEach(city => {
      const maxWind = Math.max(...dataMap[city].map(d => d.wind_speed));
      const maxRain = Math.max(...dataMap[city].map(d => d.rain));
      windData.push(maxWind.toFixed(1));
      rainData.push((maxRain * 10).toFixed(2));
    });
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-color)', textStyle: { color: 'var(--text-primary)' } },
      legend: { textStyle: { color: 'var(--text-secondary)' }, top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: cities, axisLabel: { color: 'var(--text-secondary)', interval: 0, rotate: 30 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: 'var(--border-color)' } }, axisLabel: { color: 'var(--text-secondary)' } },
      series: [
        { name: 'Viento Máx (km/h)', type: 'bar', stack: 'total', barWidth: '60%', data: windData },
        { name: 'Lluvia Máx (escala visual)', type: 'bar', stack: 'total', barWidth: '60%', data: rainData }
      ]
    };
  };

  return (
    <div className="bi-dashboard-container">
      <div className="bi-header">
        <div className="bi-header-titles">
          <h1>Dashboard Analítico Global</h1>
          <p>Comparativa macroeconómica de variables meteorológicas</p>
          {loading && <span style={{ color: 'var(--accent)', fontSize: '14px', marginLeft: '10px' }}>Sincronizando...</span>}
        </div>
        <div className="bi-export-actions">
          <button className="rep-export-btn rep-export-pdf" onClick={() => handleExport('pdf')} disabled={loading}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            Descargar PDF
          </button>
          <button className="rep-export-btn rep-export-xl" onClick={() => handleExport('excel')} disabled={loading}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" /></svg>
            Exportar Excel
          </button>
        </div>
      </div>

      <div className="bi-filter-panel">
        <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)' }}>Filtro de Localidades</h4>
        <div className="bi-city-tags">
          {CIUDADES_BOLIVIA.map(city => {
            const isSelected = selectedCities.includes(city.nombre);
            return (
              <span 
                key={city.nombre} 
                className={`bi-city-tag ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleCity(city.nombre)}
              >
                {city.nombre}
              </span>
            );
          })}
        </div>
      </div>

      {Object.keys(dataMap).length > 0 && (
        <div className="bi-charts-grid">
          <div className="bi-chart-card" style={{ gridColumn: 'span 2' }}>
            <div className="bi-chart-header"><span className="bi-chart-title">Evolución Térmica Comparativa (°C)</span></div>
            <ReactECharts option={getLineChartOption()} style={{ height: '300px' }} theme="dark" />
          </div>
          <div className="bi-chart-card">
            <div className="bi-chart-header"><span className="bi-chart-title">Distribución de Calor Promedio</span></div>
            <ReactECharts option={getPieChartOption()} style={{ height: '300px' }} theme="dark" />
          </div>
          <div className="bi-chart-card">
            <div className="bi-chart-header"><span className="bi-chart-title">Extremos de Viento y Lluvia</span></div>
            <ReactECharts option={getBarChartOption()} style={{ height: '300px' }} theme="dark" />
          </div>
        </div>
      )}

      <div className="bi-data-table-container">
        <div className="bi-table-header">
          <h3 className="bi-table-title">Matriz de Datos Consolidados</h3>
        </div>
        <div className="bi-table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table className="bi-professional-table">
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th>Región / Ciudad</th>
                <th>Fecha</th>
                <th>Hora Local</th>
                <th>Temp (°C)</th>
                <th>Lluvia (mm/h)</th>
                <th>Viento (km/h)</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, idx) => (
                <tr key={idx}>
                  <td className="bi-td-highlight">{row.city}</td>
                  <td style={{ color: 'var(--text-primary)' }}>{row.dateLabel}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{row.timeLabel}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{row.t.toFixed(2)}</td>
                  <td style={{ color: 'var(--color-water)' }}>{row.r.toFixed(3)}</td>
                  <td style={{ color: 'var(--color-air)' }}>{row.w.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TabSimulador() {
  const [selectedCityIdx, setSelectedCityIdx] = useState(0);
  const [selectedVariable, setSelectedVariable] = useState('temperatura');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [simulatedData, setSimulatedData] = useState(null);
  const { addToast } = useToast();
  
  const selectedCity = CIUDADES_BOLIVIA[selectedCityIdx];
  const { dataMap, loading } = useMultiForecastData([selectedCity]);
  const forecastData = dataMap[selectedCity.nombre] || [];

  const timeLabels = forecastData.map(d => 
    new Date(d.forecast_time).toLocaleDateString([], { weekday: 'short', hour: '2-digit' })
  );

  const requestAiAnalysis = async () => {
    if (forecastData.length === 0) return;
    setIsAnalyzing(true);
    setAiAnalysis(null);
    try {
      const sampleData = forecastData.filter((_, idx) => idx % 2 === 0).map(d => {
        let val = 0;
        if (selectedVariable === 'temperatura') val = d.temperatura.toFixed(1);
        if (selectedVariable === 'rain') val = d.rain.toFixed(2);
        if (selectedVariable === 'wind_speed') val = d.wind_speed.toFixed(1);
        if (selectedVariable === 'vis') val = d.vis.toFixed(0);
        return {
          timeLabel: new Date(d.forecast_time).toLocaleDateString([], { weekday: 'short', hour: '2-digit' }),
          value: val
        };
      });

      const response = await httpClient.post('/reportes/ia', {
        ciudad: selectedCity.nombre,
        variable: selectedVariable,
        datos: sampleData
      });

      const { data } = response.data;
      setAiAnalysis(data.recomendacion);
    } catch (err) {
      addToast('Error al obtener análisis de DeepSeek', 'error');
      setAiAnalysis('No se pudo conectar con el motor de IA. Verifique su API Key en el backend.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSimuladorChartOption = () => {
    let seriesData = [];
    let name = 'Valor';

    if (selectedVariable === 'temperatura') {
      seriesData = forecastData.map(d => d.temperatura);
      name = 'Temperatura (°C)';
    } else if (selectedVariable === 'rain') {
      seriesData = forecastData.map(d => d.rain);
      name = 'Precipitación (mm/h)';
    } else if (selectedVariable === 'wind_speed') {
      seriesData = forecastData.map(d => d.wind_speed);
      name = 'Viento (km/h)';
    } else if (selectedVariable === 'vis') {
      seriesData = forecastData.map(d => d.vis);
      name = 'Visibilidad (m)';
    }

    const minVal = Math.min(...seriesData);
    const maxVal = Math.max(...seriesData);
    const avgVal = (seriesData.reduce((a, b) => a + b, 0) / (seriesData.length || 1)).toFixed(1);

    const seriesArray = [
      {
        name, type: 'line', data: seriesData,
        symbol: 'diamond', symbolSize: 10,
        itemStyle: { color: 'var(--accent)', borderColor: 'var(--accent)', borderWidth: 1 }, 
        lineStyle: { color: 'var(--accent)', width: 4 }
      }
    ];

    if (simulatedData) {
      const simSeries = forecastData.map(d => {
        const isoStr = new Date(d.forecast_time).toISOString();
        return simulatedData[isoStr] !== undefined ? simulatedData[isoStr] : null;
      });
      seriesArray.push({
        name: 'Proyección IA (Meteoro)', type: 'line', data: simSeries,
        symbol: 'circle', symbolSize: 8,
        itemStyle: { color: '#8b5cf6' },
        lineStyle: { color: '#8b5cf6', width: 3, type: 'dashed' },
        connectNulls: true
      });
    }

    return {
      backgroundColor: 'transparent',
      title: {
        text: name.toUpperCase(),
        left: 'center',
        top: 10,
        textStyle: { color: 'var(--text-primary)', fontSize: 20, fontWeight: 'bold' }
      },
      tooltip: { trigger: 'axis', backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-color)', textStyle: { color: 'var(--text-primary)' } },
      grid: { left: '5%', right: '5%', bottom: '10%', top: '20%', containLabel: true },
      xAxis: { 
        type: 'category', boundaryGap: false, data: timeLabels, 
        axisLabel: { color: 'var(--text-secondary)', rotate: 45, fontSize: 11 },
        axisLine: { lineStyle: { color: 'var(--border-color)' } }
      },
      yAxis: { 
        type: 'value', 
        splitLine: { lineStyle: { color: 'var(--border-color)' } }, 
        axisLabel: { color: 'var(--text-secondary)' },
        min: function (value) { return Math.floor(value.min - (value.max - value.min) * 0.1); },
        max: function (value) { return Math.ceil(value.max + (value.max - value.min) * 0.1); }
      },
      dataZoom: [{ type: 'inside', start: 0, end: 100 }],
      series: seriesArray
    };
  };

  return (
    <div className="bi-dashboard-container">
      <div className="bi-header" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
        <div className="bi-header-titles">
          <h1>Simulador de Predicciones a 96h</h1>
          <p>Análisis extendido y soporte de decisiones IA para 4 días</p>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="rep-select" value={selectedCityIdx} onChange={(e) => setSelectedCityIdx(Number(e.target.value))}>
            {CIUDADES_BOLIVIA.map((city, idx) => <option key={city.nombre} value={idx}>{city.nombre}</option>)}
          </select>

          <div className="google-weather-tabs">
            <button className={`gwt-btn ${selectedVariable === 'temperatura' ? 'active' : ''}`} onClick={() => setSelectedVariable('temperatura')}>Temperatura</button>
            <button className={`gwt-btn ${selectedVariable === 'rain' ? 'active' : ''}`} onClick={() => setSelectedVariable('rain')}>Precipitaciones</button>
            <button className={`gwt-btn ${selectedVariable === 'wind_speed' ? 'active' : ''}`} onClick={() => setSelectedVariable('wind_speed')}>Viento</button>
            <button className={`gwt-btn ${selectedVariable === 'vis' ? 'active' : ''}`} onClick={() => setSelectedVariable('vis')}>Visibilidad</button>
          </div>

          <button 
            onClick={requestAiAnalysis} 
            disabled={isAnalyzing || loading || forecastData.length === 0}
            className="rep-rango-btn"
            style={{ border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', color: '#fff' }}
          >
            {isAnalyzing ? 'Analizando con DeepSeek...' : '✨ Solicitar Análisis IA'}
          </button>
        </div>
      </div>

      <div className="bi-chart-card" style={{ minHeight: '400px' }}>
        <div className="bi-chart-header">
          <span className="bi-chart-title">Proyección Meteorológica Profesional</span>
          {loading && <span style={{ color: 'var(--accent)', fontSize: '14px', fontWeight: 'bold' }}>Cargando 96 horas...</span>}
        </div>
        {forecastData.length > 0 && (
          <div style={{ background: 'var(--bg-panel)', borderRadius: '8px', padding: '10px', marginTop: '10px', border: '1px solid var(--border-color)' }}>
            <ReactECharts option={getSimuladorChartOption()} style={{ height: '400px' }} theme="dark" />
          </div>
        )}
      </div>

      <MeteoroAssistant 
        cityContext={selectedCity.nombre}
        dataContext={forecastData}
        onSimulatedData={setSimulatedData}
        globalMode={false}
      />
    </div>
  );
}

function TabHistorial() {
  const { addToast } = useToast()
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [ciudadFiltro, setCiudadFiltro] = useState('')
  const [ciudadFiltro2, setCiudadFiltro2] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [metricaGrafico, setMetricaGrafico] = useState('temperatura')
  const [page, setPage] = useState(1)
  const { unidades } = useUnidades()

  // --- Zona sim context: auto-refresh cuando termina una simulación ---
  const { zonaSimActiva, zonaSimSesionId } = useZonaSim()
  const prevActivaRef = useRef(zonaSimActiva)

  const fetchHistorial = useCallback(() => {
    console.log('🔄 [Reportes] Solicitando historial fresco al servidor...');
    setLoading(true)
    httpClient.get('/historial', { 
      cacheTTL: false,
      params: { _t: Date.now() }, // Cache buster absoluto
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
      .then(res => res.data.data)
      .then(data => {
        const flat = []
        data.forEach(t => {
          t.cities.forEach(c => {
            flat.push({
              fecha: t.timestamp,
              ciudad: c.name,
              temperatura: c.data.temperatura,
              aqi: c.data.aqi,
              humedad: c.data.humedad,
              ruido: c.data.ruido,
              ica: c.data.ica,
            })
          })
        })
        console.log(`✅ [Reportes] Historial cargado. Total ciudades en historial:`, new Set(flat.map(x => x.ciudad)).size);
        setHistorial(flat.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)))
      })
      .catch((err) => {
        console.error('❌ [Reportes] Error cargando historial:', err);
        addToast('Error cargando historial', 'error');
      })
      .finally(() => setLoading(false))
  }, [addToast])

  // Carga inicial al montar el componente
  useEffect(() => { fetchHistorial() }, [fetchHistorial])

  // Auto-refresh cuando una simulación de zona termina (activa pasa de true→false)
  useEffect(() => {
    if (prevActivaRef.current === true && zonaSimActiva === false) {
      // Pequeño delay para que la BD termine de escribir
      const timer = setTimeout(() => {
        fetchHistorial()
        addToast('Datos de simulación actualizados', 'success')
      }, 1500)
      return () => clearTimeout(timer)
    }
    prevActivaRef.current = zonaSimActiva
  }, [zonaSimActiva, fetchHistorial, addToast])

  const ciudadesDisponibles = useMemo(() => {
    const s = new Set(CIUDADES)
    historial.forEach(d => s.add(d.ciudad))
    return Array.from(s).sort((a, b) => formatCityName(a).localeCompare(formatCityName(b)))
  }, [historial])

  const aplicarRango = dias => {
    if (dias === null) {
      setFechaInicio('')
      setFechaFin('')
    } else {
      const now = new Date()
      const from = new Date(now)
      from.setDate(from.getDate() - dias)
      setFechaInicio(from.toISOString().split('T')[0])
      setFechaFin(now.toISOString().split('T')[0])
    }
    setPage(1)
  }

  const datosFiltrados = useMemo(() =>
    historial.filter(row => {
      const esSimulacion = row.ciudad.startsWith('Zona Sim.');
      const esSimulacionSeleccionada = esSimulacion && (row.ciudad === ciudadFiltro || row.ciudad === ciudadFiltro2);

      if (ciudadFiltro || ciudadFiltro2) {
        if (row.ciudad !== ciudadFiltro && row.ciudad !== ciudadFiltro2) return false
      }
      if (!esSimulacionSeleccionada) {
        if (fechaInicio && new Date(row.fecha) < new Date(fechaInicio)) return false
        if (fechaFin && new Date(row.fecha) > new Date(fechaFin + 'T23:59:59')) return false
      }
      return true
    }),
    [historial, ciudadFiltro, ciudadFiltro2, fechaInicio, fechaFin]
  )

  const metricaActual = METRICAS_OPTS.find(m => m.value === metricaGrafico) ?? METRICAS_OPTS[0]

  const seriesLinea = useMemo(() => {
    const s = []
    if (ciudadFiltro) {
      s.push({
        name: formatCityName(ciudadFiltro),
        datos: datosFiltrados.filter(d => d.ciudad === ciudadFiltro),
        colorVar: metricaActual.color
      })
    }
    if (ciudadFiltro2) {
      s.push({
        name: formatCityName(ciudadFiltro2),
        datos: datosFiltrados.filter(d => d.ciudad === ciudadFiltro2),
        colorVar: metricaActual.color === 'river' ? 'moss' : 'river'
      })
    }
    if (s.length === 0) {
      const byTime = {}
      datosFiltrados.forEach(d => {
        if (!byTime[d.fecha]) byTime[d.fecha] = { fecha: d.fecha, _n: 0, v: 0 }
        const t = byTime[d.fecha]
        if (d[metricaGrafico] != null && !isNaN(d[metricaGrafico])) {
          t.v += d[metricaGrafico]
          t._n++
        }
      })
      const prom = Object.values(byTime)
        .map(t => ({ fecha: t.fecha, [metricaGrafico]: t._n ? t.v / t._n : null }))
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      s.push({ name: 'Promedio general', datos: prom, colorVar: metricaActual.color })
    }
    return s
  }, [datosFiltrados, ciudadFiltro, ciudadFiltro2, metricaActual, metricaGrafico])

  const stats = useMemo(() => ({
    temperatura: calcStats(datosFiltrados, 'temperatura'),
    aqi: calcStats(datosFiltrados, 'aqi'),
    humedad: calcStats(datosFiltrados, 'humedad'),
    ruido: calcStats(datosFiltrados, 'ruido'),
  }), [datosFiltrados])

  const totalPaginas = Math.ceil(datosFiltrados.length / PAGE_SIZE)
  const datosPagina = datosFiltrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const descargarReporte = async formato => {
    const getReportFilename = (c1, c2) => {
      const cleanName = (name) => {
        if (!name) return '';
        let clean = name.replace(/Zona Sim\.\s*/i, '');
        clean = clean.replace(/\d+/g, '').trim();
        clean = clean.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z\s]/g, '')
          .trim();
        const hasDept = clean.includes('department') || clean.includes('departamento');
        if (hasDept) {
          clean = clean.replace(/department|departamento/g, '').trim();
          clean = clean.replace(/\s+/g, '_');
          return `department_${clean}`;
        }
        return clean.replace(/\s+/g, '_');
      };

      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const dateStr = `${dd}${mm}${yyyy}`;

      if (c1 && c2) {
        return `${cleanName(c1)}_${cleanName(c2)}_${dateStr}`;
      } else if (c1) {
        return `${cleanName(c1)}_${dateStr}`;
      } else {
        return `reporte_ambiental_${dateStr}`;
      }
    };

    try {
      const payload = {
        formato,
        titulo: `Reporte Ambiental${ciudadFiltro ? (ciudadFiltro2 ? ` — ${formatCityName(ciudadFiltro)} vs ${formatCityName(ciudadFiltro2)}` : ` — ${formatCityName(ciudadFiltro)}`) : ' — Todas las ciudades'}`,
        columnas: [
          { header: 'Fecha y Hora', key: 'fechaFmt' },
          { header: 'Ciudad', key: 'ciudad' },
          { header: 'Temp (°C)', key: 'temperaturaFmt' },
          { header: 'AQI', key: 'aqiFmt' },
          { header: 'Humedad (%)', key: 'humedadFmt' },
          { header: 'Ruido (dB)', key: 'ruidoFmt' },
          { header: 'ICA', key: 'icaFmt' },
        ],
        datos: datosFiltrados.map(d => ({
          fechaFmt: formatDateTime(d.fecha),
          ciudad: formatCityName(d.ciudad),
          temperaturaFmt: formatearValor('temperatura', d.temperatura, unidades.temperatura),
          aqiFmt: formatearValor('aqi', d.aqi, unidades.aqi),
          humedadFmt: formatearValor('humedad', d.humedad, unidades.humedad),
          ruidoFmt: formatearValor('ruido', d.ruido, unidades.ruido),
          icaFmt: d.ica != null ? `${Number(d.ica).toFixed(0)} ICA` : '—',
        })),
      }

      const res = await httpClient.post('/reportes/generar', payload, { responseType: 'blob' })
      const blob = res.data
      const url = URL.createObjectURL(blob)
      const filename = `${getReportFilename(ciudadFiltro, ciudadFiltro2)}.${formato === 'excel' ? 'xlsx' : 'pdf'}`

      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: filename,
      })
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  return (
    <div className="bi-dashboard-container" style={{ marginTop: '20px' }}>
      {/* KPI Cards */}
      <div className="rep-kpi-grid">
        <KpiCard label="Temperatura" sufijo="°C" colorVar="violet" icon="🌡" stats={stats.temperatura} />
        <KpiCard label="Calidad del Aire" sufijo=" AQI" colorVar="rust" icon="🌫" stats={stats.aqi} />
        <KpiCard label="Humedad" sufijo="%" colorVar="river" icon="💧" stats={stats.humedad} />
        <KpiCard label="Ruido" sufijo=" dB" colorVar="amber" icon="🔊" stats={stats.ruido} />
      </div>

      {/* Filtros */}
      <div className="rep-filtros" style={{ background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '20px' }}>
        <div className="rep-filtros-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end' }}>
          <label className="rep-label" style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>
            Localidad
            <select
              className="rep-select"
              value={ciudadFiltro}
              onChange={e => {
                setCiudadFiltro(e.target.value)
                if (!e.target.value) setCiudadFiltro2('')
                setPage(1)
              }}
              style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px', minWidth: '180px' }}
            >
              <option value="">Todas las ciudades</option>
              {ciudadesDisponibles.map(c => <option key={c} value={c}>{formatCityName(c)}</option>)}
            </select>
          </label>

          {ciudadFiltro && (
            <label className="rep-label" style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px', animation: 'fadeIn 0.2s' }}>
              Comparar con
              <select
                className="rep-select"
                value={ciudadFiltro2}
                onChange={e => { setCiudadFiltro2(e.target.value); setPage(1) }}
                style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px', minWidth: '180px' }}
              >
                <option value="">Ninguna</option>
                {ciudadesDisponibles.map(c => (c !== ciudadFiltro) && <option key={c} value={c}>{formatCityName(c)}</option>)}
              </select>
            </label>
          )}

          <label className="rep-label" style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>
            Desde
            <input
              type="date" className="rep-input" value={fechaInicio}
              onChange={e => { setFechaInicio(e.target.value); setPage(1) }}
              style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px' }}
            />
          </label>

          <label className="rep-label" style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>
            Hasta
            <input
              type="date" className="rep-input" value={fechaFin}
              onChange={e => { setFechaFin(e.target.value); setPage(1) }}
              style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px' }}
            />
          </label>

          <div className="rep-rangos" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span className="rep-rangos-label" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Rango rápido</span>
            <div className="rep-rangos-btns" style={{ display: 'flex', gap: '8px' }}>
              {RANGOS.map(r => (
                <button key={r.label} className="rep-rango-btn" onClick={() => aplicarRango(r.dias)} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rep-actions" style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
            <button className="rep-export-btn rep-export-pdf" onClick={() => descargarReporte('pdf')} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              PDF
            </button>
            <button className="rep-export-btn rep-export-xl" onClick={() => descargarReporte('excel')} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M3 15h18M9 3v18" />
              </svg>
              Excel
            </button>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="rep-charts" style={{ marginTop: '30px' }}>
        <div className="rep-chart-tabs" style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>
          {METRICAS_OPTS.map(m => (
            <button
              key={m.value}
              className={`rep-chart-tab ${metricaGrafico === m.value ? 'active' : ''}`}
              style={{
                background: metricaGrafico === m.value ? `var(--${m.color}-soft)` : 'transparent',
                color: metricaGrafico === m.value ? `var(--${m.color})` : 'var(--text-secondary)',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
              onClick={() => setMetricaGrafico(m.value)}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        <div className="rep-charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="rep-chart-card" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '12px' }}>
            <div className="rep-chart-title" style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>
              Evolución temporal
              <span className="rep-chart-sub" style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {ciudadFiltro ? (ciudadFiltro2 ? `${formatCityName(ciudadFiltro)} vs ${formatCityName(ciudadFiltro2)}` : formatCityName(ciudadFiltro)) : 'promedio · todas las ciudades'}
              </span>
            </div>
            {loading
              ? <div className="rep-chart-empty" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Cargando…</div>
              : <LineChart series={seriesLinea} metrica={metricaGrafico} />
            }
          </div>

          <div className="rep-chart-card" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '12px' }}>
            <div className="rep-chart-title" style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>
              Promedio por ciudad
              <span className="rep-chart-sub" style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{metricaActual.label}</span>
            </div>
            {loading
              ? <div className="rep-chart-empty" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Cargando…</div>
              : <BarChart datos={datosFiltrados} metrica={metricaGrafico} colorVar={metricaActual.color} />
            }
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="rep-tabla-wrap" style={{ marginTop: '30px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
        {loading ? (
          <div className="rep-estado" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando historial de datos…</div>
        ) : datosFiltrados.length === 0 ? (
          <div className="rep-estado" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No hay registros para los filtros seleccionados.</div>
        ) : (
          <table className="rep-tabla" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>Fecha / Hora</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>Ciudad</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>Temperatura</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>AQI</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>Humedad</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>Ruido</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>ICA</th>
              </tr>
            </thead>
            <tbody>
              {datosPagina.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td className="rep-td-fecha" style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    {formatDateTime(row.fecha)}
                  </td>
                  <td className="rep-td-ciudad" style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{formatCityName(row.ciudad)}</td>
                  <td className="rep-td-valor" style={{ padding: '12px 16px', color: 'var(--accent)' }}>{formatearValor('temperatura', row.temperatura, unidades.temperatura)}</td>
                  <td className="rep-td-valor" style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>{formatearValor('aqi', row.aqi, unidades.aqi)}</td>
                  <td className="rep-td-valor" style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>{formatearValor('humedad', row.humedad, unidades.humedad)}</td>
                  <td className="rep-td-valor" style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>{formatearValor('ruido', row.ruido, unidades.ruido)}</td>
                  <td className="rep-td-valor" style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    {row.ica != null ? `${Number(row.ica).toFixed(0)} ICA` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="rep-paginacion" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginTop: '20px' }}>
          <button className="rep-pag-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
            ← Anterior
          </button>
          <span className="rep-pag-info" style={{ color: 'var(--text-secondary)' }}>Página {page} de {totalPaginas}</span>
          <button className="rep-pag-btn" disabled={page >= totalPaginas} onClick={() => setPage(p => p + 1)} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
            Siguiente →
          </button>
        </div>
      )}

      <p className="rep-nota" style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '15px' }}>
        Mostrando {datosPagina.length} de {datosFiltrados.length} registros
        · El archivo exportado incluye todos los registros filtrados.
      </p>
    </div>
  )
}

export default function Reportes() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { zonaSimActiva } = useZonaSim();

  return (
    <div className="page reportes-page w-full max-w-7xl mx-auto p-6 md:p-10">
      {/* ─── Header de Partner ─────────────────────────────────────────── */}
      <div className="page-header mb-8">
        <div>
          <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2">Reportes <span className="text-[var(--accent)]">Ambientales</span></h1>
          <p className="text-base text-[var(--text-secondary)] mb-8">
            Explora el historial de lecturas por localidad, visualiza tendencias estadísticas y utiliza nuestra IA predictiva.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {zonaSimActiva && (
            <span className="page-tag" style={{ background: 'rgba(251, 146, 60, 0.15)', color: '#fb923c', borderColor: 'rgba(251, 146, 60, 0.3)' }}>
              <svg width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{marginRight: '6px', display: 'inline-block', animation: 'spin 2s linear infinite'}}><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg> Simulación en curso…
            </span>
          )}
        </div>
      </div>

      {/* TABS NAVIGATION ADAPTADO */}
      <div className="bi-tabs-nav">
        <button 
          className={`bi-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard Global
        </button>
        <button 
          className={`bi-tab-btn ${activeTab === 'simulador' ? 'active' : ''}`}
          onClick={() => setActiveTab('simulador')}
        >
          🔮 Simulador 96h e IA
        </button>
        <button 
          className={`bi-tab-btn ${activeTab === 'historial' ? 'active' : ''}`}
          onClick={() => setActiveTab('historial')}
        >
          📈 Historial y Simulaciones
        </button>
      </div>

      {/* TABS CONTENT */}
      {activeTab === 'dashboard' && <TabDashboard />}
      {activeTab === 'simulador' && <TabSimulador />}
      {activeTab === 'historial' && <TabHistorial />}
    </div>
  );
}
