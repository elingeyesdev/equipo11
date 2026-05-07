const TelegramBot = require('node-telegram-bot-api');

/**
 * Listener para que el bot responda con el Chat ID del usuario.
 * Útil para la configuración inicial y presentaciones.
 */
const startTelegramListener = () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!token) {
        console.warn('[Telegram Listener] No hay token configurado. Listener desactivado.');
        return;
    }

    // Inicializamos el bot en modo polling (escuchando)
    const bot = new TelegramBot(token, { polling: true });

    console.log('✈️ [Telegram Listener] Escuchando mensajes para dar IDs...');

    // Escuchar cualquier mensaje
    bot.on('message', (msg) => {
        const chatId = msg.chat.id;
        const firstName = msg.from.first_name || 'Usuario';

        const welcomeMsg = `Hola ${firstName}! 👋\n\n` +
                           `Tu **ID de Chat** es:\n` +
                           `<code>${chatId}</code>\n\n` +
                           `Cópialo y pégalo en el panel de EnviroSense para recibir alertas críticas aquí.`;

        bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'HTML' });
        console.log(`[Telegram Listener] ID enviado a ${firstName} (${chatId})`);
    });

    bot.on('polling_error', (error) => {
        console.error('[Telegram Listener] Error de polling:', error.message);
    });

    // Detener el polling limpiamente cuando Nodemon o el proceso se cierre
    const stopPolling = () => {
        console.log('[Telegram Listener] Deteniendo polling de Telegram...');
        bot.stopPolling();
    };

    process.once('SIGINT', stopPolling);
    process.once('SIGTERM', stopPolling);
    process.once('SIGUSR2', stopPolling); // Nodemon restart signal
};

module.exports = { startTelegramListener };
