const MetricaAmbiental = require('../../models/MetricaAmbiental');
const { Op } = require('sequelize');

const FALLBACK_CITIES = [
  { id: 'lapaz',      name: 'La Paz',      lat: -16.4897, lng: -68.1193 },
  { id: 'cochabamba', name: 'Cochabamba',  lat: -17.3895, lng: -66.1568 },
  { id: 'santacruz',  name: 'Santa Cruz',  lat: -17.7833, lng: -63.1812 },
  { id: 'oruro',      name: 'Oruro',       lat: -17.9624, lng: -67.1061 },
  { id: 'potosi',     name: 'Potosí',      lat: -19.5836, lng: -65.7531 },
  { id: 'sucre',      name: 'Sucre',       lat: -19.0353, lng: -65.2592 },
  { id: 'tarija',     name: 'Tarija',      lat: -21.5355, lng: -64.7296 },
  { id: 'beni',       name: 'Trinidad',    lat: -14.8333, lng: -64.9000 },
  { id: 'pando',      name: 'Cobija',      lat: -11.0267, lng: -68.7692 },
];

const WEATHERS = [0, 1, 2, 3, 45, 48, 51, 61, 71, 95];

const historialController = {
  // Obtener histórico agrupado por "instantes"
  getHistorial: async (req, res) => {
    try {
      // Traemos todo ordenado cronológicamente
      const rows = await MetricaAmbiental.findAll({
        order: [['fecha_registro', 'ASC']]
      });

      // Agrupar por timestamp (minuto exacto o similar, pero acá agrupamos por la firma real de momento)
      // Como los seeds se crearán exactamente con el mismo timestamp para cada tick,
      // usaremos el valor numérico (getTime) para agrupar.
      const groups = {};
      
      rows.forEach(row => {
        const timeKey = new Date(row.fecha_registro).toISOString();
        if (!groups[timeKey]) {
          groups[timeKey] = {
            timestamp: timeKey,
            cities: []
          };
        }
        groups[timeKey].cities.push({
          id: row.ciudad.toLowerCase().replace(' ', ''), // id simulado
          name: row.ciudad,
          latitude: Number(row.latitud),
          longitude: Number(row.longitud),
          data: {
            temperature: Number(row.temperatura),
            aqi: row.aqi,
            humidity: row.detalles?.humidity || 50,
            waterQuality: row.detalles?.waterQuality || 80,
            noise: row.detalles?.noise || 60,
            weatherCode: row.condicion_climatica ? parseInt(row.condicion_climatica, 10) : null
          }
        });
      });

      // Convertir el objeto a array cronológico
      const timelineData = Object.values(groups).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      res.json(timelineData);
    } catch (error) {
      console.error(error);
      res.status(500).json({ msg: 'Error obteniendo historial', error: error.message });
    }
  },

  // Generar datos de prueba
  seedHistorial: async (req, res) => {
    try {
      const recordsToInsert = [];
      const now = new Date();
      // Crear 24 puntos históricos (uno por hora)
      for (let i = 24; i >= 0; i--) {
        const pastTime = new Date(now.getTime() - i * 60 * 60 * 1000);
        
        for (const city of FALLBACK_CITIES) {
          recordsToInsert.push({
            latitud: city.lat,
            longitud: city.lng,
            ciudad: city.name,
            temperatura: (Math.random() * 20 + 5).toFixed(2), // 5 a 25
            aqi: Math.floor(Math.random() * 150),
            condicion_climatica: String(WEATHERS[Math.floor(Math.random() * WEATHERS.length)]),
            detalles: {
              humidity: Math.floor(Math.random() * 60 + 30),
              waterQuality: Math.floor(Math.random() * 40 + 50),
              noise: Math.floor(Math.random() * 50 + 40),
            },
            fecha_registro: pastTime
          });
        }
      }

      await MetricaAmbiental.bulkCreate(recordsToInsert);
      res.json({ msg: 'Datos de prueba inyectados (24 horas)', count: recordsToInsert.length });
    } catch (error) {
       console.error(error);
       res.status(500).json({ msg: 'Error en seeding', error: error.message });
    }
  },

  // Borrar todos los datos (para limpiar pruebas)
  clearHistorial: async (req, res) => {
    try {
      await MetricaAmbiental.destroy({ where: {} });
      // reiniciar la secuencia del id si se desea, por ahora solo borramos data.
      res.json({ msg: 'Todo el historial de métricas ambientales ha sido borrado exitosamente.' });
    } catch (error) {
       console.error(error);
       res.status(500).json({ msg: 'Error limpiando base de datos', error: error.message });
    }
  }
};

module.exports = historialController;
