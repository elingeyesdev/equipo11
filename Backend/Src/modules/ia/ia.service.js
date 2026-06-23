const logger = require('../../utils/logger')
const radarService = require('../radar/radar.service')

function generarAnalisisMock(ciudad, data) {
  const current = data.current
  const daily = data.daily[0]
  
  return {
    resumen: `Actualmente en ${ciudad}, la temperatura es de ${current.temperatura}°C con una humedad del ${current.humedad}%. La sensación térmica es de ${current.sensacion_termica}°C.`,
    tendencias: [
      `Se espera una máxima de ${daily.temp_max}°C y mínima de ${daily.temp_min}°C hoy.`,
      `El viento alcanzará rachas de hasta ${daily.viento_max} km/h.`
    ],
    alertas: current.uv_index > 8 ? ['Precaución: Índice UV extremo'] : [],
    recomendaciones: current.precipitacion_prob > 50 
      ? ['Llevar paraguas, alta probabilidad de lluvia.']
      : ['Condiciones favorables para actividades al aire libre.'],
    indice_confort: current.temperatura > 15 && current.temperatura < 28 ? 4 : 2
  }
}

async function generarAnalisisClima(ciudad, lat, lon) {
  try {
    // 1. Obtener datos de pronóstico (usamos nuestro endpoint enriquecido que tiene caché)
    const forecastData = await radarService.fetchForecast(lat, lon)
    
    // 2. Extraer resúmenes para la IA
    const current = forecastData.current
    const daily = forecastData.daily.slice(0, 3) // proximos 3 dias
    
    const prompt = `Actúa como un meteorólogo experto. Analiza el siguiente clima para la ciudad de ${ciudad}.
    
Condiciones actuales:
- Temperatura: ${current.temperatura}°C (Sensación: ${current.sensacion_termica}°C)
- Humedad: ${current.humedad}%
- Viento: ${current.viento_velocidad} km/h (Dirección: ${current.viento_direccion}°)
- Nubosidad: ${current.nubosidad}%
- Presión: ${current.presion} hPa
- Índice UV: ${current.uv_index}
- Probabilidad de precipitación: ${current.precipitacion_prob}%

Pronóstico para los próximos días:
${daily.map(d => `- Fecha: ${d.date}, Max: ${d.temp_max}°C, Min: ${d.temp_min}°C, Lluvia total: ${d.precipitacion_total}mm, UV Max: ${d.uv_max}`).join('\n')}

Genera un JSON estrictamente con la siguiente estructura (sin markdown ni texto extra):
{
  "resumen": "string (resumen general conciso de 2 líneas)",
  "tendencias": ["string", "string"], // 2 a 3 tendencias importantes
  "alertas": ["string"], // array vacio si no hay nada crítico (ej. uv alto, vientos, lluvia fuerte)
  "recomendaciones": ["string", "string"], // 2 a 3 recomendaciones prácticas
  "indice_confort": number // del 1 al 5 (1=muy malo, 5=excelente)
}`

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      logger.warn('[ia.service] DeepSeek API Key no configurada. Usando mock.')
      return generarAnalisisMock(ciudad, forecastData)
    }

    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1'
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
        response_format: { type: 'json_object' } // Forzar JSON
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      logger.error(`[ia.service] Error API DeepSeek: ${errText}`)
      return generarAnalisisMock(ciudad, forecastData)
    }

    const aiData = await response.json()
    const content = aiData.choices[0].message.content
    
    // Intentar parsear el JSON retornado
    try {
      const parsedJson = JSON.parse(content)
      return parsedJson
    } catch (parseErr) {
      logger.error(`[ia.service] Error parseando respuesta JSON de IA: ${content}`)
      return generarAnalisisMock(ciudad, forecastData)
    }

  } catch (err) {
    logger.error(`[ia.service] Excepción en generarAnalisisClima:`, err)
    throw err
  }
}

module.exports = {
  generarAnalisisClima
}
