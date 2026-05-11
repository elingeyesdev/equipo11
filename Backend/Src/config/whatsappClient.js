const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const { execSync } = require('child_process');

// 1. Matar procesos huérfanos de Chromium que se quedan colgados cuando Nodemon reinicia la app
try {
    execSync('pkill -f chrome');
    execSync('pkill -f chromium');
    console.log('🧹 [WhatsApp] Procesos huérfanos de Chrome/Chromium cerrados.');
} catch (e) {
    // Ignorar si no hay procesos
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
                    console.log('🧹 [WhatsApp] Bloqueo de sesión anterior limpiado en:', curPath);
                } catch (e) {
                    console.warn('[WhatsApp] No se pudo borrar el bloqueo, intentando continuar...', e.message);
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
            '--disable-gpu'
        ],
        executablePath: process.env.CHROME_BIN || null,
    }
});

let qrShown = false;
client.on('qr', (qr) => {
    if (qrShown) return;
    qrShown = true;
    console.log('---------------------------------------------------------');
    console.log('SCAN THIS QR CODE WITH WHATSAPP TO CONNECT:');
    qrcode.generate(qr, { small: true });
    console.log('---------------------------------------------------------');
    console.log('💡 El código QR se muestra solo una vez para evitar saturar la consola.');
});

client.on('ready', () => {
    console.log('✅ WhatsApp Web Client is READY!');
});

client.on('authenticated', () => {
    console.log('✅ WhatsApp Authenticated');
});

client.on('auth_failure', (msg) => {
    console.error('❌ WhatsApp Auth Failure:', msg);
});

// Inicializamos el cliente
client.initialize();

module.exports = client;
