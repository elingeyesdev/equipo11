import { useState, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import './Simulacion.css'

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

  if (line.startsWith('# ')) {
    return <h2 key={idx} className="rep-md-h1 text-xl font-bold mt-4 mb-2 text-white border-b border-amber-500/30 pb-1">{line.slice(2)}</h2>;
  }
  if (line.startsWith('## ')) {
    return <h3 key={idx} className="rep-md-h2 text-lg font-bold mt-3 mb-2 text-amber-400">{line.slice(3)}</h3>;
  }
  if (line.startsWith('### ')) {
    return <h4 key={idx} className="rep-md-h3 text-md font-semibold mt-2 mb-1 text-orange-400">{line.slice(4)}</h4>;
  }
  if (line.startsWith('---')) {
    return <hr key={idx} className="my-4 border-slate-700" />;
  }

  if (line.startsWith('- ') || line.startsWith('* ')) {
    const content = line.slice(2);
    return <li key={idx} className="ml-4 list-disc text-gray-300 my-1">{replaceBold(content)}</li>;
  }

  if (/^\d+\.\s/.test(line)) {
    const match = line.match(/^(\d+\.\s)(.*)/);
    return (
      <div key={idx} className="pl-2 my-2 text-gray-300 font-medium">
        <span className="text-amber-400 font-bold">{match[1]}</span>
        <span>{replaceBold(match[2])}</span>
      </div>
    );
  }

  return <p key={idx} className="text-gray-300 my-2 leading-relaxed text-sm">{replaceBold(line)}</p>;
};

export default function SimulacionResultados({ simulationData, onBack }) {
  const [arimaMetric, setArimaMetric] = useState('temperatura')
  const [whatIfMetric, setWhatIfMetric] = useState('aqi')

  const meta = simulationData.meta || simulationData;
  const arimaData = simulationData.predicciones_derivadas?.[arimaMetric];
  const scenarioData = simulationData.scenarios?.[whatIfMetric];
  const reportData = simulationData.recomendaciones;

  // Renderizar sugerencias Markdown
  const renderedMarkdown = useMemo(() => {
    if (!reportData || !reportData.report_text) return null;
    return reportData.report_text.split('\n').map((line, idx) => parseMarkdownLine(line, idx));
  }, [reportData]);

  // Valores promedio para tarjetas KPI What-If
  const meanValues = useMemo(() => {
    if (!scenarioData) return null;
    const actual = scenarioData.actual || [];
    const optimista = scenarioData.optimista || [];
    const pesimista = scenarioData.pesimista || [];

    const stats = {};
    PREDICTIVE_METRICS.forEach(m => {
      const actAvg = actual.reduce((acc, curr) => acc + (curr.valores[m.value] || 0), 0) / (actual.length || 1);
      const optAvg = optimista.reduce((acc, curr) => acc + (curr.valores[m.value] || 0), 0) / (optimista.length || 1);
      const pessAvg = pesimista.reduce((acc, curr) => acc + (curr.valores[m.value] || 0), 0) / (pesimista.length || 1);

      stats[m.value] = {
        actual: actAvg,
        optimista: optAvg,
        pesimista: pessAvg
      };
    });
    return stats;
  }, [scenarioData]);

  // ECharts Option - ARIMA con marca de simulación
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
      title: { 
        text: `Proyección ARIMA — ${mOpt.label} (DATOS SIMULADOS)`, 
        textStyle: { color: '#fbbf24', fontSize: 13, fontWeight: 'bold' } 
      },
      graphic: [{
        type: 'text',
        left: 'center',
        top: 'middle',
        style: {
          text: 'DATOS SIMULADOS',
          font: 'bold 32px Inter, sans-serif',
          fill: 'rgba(251, 191, 36, 0.07)',
          align: 'center',
          verticalAlign: 'middle'
        }
      }],
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
        data: ['Histórico (Simulado)', 'Proyección ARIMA', 'Intervalo de Confianza (95%)'],
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
          name: 'Histórico (Simulado)',
          type: 'line',
          data: histSeries,
          showSymbol: false,
          lineStyle: { color: '#38bdf8', width: 2 }
        },
        {
          name: 'Proyección ARIMA',
          type: 'line',
          data: predSeries,
          showSymbol: true,
          symbolSize: 6,
          lineStyle: { color: '#fb923c', width: 2.5, type: 'dashed' },
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
          areaStyle: { color: 'rgba(251, 146, 60, 0.08)' },
          showSymbol: false
        }
      ]
    };
  }, [arimaData, arimaMetric]);

  // ECharts Option - Scenario What-If
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
      title: { 
        text: `Comparación de Escenarios: ${mOpt.label} (DATOS SIMULADOS)`, 
        textStyle: { color: '#fbbf24', fontSize: 13, fontWeight: 'bold' } 
      },
      graphic: [{
        type: 'text',
        left: 'center',
        top: 'middle',
        style: {
          text: 'ESCENARIOS SIMULADOS',
          font: 'bold 30px Inter, sans-serif',
          fill: 'rgba(251, 191, 36, 0.06)',
          align: 'center',
          verticalAlign: 'middle'
        }
      }],
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
        data: ['Escenario Actual (Simulado)', 'Escenario Optimista (Simulado)', 'Escenario Pesimista (Simulado)'],
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
        {
          name: 'Escenario Actual (Simulado)',
          type: 'line',
          data: actualVals,
          showSymbol: false,
          lineStyle: { color: '#fb923c', width: 2 }
        },
        {
          name: 'Escenario Optimista (Simulado)',
          type: 'line',
          data: optVals,
          showSymbol: false,
          lineStyle: { color: '#10b981', width: 2, type: 'dashed' }
        },
        {
          name: 'Escenario Pesimista (Simulado)',
          type: 'line',
          data: pessVals,
          showSymbol: false,
          lineStyle: { color: '#ef4444', width: 2, type: 'dashed' }
        }
      ]
    };
  }, [scenarioData]);

  return (
    <div className="sim-results-container">
      {/* Botón Volver y Metadatos */}
      <div className="sim-results-header flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🎭 Simulación: <span className="text-amber-400">{meta.nombre}</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Evento: <span className="text-gray-200 capitalize font-medium">{meta.tipo_evento?.replace('_', ' ')}</span> | 
            Intensidad: <span className="text-gray-200 font-medium">{meta.parametros?.intensidad?.toFixed(1)}/10</span> | 
            Duración: <span className="text-gray-200 font-medium">{meta.parametros?.duracion_horas}h</span>
          </p>
        </div>
        <button 
          onClick={onBack}
          className="px-4 py-2 bg-slate-700/60 hover:bg-slate-700 text-gray-200 border border-slate-600 rounded-lg text-xs font-semibold transition-colors"
        >
          ⬅️ Volver a Controles
        </button>
      </div>

      <div className="grid-predictivo">
        {/* Columna Izquierda: ECharts */}
        <div className="col-chart-panels">
          {/* Gráfico ARIMA */}
          <div className="rep-chart-card sim-branded-card border border-amber-500/20 bg-slate-900/30">
            <div className="chart-header flex justify-between items-center mb-3">
              <span className="rep-chart-title text-amber-400 flex items-center gap-2">
                📈 Tendencia Proyectada <span className="text-[10px] bg-amber-500/10 px-2 py-0.5 rounded text-amber-300 border border-amber-500/20">SIMULADO</span>
              </span>
              <select
                className="metric-chart-select bg-slate-800 border border-slate-700 text-gray-300 rounded px-2 py-1 text-xs"
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
                <div className="flex items-center justify-center h-[340px] text-gray-500">Cargando gráfico...</div>
              )}
            </div>
          </div>

          {/* Gráfico What-If Cascading */}
          <div className="rep-chart-card sim-branded-card mt-6 border border-amber-500/20 bg-slate-900/30">
            <div className="chart-header flex justify-between items-center mb-3">
              <div>
                <span className="rep-chart-title text-amber-400 flex items-center gap-2">
                  🎛️ Simulación What-If <span className="text-[10px] bg-amber-500/10 px-2 py-0.5 rounded text-amber-300 border border-amber-500/20">SIMULADO</span>
                </span>
                <p className="text-xs text-gray-400 mt-1">
                  Verifica cómo cambian las variables respecto a la métrica objetivo simulada.
                </p>
              </div>
              <select
                className="metric-chart-select bg-slate-800 border border-slate-700 text-gray-300 rounded px-2 py-1 text-xs"
                value={whatIfMetric}
                onChange={e => setWhatIfMetric(e.target.value)}
              >
                {PREDICTIVE_METRICS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* KPI Cards del What-If */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="scenario-kpi-card opt-card border border-emerald-500/25 bg-emerald-500/5 p-3 rounded-lg">
                <span className="block text-xs font-semibold text-emerald-400 mb-1">🟢 Escenario Optimista ({scenarioData?.presets?.optimista}%)</span>
                <div className="space-y-1 text-[11px]">
                  {meanValues && PREDICTIVE_METRICS.map(m => (
                    <div key={m.value} className="flex justify-between">
                      <span className="text-gray-400">{m.label}:</span>
                      <span className="font-semibold text-emerald-300">{meanValues[m.value].optimista.toFixed(1)}{m.unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="scenario-kpi-card base-card border border-slate-600/25 bg-slate-600/5 p-3 rounded-lg">
                <span className="block text-xs font-semibold text-slate-400 mb-1">⚪ Escenario Proyectado</span>
                <div className="space-y-1 text-[11px]">
                  {meanValues && PREDICTIVE_METRICS.map(m => (
                    <div key={m.value} className="flex justify-between">
                      <span className="text-gray-400">{m.label}:</span>
                      <span className="font-semibold text-slate-300">{meanValues[m.value].actual.toFixed(1)}{m.unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="scenario-kpi-card pess-card border border-red-500/25 bg-red-500/5 p-3 rounded-lg">
                <span className="block text-xs font-semibold text-red-400 mb-1">🔴 Escenario Pesimista (+{scenarioData?.presets?.pesimista}%)</span>
                <div className="space-y-1 text-[11px]">
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
                <div className="flex items-center justify-center h-[300px] text-gray-500">Cargando gráfico...</div>
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Recomendaciones */}
        <div className="col-report-panels">
          <div className="report-markdown-card sim-branded-card bg-slate-900/30 border border-amber-500/20 p-6 rounded-xl overflow-y-auto max-h-[710px]">
            <span className="block text-[10px] bg-amber-500/10 px-2 py-0.5 rounded text-amber-300 border border-amber-500/20 w-fit mb-3">
              INFORMACIÓN SIMULADA
            </span>
            {renderedMarkdown ? (
              <div className="markdown-body text-gray-200">
                {renderedMarkdown}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center text-gray-500">
                <span className="text-3xl mb-2">📄</span>
                <p>No hay recomendaciones de simulación disponibles.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
