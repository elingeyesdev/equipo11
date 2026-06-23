import os
import calendar
import cdsapi
import numpy as np
import xarray as xr
from PIL import Image
import bisect

# Configuración
DATASET = 'reanalysis-era5-single-levels'
VAR_NAME = 'temperatura'
SHORT_NAME = 't2m'
BASE_DIR = './data/temperatura'

CUTOFF_DATE = np.datetime64('2026-06-18T04:00:00')

YEARS = ['2024', '2025', '2026']
MONTHS = [f"{m:02d}" for m in range(1, 13)]



def run_historical():
    print(f"[*] INICIANDO HISTÓRICO: {VAR_NAME.upper()}")
    c = cdsapi.Client()
    
    for year in YEARS:
        for month in MONTHS:
            if year == '2026' and int(month) > 6:
                continue
                
            download_file = f'era5_{VAR_NAME}_{year}_{month}.nc'
            output_dir = os.path.join(BASE_DIR, year, month)
            os.makedirs(output_dir, exist_ok=True)
            
            _, days_in_month = calendar.monthrange(int(year), int(month))
            days_list = [f"{d:02d}" for d in range(1, days_in_month + 1)]
            
            if year == '2026' and month == '06':
                days_list = [f"{d:02d}" for d in range(1, 19)]
                
            if not os.path.exists(download_file):
                print(f"[*] Petición a la API para {year}-{month}...")
                try:
                    c.retrieve(
                        DATASET,
                        {
                            'product_type': 'reanalysis',
                            'variable': ['2m_temperature'],
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
                except Exception as e:
                    print(f"[!] Error descargando API: {e}")
                    continue
            
            try:
                ds = xr.open_dataset(download_file, engine='netcdf4')
                time_dim = 'valid_time' if 'valid_time' in ds.dims else 'time'
                total_hours = ds.sizes[time_dim]
                
                for i in range(total_hours):
                    current_time = ds[time_dim].values[i]
                    if current_time > CUTOFF_DATE:
                        print(f"[*] Cutoff alcanzado: {current_time}. Finalizando mes.")
                        break
                        
                    frame = ds['t2m'].isel({time_dim: i}).values
                    frame = np.flipud(frame)
                    celsius = frame - 273.15
                    normalized = (celsius - (-50.0)) / (50.0 - (-50.0))
                    clipped = np.clip(normalized, 0.0, 1.0)
                    encoded = np.round(clipped * 255.0).astype(np.uint8)
                    img = Image.fromarray(encoded, mode='L')
                    
                    timestamp = np.datetime_as_string(current_time, unit='h')
                    filename = f"{timestamp.replace('-', '').replace('T', '_')}00.png"
                    filepath = os.path.join(output_dir, filename)
                    img.save(filepath)
                    
                ds.close()
            except Exception as e:
                print(f"[!] Error procesando {download_file}: {e}")
                
            if os.path.exists(download_file):
                os.remove(download_file)

if __name__ == "__main__":
    run_historical()
