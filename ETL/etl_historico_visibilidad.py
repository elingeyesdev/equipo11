import os
import time
import requests
import xarray as xr
import numpy as np
from PIL import Image
from datetime import datetime, timedelta

# ==========================================
# 1. CONFIGURACIÓN ESTRUCTURAL Y RUTAS
# ==========================================
BASE_OUT_DIR = os.path.join(os.path.dirname(__file__), '../data/visibilidad')
TEMP_FILE = os.path.join(os.path.dirname(__file__), 'temp_vis_historico.grib2')

start_dt = datetime(2024, 1, 1, 0, 0, 0)
end_dt = datetime(2026, 6, 18, 4, 0, 0)

total_hours = int((end_dt - start_dt).total_seconds() // 3600)
datetimes_to_process = [start_dt + timedelta(hours=i) for i in range(total_hours + 1)]

def fetch_with_retry(url, headers=None, max_retries=5):
    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=headers, timeout=20)
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as e:
            print(f"[!] Intento {attempt + 1} fallido para {url}: {e}")
            time.sleep(2 ** attempt)
    raise Exception(f"Fallo definitivo al descargar {url}")

def get_gfs_params(dt):
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

print(f"\n==============================================================")
print(f"[*] INICIANDO HISTÓRICO NOAA GFS: VISIBILIDAD HORARIA")
print(f"[*] Desde: {start_dt.strftime('%Y-%m-%d %H:%M:%S')} UTC")
print(f"[*] Hasta: {end_dt.strftime('%Y-%m-%d %H:%M:%S')} UTC")
print(f"==============================================================")

for current_dt in datetimes_to_process:
    year = current_dt.strftime('%Y')
    month = current_dt.strftime('%m')
    
    output_dir = os.path.join(BASE_OUT_DIR, year, month)
    os.makedirs(output_dir, exist_ok=True)
    
    filename = f"{current_dt.strftime('%Y%m%d_%H00')}.png"
    filepath = os.path.join(output_dir, filename)
    
    if os.path.exists(filepath):
        print(f"[*] Saltando {filename} (ya existe).")
        continue
        
    date_str, cycle_str, f_hour_str = get_gfs_params(current_dt)
    
    url_grib = f"https://noaa-gfs-bdp-pds.s3.amazonaws.com/gfs.{date_str}/{cycle_str}/atmos/gfs.t{cycle_str}z.pgrb2.0p25.f{f_hour_str}"
    url_idx = url_grib + ".idx"
    
    try:
        r_idx = fetch_with_retry(url_idx)
    except Exception as e:
        print(f"[!] Error descargando el índice {url_idx}: {e}")
        continue
        
    lines = r_idx.text.strip().split('\n')
    start_byte = None
    end_byte = None
    
    for i, line in enumerate(lines):
        if ':VIS:surface:' in line:
            parts = line.split(':')
            start_byte = int(parts[1])
            if i + 1 < len(lines):
                next_parts = lines[i+1].split(':')
                end_byte = int(next_parts[1]) - 1
            else:
                end_byte = ''
            break
            
    if start_byte is None:
        print(f"[!] Variable ':VIS:surface:' no encontrada en {current_dt}.")
        continue
        
    headers = {"Range": f"bytes={start_byte}-{end_byte}"}
    try:
        r_grib = fetch_with_retry(url_grib, headers=headers)
        with open(TEMP_FILE, 'wb') as f:
            f.write(r_grib.content)
    except Exception as e:
        print(f"[!] Error descargando fragmento GRIB2: {e}")
        if os.path.exists(TEMP_FILE): os.remove(TEMP_FILE)
        continue
        
    try:
        ds = xr.open_dataset(TEMP_FILE, engine='cfgrib')
        var_name = [v for v in ds.data_vars if 'vis' in v.lower()][0]
        frame = ds[var_name].values
        frame_flipped = np.flipud(frame)
        
        normalized = frame_flipped / 24140.0
        clipped = np.clip(normalized, 0.0, 1.0)
        encoded = np.round(clipped * 255.0).astype(np.uint8)
        
        img = Image.fromarray(encoded, mode='L')
        img.save(filepath)
        ds.close()
    except Exception as e:
        print(f"[!] Error procesando archivo GRIB2 con cfgrib: {e}")
        if 'ds' in locals(): ds.close()
            
    if os.path.exists(TEMP_FILE):
        os.remove(TEMP_FILE)

print("[*] ⚡ ETL NOAA VISIBILIDAD HISTÓRICO COMPLETADO ⚡")
