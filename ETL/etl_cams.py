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
        'dataset': 'cams-global-reanalysis-eac4',
        'name': 'aqi',
        'vars': ['particulate_matter_2.5um', 'particulate_matter_10um', 'ozone'],
        'years': ['2024', '2025', '2026'],
        'months': ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    }
]

BASE_OUTPUT_DIRS = {
    'aqi': './data/aqi'
}

# ==========================================
# 2. CLIENTE API Y BUCLE PRINCIPAL
# ==========================================
# Cliente exclusivo de ADS (Atmosphere Data Store)
def get_ads_client():
    ads_rc = os.path.expanduser('~/.adsapirc')
    if not os.path.exists(ads_rc):
        raise FileNotFoundError(f"No se encontró el archivo de credenciales: {ads_rc}")
        
    with open(ads_rc, 'r') as f:
        lines = f.readlines()
    
    url = ''
    key = ''
    for line in lines:
        if line.startswith('url:'):
            url = line.split('url:')[1].strip()
        elif line.startswith('key:'):
            key = line.split('key:')[1].strip()
            
    return cdsapi.Client(url=url, key=key)

c_ads = get_ads_client()

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
    print(f"[*] INICIANDO BLOQUE CAMS (AQI): {block_name.upper()}")
    print(f"[*] Dataset: {block_dataset}")
    print(f"[*] Variables: {block_vars}")
    print(f"==============================================================")

    for year in block_years:
        for month in block_months:
            # Filtro defensivo: ignorar meses futuros de 2026
            if year == '2026' and int(month) > 6:
                print(f"[*] Saltando {year}-{month} (mes futuro, ignorado por seguridad).")
                continue
            
            print(f"\n[*] Descargando e iterando: {year}-{month} ({block_name})")
            
            download_file = f'cams_{block_name}_{year}_{month}.nc'
            output_dir = os.path.join(base_output_dir, year, month)
            os.makedirs(output_dir, exist_ok=True)
            
            _, days_in_month = calendar.monthrange(int(year), int(month))
            
            # 1. Petición a Copernicus (CAMS) via ADS
            if not os.path.exists(download_file):
                print(f"[*] Petición a la API ADS (Data format: NetCDF)...")
                request_params = {
                    'variable': block_vars,
                    # Regla estricta CAMS v2: Date continuo en lugar de año/mes/día
                    'date': f"{year}-{month}-01/{year}-{month}-{days_in_month:02d}",
                    # CAMS solo posee resolución de 3 horas
                    'time': ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
                    'format': 'netcdf'
                }
                
                try:
                    c_ads.retrieve(block_dataset, request_params, download_file)
                    print("[*] Descarga exitosa.")
                except Exception as e:
                    print(f"[!] Error en API: {e}")
                    continue
            else:
                print("[*] Archivo .nc ya existe localmente. Omitiendo descarga.")

            # Validación de Integridad de Archivo
            if not os.path.exists(download_file) or os.path.getsize(download_file) < 50000:
                print("[!] Archivo corrupto o descarga fallida (menos de 50KB). Omitiendo...")
                if os.path.exists(download_file): 
                    os.remove(download_file)
                continue

            # 2. Extracción y Transformación Matemática (ETL)
            print(f"[*] Procesando tensores y empaquetando PNGs...")
            try:
                ds = xr.open_dataset(download_file, engine='netcdf4')
                data_var_names = [var for var in ds.data_vars if var not in ['number', 'expver']]
                print(f"[*] Variables detectadas en el NetCDF: {data_var_names}")
                
                if not data_var_names:
                    print("[!] No se encontraron variables de datos en el archivo.")
                    ds.close()
                    continue

                da_first = ds[data_var_names[0]]
                
                time_dim = 'valid_time' if 'valid_time' in da_first.dims else 'time'
                total_hours = da_first.sizes[time_dim]
                
                def extract_flipped(var_name, idx):
                    frame = ds[var_name].isel({time_dim: idx}).values
                    return np.flipud(frame)

                # Búsqueda Adaptativa de Variables (AQI) con Degradación Elegante
                try:
                    var_pm25 = next(v for v in data_var_names if v in ['pm2p5', 'particulate_matter_2.5um'])
                    var_pm10 = next(v for v in data_var_names if v in ['pm10', 'particulate_matter_10um'])
                except StopIteration:
                    print(f"[!] Faltan PM2.5 o PM10. Encontradas: {data_var_names}")
                    ds.close()
                    continue

                # Ozono opcional (Degradación Elegante)
                var_o3 = next((v for v in data_var_names if v in ['go3', 'o3', 'ozone']), None)

                # Pre-cálculos de rangos
                pm25_min, pm25_max = float(ds[var_pm25].min().values), float(ds[var_pm25].max().values)
                pm10_min, pm10_max = float(ds[var_pm10].min().values), float(ds[var_pm10].max().values)

                pm25_range = pm25_max - pm25_min if pm25_max != pm25_min else 1.0
                pm10_range = pm10_max - pm10_min if pm10_max != pm10_min else 1.0

                if var_o3:
                    o3_min, o3_max = float(ds[var_o3].min().values), float(ds[var_o3].max().values)
                    o3_range = o3_max - o3_min if o3_max != o3_min else 1.0

                for i in range(total_hours):
                    f_pm25 = extract_flipped(var_pm25, i)
                    f_pm10 = extract_flipped(var_pm10, i)
                    
                    r = np.clip((f_pm25 - pm25_min) / pm25_range, 0.0, 1.0)
                    g = np.clip((f_pm10 - pm10_min) / pm10_range, 0.0, 1.0)
                    
                    r_8 = np.round(r * 255.0).astype(np.uint8)
                    g_8 = np.round(g * 255.0).astype(np.uint8)
                    
                    if var_o3:
                        f_o3 = extract_flipped(var_o3, i)
                        b = np.clip((f_o3 - o3_min) / o3_range, 0.0, 1.0)
                        b_8 = np.round(b * 255.0).astype(np.uint8)
                    else:
                        b_8 = np.zeros_like(r_8) # Canal azul vacío si no hay Ozono
                    
                    rgb_array = np.dstack((r_8, g_8, b_8))
                    img = Image.fromarray(rgb_array, mode='RGB')
                    
                    current_time = da_first[time_dim].values[i]
                    timestamp = np.datetime_as_string(current_time, unit='h')
                    filename = f"{timestamp.replace('-', '').replace('T', '_')}00.png"
                    filepath = os.path.join(output_dir, filename)
                    img.save(filepath)
                
                ds.close()
                print(f"[*] ✓ {total_hours} PNGs generados en {output_dir} (Formato 3-hourly)")
                
            except Exception as e:
                print(f"[!] Error procesando {download_file}: {e}")
            
            # Limpieza Absoluta
            if os.path.exists(download_file):
                print(f"[*] 🗑 Eliminando residuo temporal {download_file}...")
                os.remove(download_file)

print("\n[*] ==============================================================")
print("[*] ⚡ ETL EXCLUSIVO CAMS AQI (ADS) COMPLETADO EXITOSAMENTE ⚡")
print("[*] ==============================================================")
