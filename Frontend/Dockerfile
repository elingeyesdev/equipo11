# Imagen base: Node.js 20 versión ligera
FROM node:20-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar archivos de dependencias primero (para cache eficiente)
COPY package.json package-lock.json ./

# Borrar package-lock.json para evitar el bug de npm con dependencias opcionales (bindings de rolldown) y luego instalar
RUN rm -f package-lock.json && npm install

# Copiar el resto del código fuente
COPY . .

# Puerto del servidor de desarrollo de Vite
EXPOSE 5173

# Iniciar Vite en modo desarrollo
CMD ["npm", "run", "dev"]