from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from app.predictor import get_arima_prediction
from app.correlations import get_metrics_correlation
from app.scenarios import calculate_scenarios
from app.recommendations import generate_recommendations
from app.grid_predictor import predict_global_grid
from app.database import get_db

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

@app.on_event("shutdown")
def shutdown_event():
    from app.database import close_pool
    close_pool()
