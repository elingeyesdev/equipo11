import time
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from statsmodels.tsa.arima.model import ARIMA
from app.database import get_db

CACHE_TTL = 1800  # 30 minutes in seconds
prediction_cache = {}

DEFAULT_METRIC_RANGES = {
    "temperatura": {"avg": 20.0, "std": 5.0, "min": -10.0, "max": 45.0},
    "humedad": {"avg": 60.0, "std": 15.0, "min": 0.0, "max": 100.0},
    "aqi": {"avg": 45.0, "std": 25.0, "min": 0.0, "max": 500.0},
    "ica": {"avg": 75.0, "std": 10.0, "min": 0.0, "max": 100.0},
    "ruido": {"avg": 55.0, "std": 12.0, "min": 0.0, "max": 140.0},
    "precipitacion": {"avg": 0.5, "std": 1.2, "min": 0.0, "max": 50.0},
    "rain": {"avg": 0.5, "std": 1.2, "min": 0.0, "max": 50.0},
    "viento": {"avg": 15.0, "std": 8.0, "min": 0.0, "max": 120.0},
    "wind_speed": {"avg": 15.0, "std": 8.0, "min": 0.0, "max": 120.0}
}

def get_city_coords(localidad_id: int):
    query = "SELECT latitud, longitud FROM localidades WHERE id = %s"
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (localidad_id,))
                row = cur.fetchone()
                if row:
                    return float(row[0]), float(row[1])
    except Exception as e:
        print(f"Error fetching city coords: {e}")
    return None

def get_nearest_grid_point(lat: float, lon: float):
    query = """
        SELECT latitud, longitud 
        FROM radar_grid_cache
        ORDER BY (latitud - %s)^2 + (longitud - %s)^2 ASC
        LIMIT 1
    """
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (lat, lon))
                row = cur.fetchone()
                if row:
                    return float(row[0]), float(row[1])
    except Exception as e:
        print(f"Error fetching nearest grid point: {e}")
    return None

def generate_fallback_prediction(rows, metrica_clave: str, steps: int):
    """
    Generador robusto de predicciones cuando no hay datos suficientes en TimescaleDB o Grid.
    Combina promedios históricos, una tendencia lineal básica y una oscilación
    diaria sinusoidal (diurnal cycle) para simular cambios reales.
    """
    print(f"Generating fallback prediction for metric: {metrica_clave}")
    now = datetime.utcnow()
    
    defaults = DEFAULT_METRIC_RANGES.get(metrica_clave, {"avg": 50.0, "std": 10.0, "min": 0.0, "max": 100.0})
    avg_val = defaults["avg"]
    std_val = defaults["std"]
    
    historical = []
    if len(rows) >= 2:
        vals = [float(row[1]) for row in rows if row[1] is not None]
        if vals:
            avg_val = np.mean(vals)
            std_val = max(1.0, np.std(vals))
        
        for row in rows[-72:]:
            if row[1] is None:
                continue
            t = row[0]
            if isinstance(t, str):
                t = datetime.fromisoformat(t.replace('Z', '+00:00'))
            historical.append({
                "tiempo": t.isoformat(),
                "valor": round(float(row[1]), 2)
            })
    
    if not historical:
        start_hist = now - timedelta(hours=48)
        for i in range(48):
            t = start_hist + timedelta(hours=i)
            val = avg_val
            if metrica_clave == "temperatura":
                val += 5.0 * np.sin(2 * np.pi * t.hour / 24.0)
            elif metrica_clave == "humedad":
                val -= 15.0 * np.sin(2 * np.pi * t.hour / 24.0)
            
            val += np.random.normal(0, std_val * 0.1)
            val = max(defaults["min"], min(defaults["max"], val))
            
            historical.append({
                "tiempo": t.isoformat(),
                "valor": round(val, 2)
            })

    predictions = []
    last_time = now
    if historical:
        last_time = datetime.fromisoformat(historical[-1]["tiempo"].replace('Z', '+00:00'))
        
    last_val = historical[-1]["valor"] if historical else avg_val
    
    trend = 0.0
    if len(historical) >= 24:
        trend = (historical[-1]["valor"] - historical[-24]["valor"]) / 24.0
        trend = max(-0.2, min(0.2, trend))

    for i in range(steps):
        t_fut = last_time + timedelta(hours=i + 1)
        pred_val = last_val + trend * (i + 1)
        
        if metrica_clave == "temperatura":
            pred_val += 4.0 * np.sin(2 * np.pi * t_fut.hour / 24.0) - 2.0 * np.sin(2 * np.pi * last_time.hour / 24.0)
        elif metrica_clave == "humedad":
            pred_val -= 12.0 * np.sin(2 * np.pi * t_fut.hour / 24.0) + 6.0 * np.sin(2 * np.pi * last_time.hour / 24.0)
            
        uncertainty = std_val * 0.15 * np.sqrt(i + 1)
        pred_val += np.random.normal(0, std_val * 0.02)
        
        ci_low = pred_val - 1.96 * uncertainty
        ci_high = pred_val + 1.96 * uncertainty
        
        pred_val = max(defaults["min"], min(defaults["max"], pred_val))
        ci_low = max(defaults["min"], min(defaults["max"], ci_low))
        ci_high = max(defaults["min"], min(defaults["max"], ci_high))
        
        if metrica_clave in ["precipitacion", "rain"]:
            if pred_val < 0.5:
                pred_val = 0.0
                ci_low = 0.0
                ci_high = max(0.0, ci_high * 0.5)
        
        predictions.append({
            "tiempo": t_fut.isoformat(),
            "valor": round(pred_val, 2),
            "valor_min": round(ci_low, 2),
            "valor_max": round(ci_high, 2)
        })
        
    return {
        "historical": historical,
        "predictions": predictions,
        "model_info": "Fallback-Heuristica (Sinusoidal + Deriva)"
    }

def get_arima_prediction(localidad_id: int, metrica_clave: str, steps: int = 48):
    now_time = time.time()
    cache_key = (localidad_id, metrica_clave, steps)
    
    if cache_key in prediction_cache:
        cached_time, cached_data = prediction_cache[cache_key]
        if now_time - cached_time < CACHE_TTL:
            print(f"Cache hit: {metrica_clave} - localidad {localidad_id}")
            return cached_data
            
    rows = []
    
    # ─── CASO METRICAS GRID (Lluvia/Viento) ───
    if metrica_clave in ["precipitacion", "rain", "viento", "wind_speed"]:
        coords = get_city_coords(localidad_id)
        if coords:
            lat, lon = coords
            grid_point = get_nearest_grid_point(lat, lon)
            if grid_point:
                g_lat, g_lon = grid_point
                col_name = "rain" if metrica_clave in ["precipitacion", "rain"] else "wind_speed"
                query = f"""
                    SELECT forecast_time as tiempo, {col_name} as valor
                    FROM radar_grid_cache
                    WHERE latitud = %s AND longitud = %s
                    ORDER BY forecast_time ASC
                """
                try:
                    with get_db() as conn:
                        with conn.cursor() as cur:
                            cur.execute(query, (g_lat, g_lon))
                            rows = cur.fetchall()
                except Exception as e:
                    print(f"Database error querying grid: {e}")
                    
    # ─── CASO METRICAS TIMESERIES SENSOR ───
    else:
        query = """
            SELECT l.tiempo, l.valor
            FROM lecturas l
            JOIN metricas m ON m.id = l.metrica_id
            WHERE l.localidad_id = %s AND m.clave = %s
            ORDER BY l.tiempo ASC
        """
        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(query, (localidad_id, metrica_clave))
                    rows = cur.fetchall()
        except Exception as e:
            print(f"Database error querying sensor readings: {e}")
            
    if len(rows) < 15:
        data = generate_fallback_prediction(rows, metrica_clave, steps)
    else:
        try:
            df = pd.DataFrame(rows, columns=['tiempo', 'valor'])
            df['tiempo'] = pd.to_datetime(df['tiempo'])
            df['valor'] = df['valor'].astype(float)
            df.set_index('tiempo', inplace=True)
            
            # Remuestrear por hora
            df = df.resample('1h').mean()
            df = df.ffill().bfill()
            
            # Entrenar ARIMA (1,1,1)
            model = ARIMA(df['valor'], order=(1, 1, 1))
            res = model.fit()
            
            # Pronóstico
            forecast_res = res.get_forecast(steps=steps)
            forecast_mean = forecast_res.predicted_mean
            conf_int = forecast_res.conf_int(alpha=0.05)
            
            last_timestamp = df.index[-1]
            future_times = [last_timestamp + timedelta(hours=i+1) for i in range(steps)]
            
            defaults = DEFAULT_METRIC_RANGES.get(metrica_clave, {"min": -999.0, "max": 999.0})
            
            predictions = []
            for i in range(steps):
                pred_val = float(forecast_mean.iloc[i])
                ci_low = float(conf_int.iloc[i, 0])
                ci_high = float(conf_int.iloc[i, 1])
                
                # Clips de sanidad
                pred_val = max(defaults["min"], min(defaults["max"], pred_val))
                ci_low = max(defaults["min"], min(defaults["max"], ci_low))
                ci_high = max(defaults["min"], min(defaults["max"], ci_high))
                
                predictions.append({
                    "tiempo": future_times[i].isoformat(),
                    "valor": round(pred_val, 2),
                    "valor_min": round(ci_low, 2),
                    "valor_max": round(ci_high, 2)
                })
                
            # Retornar historial (últimas 72h)
            hist_df = df.tail(72)
            historical = []
            for t, val in zip(hist_df.index, hist_df['valor']):
                historical.append({
                    "tiempo": t.isoformat(),
                    "valor": round(float(val), 2)
                })
                
            data = {
                "historical": historical,
                "predictions": predictions,
                "model_info": "ARIMA(1,1,1)"
            }
        except Exception as e:
            print(f"ARIMA fitting failed: {e}. Falling back...")
            data = generate_fallback_prediction(rows, metrica_clave, steps)
            
    prediction_cache[cache_key] = (now_time, data)
    return data
