import { useState, useEffect, useMemo, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'
import { useUnidades } from '../../hooks/useUnidades'
import { formatearValor } from '../../utils/unidades'
import { useToast } from '../../components/Toast/Toast'
import { formatDateTime, formatCityName } from '../../utils/formatters'
import httpClient from '../../config/httpClient'
import LineChart from './LineChart'
import BarChart from './BarChart'
import KpiCard from './KpiCard'
import { CIUDADES, METRICAS_OPTS, RANGOS, PAGE_SIZE, calcStats } from './constants'
import './Reportes.css'
import '../PagePlaceholder.css'

// Mapeo determinista de nombres de ciudades a IDs de BD (acorde con seeds de DB)
const CIUDAD_IDS = {
  'la paz': 1,
  'cochabamba': 2,
  'santa cruz': 3,
  'oruro': 4,
  'potosi': 5,
  'potosí': 5,
  'sucre': 6,
  'tarija': 7,
  'trinidad': 8,
  'cobija': 9
};

const PREDICTIVE_METRICS = [
  { value: 'temperatura', label: 'Temperatura', unit: '°C' },
  { value: 'humedad', label: 'Humedad', unit: '%' },
  { value: 'aqi', label: 'Calidad del Aire (AQI)', unit: 'AQI' },
  { value: 'precipitacion', label: 'Lluvia (Precipitación)', unit: 'mm/h' },
  { value: 'viento', label: 'Velocidad del Viento', unit: 'km/h' }
];

// ─── Custom Markdown Parser Helpers ───
const replaceBold = (text) => {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-semibold text-white">{part}</strong> : part);
};

const parseMarkdownLine = (line, idx) => {
  if (!line.trim()) return <br key={idx} />;

  // Headers
  if (line.startsWith('# ')) {
    return <h2 key={idx} className="rep-md-h1 text-xl font-bold mt-4 mb-2 text-white border-b border-gray-700 pb-1">{line.slice(2)}</h2>;
  }
  if (line.startsWith('## ')) {
    return <h3 key={idx} className="rep-md-h2 text-lg font-bold mt-3 mb-2 text-teal-400">{line.slice(3)}</h3>;
  }
  if (line.startsWith('### ')) {
    return <h4 key={idx} className="rep-md-h3 text-md font-semibold mt-2 mb-1 text-orange-400">{line.slice(4)}</h4>;
  }
  if (line.startsWith('---')) {
    return <hr key={idx} className="my-4 border-gray-700" />;
  }

  // Bullets
  if (line.startsWith('- ') || line.startsWith('* ')) {
    const content = line.slice(2);
    return <li key={idx} className="ml-4 list-disc text-gray-300 my-1">{replaceBold(content)}</li>;
  }

  // Numbered lists
  if (/^\d+\.\s/.test(line)) {
    const match = line.match(/^(\d+\.\s)(.*)/);
    return (
      <div key={idx} className="pl-2 my-2 text-gray-300 font-medium">
        <span className="text-teal-400 font-bold">{match[1]}</span>
        <span>{replaceBold(match[2])}</span>
      </div>
    );
  }

  return <p key={idx} className="text-gray-300 my-2 leading-relaxed text-sm">{replaceBold(line)}</p>;
};

export default function Reportes() {
  const { addToast } = useToast()
  const { unidades } = useUnidades()

  // ─── Control de Pestañas principales ───
  const [activeTab, setActiveTab] = useState('predictivos') // 'predictivos' | 'historico'

  // ─── Estados del Módulo Predictivo ───
  const [predictCity, setPredictCity] = useState('La Paz')
  const [predictHours, setPredictHours] = useState(48)
  const [predictiveLoading, setPredictiveLoading] = useState(false)
  const [arimaMetric, setArimaMetric] = useState('temperatura')
  const [whatIfMetric, setWhatIfMetric] = useState('aqi')
  const [localidadesList, setLocalidadesList] = useState([])

  // Datos de predicción devueltos por FastAPI
  const [arimaData, setArimaData] = useState(null)
  const [correlationData, setCorrelationData] = useState(null)
  const [scenarioData, setScenarioData] = useState(null)
  const [reportData, setReportData] = useState(null)

  // ─── Estados del Módulo Histórico (Existente) ───
  const [historial, setHistorial] = useState([])
  const [loadingHistorial, setLoadingHistorial] = useState(true)
  const [ciudadFiltro, setCiudadFiltro] = useState('')
  const [ciudadFiltro2, setCiudadFiltro2] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [metricaGrafico, setMetricaGrafico] = useState('temperatura')
  const [page, setPage] = useState(1)

  // Cargar lista de localidades desde el backend
  useEffect(() => {
    httpClient.get('/geografia/localidades')
      .then(res => {
        if (res.data && res.data.data) {
          const sorted = [...res.data.data].sort((a, b) => a.nombre.localeCompare(b.nombre));
          setLocalidadesList(sorted);
          if (sorted.length > 0) {
            const hasLaPaz = sorted.some(loc => loc.nombre.toLowerCase() === 'la paz');
            if (!hasLaPaz) {
              setPredictCity(sorted[0].nombre);
            }
          }
        }
      })
      .catch(err => {
        console.error('Error cargando localidades:', err);
      });
  }, []);

  const cityId = useMemo(() => {
    const found = localidadesList.find(loc => loc.nombre.toLowerCase() === predictCity.toLowerCase());
    return found ? found.id : (CIUDAD_IDS[predictCity.toLowerCase()] || 1);
  }, [predictCity, localidadesList]);

  const dropdownCities = useMemo(() => {
    return localidadesList.length > 0 ? localidadesList.map(loc => loc.nombre) : CIUDADES;
  }, [localidadesList]);

  // ─── Cargar Datos Predictivos ───
  const fetchPredictiveData = useCallback(async () => {
    setPredictiveLoading(true);
    try {
      // 1. Obtener Reporte Completo y Recomendaciones
      const reportRes = await httpClient.post('/predictions/report', {
        localidad_id: cityId,
        horas_prediccion: Number(predictHours)
      });
      setReportData(reportRes.data.data);

      // 2. Obtener Matriz de Correlaciones
      const corrRes = await httpClient.post('/predictions/correlations', {
        localidad_id: cityId
      });
      setCorrelationData(corrRes.data.data);

      // 3. Obtener Tendencia ARIMA para la métrica activa
      const arimaRes = await httpClient.post('/predictions/trend', {
        localidad_id: cityId,
        metrica_clave: arimaMetric,
        horas_prediccion: Number(predictHours)
      });
      setArimaData(arimaRes.data.data);

      // 4. Obtener Escenarios What-If
      const scenarioRes = await httpClient.post('/predictions/scenario', {
        localidad_id: cityId,
        metrica_clave: whatIfMetric,
        horas_prediccion: Number(predictHours)
      });
      setScenarioData(scenarioRes.data.data);

    } catch (err) {
      console.error('Error cargando reportes predictivos:', err);
      addToast('Error al conectar con el servicio de predicciones', 'error');
    } finally {
      setPredictiveLoading(false);
    }
  }, [cityId, predictHours, arimaMetric, whatIfMetric, addToast]);

  // Recargar predicción ARIMA al cambiar la métrica seleccionada del gráfico
  useEffect(() => {
    if (activeTab === 'predictivos' && cityId) {
      httpClient.post('/predictions/trend', {
        localidad_id: cityId,
        metrica_clave: arimaMetric,
        horas_prediccion: Number(predictHours)
      })
      .then(res => setArimaData(res.data.data))
      .catch(err => console.error(err));
    }
  }, [arimaMetric, cityId, predictHours, activeTab]);

  // Recargar Escenarios What-If al cambiar la métrica de control
  useEffect(() => {
    if (activeTab === 'predictivos' && cityId) {
      httpClient.post('/predictions/scenario', {
        localidad_id: cityId,
        metrica_clave: whatIfMetric,
        horas_prediccion: Number(predictHours)
      })
      .then(res => setScenarioData(res.data.data))
      .catch(err => console.error(err));
    }
  }, [whatIfMetric, cityId, predictHours, activeTab]);

  // Ejecutar carga predictiva inicial
  useEffect(() => {
    if (activeTab === 'predictivos') {
      Promise.resolve().then(() => {
        fetchPredictiveData();
      });
    }
  }, [activeTab, fetchPredictiveData]);

  // ─── Cargar Historial (Módulo Histórico Existente) ───
  const fetchHistorial = useCallback(() => {
    setLoadingHistorial(true)
    httpClient.get('/historial', { 
      cacheTTL: false,
      params: { _t: Date.now() }
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
        setHistorial(flat.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)))
      })
      .catch((err) => {
        console.error('Error cargando historial:', err);
        addToast('Error cargando historial histórico', 'error');
      })
      .finally(() => setLoadingHistorial(false))
  }, [addToast])

  useEffect(() => {
    if (activeTab === 'historico') {
      Promise.resolve().then(() => {
        fetchHistorial();
      });
    }
  }, [activeTab, fetchHistorial]);

  // ─── Lógica de Filtros y Cálculos Históricos ───
  const ciudadesDisponibles = useMemo(() => {
    const s = new Set(dropdownCities)
    historial.forEach(d => s.add(d.ciudad))
    return Array.from(s).sort((a, b) => formatCityName(a).localeCompare(formatCityName(b)))
  }, [historial, dropdownCities])

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
      const filename = `reporte_ambiental_${new Date().toISOString().split('T')[0]}.${formato === 'excel' ? 'xlsx' : 'pdf'}`

      const a = Object.assign(document.createElement('a'), { href: url, download: filename })
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  // ─── ECharts Configuration Option Generators ───

  const getARIMAChartOption = useMemo(() => {
    if (!arimaData) return {};
    const historical = arimaData.historical || [];
    const predictions = arimaData.predictions || [];

    const histSeries = historical.map(h => [new Date(h.tiempo), h.valor]);
    const predSeries = predictions.map(p => [new Date(p.tiempo), p.valor]);
    const ciLowSeries = predictions.map(p => [new Date(p.tiempo), p.valor_min]);
    const ciHighDiffSeries = predictions.map(p => [new Date(p.tiempo), p.valor_max - p.valor_min]);

    const mOpt = PREDICTIVE_METRICS.find(m => m.value === arimaMetric) || PREDICTIVE_METRICS[0];

    return {
      title: { text: `Proyección ARIMA — ${mOpt.label}`, textStyle: { color: '#e2e8f0', fontSize: 14 } },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          let html = '';
          params.forEach(p => {
            const dateStr = new Date(p.value[0]).toLocaleString('es-BO', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            if (p.seriesName === 'Banda de Confianza (95%)') return;
            html = `<b>${dateStr}</b><br/>` + html;
            html += `${p.marker} ${p.seriesName}: <b>${p.value[1].toFixed(2)}${mOpt.unit}</b><br/>`;
          });
          return html;
        }
      },
      legend: {
        data: ['Histórico', 'Predicción ARIMA', 'Intervalo de Confianza (95%)'],
        textStyle: { color: '#94a3b8' },
        top: 25
      },
      grid: { left: '3%', right: '4%', bottom: '5%', top: '22%', containLabel: true },
      xAxis: {
        type: 'time',
        axisLabel: { color: '#94a3b8' },
        axisLine: { lineStyle: { color: '#475569' } },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: mOpt.unit,
        axisLabel: { color: '#94a3b8' },
        axisLine: { lineStyle: { color: '#475569' } },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } }
      },
      series: [
        {
          name: 'Histórico',
          type: 'line',
          data: histSeries,
          showSymbol: false,
          lineStyle: { color: '#38bdf8', width: 2 } // sky-400
        },
        {
          name: 'Predicción ARIMA',
          type: 'line',
          data: predSeries,
          showSymbol: true,
          symbolSize: 6,
          lineStyle: { color: '#fb923c', width: 2.5, type: 'dashed' }, // orange-400
          itemStyle: { color: '#fb923c' }
        },
        {
          name: 'Intervalo de Confianza (95%)',
          type: 'line',
          data: ciLowSeries,
          lineStyle: { opacity: 0 },
          stack: 'confidence-band',
          showSymbol: false
        },
        {
          name: 'Intervalo de Confianza (95%)',
          type: 'line',
          data: ciHighDiffSeries,
          lineStyle: { opacity: 0 },
          stack: 'confidence-band',
          areaStyle: { color: 'rgba(251, 146, 60, 0.12)' }, // shaded confidence interval
          showSymbol: false
        }
      ]
    };
  }, [arimaData, arimaMetric]);

  const getCorrelationChartOption = useMemo(() => {
    if (!correlationData) return {};
    const corrMap = correlationData.correlations || {};
    const metrics = ["temperatura", "humedad", "aqi", "precipitacion", "viento"];
    const labels = ["Temp", "Humedad", "AQI", "Lluvia", "Viento"];

    const data = [];
    metrics.forEach((m1, xIdx) => {
      metrics.forEach((m2, yIdx) => {
        const val = corrMap[m1]?.[m2] ?? 0;
        data.push([xIdx, yIdx, val]);
      });
    });

    return {
      title: { text: 'Matriz de Correlación de Pearson', textStyle: { color: '#e2e8f0', fontSize: 14 } },
      tooltip: {
        position: 'top',
        formatter: (params) => {
          const x = labels[params.data[0]];
          const y = labels[params.data[1]];
          return `${x} vs ${y}: <b>${params.data[2]}</b>`;
        }
      },
      grid: { height: '60%', top: '15%', bottom: '25%' },
      xAxis: {
        type: 'category',
        data: labels,
        splitArea: { show: true },
        axisLabel: { color: '#94a3b8' }
      },
      yAxis: {
        type: 'category',
        data: labels,
        splitArea: { show: true },
        axisLabel: { color: '#94a3b8' }
      },
      visualMap: {
        min: -1,
        max: 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '0%',
        inRange: {
          color: ['#0284c7', '#38bdf8', '#bae6fd', '#f8fafc', '#ffedd5', '#fed7aa', '#f97316', '#dc2626'] // blue (neg) to red (pos)
        },
        textStyle: { color: '#94a3b8', fontSize: 10 }
      },
      series: [{
        name: 'Pearson',
        type: 'heatmap',
        data: data,
        label: {
          show: true,
          formatter: (params) => params.data[2].toFixed(2),
          color: '#1e293b',
          fontWeight: 'bold',
          fontSize: 11
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    };
  }, [correlationData]);

  const getScenarioChartOption = useMemo(() => {
    if (!scenarioData) return {};
    const actual = scenarioData.actual || [];
    const optimista = scenarioData.optimista || [];
    const pesimista = scenarioData.pesimista || [];
    const metric = scenarioData.target_metric;

    const actualVals = actual.map(d => [new Date(d.tiempo), d.valores[metric]]);
    const optVals = optimista.map(d => [new Date(d.tiempo), d.valores[metric]]);
    const pessVals = pesimista.map(d => [new Date(d.tiempo), d.valores[metric]]);

    const mOpt = PREDICTIVE_METRICS.find(m => m.value === metric) || PREDICTIVE_METRICS[0];

    return {
      title: { text: `Comparación de Escenarios: ${mOpt.label}`, textStyle: { color: '#e2e8f0', fontSize: 14 } },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          let html = '';
          params.forEach(p => {
            const dateStr = new Date(p.value[0]).toLocaleString('es-BO', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            html = `<b>${dateStr}</b><br/>` + html;
            html += `${p.marker} ${p.seriesName}: <b>${p.value[1].toFixed(2)}${mOpt.unit}</b><br/>`;
          });
          return html;
        }
      },
      legend: {
        data: ['Escenario Actual', 'Escenario Optimista', 'Escenario Pesimista'],
        textStyle: { color: '#94a3b8' },
        top: 25
      },
      grid: { left: '3%', right: '4%', bottom: '5%', top: '22%', containLabel: true },
      xAxis: {
        type: 'time',
        axisLabel: { color: '#94a3b8' },
        axisLine: { lineStyle: { color: '#475569' } }
      },
      yAxis: {
        type: 'value',
        name: mOpt.unit,
        axisLabel: { color: '#94a3b8' },
        axisLine: { lineStyle: { color: '#475569' } },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } }
      },
      series: [
        { name: 'Escenario Actual', type: 'line', data: actualVals, lineStyle: { color: '#94a3b8', width: 2 } }, // slate
        { name: 'Escenario Optimista', type: 'line', data: optVals, lineStyle: { color: '#10b981', width: 2.5, type: 'dashed' } }, // emerald
        { name: 'Escenario Pesimista', type: 'line', data: pessVals, lineStyle: { color: '#ef4444', width: 2.5, type: 'dashed' } } // red
      ]
    };
  }, [scenarioData]);

  // Obtener medias para las tarjetas del What-if
  const meanValues = useMemo(() => {
    if (!scenarioData) return null;
    const actual = scenarioData.actual || [];
    const opt = scenarioData.optimista || [];
    const pess = scenarioData.pesimista || [];

    const getMean = (list, key) => {
      if (!list.length) return 0;
      const sum = list.reduce((acc, d) => acc + (d.valores[key] || 0), 0);
      return sum / list.length;
    };

    const result = {};
    PREDICTIVE_METRICS.forEach(m => {
      result[m.value] = {
        actual: getMean(actual, m.value),
        optimista: getMean(opt, m.value),
        pesimista: getMean(pess, m.value)
      };
    });
    return result;
  }, [scenarioData]);

  // (Helpers moved to module scope)

  const renderedMarkdown = useMemo(() => {
    if (!reportData?.report_text) return null;
    return reportData.report_text.split('\n').map((line, idx) => parseMarkdownLine(line, idx));
  }, [reportData]);


  return (
    <div className="page reportes-page">
      {/* ─── Header de Página ─── */}
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Módulo Predictivo e Histórico</p>
          <h1 className="page-heading">Reportes y <em>Predicciones</em></h1>
          <p className="page-desc">
            Visualiza tendencias con modelos ARIMA, analiza correlaciones complejas y simula escenarios what-if para la toma de decisiones ambientales inteligentes.
          </p>
        </div>
        
        {/* Selector de Pestañas principales */}
        <div className="tab-navigation">
          <button
            className={`tab-btn ${activeTab === 'predictivos' ? 'active' : ''}`}
            onClick={() => setActiveTab('predictivos')}
          >
            🧠 Reportes Predictivos
          </button>
          <button
            className={`tab-btn ${activeTab === 'historico' ? 'active' : ''}`}
            onClick={() => setActiveTab('historico')}
          >
            📂 Historial de Lecturas
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 🧠 PESTAÑA 1: CONTROL DE REPORTES PREDICTIVOS                             */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'predictivos' && (
        <div className="predictive-tab-content">
          {/* Barra de Filtros Predictivos */}
          <div className="rep-filtros mb-6">
            <div className="rep-filtros-row flex items-center gap-4">
              <label className="rep-label">
                Ciudad
                <select
                  className="rep-select"
                  value={predictCity}
                  onChange={e => setPredictCity(e.target.value)}
                >
                  {dropdownCities.map(c => <option key={c} value={c}>{formatCityName(c)}</option>)}
                </select>
              </label>

              <label className="rep-label">
                Horizonte de Pronóstico
                <select
                  className="rep-select"
                  value={predictHours}
                  onChange={e => setPredictHours(Number(e.target.value))}
                >
                  <option value={24}>24 Horas</option>
                  <option value={48}>48 Horas</option>
                  <option value={72}>72 Horas</option>
                </select>
              </label>

              <button
                className="rep-rango-btn flex items-center gap-2"
                onClick={fetchPredictiveData}
                disabled={predictiveLoading}
                style={{ height: '38px', marginTop: '18px', background: 'var(--primary)', color: 'var(--white)' }}
              >
                {predictiveLoading ? '⏳ Calculando...' : '🧠 Recalcular ARIMA'}
              </button>
            </div>
          </div>

          {predictiveLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="spinner mb-4" style={{ width: '40px', height: '40px', borderWidth: '4px' }}></div>
              <p className="text-gray-400 font-medium">Entrenando modelos ARIMA e interpolando variables...</p>
              <p className="text-gray-500 text-xs mt-1">Esto puede tardar unos segundos debido a la carga computacional.</p>
            </div>
          ) : (
            <div className="grid-predictivo">
              {/* Sección Izquierda: Gráficos de Tendencias ARIMA y Escenarios What-If */}
              <div className="col-chart-panels">
                {/* Panel ARIMA */}
                <div className="rep-chart-card">
                  <div className="chart-header flex justify-between items-center mb-3">
                    <span className="rep-chart-title">Análisis de Tendencias Futuras</span>
                    <select
                      className="metric-chart-select"
                      value={arimaMetric}
                      onChange={e => setArimaMetric(e.target.value)}
                    >
                      {PREDICTIVE_METRICS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="echarts-wrap">
                    {arimaData ? (
                      <ReactECharts option={getARIMAChartOption} theme="dark" style={{ height: '340px' }} notMerge={true} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">Cargando gráfico de tendencias...</div>
                    )}
                  </div>
                </div>

                {/* Panel de Simulación de Escenarios What-If */}
                <div className="rep-chart-card mt-6">
                  <div className="chart-header flex justify-between items-center mb-3">
                    <div>
                      <span className="rep-chart-title">Simulación What-If (Efecto Cascada)</span>
                      <p className="text-xs text-gray-400 mt-1">
                        Ajusta la métrica objetivo para ver la propagación de cambios en base a las correlaciones históricas.
                      </p>
                    </div>
                    <select
                      className="metric-chart-select"
                      value={whatIfMetric}
                      onChange={e => setWhatIfMetric(e.target.value)}
                    >
                      {PREDICTIVE_METRICS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* Tarjeta Optimista */}
                    <div className="scenario-kpi-card opt-card border border-emerald-500/30 bg-emerald-500/5 p-3 rounded-lg">
                      <span className="block text-xs font-semibold text-emerald-400 mb-1">🟢 Escenario Optimista ({scenarioData?.presets?.optimista}%)</span>
                      <div className="space-y-1 text-xs">
                        {meanValues && PREDICTIVE_METRICS.map(m => (
                          <div key={m.value} className="flex justify-between">
                            <span className="text-gray-400">{m.label}:</span>
                            <span className="font-semibold text-emerald-300">{meanValues[m.value].optimista.toFixed(1)}{m.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tarjeta Base */}
                    <div className="scenario-kpi-card base-card border border-slate-500/30 bg-slate-500/5 p-3 rounded-lg">
                      <span className="block text-xs font-semibold text-slate-400 mb-1">⚪ Escenario Proyectado (ARIMA)</span>
                      <div className="space-y-1 text-xs">
                        {meanValues && PREDICTIVE_METRICS.map(m => (
                          <div key={m.value} className="flex justify-between">
                            <span className="text-gray-400">{m.label}:</span>
                            <span className="font-semibold text-slate-300">{meanValues[m.value].actual.toFixed(1)}{m.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tarjeta Pesimista */}
                    <div className="scenario-kpi-card pess-card border border-red-500/30 bg-red-500/5 p-3 rounded-lg">
                      <span className="block text-xs font-semibold text-red-400 mb-1">🔴 Escenario Pesimista (+{scenarioData?.presets?.pesimista}%)</span>
                      <div className="space-y-1 text-xs">
                        {meanValues && PREDICTIVE_METRICS.map(m => (
                          <div key={m.value} className="flex justify-between">
                            <span className="text-gray-400">{m.label}:</span>
                            <span className="font-semibold text-red-300">{meanValues[m.value].pesimista.toFixed(1)}{m.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="echarts-wrap">
                    {scenarioData ? (
                      <ReactECharts option={getScenarioChartOption} theme="dark" style={{ height: '300px' }} notMerge={true} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">Cargando gráfico de simulación...</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sección Derecha: Reporte de Decisiones en Español y Heatmap de Correlaciones */}
              <div className="col-report-panels">
                {/* Contenedor de Reporte en Markdown */}
                <div className="report-markdown-card bg-slate-800/40 backdrop-blur border border-slate-700 p-6 rounded-xl overflow-y-auto max-h-[560px]">
                  {renderedMarkdown ? (
                    <div className="markdown-body text-gray-200">
                      {renderedMarkdown}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-center text-gray-500">
                      <span className="text-3xl mb-2">📄</span>
                      <p>Generando reporte y sugerencias...</p>
                    </div>
                  )}
                </div>

                {/* Heatmap de Correlación */}
                <div className="rep-chart-card mt-6">
                  <div className="echarts-wrap">
                    {correlationData ? (
                      <ReactECharts option={getCorrelationChartOption} theme="dark" style={{ height: '280px' }} notMerge={true} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">Cargando matriz de correlaciones...</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 📂 PESTAÑA 2: HISTORIAL DE LECTURAS (CÓDIGO ORIGINAL CONSERVADO)         */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'historico' && (
        <div className="historical-tab-content">
          {/* KPI Cards */}
          <div className="rep-kpi-grid">
            <KpiCard label="Temperatura" sufijo="°C" colorVar="violet" icon="🌡" stats={stats.temperatura} />
            <KpiCard label="Calidad del Aire" sufijo=" AQI" colorVar="rust" icon="🌫" stats={stats.aqi} />
            <KpiCard label="Humedad" sufijo="%" colorVar="river" icon="💧" stats={stats.humedad} />
            <KpiCard label="Ruido" sufijo=" dB" colorVar="amber" icon="🔊" stats={stats.ruido} />
          </div>

          {/* Filtros Históricos */}
          <div className="rep-filtros">
            <div className="rep-filtros-row">
              <label className="rep-label">
                Localidad
                <select
                  className="rep-select"
                  value={ciudadFiltro}
                  onChange={e => {
                    setCiudadFiltro(e.target.value)
                    if (!e.target.value) setCiudadFiltro2('')
                    setPage(1)
                  }}
                >
                  <option value="">Todas las ciudades</option>
                  {ciudadesDisponibles.map(c => <option key={c} value={c}>{formatCityName(c)}</option>)}
                </select>
              </label>

              {ciudadFiltro && (
                <label className="rep-label" style={{ animation: 'fadeIn 0.2s' }}>
                  Comparar con
                  <select
                    className="rep-select"
                    value={ciudadFiltro2}
                    onChange={e => { setCiudadFiltro2(e.target.value); setPage(1) }}
                  >
                    <option value="">Ninguna</option>
                    {ciudadesDisponibles.map(c => (c !== ciudadFiltro) && <option key={c} value={c}>{formatCityName(c)}</option>)}
                  </select>
                </label>
              )}

              <label className="rep-label">
                Desde
                <input
                  type="date" className="rep-input" value={fechaInicio}
                  onChange={e => { setFechaInicio(e.target.value); setPage(1) }}
                />
              </label>

              <label className="rep-label">
                Hasta
                <input
                  type="date" className="rep-input" value={fechaFin}
                  onChange={e => { setFechaFin(e.target.value); setPage(1) }}
                />
              </label>

              <div className="rep-rangos">
                <span className="rep-rangos-label">Rango rápido</span>
                <div className="rep-rangos-btns">
                  {RANGOS.map(r => (
                    <button key={r.label} className="rep-rango-btn" onClick={() => aplicarRango(r.dias)}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rep-actions">
                <button className="rep-export-btn rep-export-pdf" onClick={() => descargarReporte('pdf')}>
                  PDF
                </button>
                <button className="rep-export-btn rep-export-xl" onClick={() => descargarReporte('excel')}>
                  Excel
                </button>
              </div>
            </div>
          </div>

          {/* Gráficos Históricos */}
          <div className="rep-charts">
            <div className="rep-chart-tabs">
              {METRICAS_OPTS.map(m => (
                <button
                  key={m.value}
                  className={`rep-chart-tab${metricaGrafico === m.value ? ' rep-chart-tab--active' : ''}`}
                  style={metricaGrafico === m.value
                    ? { borderColor: `var(--${m.color})`, color: `var(--${m.color})`, background: `var(--${m.color}-soft)` }
                    : {}}
                  onClick={() => setMetricaGrafico(m.value)}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>

            <div className="rep-charts-grid">
              <div className="rep-chart-card">
                <div className="rep-chart-title">
                  Evolución temporal
                  <span className="rep-chart-sub">
                    {ciudadFiltro ? (ciudadFiltro2 ? `${formatCityName(ciudadFiltro)} vs ${formatCityName(ciudadFiltro2)}` : formatCityName(ciudadFiltro)) : 'promedio · todas las ciudades'}
                  </span>
                </div>
                {loadingHistorial
                  ? <div className="rep-chart-empty">Cargando…</div>
                  : <LineChart series={seriesLinea} metrica={metricaGrafico} />
                }
              </div>

              <div className="rep-chart-card">
                <div className="rep-chart-title">
                  Promedio por ciudad
                  <span className="rep-chart-sub">{metricaActual.label}</span>
                </div>
                {loadingHistorial
                  ? <div className="rep-chart-empty">Cargando…</div>
                  : <BarChart datos={datosFiltrados} metrica={metricaGrafico} colorVar={metricaActual.color} />
                }
              </div>
            </div>
          </div>

          {/* Tabla Histórica */}
          <div className="rep-tabla-wrap">
            {loadingHistorial ? (
              <div className="rep-estado">Cargando historial de datos…</div>
            ) : datosFiltrados.length === 0 ? (
              <div className="rep-estado">No hay registros para los filtros seleccionados.</div>
            ) : (
              <table className="rep-tabla">
                <thead>
                  <tr>
                    <th>Fecha / Hora</th>
                    <th>Ciudad</th>
                    <th>Temperatura</th>
                    <th>AQI</th>
                    <th>Humedad</th>
                    <th>Ruido</th>
                    <th>ICA</th>
                  </tr>
                </thead>
                <tbody>
                  {datosPagina.map((row, i) => (
                    <tr key={i}>
                      <td className="rep-td-fecha">
                        {formatDateTime(row.fecha)}
                      </td>
                      <td className="rep-td-ciudad">{formatCityName(row.ciudad)}</td>
                      <td className="rep-td-valor">{formatearValor('temperatura', row.temperatura, unidades.temperatura)}</td>
                      <td className="rep-td-valor">{formatearValor('aqi', row.aqi, unidades.aqi)}</td>
                      <td className="rep-td-valor">{formatearValor('humedad', row.humedad, unidades.humedad)}</td>
                      <td className="rep-td-valor">{formatearValor('ruido', row.ruido, unidades.ruido)}</td>
                      <td className="rep-td-valor">
                        {row.ica != null ? `${Number(row.ica).toFixed(0)} ICA` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginación Histórica */}
          {totalPaginas > 1 && (
            <div className="rep-paginacion">
              <button className="rep-pag-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                ← Anterior
              </button>
              <span className="rep-pag-info">Página {page} de {totalPaginas}</span>
              <button className="rep-pag-btn" disabled={page >= totalPaginas} onClick={() => setPage(p => p + 1)}>
                Siguiente →
              </button>
            </div>
          )}

          <p className="rep-nota">
            Mostrando {datosPagina.length} de {datosFiltrados.length} registros
            · El archivo exportado incluye todos los registros filtrados.
          </p>
        </div>
      )}
    </div>
  )
}
