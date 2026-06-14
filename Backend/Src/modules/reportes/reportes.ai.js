const { success, error } = require('../../utils/response');
const logger = require('../../utils/logger');

const obtenerSugerenciaIA = async (req, res) => {
  try {
    const { ciudad, variable, datos } = req.body;

    if (!datos || !Array.isArray(datos) || datos.length === 0) {
      return error(res, 'No hay datos para analizar', 400);
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return error(res, 'DeepSeek API Key no configurada en el backend', 500);
    }

    // Preparar el resumen de datos para la IA
    const resumen = datos.map(d => `${d.timeLabel}: ${d.value}`).join(' | ');

    const prompt = `Actúa como un meteorólogo experto y analista de riesgos ambientales. 
Estoy monitoreando la variable "${variable}" para la ciudad de "${ciudad}" durante las próximas 96 horas.
Aquí tienes los datos proyectados:
[${resumen}]

Por favor, proporciona:
1. Un resumen conciso (2 líneas) de la tendencia general.
2. Identifica cualquier pico, anomalía o valor extremo que requiera atención.
3. Una recomendación directa y profesional sobre qué acciones tomar si aplica, o simplemente indicar que las condiciones son estables.
Mantén tu respuesta profesional, directa y no más larga de un párrafo corto.`;

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 250
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('[AI] Error de DeepSeek API:', errText);
      return error(res, 'Error al conectar con IA predictiva', 502);
    }

    const aiData = await response.json();
    const recomendacion = aiData.choices[0].message.content;

    success(res, { recomendacion });
  } catch (err) {
    logger.error('[AI] Error en obtenerSugerenciaIA:', err);
    error(res, 'Error interno del servidor', 500);
  }
};

module.exports = {
  obtenerSugerenciaIA
};
