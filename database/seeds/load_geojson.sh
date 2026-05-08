#!/bin/bash
set -e

echo "=========================================="
echo "Cargando archivos GeoJSON en la base de datos..."
echo "=========================================="

# Iterar sobre todos los archivos .sql en la carpeta geojson
for f in /docker-entrypoint-initdb.d/geojson/*_geojson.sql; do
    if [ -f "$f" ]; then
        echo "Ejecutando: $(basename $f)"
        psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$f" -q && echo "OK: $(basename $f)" || echo "FAIL: $(basename $f)"
    else
        echo "No se encontraron archivos _geojson.sql en /docker-entrypoint-initdb.d/geojson"
    fi
done

echo "=========================================="
echo "Carga de GeoJSON completada."
echo "=========================================="
