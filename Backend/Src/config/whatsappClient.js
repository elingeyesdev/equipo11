const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Limpieza de bloqueos de Chromium (Evita el error de "Profile in use")
const lockPath = path.join(__dirname, '../../.wwebjs_auth/session/Default/SingletonLock');
if (fs.existsSync(lockPath)) {
    try {
        fs.unlinkSync(lockPath);
        console.log('🧹 [WhatsApp] Bloqueo de sesión anterior limpiado.');
    } catch (e) {
        // A veces es un enlace simbólico, intentamos de nuevo
        console.warn('[WhatsApp] No se pudo borrar el bloqueo, intentando continuar...');
    }
}

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
            '--no-zygote',
            '--single-process'
        ],
        executablePath: process.env.CHROME_BIN || null,
    }
});

client.on('qr', (qr) => {
    console.log('---------------------------------------------------------');
    console.log('SCAN THIS QR CODE WITH WHATSAPP TO CONNECT:');
    qrcode.generate(qr, { small: true });
    console.log('---------------------------------------------------------');
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
