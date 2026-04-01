# Imagen base: Node.js 20 versión ligera
FROM node:20-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar archivos de dependencias primero (para cache eficiente)
COPY package.json package-lock.json ./

# Instalar dependencias
RUN npm ci

# Copiar el resto del código fuente
COPY . .

# Puerto que expone la API
EXPOSE 3000

# Comando para iniciar en desarrollo (con nodemon para hot-reload)
CMD ["npm", "run", "dev"]
