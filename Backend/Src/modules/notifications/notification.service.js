const admin = require('firebase-admin');
const logger = require('../../utils/logger');

let app;

function getFirebaseApp() {
  if (!app) {
    let serviceAccount;
    try {
      let rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!rawEnv) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not defined.');
      }
      
      // Limpiar comillas simples iniciales/finales si existen
      if (rawEnv.startsWith("'") && rawEnv.endsWith("'")) {
        rawEnv = rawEnv.slice(1, -1);
      }
      serviceAccount = JSON.parse(rawEnv);
    } catch (e) {
      logger.error('[notifications] Error parsing FIREBASE_SERVICE_ACCOUNT env variable:', e.message);
      return null;
    }

    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      app = admin.app();
      logger.info('[notifications] Firebase Admin inicializado correctamente.');
    } catch (err) {
      logger.error('[notifications] Error al inicializar Firebase Admin:', err.message);
      return null;
    }
  }
  return app;
}

/**
 * Envía notificaciones push multicast.
 * @param {string[]} tokens - Lista de tokens FCM de destino.
 * @param {Object} payload - Objeto con title, body y opcionalmente data.
 * @returns {Promise<{ successCount: number, failureCount: number }>}
 */
async function sendPushNotification(tokens, payload) {
  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    logger.warn('[notifications] No se provieron tokens para enviar push.');
    return { successCount: 0, failureCount: 0 };
  }

  // Filtrar tokens vacíos, no válidos o nulos
  const cleanTokens = tokens.filter(t => t && typeof t === 'string' && t.trim().length > 0);
  if (cleanTokens.length === 0) {
    logger.warn('[notifications] Lista de tokens limpios está vacía.');
    return { successCount: 0, failureCount: 0 };
  }

  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) {
    logger.error('[notifications] Firebase Admin no está inicializado. Omitiendo envío.');
    return { successCount: 0, failureCount: cleanTokens.length };
  }

  try {
    const { title, body, data } = payload || {};
    
    // FCM requiere que todos los valores en el objeto 'data' sean strings
    const formattedData = {};
    if (data) {
      for (const [key, value] of Object.entries(data)) {
        formattedData[key] = typeof value === 'string' ? value : String(value);
      }
    }

    const message = {
      notification: {
        title: title || 'Alerta EnviroSense',
        body: body || 'Notificación del sistema'
      },
      tokens: cleanTokens,
    };

    if (Object.keys(formattedData).length > 0) {
      message.data = formattedData;
    }

    const response = await firebaseApp.messaging().sendEachForMulticast(message);
    logger.info(`[notifications] Push enviado: ${response.successCount} exitosos, ${response.failureCount} fallidos`);
    
    return {
      successCount: response.successCount || 0,
      failureCount: response.failureCount || 0
    };
  } catch (err) {
    logger.error('[notifications] Error al enviar push multicast:', err.message);
    return { successCount: 0, failureCount: cleanTokens.length };
  }
}

module.exports = { sendPushNotification };
