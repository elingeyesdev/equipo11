from app.predictor import get_arima_prediction
from app.correlations import get_metrics_correlation

METRICS = ["temperatura", "humedad", "aqi", "precipitacion", "viento"]

PRESETS = {
    "aqi": {"optimista": -25.0, "pesimista": 30.0},
    "temperatura": {"optimista": -10.0, "pesimista": 15.0},
    "humedad": {"optimista": 10.0, "pesimista": -20.0},
    "precipitacion": {"optimista": -10.0, "pesimista": 40.0},
    "viento": {"optimista": -10.0, "pesimista": 30.0}
}

def clip_metric_value(metric: str, val: float) -> float:
    if metric in ["aqi", "humedad", "precipitacion", "viento"]:
        val = max(0.0, val)
    if metric == "humedad":
        val = min(100.0, val)
    return val

def calculate_scenarios(localidad_id: int, target_metric: str, steps: int = 48, simulated_predictions = None):
    """
    Simula escenarios what-if propagando el cambio porcentual de una métrica
    objetivo hacia las otras métricas usando la matriz de correlación de Pearson.
    """
    if target_metric not in PRESETS:
        target_metric = "aqi"

    # 1. Obtener predicción ARIMA base para todas las métricas o usar las simuladas
    baselines = {}
    for m in METRICS:
        if simulated_predictions is not None and m in simulated_predictions:
            m_data = simulated_predictions[m]
            if isinstance(m_data, dict) and "predictions" in m_data:
                baselines[m] = m_data["predictions"]
            else:
                baselines[m] = m_data
        else:
            baselines[m] = get_arima_prediction(localidad_id, m, steps)["predictions"]

    # 2. Obtener matriz de correlación
    correlations = get_metrics_correlation(localidad_id)

    # 3. Cargar presets
    opt_change = PRESETS[target_metric]["optimista"]
    pess_change = PRESETS[target_metric]["pesimista"]

    actual_timeline = []
    opt_timeline = []
    pess_timeline = []

    for i in range(steps):
        timestamp = baselines[target_metric][i]["tiempo"]

        # ─── ESCENARIO ACTUAL (ARIMA BASE) ───
        actual_step = {"tiempo": timestamp, "valores": {}}
        for m in METRICS:
            actual_step["valores"][m] = baselines[m][i]["valor"]
        actual_timeline.append(actual_step)

        # ─── ESCENARIO OPTIMISTA ───
        opt_step = {"tiempo": timestamp, "valores": {}}
        # Modificar métrica objetivo
        opt_target_val = actual_step["valores"][target_metric] * (1.0 + opt_change / 100.0)
        opt_step["valores"][target_metric] = round(clip_metric_value(target_metric, opt_target_val), 2)
        # Propagar en cascada al resto
        for m in METRICS:
            if m != target_metric:
                r = correlations[target_metric].get(m, 0.0)
                m_change = r * (opt_change / 100.0)
                opt_val = actual_step["valores"][m] * (1.0 + m_change)
                opt_step["valores"][m] = round(clip_metric_value(m, opt_val), 2)
        opt_timeline.append(opt_step)

        # ─── ESCENARIO PESIMISTA ───
        pess_step = {"tiempo": timestamp, "valores": {}}
        # Modificar métrica objetivo
        pess_target_val = actual_step["valores"][target_metric] * (1.0 + pess_change / 100.0)
        pess_step["valores"][target_metric] = round(clip_metric_value(target_metric, pess_target_val), 2)
        # Propagar en cascada al resto
        for m in METRICS:
            if m != target_metric:
                r = correlations[target_metric].get(m, 0.0)
                m_change = r * (pess_change / 100.0)
                pess_val = actual_step["valores"][m] * (1.0 + m_change)
                pess_step["valores"][m] = round(clip_metric_value(m, pess_val), 2)
        pess_timeline.append(pess_step)

    return {
        "actual": actual_timeline,
        "optimista": opt_timeline,
        "pesimista": pess_timeline,
        "target_metric": target_metric,
        "presets": PRESETS[target_metric]
    }
