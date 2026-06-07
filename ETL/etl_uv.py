import os
import cdsapi
import xarray as xr
import numpy as np
from PIL import Image
import calendar

# ==========================================
# 1. CONFIGURACIÓN ESTRUCTURAL
# ==========================================
UV_VARIABLE = 'downward_uv_radiation_at_the_surface'
YEARS = ['2024', '2025', '2026']
MONTHS = [f"{m:02d}" for m in range(1, 13)]

BASE_OUTPUT_DIR = './data/uv'

# ==========================================
# 2. CLIENTE API Y BUCLE PRINCIPAL
# ==========================================
# Usar el cliente estándar para el Climate Data Store (lee ~/.cdsapirc)
c = cdsapi.Client()

print(f"\n==============================================================")
print(f"[*] INICIANDO ETL ERA5 EXCLUSIVO: ÍNDICE UV")
print(f"[*] Dataset: reanalysis-era5-single-levels")
print(f"[*] Variable: {UV_VARIABLE}")
print(f"==============================================================")

for year in YEARS:
    for month in MONTHS:
        # Filtro defensivo: ignorar meses futuros de 2026
        if year == '2026' and int(month) > 6:
            print(f"[*] Saltando {year}-{month} (mes futuro, ignorado por seguridad).")
            continue
            
        print(f"\n[*] Descargando e iterando: {year}-{month} (uv)")
        
        download_file = f'era5_uv_{year}_{month}.nc'
        output_dir = os.path.join(BASE_OUTPUT_DIR, year, month)
        os.makedirs(output_dir, exist_ok=True)
        
        _, days_in_month = calendar.monthrange(int(year), int(month))
        days_list = [f"{d:02d}" for d in range(1, days_in_month + 1)]
        
        # 1. Petición a Copernicus (ERA5)
        if not os.path.exists(download_file):
            print(f"[*] Petición a la API ERA5 (Data format: NetCDF)...")
            request_params = {
                'product_type': 'reanalysis',
                'variable': UV_VARIABLE,
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
            
            try:
                c.retrieve('reanalysis-era5-single-levels', request_params, download_file)
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

            # Búsqueda segura de la variable UV (nombre interno suele ser 'duvrs')
            var_uv = next((v for v in data_var_names if v in ['duvrs', 'downward_uv_radiation_at_the_surface']), data_var_names[0])

            for i in range(total_hours):
                frame = ds[var_uv].isel({time_dim: i}).values
                frame_flipped = np.flipud(frame)
                
                # Normalización dinámica por frame para maximizar contraste
                frame_min = np.nanmin(frame_flipped)
                frame_max = np.nanmax(frame_flipped)
                
                if frame_max > 0 and frame_max > frame_min:
                    normalized = (frame_flipped - frame_min) / (frame_max - frame_min)
                else:
                    normalized = np.zeros_like(frame_flipped)
                
                clipped = np.clip(normalized, 0.0, 1.0)
                encoded = np.round(clipped * 255.0).astype(np.uint8)
                
                img = Image.fromarray(encoded, mode='L')
                
                current_time = da_first[time_dim].values[i]
                timestamp = np.datetime_as_string(current_time, unit='h')
                filename = f"{timestamp.replace('-', '').replace('T', '_')}00.png"
                filepath = os.path.join(output_dir, filename)
                img.save(filepath)
            
            ds.close()
            print(f"[*] ✓ {total_hours} PNGs generados en {output_dir}")
            
        except Exception as e:
            print(f"[!] Error procesando {download_file}: {e}")
        
        # Limpieza Absoluta
        if os.path.exists(download_file):
            print(f"[*] 🗑 Eliminando residuo temporal {download_file}...")
            os.remove(download_file)

print("\n[*] ==============================================================")
print("[*] ⚡ ETL ERA5 UV COMPLETADO EXITOSAMENTE ⚡")
print("[*] ==============================================================")
