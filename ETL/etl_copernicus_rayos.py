import os
import cdsapi
import xarray as xr
import numpy as np
from PIL import Image
import calendar
import time
from datetime import datetime, timezone

# ==========================================
# 1. CONFIGURACIÓN
# ==========================================
YEARS = ['2024', '2025', '2026']
MONTHS = [f"{m:02d}" for m in range(1, 13)]
BASE_OUTPUT_DIR = './data/rayos'
TEMP_FILE = 'temp_rayos_era5.nc'

current_year  = datetime.now(timezone.utc).year
current_month = datetime.now(timezone.utc).month

# ==========================================
# 2. FUNCIONES DE RESILIENCIA Y ROLLBACK
# ==========================================
def download_with_retries(client, dataset, request, target_file, max_retries=3):
    for attempt in range(max_retries):
        try:
            print(f"[*] Solicitando a la API (Intento {attempt + 1}/{max_retries})...")
            client.retrieve(dataset, request, target_file)
            return True
        except Exception as e:
            print(f"[!] Error en intento {attempt + 1}: {e}")
            time.sleep(10 * (attempt + 1))
    return False

def rollback(generated_files):
    print(f"[!] ROLLBACK: eliminando {len(generated_files)} archivos incompletos...")
    for filepath in generated_files:
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
                print(f"  [-] Eliminado: {filepath}")
            except Exception as e:
                print(f"  [!] No se pudo eliminar {filepath}: {e}")

# ==========================================
# 3. DIAGNÓSTICO DEFINITIVO Y ESTRATEGIA
# ==========================================
#
# PROBLEMA 1 — Nombre de variable ambiguo en MARS:
#   'mean_lightning_flash_rate' → MARS lo confunde con parámetros de oleaje
#   ('MEAN WAVE PERIOD OF AT LEAST 8 S' o 'MEAN WAVE PERIOD PROBABILITY').
#   El ParamID correcto es 228050 ("Instantaneous total lightning flash density",
#   alias MARS: litoti), pero el formato requerido por reanalysis-era5-complete
#   es "228050" como string, NO el nombre largo.
#
# PROBLEMA 2 — Stream ensemble inyectado automáticamente:
#   Con reanalysis-era5-single-levels + product_type='forecast', la nueva API
#   CDS inyecta 'number': ['all'] → enruta al stream ENDA (ensemble) donde
#   228050 no existe. Para forzar el stream OPER (HRES), debemos usar el
#   dataset 'reanalysis-era5-complete' con sintaxis MARS explícita:
#   stream=oper, type=fc, class=ea.
#
# PROBLEMA 3 — 228050 es INSTANTÁNEO, no acumulado:
#   Es "Instantaneous total lightning flash density" (litoti). No necesita
#   lógica de mean rate. La valid_time de cada step ES el timestamp del dato.
#   Unidades: flashes km⁻² day⁻¹
#
# SOLUCIÓN: reanalysis-era5-complete + MARS syntax + stream=oper + type=fc
#   Los forecasts cortos de ERA5 (18h) se inicializan a 06 y 18 UTC.
#   Steps 1..12 desde cada run dan 24 valid_times únicas por día:
#     06UTC + step1 → 07UTC ... 06UTC + step12 → 18UTC
#     18UTC + step1 → 19UTC ... 18UTC + step12 → 06UTC(+1día)
#
# NOTA IMPORTANTE sobre reanalysis-era5-complete:
#   - Usa 'date' en lugar de year/month/day
#   - Usa 'step' en lugar de 'leadtime_hour'
#   - Solo acepta formato GRIB (no netcdf directamente)
#   - Las descargas van vía tape MARS → pueden tardar horas
#   → Para minimizar el tiempo en tape, se descarga de a UN DÍA por petición.

print("\n==============================================================")
print("[*] ETL COPERNICUS ERA5 — DENSIDAD DE RAYOS (litoti / 228050)")
print("[*] Dataset: reanalysis-era5-complete | Stream: oper | Type: fc")
print("==============================================================\n")

try:
    c = cdsapi.Client(wait_until_complete=True, delete=True, timeout=600)
except Exception as e:
    print(f"[!] Error inicializando cdsapi.Client(): {e}")
    exit(1)

for year in YEARS:
    for month_str in MONTHS:
        month = int(month_str)

        if int(year) > current_year:
            continue
        if int(year) == current_year and month > current_month:
            continue

        print(f"\n[*] =================== {year}-{month_str} ===================")
        output_dir = os.path.join(BASE_OUTPUT_DIR, year, month_str)
        os.makedirs(output_dir, exist_ok=True)

        _, days_in_month = calendar.monthrange(int(year), month)
        expected_pngs = days_in_month * 24

        existing_pngs = [f for f in os.listdir(output_dir) if f.endswith('.png')]
        if len(existing_pngs) >= expected_pngs:
            print(f"[*] Completo: {len(existing_pngs)}/{expected_pngs} PNGs. Omitiendo.")
            continue

        # Iterar día a día para minimizar el tamaño de cada petición a MARS
        for day in range(1, days_in_month + 1):
            day_str = f"{day:02d}"
            date_str = f"{year}-{month_str}-{day_str}"

            # Verificar si este día ya está completo (24 PNGs)
            day_pngs = [f for f in os.listdir(output_dir)
                        if f.endswith('.png') and f.startswith(f"{year}{month_str}{day_str}")]
            if len(day_pngs) >= 24:
                print(f"  [=] {date_str} ya completo ({len(day_pngs)} PNGs). Saltando.")
                continue

            print(f"  [*] Descargando {date_str}...")

            # ----------------------------------------------------------
            # REQUEST CORREGIDO: reanalysis-era5-complete + MARS syntax
            # ----------------------------------------------------------
            # - class=ea, dataset=era5 → fuerza ERA5 HRES (no ensemble)
            # - stream=oper            → stream operacional (no enda)
            # - type=fc                → forecast (228050 solo existe en fc)
            # - param=228050           → litoti: Instantaneous total lightning
            #                           flash density [flashes km⁻² day⁻¹]
            # - time=0600/1800         → dos runs de inicialización por día
            # - step=1/2/.../12        → 12 pasos × 2 runs = 24 valid_times
            # - levtype=sfc            → superficie (single level)
            # - grid=0.25/0.25         → resolución 0.25°
            # ----------------------------------------------------------
            request_payload = {
                'class'    : 'ea',
                'dataset'  : 'era5',
                'expver'   : '1',
                'stream'   : 'oper',
                'type'     : 'fc',
                'levtype'  : 'sfc',
                'param'    : '228050',
                'date'     : date_str,
                'time'     : '0600/1800',
                'step'     : '/'.join(str(s) for s in range(1, 13)),
                'grid'     : '0.25/0.25',
                #'area'     : '90/-180/-90/180',
                'area'     : '15/-85/-60/-30',
                'format'   : 'netcdf',
            }

            success = download_with_retries(
                c, 'reanalysis-era5-complete', request_payload, TEMP_FILE
            )

            if not success:
                print(f"  [!] Fracaso descargando {date_str}. Continuando con el día siguiente.")
                continue

            # ==========================================
            # 4. PROCESAMIENTO DEL NETCDF
            # ==========================================
            generated_files = []
            ds = None

            try:
                ds = xr.open_dataset(TEMP_FILE, engine='netcdf4')
                var_name = list(ds.data_vars)[0]
                print(f"  [*] Variable en NetCDF: '{var_name}'")

                da = ds[var_name]

                # Aplanar (time, step) → flat_time y ordenar por valid_time
                if 'step' in da.dims and 'time' in da.dims:
                    da_stacked = da.stack(flat_time=('time', 'step'))
                    if 'valid_time' in ds.coords:
                        vt = ds['valid_time'].stack(flat_time=('time', 'step'))
                        da_stacked = da_stacked.assign_coords(
                            valid_time=('flat_time', vt.values)
                        )
                        da_stacked = da_stacked.sortby('valid_time')
                    time_dim = 'flat_time'
                    da = da_stacked
                else:
                    time_dim = 'valid_time' if 'valid_time' in da.dims else 'time'

                total_frames = da.sizes[time_dim]
                seen_timestamps = set()

                for i in range(total_frames):
                    frame_da = da.isel({time_dim: i})

                    if 'valid_time' in frame_da.coords:
                        vt_val = frame_da.coords['valid_time'].values
                    else:
                        vt_val = frame_da.coords[time_dim].values

                    ts = np.datetime64(vt_val, 'h')
                    timestamp_str = str(ts)  # '2024-01-01T07'

                    if timestamp_str in seen_timestamps:
                        continue
                    seen_timestamps.add(timestamp_str)

                    # Nombre: YYYYMMDD_HH00.png
                    dt_part = timestamp_str.replace('-', '').replace('T', '_')
                    filename = f"{dt_part}00.png"
                    filepath = os.path.join(output_dir, filename)

                    # Normalización: litoti en flashes km⁻² day⁻¹
                    # Máximo razonable: ~100 fl km⁻² day⁻¹ (regiones convectivas
                    # muy activas como África Central en verano boreal).
                    # Ajustar MAX_FLASH según el dominio si se desea más detalle.
                    MAX_FLASH = 100.0  # flashes km⁻² day⁻¹

                    frame = frame_da.values.astype(np.float32)
                    frame = np.where(np.isnan(frame), 0.0, frame)
                    frame_flipped = np.flipud(frame)
                    normalized    = frame_flipped / MAX_FLASH
                    clipped       = np.clip(normalized, 0.0, 1.0)
                    encoded       = np.round(clipped * 255.0).astype(np.uint8)

                    img = Image.fromarray(encoded, mode='L')
                    img.save(filepath)
                    generated_files.append(filepath)

                print(f"  [✓] {len(generated_files)} PNGs generados para {date_str}")

            except Exception as e:
                print(f"  [!] Error procesando {date_str}: {e}")
                rollback(generated_files)

            finally:
                if ds is not None:
                    try:
                        ds.close()
                    except Exception:
                        pass
                if os.path.exists(TEMP_FILE):
                    os.remove(TEMP_FILE)

print("\n[*] ==============================================================")
print("[*] ⚡ ETL COPERNICUS RAYOS COMPLETADO ⚡")
print("[*] ==============================================================")
