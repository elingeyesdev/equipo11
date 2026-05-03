const db = require('../../config/db');
const { sendEmail } = require('../../utils/mailer');
const { sendWhatsAppMessage } = require('../../utils/whatsapp');
const { sendTelegramMessage } = require('../../utils/telegram');

/**
 * Notifica a través de los canales configurados.
 */
const notifyAlert = async (alerta) => {
  try {
    const { rows: settings } = await db.query('SELECT * FROM configuracion_notificaciones WHERE habilitado = TRUE');
    
    console.log(`[Notificaciones] Procesando alerta para ${alerta.ciudad_nombre}. Canales activos: ${settings.length}`);

    if (settings.length === 0) {
      console.log('[Notificaciones] No hay canales habilitados. Abortando.');
      return;
    }

    const message = `🚨 <b>Alerta Ambiental</b>\n\n` +
                    `Ciudad: <b>${alerta.ciudad_nombre}</b>\n` +
                    `Indicador: <b>${alerta.metrica_clave.toUpperCase()}</b>\n` +
                    `Valor: <b>${alerta.valor}</b>\n` +
                    `Nivel: <b>${alerta.label}</b> (${alerta.severidad})`;

    for (const s of settings) {
      if (s.tipo === 'email') {
        await sendEmail(
          s.destino, 
          `Alerta ${alerta.severidad.toUpperCase()}: ${alerta.metrica_clave.toUpperCase()} en ${alerta.ciudad_nombre}`,
          'Alerta de Umbral Crítico',
          `La ciudad de <b>${alerta.ciudad_nombre}</b> ha alcanzado un nivel de <b>${alerta.label}</b> en <b>${alerta.metrica_clave.toUpperCase()}</b> con un valor de <b>${alerta.valor}</b>.`,
          'Ver Panel',
          `http://localhost:5173/`
        );
      } else if (s.tipo === 'whatsapp') {
        const waMessage = `🚨 *Alerta Ambiental*\n\n` +
                         `Ciudad: *${alerta.ciudad_nombre}*\n` +
                         `Indicador: *${alerta.metrica_clave.toUpperCase()}*\n` +
                         `Valor: *${alerta.valor}*\n` +
                         `Nivel: *${alerta.label}*`;
        await sendWhatsAppMessage(s.destino, waMessage);
      } else if (s.tipo === 'telegram') {
        await sendTelegramMessage(s.destino, message);
      }
    }
  } catch (err) {
    console.error('[Notificaciones] Error procesando notificación:', err.message);
  }
};

module.exports = { notifyAlert };
