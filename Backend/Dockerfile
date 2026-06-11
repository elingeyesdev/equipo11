# ==========================================
# ETAPA 1: Compilación de Dependencias (Builder)
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar herramientas esenciales de compilación nativa de Node
RUN apk add --no-cache python3 make g++ gcc musl-dev git

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./


RUN npm install -g pnpm@11.4.0 && \
    pnpm config set confirmModulesPurge false && \
    pnpm install --no-frozen-lockfile --prod


# ==========================================
# ETAPA 2: Entorno de Ejecución (Runner)
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

# Instalar dependencias de sistema mínimas requeridas para producción
# - Chromium: Para automatización de WhatsApp Web (Puppeteer)
# - eccodes: Para decodificación de GRIB2 NOAA
# - ca-certificates: Para conexiones TLS seguras
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl && \
    apk add --no-cache eccodes --repository=http://dl-cdn.alpinelinux.org/alpine/edge/testing

# Variables de entorno para Puppeteer y Chromium integrado de Alpine
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

# Copiar dependencias ya resueltas de la etapa builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=builder /usr/local/bin /usr/local/bin

# Copiar el código fuente de la aplicación
COPY . .

# Exponer el puerto del Backend de Express
EXPOSE 3000

# Añadir Healthcheck nativo de Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Comando de arranque por defecto en producción
CMD ["node", "index.js"]