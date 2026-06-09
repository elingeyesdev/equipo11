import os
import requests
import xarray as xr
import numpy as np
from PIL import Image
import calendar

# Configuración estática para la prueba (Enero 2024)
YEAR = '2024'
MONTH = '01'
BASE_OUTPUT_DIR = f'./data/visibilidad/{YEAR}/{MONTH}'
TEMP_FILE = 'temp_vis.grib2'

os.makedirs(BASE_OUTPUT_DIR, exist_ok=True)

print(f"\n==============================================================")
print(f"[*] INICIANDO POC NOAA GFS: EXTRACCIÓN POR RANGOS DE BYTES")
print(f"[*] Variable: :VIS:surface:")
print(f"[*] Periodo: {YEAR}-{MONTH}")
print(f"==============================================================")

_, days_in_month = calendar.monthrange(int(YEAR), int(MONTH))

for day_int in range(1, days_in_month + 1):
    day = f"{day_int:02d}"
    print(f"\n[*] Procesando {YEAR}-{MONTH}-{day} 00:00Z...")

    url_grib = f"https://noaa-gfs-bdp-pds.s3.amazonaws.com/gfs.{YEAR}{MONTH}{day}/00/atmos/gfs.t00z.pgrb2.1p00.f000"
    url_idx = url_grib + ".idx"
    
    # ---------------------------------------------------------
    # PASO A y B: Descargar y Parsear el Archivo Índice (.idx)
    # ---------------------------------------------------------
    try:
        r_idx = requests.get(url_idx, timeout=10)
        r_idx.raise_for_status()
    except Exception as e:
        print(f"[!] Error descargando el índice {url_idx}: {e}")
        continue
        
    lines = r_idx.text.strip().split('\n')
    
    start_byte = None
    end_byte = None
    
    # PASO C: Buscar la variable :VIS:surface: y deducir rango
    for i, line in enumerate(lines):
        if ':VIS:surface:' in line:
            parts = line.split(':')
            start_byte = int(parts[1])
            
            # El fin de este bloque es el inicio de la siguiente línea en el índice
            if i + 1 < len(lines):
                next_parts = lines[i+1].split(':')
                end_byte = int(next_parts[1]) - 1
            else:
                # Si fuera la última línea, no limitamos el end_byte
                end_byte = '' 
            break
            
    if start_byte is None:
        print(f"[!] Variable ':VIS:surface:' no encontrada en el índice del día {day}.")
        continue
        
    print(f"[*] Rango de bytes detectado: {start_byte}-{end_byte}")
    
    # ---------------------------------------------------------
    # PASO D y E: Descargar Fragmento Binario (Byte-Range)
    # ---------------------------------------------------------
    headers = {"Range": f"bytes={start_byte}-{end_byte}"}
    try:
        r_grib = requests.get(url_grib, headers=headers, timeout=20)
        r_grib.raise_for_status()
        
        with open(TEMP_FILE, 'wb') as f:
            f.write(r_grib.content)
            
        print(f"[*] Fragmento GRIB2 guardado ({os.path.getsize(TEMP_FILE) / 1024:.2f} KB)")
    except Exception as e:
        print(f"[!] Error descargando el fragmento GRIB2: {e}")
        if os.path.exists(TEMP_FILE):
            os.remove(TEMP_FILE)
        continue
        
    # ---------------------------------------------------------
    # PROCESAMIENTO MATEMÁTICO (Xarray)
    # ---------------------------------------------------------
    try:
        # Abrir archivo GRIB2 parcial con el engine cfgrib
        ds = xr.open_dataset(TEMP_FILE, engine='cfgrib')
        
        # En GFS a través de cfgrib, la visibilidad se suele nombrar 'vis'
        if 'vis' in ds.data_vars:
            frame = ds['vis'].values
        else:
            # Buscar dinámicamente si le dio otro nombre
            var_name = list(ds.data_vars)[0]
            frame = ds[var_name].values
            
        # Invertir latitud de Norte a Sur para alinear con WebGL Mapbox
        frame_flipped = np.flipud(frame)
        
        # Normalizar: 0 a 24140.0 metros (Límite físico estándar de visibilidad de GFS)
        normalized = frame_flipped / 24140.0
        clipped = np.clip(normalized, 0.0, 1.0)
        encoded = np.round(clipped * 255.0).astype(np.uint8)
        
        img = Image.fromarray(encoded, mode='L')
        
        filename = f"{YEAR}{MONTH}{day}_0000.png"
        filepath = os.path.join(BASE_OUTPUT_DIR, filename)
        img.save(filepath)
        
        ds.close()
        print(f"[*] ✓ PNG generado exitosamente: {filepath}")
        
    except Exception as e:
        print(f"[!] Error procesando el archivo GRIB2 con cfgrib: {e}")
        
    # ---------------------------------------------------------
    # LIMPIEZA ABSOLUTA
    # ---------------------------------------------------------
    if os.path.exists(TEMP_FILE):
        os.remove(TEMP_FILE)

print("\n[*] ==============================================================")
print("[*] ⚡ POC NOAA VISIBILIDAD COMPLETADO ⚡")
print("[*] ==============================================================")
