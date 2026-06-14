import React from 'react';
import tempImg from '../assets/Temperatura.png';
import aqiImg from '../assets/AQI.png';
import icaImg from '../assets/CalidadAire.png';
import humImg from '../assets/humedad.png';
import noiseImg from '../assets/ruido.png';

const imgStyle = {
  width: '26px',
  height: '26px',
  objectFit: 'contain',
  display: 'inline-block',
  verticalAlign: 'middle'
};

const ICONS = {
  temperatura: React.createElement('img', { src: tempImg, alt: 'temperatura', style: imgStyle }),
  aqi: React.createElement('img', { src: aqiImg, alt: 'aqi', style: imgStyle }),
  ica: React.createElement('img', { src: icaImg, alt: 'ica', style: imgStyle }),
  humedad: React.createElement('img', { src: humImg, alt: 'humedad', style: imgStyle }),
  ruido: React.createElement('img', { src: noiseImg, alt: 'ruido', style: imgStyle }),
};

export function getIcon(metric) {
  return ICONS[metric] || '📊';
}
