from typing import List, Dict

def generate_markdown_report_text(localidad_nombre: str, predictions_dict: Dict, recommendations: List[Dict]) -> str:
    """
    Genera un informe estructurado en formato Markdown en español con el análisis
    de tendencias y las sugerencias de toma de decisiones para las autoridades.
    """
    temp_preds = predictions_dict.get("temperatura", [])
    aqi_preds = predictions_dict.get("aqi", [])
    hum_preds = predictions_dict.get("humedad", [])
    rain_preds = predictions_dict.get("precipitacion", [])
    wind_preds = predictions_dict.get("viento", [])

    max_temp = max([p["valor"] for p in temp_preds]) if temp_preds else 0
    min_temp = min([p["valor"] for p in temp_preds]) if temp_preds else 0
    max_aqi = max([p["valor"] for p in aqi_preds]) if aqi_preds else 0
    max_rain = max([p["valor"] for p in rain_preds]) if rain_preds else 0
    max_wind = max([p["valor"] for p in wind_preds]) if wind_preds else 0

    markdown = f"""# INFORME DE ANÁLISIS PREDICTIVO Y TOMA DE DECISIONES
**Localidad de Análisis:** {localidad_nombre}  
**Proyección Temporal:** Siguientes 48 a 72 Horas

---

## 1. RESUMEN EJECUTIVO
Sobre la base de los datos recopilados por las estaciones de monitoreo y procesados mediante modelos autorregresivos ARIMA, se ha generado el perfil predictivo ambiental para el corto plazo. 

- **Temperatura**: Rango proyectado entre {min_temp:.1f}°C y {max_temp:.1f}°C.
- **Calidad del Aire**: El índice máximo estimado alcanzará **{max_aqi:.0f} AQI**.
- **Precipitación**: Nivel pico de lluvia proyectado en **{max_rain:.2f} mm/h**.
- **Viento**: Ráfagas máximas de viento estimadas en **{max_wind:.1f} km/h**.

---

## 2. ANÁLISIS DE RIESGO POR VARIABLE

"""
    # Agregar análisis de Temperatura
    markdown += f"### 🌡️ Comportamiento Térmico\n"
    if max_temp > 35:
        markdown += f"Se proyecta una anomalía de calor con temperaturas máximas de {max_temp:.1f}°C. Se recomienda extremar precauciones contra golpes de calor y deshidratación.\n\n"
    elif min_temp < 5:
        markdown += f"Se anticipa un descenso severo de la temperatura alcanzando mínimos de {min_temp:.1f}°C. Riesgo incrementado para enfermedades respiratorias agudas.\n\n"
    else:
        markdown += f"El patrón térmico se mantiene estable en rangos normales de confort térmico (mínimo de {min_temp:.1f}°C, máximo de {max_temp:.1f}°C).\n\n"

    # Agregar análisis de Calidad del Aire (AQI)
    markdown += f"### 🌫️ Calidad del Aire (AQI)\n"
    if max_aqi > 150:
        markdown += f"**CRÍTICO**: El AQI proyectado alcanzará niveles no saludables ({max_aqi:.0f} AQI). El smog fotoquímico y la acumulación de material particulado requerirán la restricción de actividades al aire libre.\n\n"
    elif max_aqi > 100:
        markdown += f"**ADVERTENCIA**: Calidad del aire nociva para grupos sensibles ({max_aqi:.0f} AQI). Niños, adultos mayores y asmáticos deben limitar esfuerzos físicos prolongados.\n\n"
    else:
        markdown += f"Calidad del aire aceptable. Los niveles de contaminación se mantendrán dentro de los límites permisibles por la OMS.\n\n"

    # Agregar análisis de Lluvia y Viento
    if max_rain > 5.0:
        markdown += f"### 🌧️ Amenazas Hidrometeorológicas\n"
        markdown += f"Se pronostican precipitaciones intensas con intensidades de hasta {max_rain:.2f} mm/h. Posibilidad latente de anegamiento de vías públicas y saturación de drenaje pluvial.\n\n"
    if max_wind > 45:
        if max_rain <= 5.0:
            markdown += f"### 💨 Amenazas Hidrometeorológicas\n"
        markdown += f"Vientos fuertes proyectados con ráfagas de hasta {max_wind:.1f} km/h. Riesgo de caída de ramas, cables eléctricos y estructuras inestables.\n\n"

    markdown += """---

## 3. PLAN DE ACCIÓN RECOMENDADO
A continuación se listan las directrices de mitigación y contingencia ambiental sugeridas:

"""
    for idx, rec in enumerate(recommendations, 1):
        severidad_emoji = "🚨" if rec["severidad"] in ["emergencia", "critica"] else "⚠️" if rec["severidad"] == "advertencia" else "ℹ️"
        markdown += f"{idx}. **{severidad_emoji} {rec['nivel'].upper()} ({rec['metrica'].upper()})**  \n   *{rec['texto']}*\n\n"

    markdown += """
---
**Nota de Confidencialidad:** Este informe predictivo es generado mediante simulaciones numéricas para soporte de decisiones gubernamentales y de protección civil. Se aconseja contrastar con alertas oficiales del SENAMHI en tiempo real."""

    return markdown.strip()

def generate_recommendations(predictions_dict: Dict, localidad_nombre: str) -> Dict:
    """
    Analiza las proyecciones ARIMA de 24/48/72 horas y genera recomendaciones
    accionables y alertas tempranas estructuradas en español.
    """
    recommendations = []
    alerts_summary = []

    # 1. Analizar Calidad del Aire (AQI)
    aqi_preds = predictions_dict.get("aqi", [])
    if aqi_preds:
        max_aqi = max([p["valor"] for p in aqi_preds])
        if max_aqi > 300:
            alerts_summary.append("¡ALERTA CRÍTICA! Se pronostica calidad del aire PELIGROSA en la región.")
            recommendations.append({
                "metrica": "aqi",
                "nivel": "Peligroso",
                "severidad": "emergencia",
                "texto": "Se prevé que el AQI supere 300 (Peligroso). Se recomienda suspender actividades al aire libre, cerrar ventanas y activar purificadores de aire en interiores. Uso de mascarillas N95 obligatorio."
            })
        elif max_aqi > 151:
            alerts_summary.append("Calidad del aire no saludable proyectada para la población general.")
            recommendations.append({
                "metrica": "aqi",
                "nivel": "No saludable",
                "severidad": "critica",
                "texto": "Se pronostica calidad del aire nociva (AQI > 150). Reduzca el esfuerzo físico prolongado al aire libre. Poblaciones vulnerables (niños, ancianos, asmáticos) deben permanecer en interiores."
            })
        elif max_aqi > 101:
            alerts_summary.append("Calidad del aire nociva para grupos sensibles pronosticada.")
            recommendations.append({
                "metrica": "aqi",
                "nivel": "Dañino para sensibles",
                "severidad": "advertencia",
                "texto": "Calidad del aire moderadamente mala (AQI > 100). Personas con problemas respiratorios deben limitar la exposición prolongada al aire libre."
            })

    # 2. Analizar Temperatura (°C)
    temp_preds = predictions_dict.get("temperatura", [])
    if temp_preds:
        max_temp = max([p["valor"] for p in temp_preds])
        min_temp = min([p["valor"] for p in temp_preds])
        
        if max_temp > 38:
            alerts_summary.append("Ola de calor extremo detectada en la proyección meteorológica.")
            recommendations.append({
                "metrica": "temperatura",
                "nivel": "Calor extremo",
                "severidad": "emergencia",
                "texto": "Temperaturas superiores a 38°C pronosticadas. Evite la exposición directa al sol entre las 11:00 y las 16:00, manténgase altamente hidratado y use ropa ligera de colores claros."
            })
        elif max_temp > 32:
            alerts_summary.append("Se prevén temperaturas cálidas inusuales.")
            recommendations.append({
                "metrica": "temperatura",
                "nivel": "Calor",
                "severidad": "advertencia",
                "texto": "Temperaturas de hasta " + str(round(max_temp, 1)) + "°C pronosticadas. Se aconseja ventilación y consumo constante de agua."
            })
            
        if min_temp < -10:
            alerts_summary.append("Helada extrema severa detectada en el pronóstico.")
            recommendations.append({
                "metrica": "temperatura",
                "nivel": "Frío extremo",
                "severidad": "emergencia",
                "texto": "Se esperan temperaturas bajo cero extremas (menores a -10°C). Alto riesgo de hipotermia. Asegure calefacción adecuada y proteja a las mascotas y plantas de la intemperie."
            })
        elif min_temp < 5:
            alerts_summary.append("Se prevé descenso importante de temperatura.")
            recommendations.append({
                "metrica": "temperatura",
                "nivel": "Frío",
                "severidad": "advertencia",
                "texto": "Se pronostican temperaturas muy bajas. Se recomienda abrigarse adecuadamente y evitar cambios bruscos de temperatura."
            })

    # 3. Analizar Humedad (%)
    hum_preds = predictions_dict.get("humedad", [])
    if hum_preds:
        min_hum = min([p["valor"] for p in hum_preds])
        max_hum = max([p["valor"] for p in hum_preds])
        if min_hum < 20:
            alerts_summary.append("Sequía y baja humedad extrema (Riesgo crítico de incendio forestal).")
            recommendations.append({
                "metrica": "humedad",
                "nivel": "Muy seco",
                "severidad": "advertencia",
                "texto": "Humedad relativa inferior al 20%. Alto riesgo de propagación de incendios forestales. Evite fogatas, quemas de pastizales y mantenga hidratación constante para evitar sequedad respiratoria."
            })
        elif max_hum > 85:
            alerts_summary.append("Humedad ambiental excesiva pronosticada.")
            recommendations.append({
                "metrica": "humedad",
                "nivel": "Muy húmedo",
                "severidad": "advertencia",
                "texto": "Humedad ambiente superior al 85%. Riesgo de proliferación de alérgenos y moho. Asegure una ventilación adecuada y use deshumidificadores de ser posible."
            })

    # 4. Caso por defecto (Todo estable)
    if not recommendations:
        recommendations.append({
            "metrica": "general",
            "nivel": "Estable",
            "severidad": "informativa",
            "texto": "Todas las variables ambientales se mantendrán dentro del rango de confort habitual en las próximas 48/72 horas. No se requieren acciones de emergencia."
        })

    report_text = generate_markdown_report_text(localidad_nombre, predictions_dict, recommendations)

    return {
        "alerts_summary": alerts_summary,
        "recommendations": recommendations,
        "report_text": report_text
    }
