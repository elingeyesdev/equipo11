const DEPARTAMENTOS = [
  {
    id: 'lapaz',
    name: 'La Paz',
    latitude: -16.4897,
    longitude: -68.1193,
    ranges: { temperatura: [-5, 18], aqi: [30, 120], ica: [60, 95], ruido: [40, 80], humedad: [25, 60] }
  },
  {
    id: 'cochabamba',
    name: 'Cochabamba',
    latitude: -17.3895,
    longitude: -66.1568,
    ranges: { temperatura: [16, 28], aqi: [40, 150], ica: [50, 90], ruido: [45, 85], humedad: [20, 55] }
  },
  {
    id: 'santacruz',
    name: 'Santa Cruz',
    latitude: -17.7833,
    longitude: -63.1812,
    ranges: { temperatura: [22, 35], aqi: [50, 160], ica: [40, 85], ruido: [50, 90], humedad: [50, 90] }
  },
  {
    id: 'oruro',
    name: 'Oruro',
    latitude: -17.9624,
    longitude: -67.1061,
    ranges: { temperatura: [-8, 15], aqi: [20, 90], ica: [65, 98], ruido: [30, 60], humedad: [15, 45] }
  },
  {
    id: 'potosi',
    name: 'Potosí',
    latitude: -19.5836,
    longitude: -65.7531,
    ranges: { temperatura: [-12, 14], aqi: [15, 80], ica: [70, 98], ruido: [25, 55], humedad: [10, 40] }
  },
  {
    id: 'sucre',
    name: 'Sucre',
    latitude: -19.0353,
    longitude: -65.2592,
    ranges: { temperatura: [12, 24], aqi: [25, 100], ica: [60, 95], ruido: [35, 65], humedad: [25, 55] }
  },
  {
    id: 'tarija',
    name: 'Tarija',
    latitude: -21.5355,
    longitude: -64.7296,
    ranges: { temperatura: [14, 30], aqi: [20, 90], ica: [55, 92], ruido: [35, 70], humedad: [30, 65] }
  },
  {
    id: 'beni',
    name: 'Trinidad',
    latitude: -14.8333,
    longitude: -64.9000,
    ranges: { temperatura: [24, 36], aqi: [30, 110], ica: [35, 80], ruido: [40, 75], humedad: [60, 95] }
  },
  {
    id: 'pando',
    name: 'Cobija',
    latitude: -11.0267,
    longitude: -68.7692,
    ranges: { temperatura: [22, 34], aqi: [25, 100], ica: [30, 78], ruido: [35, 70], humedad: [65, 95] }
  }
]

module.exports = DEPARTAMENTOS
