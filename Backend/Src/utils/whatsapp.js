/**
 * Utility for sending WhatsApp notifications via whatsapp-web.js (Real session).
 */
const client = require('../config/whatsappClient');

const sendWhatsAppMessage = async (number, message) => {
  try {
    // Limpiar el número y formatearlo para whatsapp-web.js
    // Debe terminar en @c.us (ej: 59178114180@c.us)
    let cleanNumber = number.replace(/\D/g, '');
    
    // Si no tiene el formato correcto, intentamos asegurar el ID de chat
    const chatId = cleanNumber.includes('@c.us') ? cleanNumber : `${cleanNumber}@c.us`;

    // Verificamos si el cliente está listo
    // Note: client.pupPage is a way to check if it's initialized
    if (!client.info) {
        console.warn('[WhatsApp] El cliente no está listo aún. Escanea el QR primero.');
        return false;
    }

    await client.sendMessage(chatId, message);
    console.log(`[WhatsApp] Mensaje enviado correctamente a ${chatId}`);
    return true;
  } catch (error) {
    console.error(`[WhatsApp] Error enviando mensaje a ${number}:`, error.message);
    return false;
  }
};

module.exports = { sendWhatsAppMessage };
