/**
 * Utility for sending Telegram notifications via Bot API.
 */
const sendTelegramMessage = async (chatId, message) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !chatId) {
    console.warn('[Telegram] Bot Token or Chat ID missing. Skipping notification.');
    return false;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.description || 'Error sending message');
    }

    console.log(`[Telegram] Mensaje enviado a ${chatId}`);
    return true;
  } catch (error) {
    console.error(`[Telegram] Error enviando mensaje a ${chatId}:`, error.message);
    return false;
  }
};

module.exports = { sendTelegramMessage };
