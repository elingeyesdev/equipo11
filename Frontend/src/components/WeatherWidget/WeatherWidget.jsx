import React, { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getWeatherInfo } from '../../utils/weatherIcons';
import './WeatherWidget.css';

export default function WeatherWidget({ forecastData, cityName, isDarkTheme }) {
  const [activeTab, setActiveTab] = useState('temp'); // temp, rain, wind

  if (!forecastData || !forecastData.current) {
    return <div className="weather-widget loading">Cargando pronóstico...</div>;
  }

  const { current, hourly, daily } = forecastData;
  const weatherInfo = getWeatherInfo(current.weather_code);

  // Opciones para el gráfico ECharts horario (24 horas)
  const getChartOptions = () => {
    const next24h = hourly.slice(0, 24);
    const times = next24h.map(h => {
      const d = new Date(h.forecast_time);
      return `${d.getHours()}:00`;
    });

    let seriesData = [];
    let color = '';
    let areaColor1 = '';
    let areaColor2 = '';
    let name = '';
    let yAxisFormatter = '';

    if (activeTab === 'temp') {
      seriesData = next24h.map(h => h.temperatura);
      color = '#f5b041';
      areaColor1 = 'rgba(245, 176, 65, 0.4)';
      areaColor2 = 'rgba(245, 176, 65, 0.0)';
      name = 'Temperatura';
      yAxisFormatter = '{value} °C';
    } else if (activeTab === 'rain') {
      seriesData = next24h.map(h => h.precipitacion_prob); // Mostramos % de probabilidad o h.rain
      color = '#3498db';
      areaColor1 = 'rgba(52, 152, 219, 0.4)';
      areaColor2 = 'rgba(52, 152, 219, 0.0)';
      name = 'Prob. Lluvia';
      yAxisFormatter = '{value}%';
    } else if (activeTab === 'wind') {
      seriesData = next24h.map(h => h.wind_speed);
      color = '#aeb6bf';
      areaColor1 = 'rgba(174, 182, 191, 0.4)';
      areaColor2 = 'rgba(174, 182, 191, 0.0)';
      name = 'Viento';
      yAxisFormatter = '{value} km/h';
    }

    return {
      tooltip: {
        trigger: 'axis',
        formatter: `{b}<br/>{a}: {c}`
      },
      grid: { left: 10, right: 10, bottom: 20, top: 30, containLabel: false },
      xAxis: {
        type: 'category',
        data: times,
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: isDarkTheme ? '#ccc' : '#666', fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        show: false, // Ocultamos el eje Y para que se vea mas limpio como en Google
      },
      series: [
        {
          name,
          type: 'line',
          smooth: true,
          data: seriesData,
          symbolSize: 6,
          itemStyle: { color },
          lineStyle: { width: 3 },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: areaColor1 },
                { offset: 1, color: areaColor2 }
              ]
            }
          },
          label: {
            show: true,
            position: 'top',
            color: isDarkTheme ? '#fff' : '#333',
            fontSize: 11,
            formatter: (params) => {
              // Mostrar label solo 1 de cada 3 para no saturar
              return params.dataIndex % 3 === 0 ? Math.round(params.value) : '';
            }
          }
        }
      ]
    };
  };

  const getDayName = (dateString, index) => {
    if (index === 0) return 'Hoy';
    const days = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    return days[new Date(dateString).getDay()];
  };

  return (
    <div className={`weather-widget ${weatherInfo.iconClass}`}>
      <div className="ww-header">
        <div className="ww-main-temp">
          <span className="ww-emoji">{weatherInfo.emoji}</span>
          <span className="ww-temp-value">{Math.round(current.temperatura)}</span>
          <span className="ww-temp-unit">°C</span>
        </div>
        <div className="ww-city-info">
          <h3>{cityName}</h3>
          <p>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="ww-condition">{weatherInfo.label}</p>
        </div>
      </div>

      <div className="ww-current-stats">
        <div><span>Prob. lluvia:</span> {current.precipitacion_prob}%</div>
        <div><span>Humedad:</span> {current.humedad}%</div>
        <div><span>Viento:</span> a {current.viento_velocidad} km/h</div>
      </div>

      <div className="ww-tabs">
        <button className={activeTab === 'temp' ? 'active' : ''} onClick={() => setActiveTab('temp')}>Temperatura</button>
        <button className={activeTab === 'rain' ? 'active' : ''} onClick={() => setActiveTab('rain')}>Precipitaciones</button>
        <button className={activeTab === 'wind' ? 'active' : ''} onClick={() => setActiveTab('wind')}>Viento</button>
      </div>

      <div className="ww-chart-container">
        <ReactECharts option={getChartOptions()} style={{ height: '140px', width: '100%' }} />
      </div>

      <div className="ww-daily-forecast">
        {daily.map((day, i) => {
          const dInfo = getWeatherInfo(day.weather_code);
          return (
            <div key={day.date} className="ww-daily-card">
              <span className="ww-day-name">{getDayName(day.date, i)}</span>
              <span className="ww-day-emoji">{dInfo.emoji}</span>
              <div className="ww-day-temps">
                <span className="max">{Math.round(day.temp_max)}°</span>
                <span className="min">{Math.round(day.temp_min)}°</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
