import os
import cdsapi
import xarray as xr
import numpy as np
from PIL import Image
import calendar

# ==========================================
# 1. CONFIGURACIÓN ESTRUCTURAL (COLA DE TRABAJO)
# ==========================================
QUEUE = [
    {
        'name': 'aqi',
        'vars': [
            'particulate_matter_2.5um', 
            'particulate_matter_10um', 
            'carbon_monoxide', 
            'nitrogen_dioxide', 
            'ozone', 
            'sulphur_dioxide'
        ],
        'years': ['2024', '2025', '2026'],
        # Por robustez acotamos 2026 hasta junio (el script tolerará meses vacíos)
        'months': ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    },
    {
        'name': 'uv',
        'vars': ['uv_a_aerosol_optical_depth_355nm'],
        'years': ['2024', '2025', '2026'],
        'months': ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    }
]

BASE_OUTPUT_DIRS = {
    'aqi': './data/aqi',
    'uv': './data/uv'
}

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
    print(f"[*] INICIANDO BLOQUE CAMS: {block_name.upper()}")
    print(f"[*] Variables: {block_vars}")
    print(f"==============================================================")

    for year in block_years:
        for month in block_months:
            print(f"\n[*] Descargando e iterando: {year}-{month} ({block_name})")
            
            download_file = f'cams_{block_name}_{year}_{month}.nc'
            output_dir = os.path.join(base_output_dir, year, month)
            os.makedirs(output_dir, exist_ok=True)
            
            _, days_in_month = calendar.monthrange(int(year), int(month))
            days_list = [f"{d:02d}" for d in range(1, days_in_month + 1)]
            
            # 1. Petición a Copernicus (CAMS)
            if not os.path.exists(download_file):
                print(f"[*] Petición a la API CAMS (Data format: NetCDF)...")
                try:
                    c.retrieve(
                        'cams-global-reanalysis-eac4',
                        {
                            'variable': block_vars,
                            'year': year,
                            'month': month,
                            'day': days_list,
                            'time': [f"{h:02d}:00" for h in range(24)],
                            'format': 'netcdf',
                            # Forzamos grid de 1.0 para mantener paridad estricta con ERA5 y windMath.js
                            'area': [90, -180, -90, 180],
                            'grid': [1.0, 1.0],
                        },
                        download_file
                    )
                    print("[*] Descarga exitosa.")
                except Exception as e:
                    print(f"[!] Error en API (posible mes futuro no procesado por CAMS): {e}")
                    # Si falla un mes futuro (ej. dic 2026), saltamos iteración sin borrar cola
                    continue
            else:
                print("[*] Archivo .nc ya existe localmente. Omitiendo descarga.")

            # 2. Extracción y Transformación Matemática (ETL)
            if not os.path.exists(download_file):
                continue
                
            print(f"[*] Procesando tensores matemáticos y empaquetando PNGs...")
            try:
                ds = xr.open_dataset(download_file, engine='netcdf4')
                data_var_names = [var for var in ds.data_vars if var not in ['number', 'expver']]
                da_first = ds[data_var_names[0]]
                
                time_dim = 'valid_time' if 'valid_time' in da_first.dims else 'time'
                total_hours = da_first.sizes[time_dim]
                
                # Función auxiliar para extracción invertida
                def extract_flipped(var_name, idx):
                    frame = ds[var_name].isel({time_dim: idx}).values
                    return np.flipud(frame)

                # Precalcular min y max mensuales para normalización dinámica (AQI)
                if block_name == 'aqi':
                    # Localización dinámica resistente a sufijos inesperados de variables en Xarray
                    var_pm25 = [v for v in data_var_names if '2.5' in v or 'pm2p5' in v][0]
                    var_pm10 = [v for v in data_var_names if '10' in v or 'pm10' in v][0]
                    var_o3 = [v for v in data_var_names if 'o3' in v or 'ozone' in v.lower()][0]

                    pm25_min, pm25_max = ds[var_pm25].min().values, ds[var_pm25].max().values
                    pm10_min, pm10_max = ds[var_pm10].min().values, ds[var_pm10].max().values
                    o3_min, o3_max = ds[var_o3].min().values, ds[var_o3].max().values

                    # Prevención de división por cero
                    pm25_range = pm25_max - pm25_min if pm25_max != pm25_min else 1.0
                    pm10_range = pm10_max - pm10_min if pm10_max != pm10_min else 1.0
                    o3_range = o3_max - o3_min if o3_max != o3_min else 1.0

                for i in range(total_hours):
                    if block_name == 'aqi':
                        f_pm25 = extract_flipped(var_pm25, i)
                        f_pm10 = extract_flipped(var_pm10, i)
                        f_o3 = extract_flipped(var_o3, i)
                        
                        # Normalización Dinámica [Min, Max] -> [0.0, 1.0]
                        norm_pm25 = (f_pm25 - pm25_min) / pm25_range
                        norm_pm10 = (f_pm10 - pm10_min) / pm10_range
                        norm_o3 = (f_o3 - o3_min) / o3_range
                        
                        r_clipped = np.clip(norm_pm25, 0.0, 1.0)
                        g_clipped = np.clip(norm_pm10, 0.0, 1.0)
                        b_clipped = np.clip(norm_o3, 0.0, 1.0)
                        
                        # Escalar a UINT8
                        r_8bit = np.round(r_clipped * 255.0).astype(np.uint8)
                        g_8bit = np.round(g_clipped * 255.0).astype(np.uint8)
                        b_8bit = np.round(b_clipped * 255.0).astype(np.uint8)
                        
                        # Empaquetado RGB estricto
                        rgb_array = np.dstack((r_8bit, g_8bit, b_8bit))
                        img = Image.fromarray(rgb_array, mode='RGB')
                        
                    elif block_name == 'uv':
                        frame = extract_flipped(data_var_names[0], i)
                        # Normalización estática: Asumiendo que el tensor entrega índice directo (0 a 15)
                        normalized = frame / 15.0
                        clipped = np.clip(normalized, 0.0, 1.0)
                        encoded_frame = np.round(clipped * 255.0).astype(np.uint8)
                        img = Image.fromarray(encoded_frame, mode='L')
                        
                    # Carga estática (Guardado en disco)
                    current_time = da_first[time_dim].values[i]
                    timestamp = np.datetime_as_string(current_time, unit='h')
                    filename = f"{timestamp.replace('-', '').replace('T', '_')}00.png"
                    filepath = os.path.join(output_dir, filename)
                    img.save(filepath)
                
                # Cerrar archivo estrictamente para purgar memoria RAM
                ds.close()
                print(f"[*] ✓ {total_hours} PNGs generados en {output_dir}")
                
            except Exception as e:
                print(f"[!] Error matemático/procesamiento en {download_file}: {e}")
            
            # 3. Limpieza Absoluta
            if os.path.exists(download_file):
                print(f"[*] 🗑 Eliminando residuo temporal {download_file}...")
                os.remove(download_file)

print("\n[*] ==============================================================")
print("[*] PIPELINE ETL CAMS ATMÓSFERA COMPLETADO EXITOSAMENTE")
print("[*] ==============================================================")
