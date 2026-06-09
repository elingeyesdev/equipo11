import os
import cdsapi
import xarray as xr
import numpy as np
from PIL import Image
import bisect
import calendar

# ==========================================
# 1. CONFIGURACIÓN ESTRUCTURAL (COLA DE TRABAJO)
# ==========================================
QUEUE = [
    # Bloque 1: Viento de los históricos (2024 y 2025)
    {
        'name': 'viento', 
        'vars': ['10m_u_component_of_wind', '10m_v_component_of_wind'], 
        'years': ['2024', '2025'], 
        'months': ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    },
    # Bloque 2: Nieve de los históricos (2024 y 2025)
    {
        'name': 'nieve', 
        'vars': ['snowfall'], 
        'years': ['2024', '2025'], 
        'months': ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    },
    # Bloque 3: Consolidado de TODO lo que va del año 2026 (Meses de enero a junio)
    {
        'name': 'total_precipitation', 
        'vars': ['total_precipitation'], 
        'years': ['2026'], 
        'months': ['01', '02', '03', '04', '05', '06']
    },
    {
        'name': '2m_temperature', 
        'vars': ['2m_temperature'], 
        'years': ['2026'], 
        'months': ['01', '02', '03', '04', '05', '06']
    },
    {
        'name': 'viento', 
        'vars': ['10m_u_component_of_wind', '10m_v_component_of_wind'], 
        'years': ['2026'], 
        'months': ['01', '02', '03', '04', '05', '06']
    },
    {
        'name': 'nieve', 
        'vars': ['snowfall'], 
        'years': ['2026'], 
        'months': ['01', '02', '03', '04', '05', '06']
    }
]

BASE_OUTPUT_DIRS = {
    'total_precipitation': './data/lluvia',
    '2m_temperature': './data/temperatura',
    'viento': './data/viento',
    'nieve': './data/nieve'
}

# Paridad estricta con RAIN_STOPS de windMath.js
RAIN_STOPS = [
    0.0, 0.2, 0.5, 1.0, 2.0, 3.0, 4.0, 5.0, 7.5, 10.0,
    15.0, 20.0, 25.0, 30.0, 35.0, 40.0, 50.0, 60.0, 70.0, 85.0, 100.0, 150.0
]

def encode_rain_pixel(val):
    if np.isnan(val) or val <= 0: return 0
    if val >= 150.0: return 255
    idx = bisect.bisect_right(RAIN_STOPS, val) - 1
    t = (val - RAIN_STOPS[idx]) / (RAIN_STOPS[idx+1] - RAIN_STOPS[idx])
    virtual_index = idx + t
    norm = virtual_index / 21.0
    return int(round(norm * 255.0))

v_encode_rain = np.vectorize(encode_rain_pixel)

# ==========================================
# 2. CLIENTE API Y BUCLE PRINCIPAL
# ==========================================
c = cdsapi.Client()

for block in QUEUE:
    block_name = block['name']
    block_vars = block['vars']
    block_years = block['years']
    block_months = block['months']
    
    base_output_dir = BASE_OUTPUT_DIRS.get(block_name)
    if not base_output_dir:
        print(f"[!] No hay directorio base definido para el bloque {block_name}. Saltando...")
        continue

    print(f"\n==============================================================")
    print(f"[*] INICIANDO BLOQUE DE TRABAJO: {block_name.upper()}")
    print(f"[*] Variables: {block_vars}")
    print(f"==============================================================")

    for year in block_years:
        for month in block_months:
            print(f"\n[*] Descargando e iterando: {year}-{month} ({block_name})")
            
            download_file = f'era5_{block_name}_{year}_{month}.nc'
            output_dir = os.path.join(base_output_dir, year, month)
            os.makedirs(output_dir, exist_ok=True)
            
            _, days_in_month = calendar.monthrange(int(year), int(month))
            days_list = [f"{d:02d}" for d in range(1, days_in_month + 1)]
            
            # 1. Petición a Copernicus
            if not os.path.exists(download_file):
                print(f"[*] Petición a la API (Data format: NetCDF)...")
                c.retrieve(
                    'reanalysis-era5-single-levels',
                    {
                        'product_type': 'reanalysis',
                        'variable': block_vars,
                        'year': year,
                        'month': month,
                        'day': days_list,
                        'time': [f"{h:02d}:00" for h in range(24)],
                        'data_format': 'netcdf',
                        'download_format': 'unarchived',
                        'format': 'netcdf',
                        'area': [90, -180, -90, 180],
                        'grid': [1.0, 1.0],
                    },
                    download_file
                )
                print("[*] Descarga exitosa.")
            else:
                print("[*] Archivo .nc ya existe localmente. Omitiendo descarga.")

            # 2. Extracción y Transformación Matemática (ETL)
            print(f"[*] Procesando tensores matemáticos y empaquetando PNGs...")
            try:
                ds = xr.open_dataset(download_file, engine='netcdf4')
                data_var_names = [var for var in ds.data_vars if var not in ['number', 'expver']]
                da_first = ds[data_var_names[0]]
                
                time_dim = 'valid_time' if 'valid_time' in da_first.dims else 'time'
                total_hours = da_first.sizes[time_dim]
                
                for i in range(total_hours):
                    # Invertir verticalmente por defecto (siempre se aplica para compatibilidad con web)
                    def extract_flipped(var_name):
                        frame = ds[var_name].isel({time_dim: i}).values
                        return np.flipud(frame)

                    if block_name == 'total_precipitation':
                        frame = extract_flipped(data_var_names[0])
                        frame_val = frame * 1000.0 # m a mm
                        encoded_frame = v_encode_rain(frame_val).astype(np.uint8)
                        img = Image.fromarray(encoded_frame, mode='L')
                        
                    elif block_name == '2m_temperature':
                        frame = extract_flipped(data_var_names[0])
                        celsius = frame - 273.15 # Kelvin a Celsius
                        normalized = (celsius - (-50.0)) / (50.0 - (-50.0))
                        clipped = np.clip(normalized, 0.0, 1.0)
                        encoded_frame = np.round(clipped * 255.0).astype(np.uint8)
                        img = Image.fromarray(encoded_frame, mode='L')
                        
                    elif block_name == 'nieve':
                        frame = extract_flipped(data_var_names[0])
                        mm = frame * 1000.0 # m a mm
                        # Normalizar linealmente con tope en 150.0 mm
                        normalized = mm / 150.0
                        clipped = np.clip(normalized, 0.0, 1.0)
                        encoded_frame = np.round(clipped * 255.0).astype(np.uint8)
                        img = Image.fromarray(encoded_frame, mode='L')
                        
                    elif block_name == 'viento':
                        # Viento requiere dos variables (U y V)
                        u_var = [v for v in data_var_names if v.startswith('u')][0]
                        v_var = [v for v in data_var_names if v.startswith('v')][0]
                        
                        u_frame = extract_flipped(u_var)
                        v_frame = extract_flipped(v_var)
                        
                        # Normalizar U y V de -100m/s a +100m/s hacia el rango [0.0, 1.0]
                        u_norm = (u_frame - (-100.0)) / (100.0 - (-100.0))
                        v_norm = (v_frame - (-100.0)) / (100.0 - (-100.0))
                        
                        u_clipped = np.clip(u_norm, 0.0, 1.0)
                        v_clipped = np.clip(v_norm, 0.0, 1.0)
                        
                        u_8bit = np.round(u_clipped * 255.0).astype(np.uint8)
                        v_8bit = np.round(v_clipped * 255.0).astype(np.uint8)
                        b_8bit = np.zeros_like(u_8bit) # Canal B en 0
                        
                        # Empaquetar como imagen RGB
                        rgb_array = np.dstack((u_8bit, v_8bit, b_8bit))
                        img = Image.fromarray(rgb_array, mode='RGB')
                    
                    # Carga estática (Guardado en disco)
                    current_time = da_first[time_dim].values[i]
                    timestamp = np.datetime_as_string(current_time, unit='h')
                    filename = f"{timestamp.replace('-', '').replace('T', '_')}00.png"
                    filepath = os.path.join(output_dir, filename)
                    img.save(filepath)
                
                # Cerrar archivo estrictamente
                ds.close()
                print(f"[*] ✓ {total_hours} PNGs generados en {output_dir}")
                
            except Exception as e:
                print(f"[!] Error procesando el archivo {download_file}: {e}")
            
            # 3. Limpieza Absoluta
            if os.path.exists(download_file):
                print(f"[*] 🗑 Eliminando residuo temporal {download_file}...")
                os.remove(download_file)

print("\n[*] ==============================================================")
print("[*] PIPELINE ETL COMPLETADO EXITOSAMENTE PARA TODA LA COLA")
print("[*] ==============================================================")
