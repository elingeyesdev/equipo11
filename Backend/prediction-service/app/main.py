from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
import json
from psycopg2.extras import execute_values
from app.predictor import get_arima_prediction
from app.correlations import get_metrics_correlation
from app.scenarios import calculate_scenarios
from app.recommendations import generate_recommendations
from app.grid_predictor import predict_global_grid
from app.database import get_db
from app.simulation_models import SimulationRequest, SimulationResponse
from app.simulation_engine import generate_scenario_data

app = FastAPI(title="EnviroSense Prediction Service", version="1.0.0")

# Habilitar CORS para permitir integraciones
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Esquemas de Petición Pydantic ───

class TrendRequest(BaseModel):
    localidad_id: int
    metrica_clave: str
    horas_prediccion: int = Field(default=48, ge=24, le=168)

class CorrelationsRequest(BaseModel):
    localidad_id: int

class ScenarioRequest(BaseModel):
    localidad_id: int
    metrica_clave: str
    horas_prediccion: int = Field(default=48, ge=24, le=168)

class ReportRequest(BaseModel):
    localidad_id: int
    horas_prediccion: int = Field(default=48, ge=24, le=168)

# ─── Helpers ───

def get_city_name(localidad_id: int) -> str:
    query = "SELECT nombre FROM localidades WHERE id = %s"
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (localidad_id,))
                row = cur.fetchone()
                if row:
                    return str(row[0])
    except Exception as e:
        print(f"Error fetching city name: {e}")
    return "Localidad Desconocida"

# ─── Endpoints de la API ───

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "prediction-service"}

@app.post("/trend")
def post_trend(req: TrendRequest):
    try:
        data = get_arima_prediction(req.localidad_id, req.metrica_clave, req.horas_prediccion)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/correlations")
def post_correlations(req: CorrelationsRequest):
    try:
        data = get_metrics_correlation(req.localidad_id)
        return {"correlations": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/scenario")
def post_scenario(req: ScenarioRequest):
    try:
        data = calculate_scenarios(req.localidad_id, req.metrica_clave, req.horas_prediccion)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/report")
def post_report(req: ReportRequest):
    try:
        predictions = {}
        # Predecir las 5 métricas reales para alimentar las recomendaciones
        for m in ["temperatura", "humedad", "aqi", "precipitacion", "viento"]:
            predictions[m] = get_arima_prediction(req.localidad_id, m, req.horas_prediccion)["predictions"]
            
        city_name = get_city_name(req.localidad_id)
        report_data = generate_recommendations(predictions, city_name)
        report_data["predictions"] = predictions
        return report_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict-grid")
def trigger_grid_prediction(background_tasks: BackgroundTasks):
    """
    Inicia la extrapolación del grid en segundo plano para no bloquear al scraper.
    """
    background_tasks.add_task(predict_global_grid)
    return {"status": "processing", "message": "Grid prediction task triggered in background."}




def check_thresholds_and_generate_alerts(localidad_id: int, predictions: dict, simulacion_id: int):
    query = """
        SELECT u.id, m.clave, u.nivel, u.label, u.valor_min, u.valor_max, u.color_hex, u.severidad
        FROM umbrales u
        JOIN metricas m ON m.id = u.metrica_id
    """
    alerts = []
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(query)
                thresholds = cur.fetchall()
                thresh_dict = {}
                for row in thresholds:
                    u_id, m_clave, nivel, label, val_min, val_max, color, sev = row
                    if m_clave not in thresh_dict:
                        thresh_dict[m_clave] = []
                    thresh_dict[m_clave].append({
                        "id": u_id,
                        "nivel": nivel,
                        "label": label,
                        "min": float(val_min),
                        "max": float(val_max),
                        "color": color,
                        "severidad": sev
                    })
                
                for metric, data in predictions.items():
                    if metric not in thresh_dict:
                        continue
                    
                    metric_thresholds = thresh_dict[metric]
                    cur.execute("SELECT id FROM metricas WHERE clave = %s", (metric,))
                    m_row = cur.fetchone()
                    if not m_row:
                        continue
                    metric_id = m_row[0]
                    
                    for pred in data:
                        val = pred["valor"]
                        tiempo = pred["tiempo"]
                        
                        for t in metric_thresholds:
                            if t["min"] <= val <= t["max"]:
                                if t["severidad"] in ["advertencia", "critica", "emergencia"]:
                                    insert_query = """
                                        INSERT INTO alertas (localidad_id, metrica_id, umbral_id, valor, reconocida, tipo, simulacion_id, tiempo)
                                        VALUES (%s, %s, %s, %s, FALSE, 'simulacion', %s, %s)
                                        RETURNING id, tiempo, reconocida, tipo
                                    """
                                    cur.execute(insert_query, (localidad_id, metric_id, t["id"], val, simulacion_id, tiempo))
                                    alert_row = cur.fetchone()
                                    if alert_row:
                                        alerts.append({
                                            "id": alert_row[0],
                                            "tiempo": alert_row[1].isoformat() if isinstance(alert_row[1], datetime) else alert_row[1],
                                            "localidad_id": localidad_id,
                                            "metrica_clave": metric,
                                            "valor": float(val),
                                            "umbral_label": t["label"],
                                            "severidad": t["severidad"],
                                            "color_hex": t["color"],
                                            "tipo": alert_row[3]
                                        })
                                    break
    except Exception as e:
        print(f"Error checking thresholds / generating alerts: {e}")
    return alerts


@app.post("/simulate", response_model=SimulationResponse)
def post_simulate(req: SimulationRequest):
    try:
        # 1. Generar los datos sintéticos utilizando el motor
        simulated_data = generate_scenario_data(req.tipo_evento, req.area_geo, req.parametros, req.localidad_id)
        
        # 2. Guardar la simulación en la tabla 'simulaciones'
        sim_id = None
        estado = "activa"
        creado_en = None
        
        with get_db() as conn:
            with conn.cursor() as cur:
                insert_sim_query = """
                    INSERT INTO simulaciones (creado_por, nombre, descripcion, tipo_evento, area_geo, localidad_id, parametros, estado)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'activa')
                    RETURNING id, estado, creado_en
                """
                cur.execute(insert_sim_query, (
                    req.creado_por,
                    req.nombre,
                    req.descripcion,
                    req.tipo_evento,
                    json.dumps(req.area_geo),
                    req.localidad_id,
                    json.dumps(req.parametros)
                ))
                sim_row = cur.fetchone()
                if sim_row:
                    sim_id, estado, creado_en = sim_row
        
        if not sim_id:
            raise HTTPException(status_code=500, detail="Failed to persist simulation metadata.")
            
        # 3. Guardar los datos inyectados en 'simulaciones_datos'
        insert_data_rows = []
        for lat, lon, metrica, val, t_step in simulated_data:
            insert_data_rows.append((
                sim_id,
                lat,
                lon,
                metrica,
                val,
                t_step
            ))
            
        with get_db() as conn:
            with conn.cursor() as cur:
                execute_values(
                    cur,
                    """
                    INSERT INTO simulaciones_datos (simulacion_id, latitud, longitud, metrica_clave, valor, tiempo)
                    VALUES %s
                    ON CONFLICT (simulacion_id, latitud, longitud, metrica_clave, tiempo) DO NOTHING
                    """,
                    insert_data_rows
                )
                
        # 4. Preparar el baseline simulado de la ciudad para alimentar ARIMA
        city_lat, city_lon = None, None
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT latitud, longitud FROM localidades WHERE id = %s", (req.localidad_id,))
                row = cur.fetchone()
                if row:
                    city_lat, city_lon = float(row[0]), float(row[1])
                    
        city_simulated_data = []
        for lat, lon, metrica, val, t_step in simulated_data:
            if city_lat is not None and city_lon is not None:
                if abs(lat - city_lat) < 0.01 and abs(lon - city_lon) < 0.01:
                    city_simulated_data.append({
                        "metrica_clave": metrica,
                        "valor": val,
                        "tiempo": t_step.isoformat() if isinstance(t_step, datetime) else t_step
                    })
                    
        # 5. Ejecutar predicciones ARIMA con baseline simulado
        predictions = {}
        predictions_completas = {}
        duration_hours = req.parametros.get("duracion_horas", 24)
        horas_pred = max(24, duration_hours)
        
        for m in ["temperatura", "humedad", "aqi", "precipitacion", "viento"]:
            full_pred = get_arima_prediction(
                req.localidad_id, 
                m, 
                horas_pred, 
                simulated_baseline_data=city_simulated_data
            )
            predictions[m] = full_pred["predictions"]
            predictions_completas[m] = full_pred
            
        # 6. Generar alertas basadas en la simulación
        alertas = check_thresholds_and_generate_alerts(req.localidad_id, predictions, sim_id)
        
        # 7. Generar recomendaciones
        city_name = get_city_name(req.localidad_id)
        recomendaciones = generate_recommendations(predictions, city_name)
        
        # 8. Calcular escenarios What-If para todas las métricas
        scenarios_dict = {}
        for m in ["temperatura", "humedad", "aqi", "precipitacion", "viento"]:
            scenarios_dict[m] = calculate_scenarios(req.localidad_id, m, horas_pred, simulated_predictions=predictions_completas)

        return {
            "id_simulacion": sim_id,
            "nombre": req.nombre,
            "estado": estado,
            "datos_generados_count": len(simulated_data),
            "predicciones_derivadas": predictions_completas,
            "alertas_generadas": alertas,
            "recomendaciones": recomendaciones,
            "scenarios": scenarios_dict
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/simulate/{id}")
def get_simulate_by_id(id: int):
    try:
        # 1. Obtener metadatos de la simulación
        sim_meta = None
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, creado_por, nombre, descripcion, tipo_evento, area_geo, localidad_id, parametros, estado, creado_en, finalizada_en
                    FROM simulaciones
                    WHERE id = %s
                """, (id,))
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail=f"Simulation with ID {id} not found.")
                sim_meta = {
                    "id": row[0],
                    "creado_por": row[1],
                    "nombre": row[2],
                    "descripcion": row[3],
                    "tipo_evento": row[4],
                    "area_geo": row[5],
                    "localidad_id": row[6],
                    "parametros": row[7],
                    "estado": row[8],
                    "creado_en": row[9].isoformat() if row[9] else None,
                    "finalizada_en": row[10].isoformat() if row[10] else None
                }
                
        # 2. Obtener los datos generados de la simulación
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT latitud, longitud, metrica_clave, valor, tiempo
                    FROM simulaciones_datos
                    WHERE simulacion_id = %s
                    ORDER BY tiempo ASC
                """, (id,))
                data_rows = cur.fetchall()
                
        # 3. Re-extraer baseline simulado para la localidad para ARIMA
        city_lat, city_lon = None, None
        localidad_id = sim_meta["localidad_id"]
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT latitud, longitud FROM localidades WHERE id = %s", (localidad_id,))
                row = cur.fetchone()
                if row:
                    city_lat, city_lon = float(row[0]), float(row[1])
                    
        city_simulated_data = []
        for lat, lon, metrica, val, t_step in data_rows:
            if city_lat is not None and city_lon is not None:
                if abs(float(lat) - city_lat) < 0.01 and abs(float(lon) - city_lon) < 0.01:
                    city_simulated_data.append({
                        "metrica_clave": metrica,
                        "valor": float(val),
                        "tiempo": t_step.isoformat() if isinstance(t_step, datetime) else t_step
                    })
                    
        # 4. Rerun predictions
        predictions = {}
        predictions_completas = {}
        duration_hours = sim_meta["parametros"].get("duracion_horas", 24)
        horas_pred = max(24, duration_hours)
        
        for m in ["temperatura", "humedad", "aqi", "precipitacion", "viento"]:
            full_pred = get_arima_prediction(
                localidad_id, 
                m, 
                horas_pred, 
                simulated_baseline_data=city_simulated_data
            )
            predictions[m] = full_pred["predictions"]
            predictions_completas[m] = full_pred
            
        # 5. Obtener alertas simuladas
        alertas = []
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT a.id, a.tiempo, a.valor, u.label, u.severidad, u.color_hex, m.clave
                    FROM alertas a
                    JOIN umbrales u ON u.id = a.umbral_id
                    JOIN metricas m ON m.id = a.metrica_id
                    WHERE a.localidad_id = %s AND a.simulacion_id = %s
                """, (localidad_id, id))
                for a_row in cur.fetchall():
                    alertas.append({
                        "id": a_row[0],
                        "tiempo": a_row[1].isoformat() if isinstance(a_row[1], datetime) else a_row[1],
                        "localidad_id": localidad_id,
                        "metrica_clave": a_row[6],
                        "valor": float(a_row[2]),
                        "umbral_label": a_row[3],
                        "severidad": a_row[4],
                        "color_hex": a_row[5],
                        "tipo": "simulacion"
                    })
                    
        # 6. Generar recomendaciones
        city_name = get_city_name(localidad_id)
        recomendaciones = generate_recommendations(predictions, city_name)
        
        # 7. Calcular escenarios What-If para todas las métricas
        scenarios_dict = {}
        for m in ["temperatura", "humedad", "aqi", "precipitacion", "viento"]:
            scenarios_dict[m] = calculate_scenarios(localidad_id, m, horas_pred, simulated_predictions=predictions_completas)

        return {
            "meta": sim_meta,
            "datos_generados_count": len(data_rows),
            "predicciones_derivadas": predictions_completas,
            "alertas_generadas": alertas,
            "recomendaciones": recomendaciones,
            "scenarios": scenarios_dict
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/simulate")
def get_simulations():
    try:
        sims = []
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, creado_por, nombre, descripcion, tipo_evento, area_geo, localidad_id, parametros, estado, creado_en, finalizada_en
                    FROM simulaciones
                    ORDER BY creado_en DESC
                """)
                for row in cur.fetchall():
                    sims.append({
                        "id": row[0],
                        "creado_por": row[1],
                        "nombre": row[2],
                        "descripcion": row[3],
                        "tipo_evento": row[4],
                        "area_geo": row[5],
                        "localidad_id": row[6],
                        "parametros": row[7],
                        "estado": row[8],
                        "creado_en": row[9].isoformat() if row[9] else None,
                        "finalizada_en": row[10].isoformat() if row[10] else None
                    })
        return sims
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/simulate/{id}")
def delete_simulate(id: int):
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM simulaciones WHERE id = %s", (id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail=f"Simulation with ID {id} not found.")
                
                cur.execute("""
                    UPDATE simulaciones 
                    SET estado = 'cancelada', finalizada_en = NOW()
                    WHERE id = %s
                """, (id,))
                
        return {"status": "success", "message": f"Simulation {id} marked as cancelada."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.on_event("shutdown")
def shutdown_event():
    from app.database import close_pool
    close_pool()
