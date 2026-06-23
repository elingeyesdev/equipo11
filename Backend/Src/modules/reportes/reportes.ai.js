const { success, error } = require('../../utils/response');
const logger = require('../../utils/logger');

function generarSugerenciaMock(ciudad, variable, datos) {
  if (!datos || datos.length === 0) return 'No hay datos para analizar.';
  
  const values = datos.map(d => parseFloat(d.value)).filter(v => !isNaN(v));
  if (values.length === 0) return 'No hay datos numéricos válidos en el rango seleccionado.';
  
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const sum = values.reduce((a, b) => a + b, 0);
  const avgVal = sum / values.length;
  
  // Determinar tendencia
  let trend = 'estable';
  if (values.length > 1) {
    const first = values[0];
    const last = values[values.length - 1];
    const diff = last - first;
    if (diff > 0.05 * avgVal) {
      trend = 'ascendente';
    } else if (diff < -0.05 * avgVal) {
      trend = 'descendente';
    }
  }
  
  let unit = '';
  const varLower = (variable || '').toLowerCase();
  if (varLower.includes('temp')) unit = '°C';
  else if (varLower.includes('aqi')) unit = ' AQI';
  else if (varLower.includes('ruido') || varLower.includes('db')) unit = ' dB';
  else if (varLower.includes('humedad')) unit = '%';
  else if (varLower.includes('ica')) unit = ' ICA';
  
  return `El análisis de la variable ${variable} en ${ciudad || 'la zona'} muestra una tendencia general ${trend}. El promedio es de ${avgVal.toFixed(1)}${unit}, con un valor máximo de ${maxVal.toFixed(1)}${unit} y un mínimo registrado de ${minVal.toFixed(1)}${unit}. Las condiciones ambientales generales se muestran ${avgVal > maxVal * 0.85 ? 'ligeramente elevadas' : 'dentro de los parámetros esperados de estabilidad, indicando un entorno seguro'}.`;
}

const obtenerSugerenciaIA = async (req, res) => {
  try {
    const { ciudad, variable, datos } = req.body;

    if (!datos || !Array.isArray(datos) || datos.length === 0) {
      return error(res, 'No hay datos para analizar', 400);
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      logger.warn('[AI] DeepSeek API Key no configurada. Usando generador analítico local.');
      const recomendacion = generarSugerenciaMock(ciudad, variable, datos);
      return success(res, { recomendacion });
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

    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1';
    const response = await fetch(`${apiUrl}/chat/completions`, {
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
      logger.warn('[AI] Usando generador analítico local como fallback.');
      const recomendacion = generarSugerenciaMock(ciudad, variable, datos);
      return success(res, { recomendacion });
    }

    const aiData = await response.json();
    const recomendacion = aiData.choices[0].message.content;

    success(res, { recomendacion });
  } catch (err) {
    logger.error({ err_code: err.code, err_msg: err.message }, '[AI] Network/Fetch Error en obtenerSugerenciaIA');
    logger.warn('[AI] Usando generador analítico local como fallback debido a excepción.');
    try {
      const { ciudad, variable, datos } = req.body;
      const recomendacion = generarSugerenciaMock(ciudad, variable, datos);
      return success(res, { recomendacion });
    } catch (fallbackErr) {
      error(res, 'Error interno del servidor', 500);
    }
  }
};

module.exports = {
  obtenerSugerenciaIA
};
