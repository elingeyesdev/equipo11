import React, { useState, useMemo } from 'react';
import { useMultiForecastData } from '../../hooks/useMultiForecastData';
import ReactECharts from 'echarts-for-react';
import { useToast } from '../../components/Toast/Toast';
import './Reportes.css';

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
  
  // State for locality filter
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
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/reportes/generar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Error generando reporte');
      const blob = await response.blob();
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
      tooltip: { trigger: 'axis', backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f8fafc' } },
      legend: { textStyle: { color: '#94a3b8' }, type: 'scroll', top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: timeLabels, axisLabel: { color: '#94a3b8' } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { color: '#94a3b8' } },
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
      tooltip: { trigger: 'item', formatter: '{b}: {c}°C ({d}%)', backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f8fafc' } },
      legend: { orient: 'vertical', left: 'left', textStyle: { color: '#94a3b8' }, type: 'scroll' },
      series: [{
        name: 'Temperatura Promedio', type: 'pie', radius: ['40%', '70%'],
        avoidLabelOverlap: false, itemStyle: { borderRadius: 10, borderColor: '#1e293b', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: '20', fontWeight: 'bold', color: '#fff' } },
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
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f8fafc' } },
      legend: { textStyle: { color: '#94a3b8' }, top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: cities, axisLabel: { color: '#94a3b8', interval: 0, rotate: 30 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { color: '#94a3b8' } },
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
          {loading && <span style={{ color: '#f59e0b', fontSize: '14px', marginLeft: '10px' }}>Sincronizando...</span>}
        </div>
        <div className="bi-export-actions">
          <button className="btn-bi-export pdf" onClick={() => handleExport('pdf')} disabled={loading}>Descargar PDF</button>
          <button className="btn-bi-export excel" onClick={() => handleExport('excel')} disabled={loading}>Exportar Excel</button>
        </div>
      </div>

      <div className="bi-filter-panel">
        <h4 style={{ margin: '0 0 10px 0', color: '#f8fafc' }}>Filtro de Localidades</h4>
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
                  <td>{row.dateLabel}</td>
                  <td style={{ color: '#94a3b8' }}>{row.timeLabel}</td>
                  <td style={{ color: '#f59e0b', fontWeight: 'bold' }}>{row.t.toFixed(2)}</td>
                  <td style={{ color: '#3b82f6' }}>{row.r.toFixed(3)}</td>
                  <td style={{ color: '#10b981' }}>{row.w.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import MeteoroAssistant from '../../components/MeteoroAssistant/MeteoroAssistant';

function TabSimulador() {
  const [selectedCityIdx, setSelectedCityIdx] = useState(0);
  const [selectedVariable, setSelectedVariable] = useState('temperatura');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [simulatedData, setSimulatedData] = useState(null); // Para los datos proyectados por Meteoro
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
        itemStyle: { color: '#dd0000', borderColor: '#880000', borderWidth: 1 }, 
        lineStyle: { color: '#dd0000', width: 4 }
      }
    ];

    if (simulatedData) {
      // Map the simulated data to the timeline array
      const simSeries = forecastData.map(d => {
        const isoStr = new Date(d.forecast_time).toISOString();
        return simulatedData[isoStr] !== undefined ? simulatedData[isoStr] : null; // If null, ECharts skips it or connects
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
      backgroundColor: '#ffffff',
      title: {
        text: name.toUpperCase(),
        left: 'center',
        top: 10,
        textStyle: { color: '#000000', fontSize: 24, fontWeight: 'bold' }
      },
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.9)', borderColor: '#ccc', textStyle: { color: '#000' } },
      grid: { left: '5%', right: '5%', bottom: '10%', top: '20%', containLabel: true },
      xAxis: { 
        type: 'category', 
        boundaryGap: false, 
        data: timeLabels, 
        axisLabel: { color: '#000', rotate: 45, fontWeight: 'bold', fontSize: 11 },
        axisLine: { lineStyle: { color: '#000', width: 2 } },
        axisTick: { alignWithLabel: true, lineStyle: { color: '#000' } }
      },
      yAxis: { 
        type: 'value', 
        splitLine: { lineStyle: { color: '#aaaaaa', width: 1 } }, 
        axisLabel: { color: '#000', fontWeight: 'bold', fontSize: 12 },
        axisLine: { show: true, lineStyle: { color: '#000', width: 2 } },
        min: function (value) { return Math.floor(value.min - (value.max - value.min) * 0.1); },
        max: function (value) { return Math.ceil(value.max + (value.max - value.min) * 0.1); }
      },
      dataZoom: [{ type: 'inside', start: 0, end: 100 }],
      graphic: [
        {
          type: 'text', left: '5%', top: '10%',
          style: { text: `MÁX: ${maxVal.toFixed(1)}\nMIN: ${minVal.toFixed(1)}\nPROM: ${avgVal}`, fill: '#000', font: 'bold 12px sans-serif' }
        }
      ],
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
          <select className="bi-select" value={selectedCityIdx} onChange={(e) => setSelectedCityIdx(Number(e.target.value))}>
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
            style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isAnalyzing ? 'Analizando con DeepSeek...' : '✨ Solicitar Análisis IA'}
          </button>
        </div>
      </div>

      <div className="bi-chart-card" style={{ minHeight: '400px', backgroundColor: '#e2e8f0', padding: '10px' }}>
        <div className="bi-chart-header" style={{ borderBottomColor: '#cbd5e1', marginBottom: 0 }}>
          <span className="bi-chart-title" style={{ color: '#0f172a' }}>Proyección Meteorológica Profesional</span>
          {loading && <span style={{ color: '#ea580c', fontSize: '14px', fontWeight: 'bold' }}>Cargando 96 horas...</span>}
        </div>
        {forecastData.length > 0 && (
          <div style={{ background: '#fff', borderRadius: '8px', padding: '10px', marginTop: '10px', border: '1px solid #94a3b8' }}>
            <ReactECharts option={getSimuladorChartOption()} style={{ height: '400px' }} />
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

export default function Reportes() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="bi-dashboard-dark">
      {/* TABS NAVIGATION */}
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
      </div>

      {/* TABS CONTENT */}
      {activeTab === 'dashboard' ? <TabDashboard /> : <TabSimulador />}
    </div>
  );
}
