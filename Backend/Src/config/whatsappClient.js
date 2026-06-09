const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const { execSync } = require('child_process');
const logger = require('../utils/logger');

// 1. Matar procesos huérfanos de Chromium que se quedan colgados cuando Nodemon reinicia la app (solo en Linux/macOS)
if (process.platform !== 'win32') {
    try {
        execSync('pkill -f chrome');
        execSync('pkill -f chromium');
        logger.info('🧹 [WhatsApp] Procesos huérfanos de Chrome/Chromium cerrados.');
    } catch (e) {
        // Ignorar si no hay procesos
    }
}

// 2. Limpieza robusta y recursiva de bloqueos de Chromium (SingletonLock)
const lockDir = path.join(__dirname, '../../.wwebjs_auth');
const deleteSingletonLock = (dirPath) => {
    if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const curPath = path.join(dirPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteSingletonLock(curPath);
            } else if (file === 'SingletonLock') {
                try {
                    fs.unlinkSync(curPath);
                    logger.info('🧹 [WhatsApp] Bloqueo de sesión anterior limpiado en:', curPath);
                } catch (e) {
                    logger.warn('[WhatsApp] No se pudo borrar el bloqueo, intentando continuar...', e.message);
                }
            }
        }
    }
};
deleteSingletonLock(lockDir);

// Creamos la instancia del cliente con persistencia de sesión local
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
        // Necesario para correr dentro de Docker y evitar bloqueos de perfil
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        ],
        executablePath: process.env.CHROME_BIN || null,
    }
});

let qrCount = 0;
client.on('qr', (qr) => {
    qrCount++;
    if (qrCount === 1) {
        logger.info('---------------------------------------------------------');
        logger.info('SCAN THIS QR CODE WITH WHATSAPP TO CONNECT:');
        qrcode.generate(qr, { small: true });
        logger.info('---------------------------------------------------------');
        logger.info('💡 El código QR se muestra en la consola y se guardará en data/last_qr.html');
    } else {
        logger.info(`🔄 [WhatsApp] Código QR actualizado (intento #${qrCount}). Actualizando data/last_qr.html...`);
    }

    // Guardar el QR en un archivo HTML interactivo para facilitar el escaneo local en el navegador
    try {
        const qrHtmlPath = path.join(__dirname, '../../data/last_qr.html');
        const dataDir = path.dirname(qrHtmlPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <!-- Refrescar la página automáticamente cada 10 segundos para cargar el QR actualizado -->
  <meta http-equiv="refresh" content="10">
  <title>EnviroSense - WhatsApp QR Link</title>
</head>
<body style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f2ea; color: #2e3b2e;">
  <div style="background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; max-width: 400px; border: 1px solid #e2dfd5;">
    <h2 style="margin-top: 0; font-family: Georgia, serif; font-size: 24px; color: #1f3622;">Conectar WhatsApp</h2>
    <p style="color: #6d756e; font-size: 14px; margin-bottom: 25px;">Escanea este código QR con la app de WhatsApp de tu teléfono para iniciar sesión.</p>
    <div style="background: #fdfdfc; padding: 16px; display: inline-block; border-radius: 12px; border: 1px solid #f0eee7;">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}" alt="WhatsApp QR Code" style="display: block; width: 300px; height: 300px;" />
    </div>
    <p style="margin-top: 25px; font-size: 12px; color: #9aa19a;">Generado automáticamente por el servidor de EnviroSense.</p>
    <p style="font-size: 11px; color: #c0c7c0; margin: 5px 0 0 0;">(La página se recarga sola cada 10s para mantener el código activo)</p>
  </div>
</body>
</html>`;

        fs.writeFileSync(qrHtmlPath, htmlContent, 'utf-8');
        if (qrCount === 1) {
            logger.info('🌐 [WhatsApp] QR guardado en archivo interactivo: data/last_qr.html. Abre este archivo en tu navegador para escanearlo.');
        }
    } catch (err) {
        logger.warn('[WhatsApp] No se pudo guardar el archivo last_qr.html:', err.message);
    }
});

client.on('ready', () => {
    logger.info('✅ WhatsApp Web Client is READY!');
    // Eliminar el archivo de QR temporal ya que la sesión está activa
    try {
        const qrHtmlPath = path.join(__dirname, '../../data/last_qr.html');
        if (fs.existsSync(qrHtmlPath)) {
            fs.unlinkSync(qrHtmlPath);
            logger.info('🧹 [WhatsApp] QR temporal eliminado de data/last_qr.html (Sesión lista)');
        }
    } catch (e) {
        // Ignorar
    }
});

client.on('authenticated', () => {
    logger.info('✅ WhatsApp Authenticated');
});

client.on('auth_failure', (msg) => {
    logger.error('❌ WhatsApp Auth Failure:', msg);
});

client.on('disconnected', (reason) => {
    logger.warn(`⚠️ WhatsApp Client Disconnected: ${reason}`);
    if (reason === 'LOGOUT') {
        logger.warn('📱 WhatsApp session expired. QR re-scan required.');
    }
    // Reintentar inicialización después de 30s
    setTimeout(() => {
        logger.info('🔄 Attempting WhatsApp reconnection...');
        client.initialize();
    }, 30000);
});

// Exported helpers for healthcheck
function isReady() {
    return !!(client.info && client.pupPage);
}

function getStatus() {
    if (!client.info) return 'uninitialized';
    if (!client.pupPage) return 'connecting';
    return 'ready';
}

// Inicializamos el cliente
client.initialize();

module.exports = client;
module.exports.isReady = isReady;
module.exports.getStatus = getStatus;
