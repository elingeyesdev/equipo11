import pandas as pd
import numpy as np
from app.database import get_db

DEFAULT_CORRELATIONS = {
    "temperatura": {"temperatura": 1.0, "humedad": -0.50, "aqi": 0.65, "precipitacion": -0.10, "rain": -0.10, "viento": 0.15, "wind_speed": 0.15},
    "humedad": {"temperatura": -0.50, "humedad": 1.0, "aqi": -0.30, "precipitacion": 0.60, "rain": 0.60, "viento": -0.10, "wind_speed": -0.10},
    "aqi": {"temperatura": 0.65, "humedad": -0.30, "aqi": 1.0, "precipitacion": -0.55, "rain": -0.55, "viento": -0.40, "wind_speed": -0.40},
    "precipitacion": {"temperatura": -0.10, "humedad": 0.60, "aqi": -0.55, "precipitacion": 1.0, "rain": 1.0, "viento": 0.20, "wind_speed": 0.20},
    "rain": {"temperatura": -0.10, "humedad": 0.60, "aqi": -0.55, "precipitacion": 1.0, "rain": 1.0, "viento": 0.20, "wind_speed": 0.20},
    "viento": {"temperatura": 0.15, "humedad": -0.10, "aqi": -0.40, "precipitacion": 0.20, "viento": 1.0, "wind_speed": 1.0},
    "wind_speed": {"temperatura": 0.15, "humedad": -0.10, "aqi": -0.40, "precipitacion": 0.20, "wind_speed": 1.0}
}

def get_metrics_correlation(localidad_id: int):
    """
    Calcula la matriz de correlación histórica de Pearson para una localidad.
    Si faltan datos o hay valores no correlacionables, fusiona con valores climáticos estándar.
    """
    query = """
        SELECT l.tiempo, m.clave, l.valor
        FROM lecturas l
        JOIN metricas m ON m.id = l.metrica_id
        WHERE l.localidad_id = %s
        ORDER BY l.tiempo ASC
    """
    
    rows = []
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (localidad_id,))
                rows = cur.fetchall()
    except Exception as e:
        print(f"Database error querying correlations: {e}")

    # Inicializar la matriz resultante con los valores por defecto
    metrics = ["temperatura", "humedad", "aqi", "precipitacion", "viento"]
    matrix = {m: {m2: DEFAULT_CORRELATIONS[m][m2] for m2 in metrics} for m in metrics}

    if len(rows) >= 15:
        try:
            df = pd.DataFrame(rows, columns=['tiempo', 'metrica', 'valor'])
            df['tiempo'] = pd.to_datetime(df['tiempo'])
            df['valor'] = df['valor'].astype(float)
            
            # Pivotar la tabla para tener métricas como columnas
            df_pivot = df.pivot_table(index='tiempo', columns='metrica', values='valor', aggfunc='mean')
            
            # Remuestrear a 1 hora para alinear las lecturas temporales
            df_pivot = df_pivot.resample('1h').mean()
            df_pivot = df_pivot.ffill().bfill()
            
            # Filtrar columnas que están en nuestra lista de interés
            cols_to_corr = [col for col in df_pivot.columns if col in metrics]
            if len(cols_to_corr) >= 2:
                corr_df = df_pivot[cols_to_corr].corr(method='pearson')
                
                # Rellenar nuestra matriz con los coeficientes calculados si son válidos
                for m1 in cols_to_corr:
                    for m2 in cols_to_corr:
                        val = corr_df.loc[m1, m2]
                        if not pd.isna(val) and not np.isinf(val):
                            matrix[m1][m2] = round(float(val), 3)
        except Exception as e:
            print(f"Error computing Pearson correlation: {e}. Using defaults.")

    return matrix
