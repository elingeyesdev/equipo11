import math
from datetime import datetime, timedelta
from app.database import get_db

DEFAULT_BASELINES = {
    "temperatura": 20.0,
    "humedad": 60.0,
    "aqi": 45.0,
    "ica": 75.0,
    "ruido": 55.0,
    "precipitacion": 0.0,
    "viento": 12.0,
    "presion": 1013.25,
    "vis": 10.0
}

def extract_vertices(area_geo):
    """
    Extracts vertices as list of (lat, lon) from area_geo.
    Supports GeoJSON Polygon and list of dicts.
    """
    if isinstance(area_geo, list):
        vertices = []
        for p in area_geo:
            if isinstance(p, dict):
                lat = p.get("lat") or p.get("latitude")
                lng = p.get("lng") or p.get("lng") or p.get("lon") or p.get("longitude")
                if lat is not None and lng is not None:
                    vertices.append((float(lat), float(lng)))
            elif isinstance(p, (list, tuple)) and len(p) >= 2:
                vertices.append((float(p[0]), float(p[1])))
        return vertices
    elif isinstance(area_geo, dict):
        if area_geo.get("type") == "Polygon" and "coordinates" in area_geo:
            coords = area_geo["coordinates"][0]  # Exterior ring
            # GeoJSON uses [lon, lat]
            return [(float(pt[1]), float(pt[0])) for pt in coords]
        elif "coordinates" in area_geo:
            coords = area_geo["coordinates"]
            if isinstance(coords, list) and len(coords) > 0:
                if isinstance(coords[0], list):
                    return [(float(pt[1]), float(pt[0])) for pt in coords[0]]
    return []

def is_point_in_polygon(lat, lon, polygon):
    """
    Ray-casting algorithm to determine if a point is inside a polygon.
    polygon: list of (lat, lon) tuples.
    """
    if len(polygon) < 3:
        return False
    
    inside = False
    n = len(polygon)
    p1x, p1y = polygon[0][1], polygon[0][0]  # lon, lat
    
    for i in range(n + 1):
        p2x, p2y = polygon[i % n][1], polygon[i % n][0]
        if lon > min(p1x, p2x):
            if lon <= max(p1x, p2x):
                if lat <= max(p1y, p2y):
                    if p1x != p2x:
                        xints = (lon - p1x) * (p2y - p1y) / (p2x - p1x) + p1y
                    if p1y == p2y or lat <= xints:
                        inside = not inside
        p1x, p1y = p2x, p2y
        
    return inside

def get_city_baseline(localidad_id: int):
    """
    Fetches the current baseline values from the database for the given city.
    """
    baseline = DEFAULT_BASELINES.copy()
    query = """
        SELECT m.clave, l.valor 
        FROM lecturas l
        JOIN metricas m ON m.id = l.metrica_id
        WHERE l.localidad_id = %s
          AND l.tiempo = (SELECT MAX(tiempo) FROM lecturas WHERE l.localidad_id = %s)
    """
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (localidad_id, localidad_id))
                for row in cur.fetchall():
                    clave = row[0]
                    valor = float(row[1])
                    if clave in baseline:
                        baseline[clave] = valor
    except Exception as e:
        print(f"Error fetching city baseline: {e}")
    return baseline

def get_grid_baseline(lat, lon):
    """
    Fetches the current baseline values from NOAA grid cache for the given coordinates.
    """
    baseline = DEFAULT_BASELINES.copy()
    query = """
        SELECT weather_code, temperatura, wind_speed, wind_direction, rafagas, presion, rain, vis
        FROM radar_grid_cache
        WHERE latitud = %s AND longitud = %s
        ORDER BY forecast_time DESC
        LIMIT 1
    """
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (lat, lon))
                row = cur.fetchone()
                if row:
                    baseline["temperatura"] = float(row[1]) if row[1] is not None else baseline["temperatura"]
                    baseline["viento"] = float(row[2]) if row[2] is not None else baseline["viento"]
                    baseline["presion"] = float(row[5]) if row[5] is not None else baseline["presion"]
                    baseline["precipitacion"] = float(row[6]) if row[6] is not None else baseline["precipitacion"]
                    baseline["vis"] = float(row[7]) if row[7] is not None else baseline["vis"]
    except Exception as e:
        print(f"Error fetching grid baseline: {e}")
    return baseline

def get_time_factor(t, duration_hours):
    """
    Realistic time profile: builds up, peaks, stays at peak, then decays.
    """
    x = t / duration_hours
    if x < 0.25:
        # Build-up phase
        return math.sin(math.pi * x / 0.5)
    elif x <= 0.60:
        # Peak phase
        return 1.0
    else:
        # Decay phase (retains 10% baseline at the end)
        decay_range = 1.0 - 0.60
        decay_pct = (x - 0.60) / decay_range
        return 1.0 - 0.9 * math.sin(math.pi * decay_pct / 2.0)

def get_points_to_simulate(localidad_id: int, area_geo):
    """
    Retrieves the list of coordinates (lat, lon, is_city) to simulate.
    """
    points = []
    city_lat = None
    city_lon = None
    
    # 1. Fetch city coordinates
    city_query = "SELECT latitud, longitud FROM localidades WHERE id = %s"
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(city_query, (localidad_id,))
                row = cur.fetchone()
                if row:
                    city_lat = float(row[0])
                    city_lon = float(row[1])
                    points.append((city_lat, city_lon, True))
    except Exception as e:
        print(f"Error fetching city coords: {e}")
        
    # 2. Extract polygon vertices
    polygon = extract_vertices(area_geo)
    
    if polygon:
        lats = [v[0] for v in polygon]
        lons = [v[1] for v in polygon]
        lat_min, lat_max = min(lats), max(lats)
        lon_min, lon_max = min(lons), max(lons)
        
        # Query distinct grid coordinates inside bbox
        grid_query = """
            SELECT DISTINCT latitud, longitud 
            FROM radar_grid_cache
            WHERE latitud BETWEEN %s AND %s
              AND longitud BETWEEN %s AND %s
        """
        grid_points = []
        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(grid_query, (lat_min, lat_max, lon_min, lon_max))
                    grid_points = [(float(row[0]), float(row[1])) for row in cur.fetchall()]
        except Exception as e:
            print(f"Error fetching grid points: {e}")
            
        # Filter grid points inside polygon
        for gp in grid_points:
            # Skip if it is too close to the city point to avoid duplication
            if city_lat is not None and city_lon is not None:
                if abs(gp[0] - city_lat) < 0.05 and abs(gp[1] - city_lon) < 0.05:
                    continue
            if is_point_in_polygon(gp[0], gp[1], polygon):
                points.append((gp[0], gp[1], False))
                
        # Fallback to nearest grid point to polygon centroid if none found
        if len(points) == 1 and points[0][2]:
            centroid_lat = sum(lats) / len(polygon)
            centroid_lon = sum(lons) / len(polygon)
            
            nearest_query = """
                SELECT latitud, longitud 
                FROM radar_grid_cache
                ORDER BY (latitud - %s)^2 + (longitud - %s)^2 ASC
                LIMIT 1
            """
            try:
                with get_db() as conn:
                    with conn.cursor() as cur:
                        cur.execute(nearest_query, (centroid_lat, centroid_lon))
                        row = cur.fetchone()
                        if row:
                            points.append((float(row[0]), float(row[1]), False))
            except Exception as e:
                print(f"Error finding nearest grid point: {e}")
                
    return points

def generate_storm_data(area_geo, params, localidad_id: int):
    """
    Generates rain, wind, pressure and temperature anomalies.
    """
    intensity = float(params.get("intensidad", 2.0))
    duration = int(params.get("duracion_horas", 24))
    
    points = get_points_to_simulate(localidad_id, area_geo)
    now = datetime.utcnow()
    
    data_points = []
    for lat, lon, is_city in points:
        baseline = get_city_baseline(localidad_id) if is_city else get_grid_baseline(lat, lon)
        
        for t in range(duration):
            time_factor = get_time_factor(t, duration)
            timestep = now + timedelta(hours=t)
            
            # 1. Rain (precipitation)
            rain_val = baseline.get("precipitacion", 0.0) + (15.0 * intensity * time_factor)
            data_points.append((lat, lon, "precipitacion", round(rain_val, 2), timestep))
            
            # 2. Wind speed
            wind_val = baseline.get("viento", 12.0) + (45.0 * intensity * time_factor)
            data_points.append((lat, lon, "viento", round(wind_val, 2), timestep))
            
            # 3. Pressure
            press_val = baseline.get("presion", 1013.25) - (30.0 * intensity * time_factor)
            data_points.append((lat, lon, "presion", round(press_val, 2), timestep))
            
            # 4. Temperature drop
            temp_val = baseline.get("temperatura", 20.0) - (4.0 * intensity * time_factor)
            data_points.append((lat, lon, "temperatura", round(temp_val, 2), timestep))
            
    return data_points

def generate_heatwave_data(area_geo, params, localidad_id: int):
    """
    Generates extreme temperatures and low humidity.
    """
    intensity = float(params.get("intensidad", 2.0))
    duration = int(params.get("duracion_horas", 24))
    
    points = get_points_to_simulate(localidad_id, area_geo)
    now = datetime.utcnow()
    
    data_points = []
    for lat, lon, is_city in points:
        baseline = get_city_baseline(localidad_id) if is_city else get_grid_baseline(lat, lon)
        
        for t in range(duration):
            time_factor = get_time_factor(t, duration)
            timestep = now + timedelta(hours=t)
            
            # 1. Temperature rise
            temp_val = baseline.get("temperatura", 20.0) + (12.0 * intensity * time_factor)
            data_points.append((lat, lon, "temperatura", round(temp_val, 2), timestep))
            
            # 2. Humidity drop
            hum_val = max(5.0, baseline.get("humedad", 60.0) - (25.0 * intensity * time_factor))
            data_points.append((lat, lon, "humedad", round(hum_val, 2), timestep))
            
    return data_points

def generate_fire_data(area_geo, params, localidad_id: int):
    """
    Generates extreme AQI, high temperature, low humidity and low visibility.
    """
    intensity = float(params.get("intensidad", 2.0))
    duration = int(params.get("duracion_horas", 24))
    
    points = get_points_to_simulate(localidad_id, area_geo)
    now = datetime.utcnow()
    
    data_points = []
    for lat, lon, is_city in points:
        baseline = get_city_baseline(localidad_id) if is_city else get_grid_baseline(lat, lon)
        
        for t in range(duration):
            time_factor = get_time_factor(t, duration)
            timestep = now + timedelta(hours=t)
            
            # 1. AQI spike
            aqi_val = min(500.0, baseline.get("aqi", 45.0) + (200.0 * intensity * time_factor))
            data_points.append((lat, lon, "aqi", round(aqi_val, 2), timestep))
            
            # 2. Temperature rise
            temp_val = baseline.get("temperatura", 20.0) + (8.0 * intensity * time_factor)
            data_points.append((lat, lon, "temperatura", round(temp_val, 2), timestep))
            
            # 3. Humidity drop
            hum_val = max(5.0, baseline.get("humedad", 60.0) - (30.0 * intensity * time_factor))
            data_points.append((lat, lon, "humedad", round(hum_val, 2), timestep))
            
            # 4. Visibility drop
            vis_val = max(0.1, baseline.get("vis", 10.0) - (8.0 * intensity * time_factor))
            data_points.append((lat, lon, "vis", round(vis_val, 2), timestep))
            
    return data_points

def generate_flood_data(area_geo, params, localidad_id: int):
    """
    Generates sustained rain, extreme humidity and poor water quality (ICA).
    """
    intensity = float(params.get("intensidad", 2.0))
    duration = int(params.get("duracion_horas", 24))
    
    points = get_points_to_simulate(localidad_id, area_geo)
    now = datetime.utcnow()
    
    data_points = []
    for lat, lon, is_city in points:
        baseline = get_city_baseline(localidad_id) if is_city else get_grid_baseline(lat, lon)
        
        for t in range(duration):
            time_factor = get_time_factor(t, duration)
            timestep = now + timedelta(hours=t)
            
            # 1. Rain
            rain_val = baseline.get("precipitacion", 0.0) + (8.0 * intensity * time_factor)
            data_points.append((lat, lon, "precipitacion", round(rain_val, 2), timestep))
            
            # 2. Humidity spike
            hum_val = min(100.0, baseline.get("humedad", 60.0) + (35.0 * intensity * time_factor))
            data_points.append((lat, lon, "humedad", round(hum_val, 2), timestep))
            
            # 3. Water Quality (ICA) drop
            ica_val = max(10.0, baseline.get("ica", 75.0) - (25.0 * intensity * time_factor))
            data_points.append((lat, lon, "ica", round(ica_val, 2), timestep))
            
    return data_points

def generate_scenario_data(tipo_evento: str, area_geo, params, localidad_id: int):
    """
    Generates synthetic data according to the event type.
    """
    if tipo_evento == "tormenta":
        return generate_storm_data(area_geo, params, localidad_id)
    elif tipo_evento == "ola_calor":
        return generate_heatwave_data(area_geo, params, localidad_id)
    elif tipo_evento == "incendio":
        return generate_fire_data(area_geo, params, localidad_id)
    elif tipo_evento == "inundacion":
        return generate_flood_data(area_geo, params, localidad_id)
    else:
        # Default/Custom fallback
        # Simply generates slightly elevated values for whatever metrics are listed in parameters
        metrics = params.get("metricas_afectadas", ["temperatura"])
        intensity = float(params.get("intensidad", 2.0))
        duration = int(params.get("duracion_horas", 24))
        points = get_points_to_simulate(localidad_id, area_geo)
        now = datetime.utcnow()
        
        data_points = []
        for lat, lon, is_city in points:
            baseline = get_city_baseline(localidad_id) if is_city else get_grid_baseline(lat, lon)
            for metric in metrics:
                for t in range(duration):
                    time_factor = get_time_factor(t, duration)
                    timestep = now + timedelta(hours=t)
                    val = baseline.get(metric, 20.0) + (5.0 * intensity * time_factor)
                    data_points.append((lat, lon, metric, round(val, 2), timestep))
        return data_points
