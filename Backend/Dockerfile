# Imagen base: Node.js 20 versión ligera
FROM node:20-alpine

WORKDIR /app

# Instalar dependencias para Puppeteer/Chromium y eccodes para archivos GRIB2
RUN apk add --no-cache \
    chromium nss freetype harfbuzz ca-certificates ttf-freefont && \
    apk add --no-cache eccodes --repository=http://dl-cdn.alpinelinux.org/alpine/edge/testing

# Configurar variables de entorno para Puppeteer y Corepack
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    CHROME_BIN=/usr/bin/chromium-browser \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# Habilitar pnpm vía Corepack
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copiar manifiestos
COPY package.json pnpm-lock.yaml ./

# Instalar dependencias con pnpm
RUN pnpm install --frozen-lockfile

# Copiar el resto del código fuente
COPY . .

# Puerto que expone la API
EXPOSE 3000

# Comando para iniciar en desarrollo (con nodemon para hot-reload)
CMD ["pnpm", "run", "dev"]