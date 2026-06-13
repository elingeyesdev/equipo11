const tls = require('tls');
const net = require('net');
const logger = require('../utils/logger');
const pool = require('./db');

let clientSocket = null;
let keepAliveTimer = null;
let reconnectTimer = null;
let isConnected = false;
const subscriptions = new Map(); // topic -> { sensorId, metric }

function encodeRemainingLength(num) {
  const bytes = [];
  do {
    let byte = num % 128;
    num = Math.floor(num / 128);
    if (num > 0) {
      byte = byte | 128;
    }
    bytes.push(byte);
  } while (num > 0);
  return Buffer.from(bytes);
}

function decodeRemainingLength(buffer, startOffset) {
  let multiplier = 1;
  let value = 0;
  let offset = startOffset;
  let encodedByte;
  do {
    if (offset >= buffer.length) {
      throw new Error("Out of bounds decoding remaining length");
    }
    encodedByte = buffer[offset++];
    value += (encodedByte & 127) * multiplier;
    multiplier *= 128;
    if (multiplier > 128 * 128 * 128) {
      throw new Error("Malformed Remaining Length");
    }
  } while ((encodedByte & 128) !== 0);
  return { value, bytesRead: offset - startOffset };
}

function encodeString(str) {
  const buf = Buffer.from(str, 'utf8');
  const lenBuf = Buffer.alloc(2);
  lenBuf.writeUInt16BE(buf.length, 0);
  return Buffer.concat([lenBuf, buf]);
}

function createConnectPacket(clientId, username, password) {
  const protocolName = encodeString("MQTT");
  const protocolLevel = Buffer.from([0x04]); // MQTT 3.1.1

  let connectFlagsByte = 0x02; // Clean Session
  if (username) connectFlagsByte |= 0x80;
  if (password) connectFlagsByte |= 0x40;

  const connectFlags = Buffer.from([connectFlagsByte]);
  const keepAlive = Buffer.from([0x00, 0x1E]); // 30 seconds

  const payloadParts = [];
  payloadParts.push(encodeString(clientId));
  if (username) payloadParts.push(encodeString(username));
  if (password) payloadParts.push(encodeString(password));

  const variableHeaderAndPayload = Buffer.concat([
    protocolName,
    protocolLevel,
    connectFlags,
    keepAlive,
    ...payloadParts
  ]);

  const remainingLength = encodeRemainingLength(variableHeaderAndPayload.length);
  return Buffer.concat([
    Buffer.from([0x10]), // CONNECT
    remainingLength,
    variableHeaderAndPayload
  ]);
}

let nextPacketId = 1;
function createSubscribePacket(topic) {
  const packetIdBuf = Buffer.alloc(2);
  packetIdBuf.writeUInt16BE(nextPacketId++, 0);
  if (nextPacketId > 65535) nextPacketId = 1;

  const topicFilter = encodeString(topic);
  const qosByte = Buffer.from([0x00]); // QoS 0

  const variableHeaderAndPayload = Buffer.concat([
    packetIdBuf,
    topicFilter,
    qosByte
  ]);

  const remainingLength = encodeRemainingLength(variableHeaderAndPayload.length);
  return Buffer.concat([
    Buffer.from([0x82]), // SUBSCRIBE
    remainingLength,
    variableHeaderAndPayload
  ]);
}

function sendPing() {
  if (!isConnected || !clientSocket) return;
  try {
    clientSocket.write(Buffer.from([0xC0, 0x00])); // PINGREQ
  } catch (err) {
    logger.warn('[MQTT] Error sending PINGREQ: ' + err.message);
    handleDisconnect();
  }
}

async function loadSubscriptionsFromDb() {
  try {
    const { rows } = await pool.query('SELECT * FROM sensores_mqtt');
    subscriptions.clear();
    for (const row of rows) {
      if (row.topic_temperatura) subscriptions.set(row.topic_temperatura, { sensorId: row.sensor_id, metric: 'temperatura' });
      if (row.topic_humedad) subscriptions.set(row.topic_humedad, { sensorId: row.sensor_id, metric: 'humedad' });
      if (row.topic_aqi) subscriptions.set(row.topic_aqi, { sensorId: row.sensor_id, metric: 'aqi' });
      if (row.topic_ruido) subscriptions.set(row.topic_ruido, { sensorId: row.sensor_id, metric: 'ruido' });
      if (row.topic_ica) subscriptions.set(row.topic_ica, { sensorId: row.sensor_id, metric: 'ica' });
    }
    logger.info(`[MQTT] Loaded ${subscriptions.size} subscriptions from database.`);
  } catch (err) {
    logger.error('[MQTT] Error loading subscriptions from DB: ' + err.message);
  }
}

function subscribeToAll() {
  if (!isConnected || !clientSocket) return;
  for (const topic of subscriptions.keys()) {
    try {
      clientSocket.write(createSubscribePacket(topic));
      logger.info(`[MQTT] Subscribed to topic: ${topic}`);
    } catch (err) {
      logger.error(`[MQTT] Error subscribing to topic ${topic}: ` + err.message);
    }
  }
}

function subscribeToNewSensor(sensor) {
  const topicsToAdd = [];
  if (sensor.topic_temperatura) {
    subscriptions.set(sensor.topic_temperatura, { sensorId: sensor.sensor_id, metric: 'temperatura' });
    topicsToAdd.push(sensor.topic_temperatura);
  }
  if (sensor.topic_humedad) {
    subscriptions.set(sensor.topic_humedad, { sensorId: sensor.sensor_id, metric: 'humedad' });
    topicsToAdd.push(sensor.topic_humedad);
  }
  if (sensor.topic_aqi) {
    subscriptions.set(sensor.topic_aqi, { sensorId: sensor.sensor_id, metric: 'aqi' });
    topicsToAdd.push(sensor.topic_aqi);
  }
  if (sensor.topic_ruido) {
    subscriptions.set(sensor.topic_ruido, { sensorId: sensor.sensor_id, metric: 'ruido' });
    topicsToAdd.push(sensor.topic_ruido);
  }
  if (sensor.topic_ica) {
    subscriptions.set(sensor.topic_ica, { sensorId: sensor.sensor_id, metric: 'ica' });
    topicsToAdd.push(sensor.topic_ica);
  }

  if (isConnected && clientSocket) {
    for (const topic of topicsToAdd) {
      try {
        clientSocket.write(createSubscribePacket(topic));
        logger.info(`[MQTT] Dynamic subscription to topic: ${topic}`);
      } catch (err) {
        logger.error(`[MQTT] Error subscribing to topic ${topic}: ` + err.message);
      }
    }
  }
}

function unsubscribeFromSensor(sensor) {
  const topicsToRemove = [
    sensor.topic_temperatura,
    sensor.topic_humedad,
    sensor.topic_aqi,
    sensor.topic_ruido,
    sensor.topic_ica
  ].filter(Boolean);

  for (const topic of topicsToRemove) {
    subscriptions.delete(topic);
    if (isConnected && clientSocket) {
      try {
        const topicBuf = Buffer.from(topic, 'utf8');
        const topicLen = Buffer.alloc(2);
        topicLen.writeUInt16BE(topicBuf.length, 0);
        const packetId = Buffer.from([0x00, Math.floor(Math.random() * 255) + 1]);
        const payload = Buffer.concat([packetId, topicLen, topicBuf]);
        const fixedHeader = Buffer.from([0xA2]); // UNSUBSCRIBE

        let remainingLength = payload.length;
        const lenBytes = [];
        do {
          let b = remainingLength % 128;
          remainingLength = Math.floor(remainingLength / 128);
          if (remainingLength > 0) b |= 128;
          lenBytes.push(b);
        } while (remainingLength > 0);

        const finalPacket = Buffer.concat([fixedHeader, Buffer.from(lenBytes), payload]);
        clientSocket.write(finalPacket);
        logger.info(`[MQTT] Unsubscribed from topic: ${topic}`);
      } catch (err) {
        logger.error(`[MQTT] Error unsubscribing from topic ${topic}: ` + err.message);
      }
    }
  }
}

async function handleMqttMessage(topic, payload) {
  logger.info(`[MQTT] Message received. Topic: ${topic}, Payload: ${payload}`);
  const mapping = subscriptions.get(topic);
  if (!mapping) {
    logger.warn(`[MQTT] No mapping found for topic: ${topic}`);
    return;
  }

  const { sensorId, metric } = mapping;
  let value = parseFloat(payload);

  if (isNaN(value)) {
    if (metric === 'aqi') {
      const upper = payload.trim().toUpperCase();
      if (upper === 'BUENA') value = 25;
      else if (upper === 'MODERADA') value = 75;
      else if (upper === 'MALA' || upper === 'DAÑINO' || upper === 'DAÑINO (SENSIBLES)') value = 125;
      else if (upper === 'PELIGROSA') value = 350;
      else {
        logger.warn(`[MQTT] Unrecognized non-numeric payload for AQI: ${payload}`);
        return;
      }
    } else {
      logger.warn(`[MQTT] Non-numeric payload for metric ${metric}: ${payload}`);
      return;
    }
  }

  try {
    // 1. Update cache
    await pool.query(`
      UPDATE sensores_cache SET
        ${metric} = $2,
        actualizado_en = NOW()
      WHERE sensor_id = $1
    `, [sensorId, value]);

    // 2. Load sensor details
    const sensorRes = await pool.query('SELECT nombre, latitud, longitud FROM sensores_cache WHERE sensor_id = $1', [sensorId]);
    if (sensorRes.rows.length > 0) {
      const sensor = sensorRes.rows[0];

      const { getDbMapping } = require('../utils/dbMapping');
      const dbMapping = await getDbMapping();
      let localidadId = dbMapping.localidades[sensor.nombre.toLowerCase()];

      if (!localidadId) {
        const dbLocRes = await pool.query('SELECT id FROM localidades WHERE LOWER(nombre) = LOWER($1)', [sensor.nombre]);
        if (dbLocRes.rows.length > 0) {
          localidadId = dbLocRes.rows[0].id;
        } else {
          // Find nearest region
          const regRes = await pool.query(`
            SELECT region_id FROM localidades
            ORDER BY (latitud - $1)^2 + (longitud - $2)^2 ASC
            LIMIT 1
          `, [sensor.latitud, sensor.longitud]);
          const regionId = regRes.rows[0]?.region_id || 1;

          const insertLocRes = await pool.query(`
            INSERT INTO localidades (region_id, nombre, latitud, longitud)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (region_id, nombre) DO UPDATE SET latitud = EXCLUDED.latitud, longitud = EXCLUDED.longitud
            RETURNING id
          `, [regionId, sensor.nombre, sensor.latitud, sensor.longitud]);

          localidadId = insertLocRes.rows[0].id;
          dbMapping.localidades[sensor.nombre.toLowerCase()] = localidadId;
        }
      }

      // 3. Write to readings timeseries table
      const metricaId = dbMapping.metricas[metric];
      if (metricaId && localidadId) {
        const fuenteId = dbMapping.fuentes_datos?.['sensor'] || 6;
        await pool.query(`
          INSERT INTO lecturas (tiempo, localidad_id, metrica_id, valor, fuente_id)
          VALUES (NOW(), $1, $2, $3, $4)
          ON CONFLICT (tiempo, localidad_id, metrica_id) DO UPDATE SET valor = EXCLUDED.valor
        `, [localidadId, metricaId, value, fuenteId]);

        logger.info(`[MQTT] Saved reading to DB: Sensor=${sensor.nombre}, ${metric}=${value}`);
      }
    }
  } catch (err) {
    logger.error('[MQTT] Error processing MQTT reading: ' + err.message);
  }
}

let dataAccumulator = Buffer.alloc(0);

function handleData(chunk) {
  dataAccumulator = Buffer.concat([dataAccumulator, chunk]);

  while (dataAccumulator.length >= 2) {
    const type = dataAccumulator[0] >> 4;
    try {
      const { value: remainingLength, bytesRead } = decodeRemainingLength(dataAccumulator, 1);
      const totalPacketLength = 1 + bytesRead + remainingLength;

      if (dataAccumulator.length < totalPacketLength) {
        break;
      }

      const packet = dataAccumulator.subarray(0, totalPacketLength);
      dataAccumulator = dataAccumulator.subarray(totalPacketLength);

      if (type === 2) { // CONNACK
        const returnCode = packet[1 + bytesRead + 1];
        if (returnCode === 0) {
          isConnected = true;
          logger.info('[MQTT] Successfully authenticated and connected to HiveMQ broker.');
          subscribeToAll();
        } else {
          logger.error(`[MQTT] Connection rejected by MQTT Broker (code ${returnCode}).`);
          handleDisconnect();
        }
      } else if (type === 3) { // PUBLISH
        const topicLen = packet.readUInt16BE(1 + bytesRead);
        const topic = packet.subarray(1 + bytesRead + 2, 1 + bytesRead + 2 + topicLen).toString('utf8');
        let payloadOffset = 1 + bytesRead + 2 + topicLen;

        const qos = (packet[0] & 0x06) >> 1;
        if (qos > 0) {
          payloadOffset += 2;
        }

        const payload = packet.subarray(payloadOffset).toString('utf8');
        handleMqttMessage(topic, payload);
      } else if (type === 13) { // PINGRESP
        // Ping response received successfully
      }
    } catch (err) {
      logger.error('[MQTT] Packet parsing error: ' + err.message);
      dataAccumulator = Buffer.alloc(0);
      break;
    }
  }
}

async function connectMqtt() {
  const host = process.env.MQTT_BROKER;
  const port = parseInt(process.env.MQTT_PORT || '8883', 10);

  if (!host) {
    logger.warn('[MQTT] MQTT_BROKER env var is missing. MQTT listener is disabled.');
    return;
  }

  // Load subscriptions first
  await loadSubscriptionsFromDb();

  logger.info(`[MQTT] Connecting to HiveMQ broker at ${host}:${port}...`);
  dataAccumulator = Buffer.alloc(0);

  const options = {
    host,
    port,
    servername: host, // Required for HiveMQ Cloud (SNI)
    rejectUnauthorized: false
  };

  try {
    if (port === 8883) {
      clientSocket = tls.connect(options, onConnected);
    } else {
      clientSocket = net.connect(options, onConnected);
    }

    clientSocket.on('data', handleData);
    clientSocket.on('error', (err) => {
      logger.error('[MQTT] Connection socket error: ' + err.message);
      handleDisconnect();
    });
    clientSocket.on('close', () => {
      logger.warn('[MQTT] Connection closed.');
      handleDisconnect();
    });
  } catch (err) {
    logger.error('[MQTT] Connection establishment failed: ' + err.message);
    handleDisconnect();
  }
}

function onConnected() {
  logger.info('[MQTT] Connection socket connected. Handshaking CONNECT...');
  const clientId = 'EnviroSenseServer-' + Math.random().toString(16).substring(2, 8);
  const connectPacket = createConnectPacket(clientId, process.env.MQTT_USER, process.env.MQTT_PASSWORD);
  clientSocket.write(connectPacket);

  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = setInterval(sendPing, 20000); // Send PING every 20s
}

function handleDisconnect() {
  isConnected = false;
  if (clientSocket) {
    try { clientSocket.destroy(); } catch (e) { }
    clientSocket = null;
  }
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }

  if (!reconnectTimer) {
    logger.info('[MQTT] Attempting to reconnect in 10s...');
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectMqtt();
    }, 10000);
  }
}

function disconnectMqtt() {
  isConnected = false;
  if (clientSocket) {
    try { clientSocket.end(); } catch (e) { }
    clientSocket = null;
  }
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  logger.info('[MQTT] Client stopped.');
}

module.exports = {
  connectMqtt,
  disconnectMqtt,
  subscribeToNewSensor,
  unsubscribeFromSensor
};
