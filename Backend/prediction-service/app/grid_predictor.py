import psycopg2
from psycopg2 import extras
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from app.database import get_db

BBOX = {
    "lat_min": -60.0,
    "lat_max": 15.0,
    "lon_min": -90.0,
    "lon_max": -30.0
}

def predict_global_grid():
    """
    Extrapola la cuadrícula NOAA GFS en radar_grid_cache para las próximas 72 horas
    en incrementos de 3 horas (24 pasos de f024 a f072) para la región de Sudamérica.
    Usa regresión lineal matricial vectorial rápida en Numpy.
    """
    print("Starting grid prediction pipeline...")
    
    # 1. Obtener la hora del último análisis (NOW de referencia)
    last_analysis_query = """
        SELECT MAX(forecast_time) 
        FROM radar_grid_cache 
        WHERE forecast_time <= NOW()
    """
    
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(last_analysis_query)
            res = cur.fetchone()
            if not res or not res[0]:
                print("No GFS historical data found in radar_grid_cache. Aborting grid prediction.")
                return False
            last_analysis = res[0]
            
    print(f"Last available GFS analysis timestamp: {last_analysis}")

    # 2. Consultar el historial de los últimos 3 días para entrenar
    history_start = last_analysis - timedelta(days=3)
    
    query_history = """
        SELECT forecast_time, latitud, longitud, weather_code, temperatura, 
               wind_speed, wind_direction, rafagas, presion, cape, hlcy, refc, 
               rain, snow, snow_fresh, vis
        FROM radar_grid_cache
        WHERE forecast_time >= %s AND forecast_time <= %s
          AND latitud BETWEEN %s AND %s
          AND longitud BETWEEN %s AND %s
        ORDER BY forecast_time ASC
    """
    
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(query_history, (
                history_start, last_analysis, 
                BBOX["lat_min"], BBOX["lat_max"], 
                BBOX["lon_min"], BBOX["lon_max"]
            ))
            rows = cur.fetchall()

    if len(rows) < 100:
        print(f"Insufficient historical grid cells found ({len(rows)}). Aborting grid prediction.")
        return False
        
    print(f"Loaded {len(rows)} historical GFS grid records.")

    # 3. Pivotar datos y organizar tensores con Pandas/Numpy
    df = pd.DataFrame(rows, columns=[
        'forecast_time', 'lat', 'lon', 'weather_code', 'temperatura',
        'wind_speed', 'wind_direction', 'rafagas', 'presion', 'cape',
        'hlcy', 'refc', 'rain', 'snow', 'snow_fresh', 'vis'
    ])
    
    # Clave compuesta por coordenadas
    df['coord'] = df['lat'].astype(str) + "_" + df['lon'].astype(str)
    
    unique_coords = df['coord'].unique()
    unique_times = df['forecast_time'].unique()
    
    num_coords = len(unique_coords)
    num_times = len(unique_times)
    
    print(f"Unique grid coordinates: {num_coords}, unique time steps: {num_times}")
    
    if num_times < 4:
        print("Too few time steps to fit regression model. Aborting.")
        return False

    # Crear mapeos rápidos
    coord_idx = {c: i for i, c in enumerate(unique_coords)}
    coord_data = [c.split("_") for c in unique_coords]
    coord_lats = np.array([float(c[0]) for c in coord_data])
    coord_lons = np.array([float(c[1]) for c in coord_data])

    # Variables a predecir
    vars_to_predict = [
        'temperatura', 'wind_speed', 'wind_direction', 'rafagas', 'presion',
        'cape', 'hlcy', 'refc', 'rain', 'snow', 'snow_fresh', 'vis'
    ]
    
    # Llenar tensores Y de tamaño (num_times, num_coords)
    Y_matrices = {v: np.zeros((num_times, num_coords)) for v in vars_to_predict}
    weather_codes = np.zeros((num_times, num_coords), dtype=int)

    # Llenar matrices con indexación rápida
    time_idx = {t: i for i, t in enumerate(unique_times)}
    for row in rows:
        t_i = time_idx[row[0]]
        c_key = f"{row[1]}_{row[2]}"
        if c_key in coord_idx:
            c_i = coord_idx[c_key]
            weather_codes[t_i, c_i] = int(row[3]) if row[3] is not None else 0
            for v_idx, v in enumerate(vars_to_predict):
                val = row[4 + v_idx]
                Y_matrices[v][t_i, c_i] = float(val) if val is not None else 0.0

    # 4. Construir la matriz de diseño X de tamaño (num_times, 4)
    # Columnas: [tiempo, 1 (constante), sin(2pi*hora/24), cos(2pi*hora/24)]
    X = np.zeros((num_times, 4))
    for i, ts in enumerate(unique_times):
        # Convertir a datetime de python si es Timestamp de pandas
        dt = pd.to_datetime(ts)
        X[i, 0] = i
        X[i, 1] = 1.0
        X[i, 2] = np.sin(2 * np.pi * dt.hour / 24.0)
        X[i, 3] = np.cos(2 * np.pi * dt.hour / 24.0)

    # Resolver coeficientes beta de tamaño (4, num_coords) para cada métrica
    beta_matrices = {}
    try:
        # Resolver usando mínimos cuadrados ordinarios generalizado
        # beta = (X^T * X)^-1 * X^T * Y
        XtX_inv = np.linalg.inv(X.T @ X)
        for v in vars_to_predict:
            beta_matrices[v] = XtX_inv @ X.T @ Y_matrices[v]
    except np.linalg.LinAlgError:
        print("Design matrix is singular, using simple historical mean for grid prediction.")
        # Fallback a la media histórica si falla la matriz
        for v in vars_to_predict:
            beta = np.zeros((4, num_coords))
            beta[1, :] = np.mean(Y_matrices[v], axis=0)
            beta_matrices[v] = beta

    # 5. Proyectar 16 pasos futuros (f027 a f072 en intervalos de 3h, es decir, de 27h a 72h del futuro)
    # Los primeros 24h (f003 a f024) son datos reales descargados de GFS por el scraper.
    future_steps = 16
    future_times = [last_analysis + timedelta(hours=24 + 3 * (k + 1)) for k in range(future_steps)]
    
    X_fut = np.zeros((future_steps, 4))
    for k, dt in enumerate(future_times):
        # f027 es el paso 8 en el futuro
        X_fut[k, 0] = num_times + 8 + k
        X_fut[k, 1] = 1.0
        X_fut[k, 2] = np.sin(2 * np.pi * dt.hour / 24.0)
        X_fut[k, 3] = np.cos(2 * np.pi * dt.hour / 24.0)

    # Calcular predicciones futuras
    Y_pred = {}
    for v in vars_to_predict:
        pred = X_fut @ beta_matrices[v]
        
        # Aplicar restricciones físicas (valores no negativos para lluvia, aqi, viento, etc.)
        if v in ['wind_speed', 'rafagas', 'cape', 'hlcy', 'refc', 'rain', 'snow', 'snow_fresh', 'vis']:
            pred = np.maximum(0.0, pred)
        elif v == 'presion':
            pred = np.maximum(800.0, pred)  # Presión hPa mínima lógica
            
        Y_pred[v] = pred

    # Usar el último código del clima histórico como estimación
    weather_codes_pred = weather_codes[-1, :]

    # 6. Escribir predicciones en Postgres en Chunks eficientes con execute_values
    print("Writing grid predictions to PostgreSQL cache...")
    
    with get_db() as conn:
        with conn.cursor() as cur:
            for k, f_time in enumerate(future_times):
                # Eliminar registros existentes para esta coordenada y tiempo futuro
                cur.execute("""
                    DELETE FROM radar_grid_cache 
                    WHERE forecast_time = %s 
                      AND latitud BETWEEN %s AND %s 
                      AND longitud BETWEEN %s AND %s
                """, (
                    f_time, 
                    BBOX["lat_min"], BBOX["lat_max"], 
                    BBOX["lon_min"], BBOX["lon_max"]
                ))
                
                # Armar tuplas para inserción masiva
                insert_data = []
                for c_i in range(num_coords):
                    lat = float(coord_lats[c_i])
                    lon = float(coord_lons[c_i])
                    w_code = int(weather_codes_pred[c_i])
                    
                    temp = float(Y_pred['temperatura'][k, c_i])
                    w_speed = float(Y_pred['wind_speed'][k, c_i])
                    w_dir = int(round(Y_pred['wind_direction'][k, c_i] % 360))
                    gusts = float(Y_pred['rafagas'][k, c_i])
                    pres = float(Y_pred['presion'][k, c_i])
                    cape = float(Y_pred['cape'][k, c_i])
                    hlcy = float(Y_pred['hlcy'][k, c_i])
                    refc = float(Y_pred['refc'][k, c_i])
                    rain = float(Y_pred['rain'][k, c_i])
                    snow = float(Y_pred['snow'][k, c_i])
                    snow_fresh = float(Y_pred['snow_fresh'][k, c_i])
                    vis = float(Y_pred['vis'][k, c_i])
                    
                    insert_data.append((
                        lat, lon, w_code, temp, w_speed, w_dir, gusts, pres,
                        f_time, cape, hlcy, refc, rain, snow, snow_fresh, vis
                    ))
                
                # Ejecutar Bulk Insert veloz
                extras.execute_values(
                    cur,
                    """
                    INSERT INTO radar_grid_cache (
                        latitud, longitud, weather_code, temperatura, wind_speed, wind_direction,
                        rafagas, presion, forecast_time, cape, hlcy, refc, rain, snow, snow_fresh, vis
                    ) VALUES %s
                    ON CONFLICT (latitud, longitud, forecast_time) DO UPDATE SET
                        weather_code = EXCLUDED.weather_code,
                        temperatura = EXCLUDED.temperatura,
                        wind_speed = EXCLUDED.wind_speed,
                        wind_direction = EXCLUDED.wind_direction,
                        rafagas = EXCLUDED.rafagas,
                        presion = EXCLUDED.presion,
                        cape = EXCLUDED.cape,
                        hlcy = EXCLUDED.hlcy,
                        refc = EXCLUDED.refc,
                        rain = EXCLUDED.rain,
                        snow = EXCLUDED.snow,
                        snow_fresh = EXCLUDED.snow_fresh,
                        vis = EXCLUDED.vis,
                        actualizado_en = NOW()
                    """,
                    insert_data
                )
        conn.commit()
        
    print(f"Grid predictions successfully inserted for {future_steps} steps up to {future_times[-1]}.")
    return True
