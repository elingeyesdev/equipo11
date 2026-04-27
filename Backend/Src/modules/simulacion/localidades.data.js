/**
 * Localidades de Sudamérica para el simulador ambiental.
 *
 * Reemplaza a departamentos.data.js (solo Bolivia).
 * Cada entrada refleja exactamente el campo `nombre` de la tabla `localidades`
 * en la BD, para que el mapeo de persistencia funcione sin cambios.
 *
 * Rangos climáticos definidos según zona geográfica real:
 *  - Altiplano  (La Paz, Potosí, Quito, Cusco, Puno): frío, humedad media
 *  - Amazonia   (Manaus, Iquitos, Leticia, Belém):     cálido, muy húmedo
 *  - Patagonia  (Bariloche, Punta Arenas, Ushuaia):    frío-templado
 *  - Trópico    (Cartagena, Fortaleza, Maracaibo):     calor intenso, húmedo
 *  - Árido/costa(Lima, Antofagasta):                   templado, muy seco
 */
const LOCALIDADES = [

  // ─── BOLIVIA (9 ciudades originales) ────────────────────────────────────────
  {
    id: 'lapaz',
    name: 'La Paz',
    latitude: -16.4897, longitude: -68.1193,
    ranges: { temperatura: [-5, 18], aqi: [30, 120], ica: [60, 95], ruido: [40, 80], humedad: [25, 60] }
  },
  {
    id: 'cochabamba',
    name: 'Cochabamba',
    latitude: -17.3895, longitude: -66.1568,
    ranges: { temperatura: [16, 28], aqi: [40, 150], ica: [50, 90], ruido: [45, 85], humedad: [20, 55] }
  },
  {
    id: 'santacruz',
    name: 'Santa Cruz',
    latitude: -17.7833, longitude: -63.1812,
    ranges: { temperatura: [22, 35], aqi: [50, 160], ica: [40, 85], ruido: [50, 90], humedad: [50, 90] }
  },
  {
    id: 'oruro',
    name: 'Oruro',
    latitude: -17.9624, longitude: -67.1061,
    ranges: { temperatura: [-8, 15], aqi: [20, 90], ica: [65, 98], ruido: [30, 60], humedad: [15, 45] }
  },
  {
    id: 'potosi',
    name: 'Potosí',
    latitude: -19.5836, longitude: -65.7531,
    ranges: { temperatura: [-12, 14], aqi: [15, 80], ica: [70, 98], ruido: [25, 55], humedad: [10, 40] }
  },
  {
    id: 'sucre',
    name: 'Sucre',
    latitude: -19.0353, longitude: -65.2592,
    ranges: { temperatura: [12, 24], aqi: [25, 100], ica: [60, 95], ruido: [35, 65], humedad: [25, 55] }
  },
  {
    id: 'tarija',
    name: 'Tarija',
    latitude: -21.5355, longitude: -64.7296,
    ranges: { temperatura: [14, 30], aqi: [20, 90], ica: [55, 92], ruido: [35, 70], humedad: [30, 65] }
  },
  {
    id: 'trinidad',
    name: 'Trinidad',
    latitude: -14.8333, longitude: -64.9000,
    ranges: { temperatura: [24, 36], aqi: [30, 110], ica: [35, 80], ruido: [40, 75], humedad: [60, 95] }
  },
  {
    id: 'cobija',
    name: 'Cobija',
    latitude: -11.0267, longitude: -68.7692,
    ranges: { temperatura: [22, 34], aqi: [25, 100], ica: [30, 78], ruido: [35, 70], humedad: [65, 95] }
  },

  // ─── ARGENTINA ──────────────────────────────────────────────────────────────
  {
    id: 'buenos_aires',
    name: 'Buenos Aires',
    latitude: -34.6037, longitude: -58.3816,
    ranges: { temperatura: [8, 35], aqi: [40, 180], ica: [45, 85], ruido: [55, 95], humedad: [50, 85] }
  },
  {
    id: 'cordoba_ar',
    name: 'Córdoba',
    latitude: -31.4135, longitude: -64.1811,
    ranges: { temperatura: [6, 33], aqi: [35, 150], ica: [50, 88], ruido: [45, 85], humedad: [40, 80] }
  },
  {
    id: 'rosario',
    name: 'Rosario',
    latitude: -32.9442, longitude: -60.6505,
    ranges: { temperatura: [8, 34], aqi: [38, 160], ica: [48, 82], ruido: [50, 90], humedad: [45, 82] }
  },
  {
    id: 'mendoza',
    name: 'Mendoza',
    latitude: -32.8908, longitude: -68.8272,
    ranges: { temperatura: [2, 36], aqi: [20, 100], ica: [55, 92], ruido: [40, 78], humedad: [20, 55] }
  },
  {
    id: 'tucuman',
    name: 'Tucumán',
    latitude: -26.8083, longitude: -65.2176,
    ranges: { temperatura: [10, 38], aqi: [30, 130], ica: [50, 88], ruido: [45, 82], humedad: [45, 85] }
  },
  {
    id: 'salta',
    name: 'Salta',
    latitude: -24.7821, longitude: -65.4232,
    ranges: { temperatura: [5, 32], aqi: [20, 110], ica: [58, 92], ruido: [35, 75], humedad: [30, 70] }
  },
  {
    id: 'bariloche',
    name: 'Bariloche',
    latitude: -41.1335, longitude: -71.3103,
    ranges: { temperatura: [-5, 22], aqi: [10, 60], ica: [70, 98], ruido: [25, 60], humedad: [45, 85] }
  },
  {
    id: 'ushuaia',
    name: 'Ushuaia',
    latitude: -54.8019, longitude: -68.3030,
    ranges: { temperatura: [-8, 14], aqi: [5, 40], ica: [75, 99], ruido: [20, 55], humedad: [55, 90] }
  },

  // ─── BRASIL ─────────────────────────────────────────────────────────────────
  {
    id: 'brasilia',
    name: 'Brasilia',
    latitude: -15.7801, longitude: -47.9292,
    ranges: { temperatura: [18, 32], aqi: [35, 140], ica: [50, 88], ruido: [45, 85], humedad: [35, 80] }
  },
  {
    id: 'sao_paulo',
    name: 'São Paulo',
    latitude: -23.5505, longitude: -46.6333,
    ranges: { temperatura: [14, 32], aqi: [60, 220], ica: [40, 78], ruido: [60, 100], humedad: [55, 90] }
  },
  {
    id: 'rio_de_janeiro',
    name: 'Rio de Janeiro',
    latitude: -22.9068, longitude: -43.1729,
    ranges: { temperatura: [20, 40], aqi: [50, 190], ica: [42, 80], ruido: [58, 98], humedad: [60, 92] }
  },
  {
    id: 'manaus',
    name: 'Manaus',
    latitude: -3.1019, longitude: -60.0250,
    ranges: { temperatura: [24, 38], aqi: [25, 120], ica: [35, 78], ruido: [40, 80], humedad: [70, 98] }
  },
  {
    id: 'belem',
    name: 'Belém',
    latitude: -1.4558, longitude: -48.5044,
    ranges: { temperatura: [25, 36], aqi: [30, 115], ica: [38, 78], ruido: [42, 82], humedad: [72, 98] }
  },
  {
    id: 'fortaleza',
    name: 'Fortaleza',
    latitude: -3.7172, longitude: -38.5433,
    ranges: { temperatura: [24, 35], aqi: [40, 160], ica: [45, 82], ruido: [50, 92], humedad: [60, 90] }
  },
  {
    id: 'salvador',
    name: 'Salvador',
    latitude: -12.9714, longitude: -38.5014,
    ranges: { temperatura: [22, 34], aqi: [35, 140], ica: [48, 85], ruido: [48, 88], humedad: [62, 92] }
  },
  {
    id: 'porto_alegre',
    name: 'Porto Alegre',
    latitude: -30.0346, longitude: -51.2177,
    ranges: { temperatura: [8, 36], aqi: [30, 130], ica: [50, 88], ruido: [48, 88], humedad: [50, 88] }
  },
  {
    id: 'cuiaba',
    name: 'Cuiabá',
    latitude: -15.5989, longitude: -56.0949,
    ranges: { temperatura: [22, 40], aqi: [35, 150], ica: [40, 80], ruido: [42, 80], humedad: [40, 85] }
  },

  // ─── CHILE ──────────────────────────────────────────────────────────────────
  {
    id: 'santiago',
    name: 'Santiago',
    latitude: -33.4489, longitude: -70.6693,
    ranges: { temperatura: [3, 32], aqi: [40, 180], ica: [52, 90], ruido: [50, 92], humedad: [25, 70] }
  },
  {
    id: 'valparaiso',
    name: 'Valparaíso',
    latitude: -33.0472, longitude: -71.6127,
    ranges: { temperatura: [8, 28], aqi: [30, 130], ica: [55, 92], ruido: [45, 85], humedad: [50, 85] }
  },
  {
    id: 'concepcion',
    name: 'Concepción',
    latitude: -36.8270, longitude: -73.0503,
    ranges: { temperatura: [4, 26], aqi: [25, 120], ica: [58, 92], ruido: [40, 80], humedad: [55, 90] }
  },
  {
    id: 'antofagasta',
    name: 'Antofagasta',
    latitude: -23.6509, longitude: -70.3975,
    ranges: { temperatura: [12, 28], aqi: [20, 90], ica: [60, 95], ruido: [35, 72], humedad: [5, 30] }
  },
  {
    id: 'punta_arenas',
    name: 'Punta Arenas',
    latitude: -53.1638, longitude: -70.9171,
    ranges: { temperatura: [-5, 14], aqi: [8, 45], ica: [72, 98], ruido: [22, 58], humedad: [50, 88] }
  },
  {
    id: 'iquique',
    name: 'Iquique',
    latitude: -20.2208, longitude: -70.1431,
    ranges: { temperatura: [14, 28], aqi: [18, 85], ica: [62, 95], ruido: [35, 70], humedad: [5, 35] }
  },

  // ─── COLOMBIA ───────────────────────────────────────────────────────────────
  {
    id: 'bogota',
    name: 'Bogotá',
    latitude: 4.7110, longitude: -74.0721,
    ranges: { temperatura: [7, 20], aqi: [45, 180], ica: [48, 85], ruido: [52, 92], humedad: [55, 90] }
  },
  {
    id: 'medellin',
    name: 'Medellín',
    latitude: 6.2442, longitude: -75.5812,
    ranges: { temperatura: [16, 28], aqi: [50, 200], ica: [45, 82], ruido: [55, 95], humedad: [55, 88] }
  },
  {
    id: 'cali',
    name: 'Cali',
    latitude: 3.4516, longitude: -76.5320,
    ranges: { temperatura: [20, 34], aqi: [40, 170], ica: [48, 85], ruido: [50, 90], humedad: [52, 88] }
  },
  {
    id: 'cartagena',
    name: 'Cartagena',
    latitude: 10.3910, longitude: -75.4794,
    ranges: { temperatura: [26, 38], aqi: [35, 145], ica: [42, 80], ruido: [48, 90], humedad: [65, 95] }
  },
  {
    id: 'barranquilla',
    name: 'Barranquilla',
    latitude: 10.9639, longitude: -74.7964,
    ranges: { temperatura: [24, 38], aqi: [38, 150], ica: [42, 80], ruido: [50, 92], humedad: [60, 92] }
  },
  {
    id: 'leticia',
    name: 'Leticia',
    latitude: -4.2153, longitude: -69.9406,
    ranges: { temperatura: [24, 36], aqi: [20, 100], ica: [35, 78], ruido: [35, 72], humedad: [72, 98] }
  },

  // ─── ECUADOR ────────────────────────────────────────────────────────────────
  {
    id: 'quito',
    name: 'Quito',
    latitude: -0.2295, longitude: -78.5243,
    ranges: { temperatura: [6, 22], aqi: [30, 130], ica: [55, 90], ruido: [45, 85], humedad: [45, 85] }
  },
  {
    id: 'guayaquil',
    name: 'Guayaquil',
    latitude: -2.1894, longitude: -79.8891,
    ranges: { temperatura: [22, 36], aqi: [40, 160], ica: [45, 82], ruido: [52, 92], humedad: [60, 92] }
  },
  {
    id: 'cuenca',
    name: 'Cuenca',
    latitude: -2.9001, longitude: -79.0059,
    ranges: { temperatura: [8, 22], aqi: [20, 100], ica: [58, 92], ruido: [38, 75], humedad: [50, 85] }
  },
  {
    id: 'lago_agrio',
    name: 'Lago Agrio',
    latitude: 0.0897, longitude: -76.8817,
    ranges: { temperatura: [22, 34], aqi: [20, 95], ica: [38, 78], ruido: [32, 68], humedad: [70, 98] }
  },

  // ─── PERÚ ───────────────────────────────────────────────────────────────────
  {
    id: 'lima',
    name: 'Lima',
    latitude: -12.0464, longitude: -77.0428,
    ranges: { temperatura: [14, 30], aqi: [40, 160], ica: [50, 88], ruido: [55, 95], humedad: [70, 95] }
  },
  {
    id: 'cusco',
    name: 'Cusco',
    latitude: -13.5319, longitude: -71.9675,
    ranges: { temperatura: [-2, 20], aqi: [20, 95], ica: [62, 96], ruido: [32, 68], humedad: [25, 70] }
  },
  {
    id: 'arequipa',
    name: 'Arequipa',
    latitude: -16.4090, longitude: -71.5375,
    ranges: { temperatura: [5, 25], aqi: [25, 110], ica: [58, 92], ruido: [38, 78], humedad: [20, 60] }
  },
  {
    id: 'trujillo',
    name: 'Trujillo',
    latitude: -8.1120, longitude: -79.0288,
    ranges: { temperatura: [16, 30], aqi: [30, 120], ica: [48, 85], ruido: [45, 82], humedad: [60, 90] }
  },
  {
    id: 'iquitos',
    name: 'Iquitos',
    latitude: -3.7491, longitude: -73.2538,
    ranges: { temperatura: [24, 36], aqi: [20, 100], ica: [35, 78], ruido: [35, 70], humedad: [72, 98] }
  },
  {
    id: 'puno',
    name: 'Puno',
    latitude: -15.8402, longitude: -70.0219,
    ranges: { temperatura: [-8, 16], aqi: [15, 80], ica: [65, 96], ruido: [25, 60], humedad: [15, 55] }
  },

  // ─── PARAGUAY ───────────────────────────────────────────────────────────────
  {
    id: 'asuncion',
    name: 'Asunción',
    latitude: -25.2867, longitude: -57.6470,
    ranges: { temperatura: [14, 40], aqi: [35, 150], ica: [45, 82], ruido: [48, 88], humedad: [45, 85] }
  },
  {
    id: 'ciudad_del_este',
    name: 'Ciudad del Este',
    latitude: -25.5097, longitude: -54.6100,
    ranges: { temperatura: [16, 38], aqi: [35, 145], ica: [42, 80], ruido: [50, 90], humedad: [50, 88] }
  },
  {
    id: 'encarnacion',
    name: 'Encarnación',
    latitude: -27.3309, longitude: -55.8660,
    ranges: { temperatura: [12, 36], aqi: [25, 110], ica: [48, 85], ruido: [38, 75], humedad: [48, 85] }
  },

  // ─── URUGUAY ────────────────────────────────────────────────────────────────
  {
    id: 'montevideo',
    name: 'Montevideo',
    latitude: -34.9011, longitude: -56.1645,
    ranges: { temperatura: [8, 32], aqi: [30, 130], ica: [52, 90], ruido: [48, 88], humedad: [50, 85] }
  },
  {
    id: 'salto',
    name: 'Salto',
    latitude: -31.3833, longitude: -57.9667,
    ranges: { temperatura: [8, 36], aqi: [20, 100], ica: [55, 92], ruido: [35, 72], humedad: [45, 82] }
  },
  {
    id: 'rivera',
    name: 'Rivera',
    latitude: -30.9053, longitude: -55.5506,
    ranges: { temperatura: [8, 34], aqi: [18, 95], ica: [55, 92], ruido: [30, 68], humedad: [45, 82] }
  },

  // ─── VENEZUELA ──────────────────────────────────────────────────────────────
  {
    id: 'caracas',
    name: 'Caracas',
    latitude: 10.4806, longitude: -66.9036,
    ranges: { temperatura: [16, 30], aqi: [45, 180], ica: [45, 82], ruido: [52, 92], humedad: [55, 88] }
  },
  {
    id: 'maracaibo',
    name: 'Maracaibo',
    latitude: 10.6544, longitude: -71.6011,
    ranges: { temperatura: [26, 42], aqi: [40, 175], ica: [40, 78], ruido: [50, 92], humedad: [60, 90] }
  },
  {
    id: 'valencia_ve',
    name: 'Valencia',
    latitude: 10.1622, longitude: -67.9947,
    ranges: { temperatura: [20, 36], aqi: [38, 165], ica: [42, 80], ruido: [48, 90], humedad: [52, 88] }
  },
  {
    id: 'puerto_ayacucho',
    name: 'Puerto Ayacucho',
    latitude: 5.6638, longitude: -67.6235,
    ranges: { temperatura: [24, 38], aqi: [20, 100], ica: [38, 80], ruido: [32, 68], humedad: [62, 95] }
  },

  // ─── GUYANA, SURINAM, GUYANA FRANCESA ───────────────────────────────────────
  {
    id: 'georgetown',
    name: 'Georgetown',
    latitude: 6.8013, longitude: -58.1551,
    ranges: { temperatura: [24, 34], aqi: [25, 110], ica: [40, 80], ruido: [38, 75], humedad: [68, 95] }
  },
  {
    id: 'paramaribo',
    name: 'Paramaribo',
    latitude: 5.8520, longitude: -55.2038,
    ranges: { temperatura: [24, 34], aqi: [22, 100], ica: [42, 82], ruido: [38, 75], humedad: [68, 95] }
  },
  {
    id: 'cayenne',
    name: 'Cayenne',
    latitude: 4.9224, longitude: -52.3135,
    ranges: { temperatura: [24, 34], aqi: [20, 95], ica: [42, 82], ruido: [35, 72], humedad: [70, 96] }
  }
]

module.exports = LOCALIDADES
