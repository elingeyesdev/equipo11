import os
import time
import requests
import xarray as xr
import numpy as np
from PIL import Image
import calendar
from datetime import datetime

# ==========================================
# 1. CONFIGURACIÓN ESTRUCTURAL
# ==========================================
YEARS = ['2024', '2025', '2026']
MONTHS = [f"{m:02d}" for m in range(1, 13)]
CYCLES = ['00', '06', '12', '18']
BASE_OUTPUT_DIR = './data/rayos'
TEMP_FILE = 'temp_rayos.grib2'

current_month = datetime.now().month

def fetch_with_retry(url, headers=None, max_retries=5):
    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as e:
            print(f"[!] Intento {attempt + 1} fallido para {url}: {e}")
            time.sleep(2 ** attempt)
    raise Exception(f"Fallo definitivo al descargar {url}")

print(f"\n==============================================================")
print(f"[*] INICIANDO ETL NOAA GFS FULL: RAYOS")
print(f"[*] Variable: :LTNG:")
print(f"==============================================================")

for year in YEARS:
    for month_str in MONTHS:
        month = int(month_str)
        if year == '2026' and month > current_month:
            continue
            
        print(f"\n[*] =================== {year}-{month_str} ===================")
        output_dir = os.path.join(BASE_OUTPUT_DIR, year, month_str)
        os.makedirs(output_dir, exist_ok=True)
        _, days_in_month = calendar.monthrange(int(year), month)
        
        for day_int in range(1, days_in_month + 1):
            day = f"{day_int:02d}"
            for cycle in CYCLES:
                print(f"\n[*] Procesando {year}-{month_str}-{day} {cycle}:00Z...")
                
                # Código corregido para extraer la alta resolución
                url_grib = f"https://noaa-gfs-bdp-pds.s3.amazonaws.com/gfs.{year}{month_str}{day}/{cycle}/atmos/gfs.t{cycle}z.pgrb2.0p25.f003"
                url_idx = url_grib + ".idx"
                
                try:
                    r_idx = fetch_with_retry(url_idx)
                except Exception as e:
                    print(f"[!] Error descargando el índice: {e}")
                    continue
                    
                lines = r_idx.text.strip().split('\n')
                start_byte, end_byte = None, None
                
                # BUSCAMOS LA VARIABLE DE RAYOS (:LTNG:)
                for i, line in enumerate(lines):
                    if ':LTNG:' in line:
                        parts = line.split(':')
                        start_byte = int(parts[1])
                        if i + 1 < len(lines):
                            end_byte = int(lines[i+1].split(':')[1]) - 1
                        else:
                            end_byte = '' 
                        break
                        
                if start_byte is None:
                    print(f"[!] Variable ':LTNG:' no encontrada en el índice.")
                    continue
                
                headers = {"Range": f"bytes={start_byte}-{end_byte}"}
                try:
                    r_grib = fetch_with_retry(url_grib, headers=headers)
                    with open(TEMP_FILE, 'wb') as f:
                        f.write(r_grib.content)
                except Exception as e:
                    print(f"[!] Error descargando el fragmento: {e}")
                    continue
                    
                try:
                    ds = xr.open_dataset(TEMP_FILE, engine='cfgrib')
                    var_name = list(ds.data_vars)[0]
                    frame = ds[var_name].values
                    frame_flipped = np.flipud(frame)
                    
                    # NORMALIZACIÓN FIJA BASADA EN METEORED (Techo = 100)
                    normalized = frame_flipped / 100.0
                    clipped = np.clip(normalized, 0.0, 1.0)
                    encoded = np.round(clipped * 255.0).astype(np.uint8)
                    
                    img = Image.fromarray(encoded, mode='L')
                    filepath = os.path.join(output_dir, f"{year}{month_str}{day}_{cycle}00.png")
                    img.save(filepath)
                    ds.close()
                    print(f"[*] ✓ PNG generado: {filepath}")
                    
                except Exception as e:
                    print(f"[!] Error procesando GRIB2: {e}")
                
                if os.path.exists(TEMP_FILE):
                    os.remove(TEMP_FILE)

print("\n[*] ETL NOAA RAYOS COMPLETADO")