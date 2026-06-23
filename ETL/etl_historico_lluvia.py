import os
import calendar
import cdsapi
import numpy as np
import xarray as xr
from PIL import Image
import bisect

# Configuración
DATASET = 'reanalysis-era5-single-levels'
VAR_NAME = 'lluvia'
SHORT_NAME = 'tp'
BASE_DIR = './data/lluvia'

CUTOFF_DATE = np.datetime64('2026-06-18T04:00:00')

YEARS = ['2024', '2025', '2026']
MONTHS = [f"{m:02d}" for m in range(1, 13)]

RAIN_STOPS = [0.0, 0.2, 0.5, 1.0, 2.0, 3.0, 4.0, 5.0, 7.5, 10.0, 15.0, 20.0, 25.0, 30.0, 35.0, 40.0, 50.0, 60.0, 70.0, 85.0, 100.0, 150.0]
def encode_rain_pixel(val):
    if np.isnan(val) or val <= 0: return 0
    if val >= 150.0: return 255
    idx = bisect.bisect_right(RAIN_STOPS, val) - 1
    t = (val - RAIN_STOPS[idx]) / (RAIN_STOPS[idx+1] - RAIN_STOPS[idx])
    norm = (idx + t) / 21.0
    return int(round(norm * 255.0))
v_encode_rain = np.vectorize(encode_rain_pixel)

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
                            'variable': ['total_precipitation'],
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
                        
                    try:
                        frame = ds['tp'].isel({time_dim: i}).values
                    except KeyError:
                        var_name = list(ds.data_vars)[0]
                        frame = ds[var_name].isel({time_dim: i}).values
                    frame = np.flipud(frame)
                    frame_val = frame * 1000.0
                    encoded_frame = v_encode_rain(frame_val).astype(np.uint8)
                    img = Image.fromarray(encoded_frame, mode='L')
                    
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
