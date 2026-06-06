import os
import requests
import geopandas as gpd
import pandas as pd
import tempfile
import zipfile
import xml.etree.ElementTree as ET

# ==========================================
# 1. CONFIGURACIÓN
# ==========================================
# URL del RSS oficial del NHC para datos GIS de tormentas activas
RSS_URL = "https://www.nhc.noaa.gov/gis-at.xml"

OUTPUT_DIR = './data/vectores'
os.makedirs(OUTPUT_DIR, exist_ok=True)
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'huracanes_activos.geojson')

# ==========================================
# 2. EXTRACCIÓN (API NHC NOAA)
# ==========================================
def process_active_hurricanes():
    print("[*] Iniciando ETL Vectorial de Huracanes (NHC NOAA)...")
    
    try:
        response = requests.get(RSS_URL, timeout=10)
        response.raise_for_status()
    except Exception as e:
        print(f"[!] Error conectando al RSS del NHC: {e}")
        return
        
    try:
        root = ET.fromstring(response.content)
        # Buscar todos los links terminados en .zip en el RSS
        # El NHC agrupa el cono y trayectoria en '5day_latest.zip'
        zip_urls = []
        for item in root.findall('.//item'):
            link = item.find('link')
            if link is not None and '5day_latest.zip' in link.text:
                zip_urls.append(link.text)
    except Exception as e:
        print(f"[!] Error parseando el XML del NHC: {e}")
        return

    # Eliminar duplicados si los hubiera
    zip_urls = list(set(zip_urls))

    if not zip_urls:
        print("[*] No hay ciclones tropicales activos reportados por el NHC en este momento.")
        # Generar un GeoJSON vacío válido para evitar que Mapbox crashee por falta de Source
        empty_gdf = gpd.GeoDataFrame(columns=['geometry'], geometry='geometry', crs="EPSG:4326")
        empty_gdf.to_file(OUTPUT_FILE, driver="GeoJSON")
        print(f"[*] GeoJSON vacío guardado en {OUTPUT_FILE}")
        return

    print(f"[*] Se detectaron {len(zip_urls)} huracanes/tormentas activas. Descargando Shapefiles...")

    # ==========================================
    # 3. TRANSFORMACIÓN (SHP -> GEOJSON)
    # ==========================================
    gdfs = []

    for zip_url in zip_urls:
        print(f"    -> Procesando: {zip_url.split('/')[-1]}")
        try:
            # Descargar el ZIP a un archivo temporal local
            with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as tmp_zip:
                r = requests.get(zip_url, stream=True)
                for chunk in r.iter_content(chunk_size=8192):
                    tmp_zip.write(chunk)
                tmp_zip_path = tmp_zip.name

            # Leer el interior del ZIP
            with zipfile.ZipFile(tmp_zip_path, 'r') as z:
                # Extraer el polígono del Cono de Incertidumbre (termina en pgn.shp)
                pgn_files = [f for f in z.namelist() if f.endswith('pgn.shp')]
                
                # Opcional: También podríamos buscar 'lin.shp' para la línea de la trayectoria.
                
                for pgn_file in pgn_files:
                    # Usar el driver virtual de fiona para leer el SHP directamente dentro del ZIP
                    vfs_path = f"zip://{tmp_zip_path}!{pgn_file}"
                    gdf = gpd.read_file(vfs_path)
                    
                    # Añadir metadatos para ayudar a Mapbox con los estilos
                    gdf['capa_tipo'] = 'cono_incertidumbre'
                    gdfs.append(gdf)

            # Limpieza temporal
            os.remove(tmp_zip_path)
            
        except Exception as e:
            print(f"    [!] Error procesando {zip_url}: {e}")

    # ==========================================
    # 4. CARGA (GUARDAR LOCALMENTE)
    # ==========================================
    if gdfs:
        print("[*] Unificando geometrías vectoriales...")
        # Concatenar todos los conos de distintos huracanes en un único GeoJSON
        merged_gdf = pd.concat(gdfs, ignore_index=True)
        
        # Asegurarnos estrictamente de que usamos el sistema WGS84 (Lat/Lon) que Mapbox requiere
        if merged_gdf.crs != "EPSG:4326":
            merged_gdf = merged_gdf.to_crs("EPSG:4326")
            
        print(f"[*] Exportando archivo estático a {OUTPUT_FILE}...")
        merged_gdf.to_file(OUTPUT_FILE, driver="GeoJSON")
        print("[*] ¡ETL Vectorial finalizado exitosamente!")
    else:
        print("[!] No se generó data válida.")

if __name__ == "__main__":
    process_active_hurricanes()
