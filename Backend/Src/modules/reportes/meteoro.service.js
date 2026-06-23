const logger = require('../../utils/logger');
const pool = require('../../config/db');
const meteoroTools = require('./meteoro.tools');
const { toolDefinitions } = meteoroTools;

/**
 * Servicio para el Asistente Interactivo "Meteoro"
 * Utiliza DeepSeek (o el LLM configurado) para generar respuestas
 */
const generarRespuestaMeteoro = async (ciudad, promptUsuario, actualDataContext, mapContext = "Sin contexto del mapa disponible.") => {
    try {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            throw new Error('API Key de DeepSeek no configurada.');
        }

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
Eres "Meteoro", un asistente meteorológico experto, analítico y amigable para el sistema EnviroSense. Tu conocimiento abarca eventos a nivel global y mundial.
El usuario te hará preguntas sobre el clima, propondrá escenarios hipotéticos numéricos/espaciales, o te pedirá comparar datos históricos y controlar la interfaz de la aplicación.
Si el usuario te pregunta por datos de cualquier ubicación (ej. Uganda, Tokio, Amazonas), ¡DEBES usar obligatoriamente la herramienta "consultar_datos_radar" antes de responder!

DIRECTRIZ AMBIENTAL CLAVE (INCENDIOS Y DESASTRES):
El usuario tiene acceso a un mapa interactivo con histórico de datos. 
1. Si el usuario te pregunta por qué hay una anomalía térmica, mala calidad de aire, o qué desastres han ocurrido recientemente en una ubicación específica, DEBES invocar la herramienta "investigar_desastres_globales" para extraer reportes de Wikipedia.
2. Si los datos climáticos o los reportes de herramientas apuntan a desastres masivos (ej. incendios en el Amazonas, inundaciones, o deslizamientos en África), DEBES cruzar la información del radar con los reportes de desastres para confirmar y explicar detalladamente la situación. Usa tu conocimiento pre-entrenado en conjunto con los resultados de las herramientas.

REGLAS ESTRICTAS:
1. Responde SIEMPRE en formato JSON válido (después de consultar las herramientas necesarias).
2. Tu JSON debe tener exactamente estas TRES claves:
   - "mensaje_voz": Un texto de respuesta amigable, conciso y profesional que se leerá en voz alta.
   - "datos_simulados": Un objeto donde las claves son fechas ISO y los valores son simulaciones. Si no aplica, devuelve null.
   - "acciones_ui": Un arreglo opcional de comandos para controlar el mapa. Comandos permitidos:
      - { "comando": "ir_a_mapa" } 
      - { "comando": "set_fecha", "valor": "2024-10-01T00:00:00Z" }
      - { "comando": "reproducir_simulacion" }
      - { "comando": "set_capa", "valor": "lluvia" | "temperatura" | "viento" | "aqi" | "humedad" | "ica" }
      - { "comando": "activar_modo_historico" }
      - { "comando": "activar_comparativo" }
      - { "comando": "set_fecha_comparativa", "valor1": "2023-10-01T00:00:00Z", "valor2": "2024-10-01T00:00:00Z" }
      - { "comando": "simular_heatmap", "metrica": "temperatura", "datos": { "Santa Cruz": 45 } }
      - { "comando": "mover_mapa", "lat": number, "lon": number, "zoom": number }

REGLA CRÍTICA DE INTERFAZ: 
Si el usuario te pide analizar, o tú le respondes sobre una ubicación (país, ciudad, zona) distinta a la que actualmente mira el usuario, ¡DEBES OBLIGATORIAMENTE incluir el comando "mover_mapa" en "acciones_ui" con las coordenadas aproximadas! Hazlo INCLUSO si la herramienta de radar te devolvió error o no tienes los datos exactos. El mapa debe volar a esa ubicación para que el usuario explore.
Si le mencionas una fecha histórica específica, DEBES incluir el comando "set_fecha" con esa fecha y "activar_modo_historico".
Si el usuario pide activar el modo histórico, explorar el pasado, o similar, debes incluir el comando "activar_modo_historico".

Ejemplo si el usuario dice: "Compara la temperatura de octubre 2023 con octubre 2024":
{
  "mensaje_voz": "Por supuesto. Dividiré el mapa para comparar la temperatura histórica de octubre de 2023 frente a octubre de 2024.",
  "datos_simulados": null,
  "acciones_ui": [
      { "comando": "ir_a_mapa" },
      { "comando": "set_capa", "valor": "temperatura" },
      { "comando": "set_fecha_comparativa", "valor1": "2023-10-01T00:00:00Z", "valor2": "2024-10-01T00:00:00Z" },
      { "comando": "mover_mapa", "lat": 40.41, "lon": -3.70, "zoom": 5 }
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
Contexto Visual (Lo que el usuario ve en el mapa ahora): ${mapContext}

Ciudad Actual Seleccionada: ${ciudad}
Contexto de Datos Recientes (Sensores/Lecturas Locales): ${JSON.stringify(actualDataContext.slice(0, 8))}

Pregunta del Usuario: "${promptUsuario}"
`;

        let messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ];

        const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1';

        const makeApiCall = async (msgs, forceJson = false) => {
            const bodyPayload = {
                model: 'deepseek-chat',
                messages: msgs,
                tools: toolDefinitions,
                tool_choice: "auto",
                temperature: 0.2,
                max_tokens: 800
            };
            
            if (forceJson) {
                bodyPayload.response_format = { type: 'json_object' };
                delete bodyPayload.tools; // Remove tools on final answer to avoid loops
                delete bodyPayload.tool_choice;
            }

            const response = await fetch(`${apiUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bodyPayload)
            });

            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`DeepSeek API Error: ${response.status} ${errBody}`);
            }

            return await response.json();
        };

        let data = await makeApiCall(messages);
        let responseMessage = data.choices[0].message;
        
        console.log("DeepSeek initial response:", JSON.stringify(responseMessage, null, 2));

        // Bucle para procesar llamadas a herramientas (function calling)
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            messages.push(responseMessage); // Agregamos la respuesta del asistente con las tool_calls

            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name;
                
                // Buscar la función dinámicamente en las herramientas exportadas
                // Convertimos snake_case (consultar_datos_radar) a camelCase (consultarDatosRadar)
                const camelCaseName = functionName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
                
                if (typeof meteoroTools[camelCaseName] === 'function') {
                    const args = JSON.parse(toolCall.function.arguments);
                    logger.info({ args, tool: functionName }, `[Meteoro] Invocando tool dinámicamente`);
                    
                    try {
                        let toolResult;
                        if (camelCaseName === 'consultarHistoricoClima') {
                            toolResult = await meteoroTools[camelCaseName](args.lat, args.lon, args.startDate, args.endDate);
                        } else {
                            toolResult = await meteoroTools[camelCaseName](args.lat, args.lon);
                        }
                        
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: toolResult
                        });
                    } catch (toolErr) {
                        logger.error({ err: toolErr }, `[Meteoro] Error ejecutando tool ${functionName}`);
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: JSON.stringify({ error: "Fallo interno al ejecutar la herramienta." })
                        });
                    }
                } else {
                    logger.warn(`[Meteoro] Tool no implementada: ${functionName}`);
                    messages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: JSON.stringify({ error: `La herramienta ${functionName} no está disponible en el backend.` })
                    });
                }
            }
            
            // Hacemos una segunda llamada con el resultado de las herramientas, forzando JSON
            data = await makeApiCall(messages, true);
            responseMessage = data.choices[0].message;
        }

        let content = responseMessage.content;
        
        // Limpiar posible formato markdown devuelto por la IA
        let contentToParse = content;
        if (content) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                contentToParse = jsonMatch[0];
            }
        } else {
            throw new Error("El modelo retornó contenido vacío o nulo.");
        }

        return JSON.parse(contentToParse);

    } catch (error) {
        logger.error({ err_code: error.code, err_msg: error.message }, '[Meteoro Service] Error en la IA/Red');
        throw new Error('No se pudo procesar el análisis de Meteoro.');
    }
};

module.exports = {
    generarRespuestaMeteoro
};
