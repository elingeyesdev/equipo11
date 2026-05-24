/**
 * globalCities.js — Catálogo global de ciudades principales del mundo.
 *
 * SRP: Solo almacena coordenadas y nombres. No contiene lógica.
 *
 * Estructura: Array de objetos { name, lng, lat }
 * Contiene ~150 ciudades: capitales mundiales, centros económicos,
 * y ciudades clave de Bolivia y Sudamérica.
 *
 * El motor nativo de Mapbox con text-allow-overlap: false se encarga
 * de ocultar etiquetas automáticamente cuando colisionan al alejar la cámara.
 */
export const GLOBAL_CITIES = [
  // ═══════════════════ BOLIVIA ═══════════════════
  { name: 'Santa Cruz', lng: -63.18, lat: -17.78 },
  { name: 'La Paz', lng: -68.12, lat: -16.49 },
  { name: 'Sucre', lng: -65.26, lat: -19.04 },
  { name: 'Potosí', lng: -65.75, lat: -19.58 },
  { name: 'Cobija', lng: -68.77, lat: -11.03 },
  { name: 'Cochabamba', lng: -66.16, lat: -17.39 },
  { name: 'Oruro', lng: -67.11, lat: -17.96 },
  { name: 'Tarija', lng: -64.73, lat: -21.54 },
  { name: 'Trinidad', lng: -64.90, lat: -14.83 },

  // ═══════════════════ SUDAMÉRICA ═══════════════════
  // Argentina
  { name: 'Buenos Aires', lng: -58.38, lat: -34.60 },
  { name: 'Córdoba', lng: -64.18, lat: -31.41 },
  { name: 'Mendoza', lng: -68.83, lat: -32.89 },
  { name: 'Rosario', lng: -60.64, lat: -32.95 },
  { name: 'Salta', lng: -65.42, lat: -24.78 },
  { name: 'Ushuaia', lng: -68.30, lat: -54.80 },
  // Brasil
  { name: 'São Paulo', lng: -46.63, lat: -23.55 },
  { name: 'Rio de Janeiro', lng: -43.17, lat: -22.91 },
  { name: 'Brasília', lng: -47.88, lat: -15.79 },
  { name: 'Manaus', lng: -60.03, lat: -3.10 },
  { name: 'Fortaleza', lng: -38.54, lat: -3.72 },
  { name: 'Salvador', lng: -38.51, lat: -12.97 },
  { name: 'Recife', lng: -34.87, lat: -8.05 },
  { name: 'Porto Alegre', lng: -51.22, lat: -30.03 },
  { name: 'Belém', lng: -48.50, lat: -1.46 },
  // Chile
  { name: 'Santiago', lng: -70.67, lat: -33.45 },
  { name: 'Valparaíso', lng: -71.63, lat: -33.05 },
  { name: 'Punta Arenas', lng: -70.92, lat: -53.16 },
  // Colombia
  { name: 'Bogotá', lng: -74.07, lat: 4.71 },
  { name: 'Medellín', lng: -75.58, lat: 6.24 },
  { name: 'Cali', lng: -76.52, lat: 3.45 },
  { name: 'Barranquilla', lng: -74.78, lat: 10.96 },
  { name: 'Cartagena', lng: -75.48, lat: 10.39 },
  // Perú
  { name: 'Lima', lng: -77.04, lat: -12.05 },
  { name: 'Cusco', lng: -71.97, lat: -13.53 },
  { name: 'Arequipa', lng: -71.54, lat: -16.41 },
  // Ecuador
  { name: 'Quito', lng: -78.52, lat: -0.23 },
  { name: 'Guayaquil', lng: -79.89, lat: -2.19 },
  // Venezuela
  { name: 'Caracas', lng: -66.90, lat: 10.48 },
  { name: 'Maracaibo', lng: -71.60, lat: 10.65 },
  // Paraguay, Uruguay, Guyana
  { name: 'Asunción', lng: -57.65, lat: -25.29 },
  { name: 'Montevideo', lng: -56.16, lat: -34.90 },
  { name: 'Georgetown', lng: -58.16, lat: 6.80 },

  // ═══════════════════ NORTEAMÉRICA ═══════════════════
  { name: 'New York', lng: -74.01, lat: 40.71 },
  { name: 'Los Angeles', lng: -118.24, lat: 34.05 },
  { name: 'Chicago', lng: -87.63, lat: 41.88 },
  { name: 'Houston', lng: -95.37, lat: 29.76 },
  { name: 'Miami', lng: -80.19, lat: 25.76 },
  { name: 'San Francisco', lng: -122.42, lat: 37.77 },
  { name: 'Washington D.C.', lng: -77.04, lat: 38.91 },
  { name: 'Toronto', lng: -79.38, lat: 43.65 },
  { name: 'Vancouver', lng: -123.12, lat: 49.28 },
  { name: 'México D.F.', lng: -99.13, lat: 19.43 },
  { name: 'Guadalajara', lng: -103.35, lat: 20.67 },
  { name: 'Monterrey', lng: -100.32, lat: 25.67 },
  { name: 'La Habana', lng: -82.37, lat: 23.11 },
  { name: 'San Juan', lng: -66.07, lat: 18.47 },
  { name: 'Panamá', lng: -79.52, lat: 8.98 },
  { name: 'San José', lng: -84.08, lat: 9.93 },
  { name: 'Guatemala', lng: -90.51, lat: 14.63 },
  { name: 'Anchorage', lng: -149.90, lat: 61.22 },

  // ═══════════════════ EUROPA ═══════════════════
  { name: 'London', lng: -0.13, lat: 51.51 },
  { name: 'Paris', lng: 2.35, lat: 48.86 },
  { name: 'Berlin', lng: 13.40, lat: 52.52 },
  { name: 'Madrid', lng: -3.70, lat: 40.42 },
  { name: 'Roma', lng: 12.50, lat: 41.90 },
  { name: 'Amsterdam', lng: 4.90, lat: 52.37 },
  { name: 'Moskva', lng: 37.62, lat: 55.76 },
  { name: 'Kyiv', lng: 30.52, lat: 50.45 },
  { name: 'Warszawa', lng: 21.01, lat: 52.23 },
  { name: 'Lisboa', lng: -9.14, lat: 38.74 },
  { name: 'Stockholm', lng: 18.07, lat: 59.33 },
  { name: 'Oslo', lng: 10.75, lat: 59.91 },
  { name: 'Helsinki', lng: 24.94, lat: 60.17 },
  { name: 'Athina', lng: 23.73, lat: 37.98 },
  { name: 'Wien', lng: 16.37, lat: 48.21 },
  { name: 'Zürich', lng: 8.54, lat: 47.38 },
  { name: 'Dublin', lng: -6.26, lat: 53.35 },
  { name: 'Praha', lng: 14.42, lat: 50.08 },
  { name: 'Budapest', lng: 19.04, lat: 47.50 },
  { name: 'Bucureşti', lng: 26.10, lat: 44.43 },
  { name: 'Istanbul', lng: 28.98, lat: 41.01 },
  { name: 'Reykjavik', lng: -21.94, lat: 64.14 },

  // ═══════════════════ ASIA ═══════════════════
  { name: 'Tokyo', lng: 139.69, lat: 35.68 },
  { name: 'Beijing', lng: 116.41, lat: 39.90 },
  { name: 'Shanghai', lng: 121.47, lat: 31.23 },
  { name: 'Hong Kong', lng: 114.17, lat: 22.28 },
  { name: 'Seoul', lng: 126.98, lat: 37.57 },
  { name: 'Delhi', lng: 77.21, lat: 28.61 },
  { name: 'Mumbai', lng: 72.88, lat: 19.08 },
  { name: 'Kolkata', lng: 88.36, lat: 22.57 },
  { name: 'Bangkok', lng: 100.50, lat: 13.76 },
  { name: 'Singapore', lng: 103.82, lat: 1.35 },
  { name: 'Jakarta', lng: 106.85, lat: -6.21 },
  { name: 'Manila', lng: 120.98, lat: 14.60 },
  { name: 'Taipei', lng: 121.57, lat: 25.03 },
  { name: 'Hanoi', lng: 105.85, lat: 21.03 },
  { name: 'Dhaka', lng: 90.41, lat: 23.81 },
  { name: 'Karachi', lng: 67.01, lat: 24.86 },
  { name: 'Tehran', lng: 51.39, lat: 35.69 },
  { name: 'Baghdad', lng: 44.37, lat: 33.31 },
  { name: 'Riyadh', lng: 46.72, lat: 24.69 },
  { name: 'Dubai', lng: 55.27, lat: 25.20 },
  { name: 'Tel Aviv', lng: 34.78, lat: 32.09 },
  { name: 'Almaty', lng: 76.95, lat: 43.24 },
  { name: 'Tashkent', lng: 69.28, lat: 41.30 },
  { name: 'Ulaanbaatar', lng: 106.91, lat: 47.92 },
  { name: 'Kuala Lumpur', lng: 101.69, lat: 3.14 },
  { name: 'Colombo', lng: 79.86, lat: 6.93 },

  // ═══════════════════ AFRICA ═══════════════════
  { name: 'Cairo', lng: 31.24, lat: 30.04 },
  { name: 'Lagos', lng: 3.38, lat: 6.52 },
  { name: 'Nairobi', lng: 36.82, lat: -1.29 },
  { name: 'Cape Town', lng: 18.42, lat: -33.93 },
  { name: 'Johannesburg', lng: 28.05, lat: -26.20 },
  { name: 'Addis Ababa', lng: 38.75, lat: 9.02 },
  { name: 'Casablanca', lng: -7.59, lat: 33.57 },
  { name: 'Algiers', lng: 3.06, lat: 36.75 },
  { name: 'Accra', lng: -0.19, lat: 5.56 },
  { name: 'Dar es Salaam', lng: 39.27, lat: -6.79 },
  { name: 'Kinshasa', lng: 15.27, lat: -4.44 },
  { name: 'Luanda', lng: 13.23, lat: -8.84 },
  { name: 'Dakar', lng: -17.44, lat: 14.69 },
  { name: 'Tunis', lng: 10.17, lat: 36.81 },
  { name: 'Kampala', lng: 32.58, lat: 0.35 },

  // ═══════════════════ OCEANÍA ═══════════════════
  { name: 'Sydney', lng: 151.21, lat: -33.87 },
  { name: 'Melbourne', lng: 144.96, lat: -37.81 },
  { name: 'Auckland', lng: 174.76, lat: -36.85 },
  { name: 'Perth', lng: 115.86, lat: -31.95 },
  { name: 'Wellington', lng: 174.78, lat: -41.29 },
  { name: 'Suva', lng: 178.44, lat: -18.14 },
  { name: 'Honolulu', lng: -157.86, lat: 21.31 },
];
