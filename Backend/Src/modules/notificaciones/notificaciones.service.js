const db = require('../../config/db');
const { sendEmail } = require('../../utils/mailer');
const { sendWhatsAppMessage } = require('../../utils/whatsapp');
const { sendTelegramMessage } = require('../../utils/telegram');
const logger = require('../../utils/logger');

// Cooldown para evitar spam de alertas (especialmente durante la simulación de ticks continuos)
const ultimoUserNotifyTime = new Map(); // Llave: "userId:metrica", Valor: timestamp
const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutos de cooldown por métrica

/**
 * Calcula la distancia entre dos coordenadas en Kilómetros usando la fórmula Haversine.
 */
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Notifica a los usuarios activos que se encuentran a menos de 50km de un foco de alerta.
 */
const notifyAlertByCoordinates = async ({ lat, lng, metrica, valor, label, severidad, source }) => {
  try {
    // Solo notificar umbrales altos (critica o emergencia)
    if (severidad !== 'critica' && severidad !== 'emergencia') {
      return;
    }

    const numericLat = parseFloat(lat);
    const numericLng = parseFloat(lng);

    if (isNaN(numericLat) || isNaN(numericLng)) {
      logger.warn(`[Notificaciones] Coordenadas inválidas para alertar: lat=${lat}, lng=${lng}`);
      return;
    }

    // 1. Obtener todos los usuarios con ubicación y canales habilitados
    const { rows: usuarios } = await db.query(
      `SELECT id, nombre, email, latitud, longitud, 
              notif_email, notif_whatsapp, whatsapp_destino, 
              notif_telegram, telegram_destino 
       FROM usuarios 
       WHERE (notif_email = TRUE OR notif_whatsapp = TRUE OR notif_telegram = TRUE)
         AND activo = TRUE`
    );

    if (usuarios.length === 0) return;

    // 2. Filtrar usuarios en un radio de 50 Km o enviar a todos por defecto si no tienen coordenadas (suscripción global)
    const usuariosEnZona = usuarios.filter(u => {
      if (u.latitud === null || u.longitud === null) {
        return true; // No tiene ubicación configurada, recibe notificaciones por defecto (suscripción global)
      }
      const dist = getDistanceKm(numericLat, numericLng, parseFloat(u.latitud), parseFloat(u.longitud));
      return dist <= 50; // radio de 50 km
    });

    if (usuariosEnZona.length === 0) {
      logger.info(`[Notificaciones] Alerta de ${metrica} en coord (${numericLat.toFixed(4)}, ${numericLng.toFixed(4)}): Ningún usuario registrado en un radio de 50km.`);
      return;
    }

    logger.info(`[Notificaciones] Alerta de ${metrica} en coord (${numericLat.toFixed(4)}, ${numericLng.toFixed(4)}): Notificando a ${usuariosEnZona.length} usuarios en el radio de 50km.`);

    // 3. Enviar notificaciones aplicando cooldown
    for (const u of usuariosEnZona) {
      const cooldownKey = `${u.id}:${metrica}`;
      const ahora = Date.now();
      const ultimoEnvio = ultimoUserNotifyTime.get(cooldownKey) || 0;

      if (ahora - ultimoEnvio < COOLDOWN_MS) {
        logger.info(`[Notificaciones] Omitiendo notificación a usuario ${u.email} para evitar spam (cooldown activo).`);
        continue;
      }

      // Actualizar cooldown
      ultimoUserNotifyTime.set(cooldownKey, ahora);

      const messageHTML = `🚨 <b>Alerta Ambiental en tu Zona</b>\n\n` +
                      `Origen: <b>${source}</b>\n` +
                      `Coordenadas: <b>${numericLat.toFixed(4)}, ${numericLng.toFixed(4)}</b>\n` +
                      `Indicador: <b>${metrica.toUpperCase()}</b>\n` +
                      `Valor: <b>${valor}</b>\n` +
                      `Nivel: <b>${label}</b> (${severidad})`;

      const messageText = `🚨 *Alerta Ambiental en tu Zona*\n\n` +
                          `Origen: *${source}*\n` +
                          `Coordenadas: *${numericLat.toFixed(4)}, ${numericLng.toFixed(4)}*\n` +
                          `Indicador: *${metrica.toUpperCase()}*\n` +
                          `Valor: *${valor}*\n` +
                          `Nivel: *${label}* (${severidad})`;

      // Canal Correo
      if (u.notif_email) {
        try {
          await sendEmail(
            u.email, 
            `Alerta Ambiental ${severidad.toUpperCase()} cerca de tu ubicación`,
            'Alerta Geográfica de Umbral Crítico',
            `Hola ${u.nombre}, la calidad ambiental cerca de tu ubicación registrada (<b>${numericLat.toFixed(4)}, ${numericLng.toFixed(4)}</b>) ha alcanzado un nivel de <b>${label}</b> en <b>${metrica.toUpperCase()}</b> con un valor de <b>${valor}</b>.`,
            'Ver Panel',
            `http://localhost:5173/`
          );
          logger.info(`[Notificaciones] Email enviado a ${u.email}`);
        } catch (mailErr) {
          logger.error(`[Notificaciones] Error enviando email a ${u.email}:`, mailErr.message);
        }
      }

      // Canal WhatsApp
      if (u.notif_whatsapp && u.whatsapp_destino) {
        try {
          await sendWhatsAppMessage(u.whatsapp_destino, messageText);
          logger.info(`[Notificaciones] WhatsApp enviado a ${u.whatsapp_destino}`);
        } catch (waErr) {
          logger.error(`[Notificaciones] Error enviando WhatsApp a ${u.whatsapp_destino}:`, waErr.message);
        }
      }

      // Canal Telegram
      if (u.notif_telegram && u.telegram_destino) {
        try {
          await sendTelegramMessage(u.telegram_destino, messageHTML);
          logger.info(`[Notificaciones] Telegram enviado a ${u.telegram_destino}`);
        } catch (tgErr) {
          logger.error(`[Notificaciones] Error enviando Telegram a ${u.telegram_destino}:`, tgErr.message);
        }
      }
    }

  } catch (err) {
    logger.error('[Notificaciones] Error en notifyAlertByCoordinates:', err.message);
  }
};

/**
 * Notifica a través del canal tradicional basándose en la localidad de la alerta.
 */
const notifyAlert = async (alerta) => {
  try {
    const { rows: locInfo } = await db.query(
      `SELECT latitud::float AS lat, longitud::float AS lng, nombre 
       FROM localidades 
       WHERE id = $1`,
      [alerta.localidad_id]
    );

    if (locInfo.length === 0 || locInfo[0].lat === null || locInfo[0].lng === null) {
      logger.warn(`[Notificaciones] No se encontraron coordenadas para localidad_id: ${alerta.localidad_id}`);
      return;
    }

    const { lat, lng, nombre } = locInfo[0];
    await notifyAlertByCoordinates({
      lat,
      lng,
      metrica: alerta.metrica_clave,
      valor: alerta.valor,
      label: alerta.label,
      severidad: alerta.severidad,
      source: `Sensor en ${nombre}`
    });
  } catch (err) {
    logger.error('[Notificaciones] Error en notifyAlert:', err.message);
  }
};

module.exports = { notifyAlert, notifyAlertByCoordinates };
