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
    # === BLOQUE 1: DATASET ERA5 (reanalysis-era5-single-levels) ===
    {
        'dataset': 'reanalysis-era5-single-levels',
        'name': 'isobaras_raw',
        'vars': ['mean_sea_level_pressure'],
        'years': ['2024', '2025', '2026'],
        'months': ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    },
    {
        'dataset': 'reanalysis-era5-single-levels',
        'name': 'visibilidad',
        'vars': ['visibility'],
        'years': ['2024', '2025', '2026'],
        'months': ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    },
    {
        'dataset': 'reanalysis-era5-single-levels',
        'name': 'rayos',
        'vars': ['mean_lightning_flash_rate'],
        'years': ['2024', '2025', '2026'],
        'months': ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    },
    {
        'dataset': 'reanalysis-era5-single-levels',
        'name': 'humedad_relativa',
        'vars': ['2m_temperature', '2m_dewpoint_temperature'],
        'years': ['2024', '2025', '2026'],
        'months': ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    },
    # === BLOQUE 2: DATASET CAMS (cams-global-reanalysis-eac4) ===
    {
        'dataset': 'cams-global-reanalysis-eac4',
        'name': 'aqi',
        'vars': ['particulate_matter_2.5um', 'particulate_matter_10um', 'ozone'],
        'years': ['2024', '2025', '2026'],
        'months': ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    },
    {
        'dataset': 'cams-global-reanalysis-eac4',
        'name': 'uv',
        'vars': ['total_sky_uv_index'],
        'years': ['2024', '2025', '2026'],
        'months': ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    }
]

BASE_OUTPUT_DIRS = {
    'isobaras_raw': './data/isobaras',
    'visibilidad': './data/visibilidad',
    'rayos': './data/rayos',
    'humedad_relativa': './data/humedad',
    'aqi': './data/aqi',
    'uv': './data/uv'
}

# ==========================================
# 2. CLIENTE API Y BUCLE PRINCIPAL
# ==========================================
c = cdsapi.Client()

for block in QUEUE:
    block_dataset = block['dataset']
    block_name = block['name']
    block_vars = block['vars']
    block_years = block['years']
    block_months = block['months']
    
    base_output_dir = BASE_OUTPUT_DIRS.get(block_name)
    if not base_output_dir:
        print(f"[!] No hay directorio base definido para el bloque {block_name}. Saltando...")
        continue

    print(f"\n==============================================================")
    print(f"[*] INICIANDO BLOQUE: {block_name.upper()}")
    print(f"[*] Dataset: {block_dataset}")
    print(f"[*] Variables: {block_vars}")
    print(f"==============================================================")

    for year in block_years:
        for month in block_months:
            # Filtro de seguridad: No pedir meses futuros de 2026
            if year == '2026' and int(month) > 6:
                print(f"[*] Saltando {year}-{month} (mes futuro, aún sin datos).")
                continue
            
            print(f"\n[*] Descargando e iterando: {year}-{month} ({block_name})")
            
            download_file = f'cds_{block_name}_{year}_{month}.nc'
            output_dir = os.path.join(base_output_dir, year, month)
            os.makedirs(output_dir, exist_ok=True)
            
            _, days_in_month = calendar.monthrange(int(year), int(month))
            days_list = [f"{d:02d}" for d in range(1, days_in_month + 1)]
            
            # =============================================
            # DESCARGA
            # =============================================
            if not os.path.exists(download_file):
                print(f"[*] Petición a {block_dataset} (NetCDF)...")
                
                # Construir el diccionario de request según el dataset
                if block_dataset == 'reanalysis-era5-single-levels':
                    request_params = {
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
                    }
                elif block_dataset == 'cams-global-reanalysis-eac4':
                    request_params = {
                        'variable': block_vars,
                        'year': year,
                        'month': month,
                        'day': days_list,
                        'time': [f"{h:02d}:00" for h in range(24)],
                        'format': 'netcdf',
                        'area': [90, -180, -90, 180],
                        'grid': [1.0, 1.0],
                    }
                
                try:
                    c.retrieve(block_dataset, request_params, download_file)
                    print("[*] Descarga exitosa.")
                except Exception as e:
                    print(f"[!] Error en API: {e}")
                    continue
            else:
                print("[*] Archivo .nc ya existe localmente. Omitiendo descarga.")

            # =============================================
            # EXTRACCIÓN Y TRANSFORMACIÓN MATEMÁTICA
            # =============================================
            if not os.path.exists(download_file):
                continue
                
            print(f"[*] Procesando tensores y empaquetando PNGs...")
            try:
                ds = xr.open_dataset(download_file, engine='netcdf4')
                data_var_names = [var for var in ds.data_vars if var not in ['number', 'expver']]
                da_first = ds[data_var_names[0]]
                
                time_dim = 'valid_time' if 'valid_time' in da_first.dims else 'time'
                total_hours = da_first.sizes[time_dim]
                
                # Función auxiliar: extrae frame e invierte verticalmente
                def extract_flipped(var_name, idx):
                    frame = ds[var_name].isel({time_dim: idx}).values
                    return np.flipud(frame)

                # ------------------------------------------
                # Pre-cálculos mensuales (normalización AQI)
                # ------------------------------------------
                if block_name == 'aqi':
                    var_pm25 = [v for v in data_var_names if '2.5' in v or 'pm2p5' in v][0]
                    var_pm10 = [v for v in data_var_names if '10' in v or 'pm10' in v][0]
                    var_o3 = [v for v in data_var_names if 'o3' in v or 'ozone' in v.lower()][0]

                    pm25_min, pm25_max = float(ds[var_pm25].min().values), float(ds[var_pm25].max().values)
                    pm10_min, pm10_max = float(ds[var_pm10].min().values), float(ds[var_pm10].max().values)
                    o3_min, o3_max = float(ds[var_o3].min().values), float(ds[var_o3].max().values)

                    pm25_range = pm25_max - pm25_min if pm25_max != pm25_min else 1.0
                    pm10_range = pm10_max - pm10_min if pm10_max != pm10_min else 1.0
                    o3_range = o3_max - o3_min if o3_max != o3_min else 1.0

                # ------------------------------------------
                # Pre-localización de variables (humedad)
                # ------------------------------------------
                if block_name == 'humedad_relativa':
                    var_t2m = [v for v in data_var_names if v in ['t2m', 't2', '2t']][0]
                    var_d2m = [v for v in data_var_names if v in ['d2m', 'd2', '2d']][0]

                # ------------------------------------------
                # Iteración frame a frame
                # ------------------------------------------
                for i in range(total_hours):

                    # ========== ISOBARAS (Presión a nivel del mar) ==========
                    if block_name == 'isobaras_raw':
                        frame = extract_flipped(data_var_names[0], i)
                        hpa = frame / 100.0  # Pascals a Hectopascals
                        # Rango estático: 950 hPa a 1050 hPa
                        normalized = (hpa - 950.0) / (1050.0 - 950.0)
                        clipped = np.clip(normalized, 0.0, 1.0)
                        encoded = np.round(clipped * 255.0).astype(np.uint8)
                        img = Image.fromarray(encoded, mode='L')

                    # ========== VISIBILIDAD ==========
                    elif block_name == 'visibilidad':
                        frame = extract_flipped(data_var_names[0], i)
                        # Rango: 0 a 100,000 metros
                        normalized = frame / 100000.0
                        clipped = np.clip(normalized, 0.0, 1.0)
                        encoded = np.round(clipped * 255.0).astype(np.uint8)
                        img = Image.fromarray(encoded, mode='L')

                    # ========== RAYOS ==========
                    elif block_name == 'rayos':
                        frame = extract_flipped(data_var_names[0], i)
                        # Escalado de alta sensibilidad: tope en 0.0001
                        normalized = frame / 0.0001
                        clipped = np.clip(normalized, 0.0, 1.0)
                        encoded = np.round(clipped * 255.0).astype(np.uint8)
                        img = Image.fromarray(encoded, mode='L')

                    # ========== HUMEDAD RELATIVA (Magnus-Tetens) ==========
                    elif block_name == 'humedad_relativa':
                        f_t2m = extract_flipped(var_t2m, i)
                        f_d2m = extract_flipped(var_d2m, i)
                        # Kelvin a Celsius
                        T = f_t2m - 273.15
                        Td = f_d2m - 273.15
                        # Ecuación de Magnus-Tetens
                        alpha_T = (17.625 * T) / (243.04 + T)
                        alpha_Td = (17.625 * Td) / (243.04 + Td)
                        rh = 100.0 * np.exp(alpha_Td - alpha_T)
                        # Normalizar de 0-100% a 0.0-1.0
                        normalized = rh / 100.0
                        clipped = np.clip(normalized, 0.0, 1.0)
                        encoded = np.round(clipped * 255.0).astype(np.uint8)
                        img = Image.fromarray(encoded, mode='L')

                    # ========== AQI (CAMS - RGB Empaquetado) ==========
                    elif block_name == 'aqi':
                        f_pm25 = extract_flipped(var_pm25, i)
                        f_pm10 = extract_flipped(var_pm10, i)
                        f_o3 = extract_flipped(var_o3, i)
                        # Normalización dinámica mensual
                        r = np.clip((f_pm25 - pm25_min) / pm25_range, 0.0, 1.0)
                        g = np.clip((f_pm10 - pm10_min) / pm10_range, 0.0, 1.0)
                        b = np.clip((f_o3 - o3_min) / o3_range, 0.0, 1.0)
                        r_8 = np.round(r * 255.0).astype(np.uint8)
                        g_8 = np.round(g * 255.0).astype(np.uint8)
                        b_8 = np.round(b * 255.0).astype(np.uint8)
                        rgb_array = np.dstack((r_8, g_8, b_8))
                        img = Image.fromarray(rgb_array, mode='RGB')

                    # ========== UV (CAMS) ==========
                    elif block_name == 'uv':
                        frame = extract_flipped(data_var_names[0], i)
                        # Rango estándar: 0 a 16
                        normalized = frame / 16.0
                        clipped = np.clip(normalized, 0.0, 1.0)
                        encoded = np.round(clipped * 255.0).astype(np.uint8)
                        img = Image.fromarray(encoded, mode='L')

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
                print(f"[!] Error procesando {download_file}: {e}")
            
            # =============================================
            # LIMPIEZA ABSOLUTA
            # =============================================
            if os.path.exists(download_file):
                print(f"[*] 🗑 Eliminando residuo temporal {download_file}...")
                os.remove(download_file)

print("\n[*] ==============================================================")
print("[*] ⚡ SUPER MEGA ETL COMPLETADO EXITOSAMENTE ⚡")
print("[*] ==============================================================")
