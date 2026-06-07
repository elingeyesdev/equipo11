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

# Obtenemos el mes actual para acotar 2026
current_month = datetime.now().month

# ==========================================
# 2. FUNCIONES DE RESILIENCIA (RETRY)
# ==========================================
def fetch_with_retry(url, headers=None, max_retries=5):
    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as e:
            print(f"[!] Intento {attempt + 1} fallido para {url}: {e}")
            time.sleep(2 ** attempt)  # Exponential backoff
    raise Exception(f"Fallo definitivo al descargar {url}")

# ==========================================
# 3. BUCLE PRINCIPAL DE EXTRACCIÓN
# ==========================================
print(f"\n==============================================================")
print(f"[*] INICIANDO ETL NOAA GFS FULL: RAYOS (BYTE-RANGE)")
print(f"[*] Variable: :LHTFL:")
print(f"==============================================================")

for year in YEARS:
    for month_str in MONTHS:
        month = int(month_str)
        
        # Acotar dinámicamente el año 2026 hasta el mes actual
        if year == '2026' and month > current_month:
            print(f"[*] Saltando {year}-{month_str} (mes futuro).")
            continue
            
        print(f"\n[*] =================== {year}-{month_str} ===================")
        
        output_dir = os.path.join(BASE_OUTPUT_DIR, year, month_str)
        os.makedirs(output_dir, exist_ok=True)
        
        _, days_in_month = calendar.monthrange(int(year), month)
        
        for day_int in range(1, days_in_month + 1):
            day = f"{day_int:02d}"
            
            for cycle in CYCLES:
                print(f"\n[*] Procesando {year}-{month_str}-{day} {cycle}:00Z...")
                
                url_grib = f"https://noaa-gfs-bdp-pds.s3.amazonaws.com/gfs.{year}{month_str}{day}/{cycle}/atmos/gfs.t{cycle}z.pgrb2.1p00.f003"
                url_idx = url_grib + ".idx"
                
                # ---------------------------------------------------------
                # PASO A y B: Descargar y Parsear el Archivo Índice (.idx)
                # ---------------------------------------------------------
                try:
                    r_idx = fetch_with_retry(url_idx)
                except Exception as e:
                    print(f"[!] Error descargando el índice: {e}")
                    continue
                    
                lines = r_idx.text.strip().split('\n')
                
                start_byte = None
                end_byte = None
                
                # PASO C: Buscar la variable :LHTFL: y deducir rango
                for i, line in enumerate(lines):
                    if ':LHTFL:' in line:
                        parts = line.split(':')
                        start_byte = int(parts[1])
                        
                        # El fin de este bloque es el inicio de la siguiente línea en el índice
                        if i + 1 < len(lines):
                            next_parts = lines[i+1].split(':')
                            end_byte = int(next_parts[1]) - 1
                        else:
                            end_byte = '' 
                        break
                        
                if start_byte is None:
                    print(f"[!] Variable ':LHTFL:' no encontrada en el índice.")
                    continue
                
                # ---------------------------------------------------------
                # PASO D y E: Descargar Fragmento Binario (Byte-Range)
                # ---------------------------------------------------------
                headers = {"Range": f"bytes={start_byte}-{end_byte}"}
                try:
                    r_grib = fetch_with_retry(url_grib, headers=headers)
                    
                    with open(TEMP_FILE, 'wb') as f:
                        f.write(r_grib.content)
                        
                except Exception as e:
                    print(f"[!] Error descargando el fragmento GRIB2: {e}")
                    if os.path.exists(TEMP_FILE):
                        os.remove(TEMP_FILE)
                    continue
                    
                # ---------------------------------------------------------
                # PROCESAMIENTO MATEMÁTICO (Xarray)
                # ---------------------------------------------------------
                try:
                    ds = xr.open_dataset(TEMP_FILE, engine='cfgrib')
                    
                    # Cargar variable dinámicamente
                    var_name = list(ds.data_vars)[0]
                    frame = ds[var_name].values
                        
                    # Invertir latitud de Norte a Sur para paridad visual con WebGL
                    frame_flipped = np.flipud(frame)
                    
                    # Normalización dinámica de alta sensibilidad (flashes/m^2/s son infinitesimales)
                    frame_max = np.max(frame_flipped)
                    if frame_max > 0:
                        normalized = frame_flipped / frame_max
                    else:
                        normalized = frame_flipped
                        
                    clipped = np.clip(normalized, 0.0, 1.0)
                    encoded = np.round(clipped * 255.0).astype(np.uint8)
                    
                    img = Image.fromarray(encoded, mode='L')
                    
                    filename = f"{year}{month_str}{day}_{cycle}00.png"
                    filepath = os.path.join(output_dir, filename)
                    img.save(filepath)
                    
                    ds.close()
                    print(f"[*] ✓ PNG generado: {filepath} ({os.path.getsize(TEMP_FILE) / 1024:.2f} KB transferidos)")
                    
                except Exception as e:
                    print(f"[!] Error procesando el archivo GRIB2 con cfgrib: {e}")
                    if 'ds' in locals():
                        ds.close()
                    
                # ---------------------------------------------------------
                # LIMPIEZA ABSOLUTA
                # ---------------------------------------------------------
                if os.path.exists(TEMP_FILE):
                    os.remove(TEMP_FILE)

print("\n[*] ==============================================================")
print("[*] ⚡ ETL NOAA RAYOS COMPLETADO EXITOSAMENTE ⚡")
print("[*] ==============================================================")
