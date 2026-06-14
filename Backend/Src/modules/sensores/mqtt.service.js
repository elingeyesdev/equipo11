const mqtt = require('mqtt');
const pool = require('../../config/db');
const logger = require('../../utils/logger');

const BROKER_URL = 'mqtts://276fec7325274dc58799cbc0e7451014.s1.eu.hivemq.cloud:8883';
const options = {
  username: 'admin',
  password: 'Admin1234',
  clientId: `envirosense_backend_${Math.random().toString(16).substring(2, 10)}`,
  rejectUnauthorized: true,
  reconnectPeriod: 5000
};

let client = null;
const topicToSensorMetric = new Map(); // Key: topic, Value: { sensorId, metric }

const initMqtt = async () => {
  try {
    logger.info('[MQTT] Conectando a HiveMQ Cloud...');
    client = mqtt.connect(BROKER_URL, options);

    client.on('connect', async () => {
      logger.info('[MQTT] ✅ Conectado exitosamente a HiveMQ Cloud');
      await reloadSubscriptions();
    });

    client.on('message', async (topic, message) => {
      try {
        const payload = message.toString();
        let value = parseFloat(payload);
        if (isNaN(value)) {
          logger.warn(`[MQTT] Payload no numérico recibido en tema ${topic}: ${payload}`);
          return;
        }

        const target = topicToSensorMetric.get(topic);
        if (!target) return;

        const { sensorId, metric } = target;
        
        let dbCol = metric;
        if (metric === 'calidad de aire' || metric === 'aqi') dbCol = 'aqi';
        else if (metric === 'calidad de agua' || metric === 'ica') dbCol = 'ica';

        // Si es el tema de gas crudo, realizar conversión a escala AQI estándar (0-500)
        if (topic.includes('gas_crudo')) {
          const raw = value;
          if (raw <= 150) {
            value = (raw / 150) * 50;
          } else if (raw <= 300) {
            value = 50 + ((raw - 150) / 150) * 50;
          } else if (raw <= 500) {
            value = 100 + ((raw - 300) / 200) * 50;
          } else if (raw <= 700) {
            value = 150 + ((raw - 500) / 200) * 50;
          } else if (raw <= 850) {
            value = 200 + ((raw - 700) / 150) * 100;
          } else {
            value = 300 + ((Math.min(raw, 1024) - 850) / 174) * 200;
          }
          logger.info(`[MQTT] 💨 Conversión de gas_crudo a AQI: ${raw} -> ${value.toFixed(1)}`);
        }

        logger.info(`[MQTT] 📨 Mensaje en ${topic}: actualizando sensor ${sensorId} (${dbCol}) -> ${value}`);

        await pool.query(
          `UPDATE sensores_cache
           SET ${dbCol} = $1, actualizado_en = NOW()
           WHERE sensor_id = $2`,
          [value, sensorId]
        );
      } catch (err) {
        logger.error(`[MQTT] Error al procesar mensaje en ${topic}:`, err.message);
      }
    });

    client.on('error', (err) => {
      logger.error('[MQTT] ❌ Error en conexión MQTT:', err.message);
    });

    client.on('close', () => {
      logger.warn('[MQTT] Conexión MQTT cerrada');
    });
  } catch (err) {
    logger.error('[MQTT] Error inicializando servicio MQTT:', err.message);
  }
};

const reloadSubscriptions = async () => {
  if (!client || !client.connected) {
    logger.warn('[MQTT] No se puede recargar suscripciones: Cliente MQTT no conectado');
    return;
  }

  try {
    const { rows: sensores } = await pool.query(
      `SELECT sensor_id, topics FROM sensores_cache WHERE es_custom = TRUE`
    );

    const oldTopics = Array.from(topicToSensorMetric.keys());
    if (oldTopics.length > 0) {
      client.unsubscribe(oldTopics);
      topicToSensorMetric.clear();
      logger.info(`[MQTT] Desuscrito de ${oldTopics.length} temas antiguos.`);
    }

    const newTopics = [];
    for (const sensor of sensores) {
      const topicsObj = sensor.topics || {};
      for (const [metric, topic] of Object.entries(topicsObj)) {
        if (topic && topic.trim() !== '') {
          const cleanTopic = topic.trim();
          topicToSensorMetric.set(cleanTopic, { sensorId: sensor.sensor_id, metric });
          newTopics.push(cleanTopic);
        }
      }
    }

    if (newTopics.length > 0) {
      client.subscribe(newTopics, (err) => {
        if (err) {
          logger.error('[MQTT] Error suscribiendo a temas:', err.message);
        } else {
          logger.info(`[MQTT] ✅ Suscrito exitosamente a ${newTopics.length} temas MQTT: ${newTopics.join(', ')}`);
        }
      });
    }
  } catch (err) {
    logger.error('[MQTT] Error recargando suscripciones MQTT:', err.message);
  }
};

const stopMqtt = () => {
  if (client) {
    client.end();
    client = null;
    logger.info('[MQTT] Cliente MQTT finalizado.');
  }
};

module.exports = {
  initMqtt,
  reloadSubscriptions,
  stopMqtt
};
