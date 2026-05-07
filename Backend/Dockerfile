# Imagen base: Node.js 20 versión ligera
FROM node:20-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Instalar dependencias para Puppeteer/Chromium (necesario para whatsapp-web.js)
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

# Instalar eccodes para decodificar archivos meteorológicos GRIB2 de la NOAA
RUN apk add --no-cache eccodes --repository=http://dl-cdn.alpinelinux.org/alpine/edge/testing

# Configurar variables de entorno para que Puppeteer use el Chromium instalado
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    CHROME_BIN=/usr/bin/chromium-browser

# Copiar archivos de dependencias primero (para cache eficiente)
COPY package.json package-lock.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código fuente
COPY . .

# Puerto que expone la API
EXPOSE 3000

# Comando para iniciar en desarrollo (con nodemon para hot-reload)
CMD ["npm", "run", "dev"]
