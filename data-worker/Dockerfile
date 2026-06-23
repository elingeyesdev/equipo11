# Usamos una imagen ligera de Python
FROM python:3.10-slim

# Instalamos las librerías necesarias + libeccodes-dev (El traductor C para GRIB)
RUN apt-get update && apt-get install -y \
    python3-dev \
    gcc \
    libeccodes-dev \
    && pip install --no-cache-dir cdsapi requests numpy pandas matplotlib netCDF4 xarray scipy pillow cfgrib eccodes

# Directorio de trabajo
WORKDIR /app

# Esto dejará el contenedor encendido esperando órdenes
CMD ["tail", "-f", "/dev/null"]