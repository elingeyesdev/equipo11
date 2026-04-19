/**
 * Datos base de los 9 departamentos de Bolivia.
 * Separado en su propio módulo para reutilización (DRY).
 * Cada departamento define rangos realistas según su geografía.
 */
const DEPARTAMENTOS = [
  {
    id: 'lapaz',
    name: 'La Paz',
    latitude: -16.4897,
    longitude: -68.1193,
    ranges: { temperature: [-5, 18], aqi: [30, 120], waterQuality: [60, 95], noise: [40, 80], humidity: [25, 60] }
  },
  {
    id: 'cochabamba',
    name: 'Cochabamba',
    latitude: -17.3895,
    longitude: -66.1568,
    ranges: { temperature: [16, 28], aqi: [40, 150], waterQuality: [50, 90], noise: [45, 85], humidity: [20, 55] }
  },
  {
    id: 'santacruz',
    name: 'Santa Cruz',
    latitude: -17.7833,
    longitude: -63.1812,
    ranges: { temperature: [22, 35], aqi: [50, 160], waterQuality: [40, 85], noise: [50, 90], humidity: [50, 90] }
  },
  {
    id: 'oruro',
    name: 'Oruro',
    latitude: -17.9624,
    longitude: -67.1061,
    ranges: { temperature: [-8, 15], aqi: [20, 90], waterQuality: [65, 98], noise: [30, 60], humidity: [15, 45] }
  },
  {
    id: 'potosi',
    name: 'Potosí',
    latitude: -19.5836,
    longitude: -65.7531,
    ranges: { temperature: [-12, 14], aqi: [15, 80], waterQuality: [70, 98], noise: [25, 55], humidity: [10, 40] }
  },
  {
    id: 'sucre',
    name: 'Sucre',
    latitude: -19.0353,
    longitude: -65.2592,
    ranges: { temperature: [12, 24], aqi: [25, 100], waterQuality: [60, 95], noise: [35, 65], humidity: [25, 55] }
  },
  {
    id: 'tarija',
    name: 'Tarija',
    latitude: -21.5355,
    longitude: -64.7296,
    ranges: { temperature: [14, 30], aqi: [20, 90], waterQuality: [55, 92], noise: [35, 70], humidity: [30, 65] }
  },
  {
    id: 'beni',
    name: 'Trinidad',
    latitude: -14.8333,
    longitude: -64.9000,
    ranges: { temperature: [24, 36], aqi: [30, 110], waterQuality: [35, 80], noise: [40, 75], humidity: [60, 95] }
  },
  {
    id: 'pando',
    name: 'Cobija',
    latitude: -11.0267,
    longitude: -68.7692,
    ranges: { temperature: [22, 34], aqi: [25, 100], waterQuality: [30, 78], noise: [35, 70], humidity: [65, 95] }
  }
]

module.exports = DEPARTAMENTOS
