const logger = require('../../utils/logger');
const pool = require('../../config/db');

/**
 * Servicio para el Asistente Interactivo "Meteoro"
 * Utiliza DeepSeek (o el LLM configurado) para generar respuestas y proyecciones de datos en formato JSON.
 */
const generarRespuestaMeteoro = async (ciudad, promptUsuario, datosContexto) => {
    try {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            throw new Error('API Key de DeepSeek no configurada.');
        }

        let actualDataContext = datosContexto;
        if (!actualDataContext || actualDataContext.length === 0) {
            // No se proporcionó contexto desde el Frontend (ej. botón global)
            // Extraer datos reales frescos de la base de datos para darle a la IA
            if (ciudad && ciudad !== 'Bolivia') {
                const res = await pool.query(`
                    SELECT nombre as ciudad, temperatura, wind_speed, humedad, aqi, ica
                    FROM sensores_cache
                    WHERE nombre ILIKE $1 LIMIT 1
                `, [ciudad]);
                if (res.rowCount > 0) {
                    actualDataContext = res.rows;
                } else {
                    actualDataContext = [{ nota: "No hay datos en vivo disponibles para esta ciudad" }];
                }
            } else {
                const res = await pool.query(`
                    SELECT nombre as ciudad, temperatura, wind_speed, humedad, aqi, ica
                    FROM sensores_cache
                    LIMIT 5
                `);
                actualDataContext = res.rows;
            }
        }

        const systemPrompt = `
Eres "Meteoro", un asistente meteorológico experto, analítico y amigable para el sistema EnviroSense en Bolivia.
El usuario te hará preguntas sobre el clima, propondrá escenarios hipotéticos numéricos/espaciales, o te pedirá comparar datos históricos y controlar la interfaz de la aplicación.

REGLAS ESTRICTAS:
1. Responde SIEMPRE en formato JSON válido.
2. Tu JSON debe tener exactamente estas TRES claves:
   - "mensaje_voz": Un texto de respuesta amigable, conciso y profesional que se leerá en voz alta (Text-To-Speech). No incluyas markdown.
   - "datos_simulados": Un objeto donde las claves son fechas ISO y los valores son los nuevos números proyectados para una simulación temporal. Si no aplica, devuelve null.
   - "acciones_ui": Un arreglo opcional de objetos con comandos para la interfaz si el usuario te pide controlar el mapa, comparar fechas o simular mapas de calor espaciales. Comandos permitidos:
      - { "comando": "ir_a_mapa" } 
      - { "comando": "activar_modo_historico" }
      - { "comando": "set_fecha", "valor": "2024-10-01T00:00:00Z" }
      - { "comando": "reproducir_simulacion" }
      - { "comando": "set_capa", "valor": "lluvia" | "temperatura" | "viento" | "aqi" | "humedad" | "ica" }
      - { "comando": "activar_comparativo" } (Divide la pantalla para comparar)
      - { "comando": "set_fecha_comparativa", "valor1": "2023-10-01T00:00:00Z", "valor2": "2024-10-01T00:00:00Z" }
      - { "comando": "simular_heatmap", "metrica": "temperatura", "datos": { "Santa Cruz de la Sierra": 45, "Montero": 43 } } (Para inyectar valores espacialmente ficticios en el mapa de calor)

Ejemplo si el usuario dice: "Compara la temperatura de octubre 2023 con octubre 2024":
{
  "mensaje_voz": "Por supuesto. Dividiré el mapa para comparar la temperatura histórica de octubre de 2023 frente a octubre de 2024.",
  "datos_simulados": null,
  "acciones_ui": [
    { "comando": "ir_a_mapa" },
    { "comando": "activar_comparativo" },
    { "comando": "set_capa", "valor": "temperatura" },
    { "comando": "set_fecha_comparativa", "valor1": "2023-10-01T00:00:00Z", "valor2": "2024-10-01T00:00:00Z" }
  ]
}

Ejemplo si el usuario dice: "Simula qué pasaría si la temperatura sube a 45 grados en Santa Cruz de la Sierra":
{
  "mensaje_voz": "He generado la simulación espacial. Como puedes ver en el mapa de calor, Santa Cruz alcanza niveles críticos de 45 grados, lo cual dispara alertas rojas en la región.",
  "datos_simulados": null,
  "acciones_ui": [
    { "comando": "ir_a_mapa" },
    { "comando": "simular_heatmap", "metrica": "temperatura", "datos": { "Santa Cruz de la Sierra": 45 } }
  ]
}
`;

        const userMessage = `
Ciudad Actual: ${ciudad}
Contexto de Datos Recientes (Muestra real de la base de datos/sensores): ${JSON.stringify(actualDataContext.slice(0, 8))}

Pregunta del Usuario: "${promptUsuario}"
`;

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.7,
                max_tokens: 800
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`DeepSeek API Error: ${response.status} ${errBody}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        return JSON.parse(content);

    } catch (error) {
        logger.error('[Meteoro Service] Error en la IA:', error.message);
        throw new Error('No se pudo procesar el análisis de Meteoro.');
    }
};

module.exports = {
    generarRespuestaMeteoro
};
