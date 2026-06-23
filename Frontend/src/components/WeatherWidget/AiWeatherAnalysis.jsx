import React, { useState } from 'react';
import httpClient from '../../config/httpClient';
import './AiWeatherAnalysis.css';

export default function AiWeatherAnalysis({ ciudad, lat, lon }) {
  const [analisis, setAnalisis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(true);

  const solicitarAnalisis = async () => {
    if (!ciudad || !lat || !lon) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await httpClient.post('/ia/analisis-clima', { ciudad, lat, lon });
      if (res.data?.data?.analisis) {
        setAnalisis(res.data.data.analisis);
        setExpanded(true);
      }
    } catch (err) {
      setError(err.message || 'Error al obtener análisis IA');
    } finally {
      setLoading(false);
    }
  };

  if (!analisis && !loading && !error) {
    return (
      <div className="ai-weather-prompt">
        <button className="btn-ia-analyze" onClick={solicitarAnalisis}>
          ✨ Solicitar Análisis IA
        </button>
      </div>
    );
  }

  return (
    <div className="ai-weather-analysis">
      <div className="ai-header" onClick={() => setExpanded(!expanded)}>
        <h3>✨ Análisis Meteorológico IA</h3>
        <button className="toggle-btn">{expanded ? '▲' : '▼'}</button>
      </div>
      
      {loading && <div className="ai-loading">Analizando patrones climáticos con DeepSeek...</div>}
      {error && <div className="ai-error">{error}</div>}

      {analisis && expanded && (
        <div className="ai-content">
          <p className="ai-summary">{analisis.resumen}</p>
          
          <div className="ai-section">
            <h4>📈 Tendencias</h4>
            <ul>
              {analisis.tendencias?.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>

          {analisis.alertas && analisis.alertas.length > 0 && (
            <div className="ai-section ai-alerts">
              <h4>⚠️ Alertas</h4>
              <ul>
                {analisis.alertas.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          <div className="ai-section">
            <h4>💡 Recomendaciones</h4>
            <ul>
              {analisis.recomendaciones?.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>

          <div className="ai-footer">
            <span className="ai-confort">
              Índice de Confort: {'⭐'.repeat(analisis.indice_confort)}{'☆'.repeat(5 - analisis.indice_confort)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
