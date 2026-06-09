# Imagen base: Node.js 20 versión ligera
FROM node:20-alpine

# Instalar pnpm globalmente
RUN npm install -g pnpm@9

WORKDIR /app

# Copiar solo manifiestos para aprovechar la caché de capas de Docker
COPY package.json pnpm-lock.yaml ./

# Instalar dependencias (frozen-lockfile garantiza reproducibilidad exacta)
RUN pnpm install
# --frozen-lockfile

# Copiar el resto del código fuente
COPY . .

# Argumentos opcionales para inyectar variables en producción
ARG VITE_MAPBOX_TOKEN
ARG VITE_API_URL

# Puerto del servidor de desarrollo de Vite
EXPOSE 5173

# Iniciar Vite en modo desarrollo
CMD ["pnpm", "run", "dev"]