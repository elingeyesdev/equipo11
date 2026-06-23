import os
import time
import requests
import xarray as xr
import cfgrib
import numpy as np
from PIL import Image
from datetime import datetime, timedelta
import bisect

# ==========================================
# 1. CONFIGURACIÓN Y RUTAS
# ==========================================
BASE_DATA_DIR = os.path.join(os.path.dirname(__file__), '../data')

VARIABLE_START_DATES = {
    'evaporacion': '2026-06-18 05:00:00',
    'humedad': '2026-06-18 07:00:00',
    'temperatura': '2026-06-18 09:00:00',
    'lluvia': '2026-06-18 09:00:00',
    'viento': '2026-06-18 09:00:00',
    'nieve': '2026-06-18 09:00:00',
    'isobaras': '2026-06-18 10:00:00',
    'uv': '2026-06-18 10:00:00',
    'visibilidad': '2026-06-23 11:00:00'
}

NOAA_IDX_TARGETS = {
    'temperatura': ':TMP:2 m above ground:',
    'lluvia': ':PRATE:surface:',           # o ':APCP:surface:' si prate no está
    'humedad': ':RH:2 m above ground:',
    'isobaras': ':PRMSL:mean sea level:',
    'visibilidad': ':VIS:surface:',
    'nieve': ':WEASD:surface:',            # o ':CSNOW:surface:'
    'uv': ':DSWRF:surface:',
    'evaporacion': ':PEVPR:surface:'
}

RAIN_STOPS = [0.0, 0.2, 0.5, 1.0, 2.0, 3.0, 4.0, 5.0, 7.5, 10.0, 15.0, 20.0, 25.0, 30.0, 35.0, 40.0, 50.0, 60.0, 70.0, 85.0, 100.0, 150.0]

def encode_rain_pixel(val):
    if np.isnan(val) or val <= 0: return 0
    if val >= 150.0: return 255
    idx = bisect.bisect_right(RAIN_STOPS, val) - 1
    t = (val - RAIN_STOPS[idx]) / (RAIN_STOPS[idx+1] - RAIN_STOPS[idx])
    norm = (idx + t) / 21.0
    return int(round(norm * 255.0))
v_encode_rain = np.vectorize(encode_rain_pixel)

# ==========================================
# 2. FUNCIONES BASE S3 Y CHUNKS
# ==========================================
def get_historical_gfs_params(dt):
    hour = dt.hour
    if hour < 6:
        cycle = 0
        f_hour = hour
    elif hour < 12:
        cycle = 6
        f_hour = hour - 6
    elif hour < 18:
        cycle = 12
        f_hour = hour - 12
    else:
        cycle = 18
        f_hour = hour - 18
    return dt.strftime('%Y%m%d'), f"{cycle:02d}", f"{f_hour:03d}"

def fetch_idx(url_idx, max_retries=3):
    for attempt in range(max_retries):
        try:
            r = requests.get(url_idx, timeout=20)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r.text.strip().split('\n')
        except Exception as e:
            time.sleep(5)
    return None

def fetch_chunk(url_grib, byte_start, byte_end, max_retries=3):
    headers = {'Range': f'bytes={byte_start}-{byte_end}'}
    for attempt in range(max_retries):
        try:
            r = requests.get(url_grib, headers=headers, timeout=30)
            r.raise_for_status()
            return r.content
        except Exception as e:
            time.sleep(5)
    return None

def find_byte_range(lines, target_str):
    for i, line in enumerate(lines):
        if target_str in line:
            parts = line.split(':')
            start_byte = int(parts[1])
            end_byte = ''
            if i + 1 < len(lines):
                end_byte = int(lines[i+1].split(':')[1]) - 1
            return start_byte, end_byte
    return None, None

def process_chunk(chunk_data, var_key, filepath):
    temp_file = f"/tmp/mini_chunk_{var_key}.grib2"
    with open(temp_file, 'wb') as f:
        f.write(chunk_data)
        
    try:
        ds = xr.open_dataset(temp_file, engine='cfgrib', backend_kwargs={'indexpath': ''})
        var_name = list(ds.data_vars)[0]
        frame = ds[var_name].values
        
        while len(frame.shape) > 2:
            frame = frame[0]
            
        frame = np.flipud(frame)
        
        if var_key == 'temperatura':
            celsius = frame - 273.15
            norm = (celsius - (-50.0)) / (50.0 - (-50.0))
        elif var_key == 'lluvia':
            mm = frame * 3600.0
            encoded = v_encode_rain(mm).astype(np.uint8)
            img = Image.fromarray(encoded, mode='L')
            img.save(filepath)
            ds.close()
            os.remove(temp_file)
            return True
        elif var_key == 'isobaras':
            hpa = frame / 100.0
            norm = (hpa - 900.0) / (1100.0 - 900.0)
        elif var_key == 'visibilidad':
            norm = frame / 24140.0
        elif var_key == 'nieve':
            mm = frame
            norm = mm / 150.0
        elif var_key == 'evaporacion':
            norm = frame / 500.0
        elif var_key == 'humedad':
            norm = frame / 100.0
        elif var_key == 'uv':
            norm = frame / 1000.0
            
        clipped = np.clip(norm, 0.0, 1.0)
        encoded = np.round(clipped * 255.0).astype(np.uint8)
        img = Image.fromarray(encoded, mode='L')
        img.save(filepath)
        
        ds.close()
    except Exception as e:
        print(f"    [!] Falla procesando chunk {var_key}: {e}")
        if 'ds' in locals(): ds.close()
        
    if os.path.exists(temp_file):
        os.remove(temp_file)
    return True

def process_wind_chunks(u_chunk, v_chunk, filepath):
    temp_u = "/tmp/mini_u.grib2"
    temp_v = "/tmp/mini_v.grib2"
    with open(temp_u, 'wb') as f: f.write(u_chunk)
    with open(temp_v, 'wb') as f: f.write(v_chunk)
    
    try:
        dsu = xr.open_dataset(temp_u, engine='cfgrib', backend_kwargs={'indexpath': ''})
        dsv = xr.open_dataset(temp_v, engine='cfgrib', backend_kwargs={'indexpath': ''})
        
        u_var = list(dsu.data_vars)[0]
        v_var = list(dsv.data_vars)[0]
        
        u_frame = dsu[u_var].values
        v_frame = dsv[v_var].values
        
        while len(u_frame.shape) > 2: u_frame = u_frame[0]
        while len(v_frame.shape) > 2: v_frame = v_frame[0]
        
        u_frame = np.flipud(u_frame)
        v_frame = np.flipud(v_frame)
        
        u_norm = (u_frame - (-100.0)) / (100.0 - (-100.0))
        v_norm = (v_frame - (-100.0)) / (100.0 - (-100.0))
        u_8bit = np.round(np.clip(u_norm, 0.0, 1.0) * 255.0).astype(np.uint8)
        v_8bit = np.round(np.clip(v_norm, 0.0, 1.0) * 255.0).astype(np.uint8)
        rgb_array = np.dstack((u_8bit, v_8bit, np.zeros_like(u_8bit)))
        img = Image.fromarray(rgb_array, mode='RGB')
        img.save(filepath)
        
        dsu.close()
        dsv.close()
    except Exception as e:
        print(f"    [!] Falla procesando chunks viento: {e}")
        if 'dsu' in locals(): dsu.close()
        if 'dsv' in locals(): dsv.close()
        
    if os.path.exists(temp_u): os.remove(temp_u)
    if os.path.exists(temp_v): os.remove(temp_v)

# ==========================================
# 3. LÓGICA DE TIEMPO Y BUCLE MAESTRO
# ==========================================
start_time = min(datetime.strptime(v, '%Y-%m-%d %H:%M:%S') for v in VARIABLE_START_DATES.values())
now = datetime.utcnow()
safe_now = now - timedelta(hours=6)
anchor_date_str = safe_now.strftime('%Y%m%d')
anchor_cycle = (safe_now.hour // 6) * 6
anchor_cycle_str = f"{anchor_cycle:02d}"
anchor_dt = datetime(safe_now.year, safe_now.month, safe_now.day, anchor_cycle, 0, 0)

print(f"[*] ORÁCULO OPERACIONAL NOAA INICIADO (Modo: Byte-Range Chunking)")
print(f"[*] Ciclo ancla detectado: {anchor_date_str} {anchor_cycle_str}Z")

current_time = start_time

while current_time <= anchor_dt + timedelta(hours=384):
    year = current_time.strftime('%Y')
    month = current_time.strftime('%m')
    timestamp = current_time.strftime('%Y%m%d_%H00')
    
    missing_vars = []
    filepaths = {}
    
    for var_folder in VARIABLE_START_DATES.keys():
        var_start = datetime.strptime(VARIABLE_START_DATES[var_folder], '%Y-%m-%d %H:%M:%S')
        if current_time < var_start:
            continue
            
        out_dir = os.path.join(BASE_DATA_DIR, var_folder, year, month)
        os.makedirs(out_dir, exist_ok=True)
        fpath = os.path.join(out_dir, f"{timestamp}.png")
        filepaths[var_folder] = fpath
        if not os.path.exists(fpath):
            missing_vars.append(var_folder)
            
    if not missing_vars:
        print(f"[*] {timestamp} | Completado en disco.")
        if current_time < anchor_dt + timedelta(hours=120):
            current_time += timedelta(hours=1)
        else:
            current_time += timedelta(hours=3)
        continue
        
    # Calcular URL S3
    if current_time <= anchor_dt:
        date_str, cycle_str, f_hour_str = get_historical_gfs_params(current_time)
    else:
        f_hour = int((current_time - anchor_dt).total_seconds() // 3600)
        date_str, cycle_str, f_hour_str = anchor_date_str, anchor_cycle_str, f"{f_hour:03d}"
        
    url_grib = f"https://noaa-gfs-bdp-pds.s3.amazonaws.com/gfs.{date_str}/{cycle_str}/atmos/gfs.t{cycle_str}z.pgrb2.0p25.f{f_hour_str}"
    url_idx = url_grib + ".idx"
    
    print(f"\n[*] Analizando índice S3 para {timestamp}...")
    idx_lines = fetch_idx(url_idx)
    
    if idx_lines is None:
        print(f"[*] Límite del pronóstico alcanzado (404). El oráculo ha terminado en {timestamp}.")
        break
        
    print(f"    Descargando mini-chunks para: {', '.join(missing_vars)}")
    
    for var_key in missing_vars:
        if var_key == 'viento':
            u_start, u_end = find_byte_range(idx_lines, ':UGRD:10 m above ground:')
            v_start, v_end = find_byte_range(idx_lines, ':VGRD:10 m above ground:')
            if u_start is not None and v_start is not None:
                u_chunk = fetch_chunk(url_grib, u_start, u_end)
                v_chunk = fetch_chunk(url_grib, v_start, v_end)
                if u_chunk and v_chunk:
                    process_wind_chunks(u_chunk, v_chunk, filepaths['viento'])
            else:
                print("    [!] Warning: Variables UGRD/VGRD no encontradas en .idx")
        else:
            target = NOAA_IDX_TARGETS[var_key]
            start_b, end_b = find_byte_range(idx_lines, target)
            
            # Fallbacks para variables inestables
            if start_b is None and var_key == 'lluvia':
                start_b, end_b = find_byte_range(idx_lines, ':APCP:surface:')
            if start_b is None and var_key == 'nieve':
                start_b, end_b = find_byte_range(idx_lines, ':CSNOW:surface:')
                
            if start_b is not None:
                chunk = fetch_chunk(url_grib, start_b, end_b)
                if chunk:
                    process_chunk(chunk, var_key, filepaths[var_key])
            else:
                print(f"    [!] Warning: {target} no encontrado en .idx para {var_key}")
                
    # Avanzar tiempo
    if current_time < anchor_dt + timedelta(hours=120):
        current_time += timedelta(hours=1)
    else:
        current_time += timedelta(hours=3)

print("\n[*] ORÁCULO COMPLETADO")
