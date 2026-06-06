FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Instalar librerías clave para GIS y matemáticas tensoriales
RUN pip install --no-cache-dir \
    cdsapi \
    xarray \
    netCDF4 \
    h5netcdf \
    numpy \
    Pillow \
    geopandas \
    requests \
    shapely

CMD ["python"]
