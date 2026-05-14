# 🚀 Guía de Migración: de `npm` a `pnpm`

¡Hola equipo! Hemos migrado nuestro gestor de paquetes en el Frontend y Backend de **npm** a **pnpm**. 
`pnpm` es mucho más rápido, estricto y eficiente con el espacio en disco. 

Para que su entorno local siga funcionando correctamente y no tengan conflictos con la configuración antigua, **todos deben seguir estos pasos al pie de la letra** después de hacer `git pull` de los últimos cambios.

---

## 🛠️ Paso 1: Instalar pnpm globalmente
Si aún no tienes `pnpm` en tu computadora, debes instalarlo de forma global. Abre tu terminal y ejecuta:
```bash
npm install -g pnpm
```

---

## 🧹 Paso 2: Limpiar el entorno local (Frontend y Backend)
Al traer los últimos cambios con `git pull`, el archivo `package-lock.json` debería haber desaparecido (fue reemplazado por `pnpm-lock.yaml`). Sin embargo, **debes eliminar tus carpetas `node_modules` antiguas**, ya que fueron generadas por npm.

Abre una terminal en la raíz del proyecto y ejecuta estos comandos:

**En el Frontend:**
```bash
cd Frontend
rm -rf node_modules
# (Solo por si acaso, si aún ves el archivo antiguo, bórralo:)
rm -f package-lock.json 
pnpm install
```

**En el Backend:**
```bash
cd ../Backend
rm -rf node_modules
rm -f package-lock.json
pnpm install
```

> **⚠️ Nota de Seguridad (Ignored Builds):** 
> Si al hacer `pnpm install` te sale una advertencia diciendo `[ERR_PNPM_IGNORED_BUILDS]`, es normal. En el repositorio ya agregamos los archivos `pnpm-workspace.yaml` para aprobar la construcción de librerías seguras, así que **no tienes que hacer nada más**, simplemente ignora el mensaje.

---

## 🐳 Paso 3: Limpiar y reconstruir los contenedores de Docker (¡CRÍTICO!)
Este es el paso más importante. Docker Compose guarda tu antigua carpeta `node_modules` (la que instaló npm) en algo llamado "volúmenes anónimos". Si levantas Docker de forma normal, **esos archivos viejos sobreescribirán la nueva instalación de pnpm y el proyecto no arrancará.**

Para evitar esto y forzar a Docker a reemplazar esos volúmenes obsoletos, debes levantar el proyecto con la bandera `-V` (o `--renew-anon-volumes`):

1. Ve a la raíz del proyecto (donde está el archivo `docker-compose.yml`).
2. Ejecuta el siguiente comando:
```bash
docker compose up --build -V
```
*(Si usas la versión antigua de Docker, usa `docker-compose up --build -V`)*.

> **ℹ️ ¿Qué hace la bandera `-V`?** Destruye únicamente los volúmenes anónimos (las dependencias de node) y crea unos nuevos. **Tu base de datos (`pgdata`) está a salvo y no perderás datos.**

---

## ✅ Comprobación
Si seguiste los pasos correctamente, verás en la consola que Docker descarga e instala dependencias usando `pnpm`, y ambos servidores (Vite y el de Node/Express) arrancarán sin errores de dependencias faltantes.

A partir de ahora, recuerda:
- Para instalar una nueva librería: `pnpm add nombre-paquete` (en lugar de `npm install`)
- Para correr un script localmente: `pnpm run dev` (en lugar de `npm run dev`)
