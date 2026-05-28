import axios from 'axios';
import { clearSession } from '../utils/auth';
import { openDB } from 'idb';

import { API_BASE } from './api';

const DB_NAME = 'envirosense-offline';
const STORE_NAME = 'api-cache';

// Helper para obtener la BD
async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    }
  });
}

const httpClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

httpClient.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

httpClient.interceptors.response.use(
  async res => {
    // Si la petición es exitosa y es GET, la guardamos en la caché offline
    if (res.config.method?.toLowerCase() === 'get') {
      try {
        const db = await getDB();
        // Usamos la URL (ej. '/sensores') como llave en IDB
        await db.put(STORE_NAME, res.data, res.config.url);
      } catch (err) {
        console.warn('[EnviroSense] No se pudo guardar caché offline:', err);
      }
    }
    return res;
  },
  async err => {
    if (err.response?.status === 401) {
      clearSession();
      window.location.href = '/login';
      return Promise.reject(err);
    }

    // Intercepción de errores de red (offline) para peticiones GET
    if (!err.response && err.config?.method?.toLowerCase() === 'get') {
      try {
        const db = await getDB();
        const cachedData = await db.get(STORE_NAME, err.config.url);
        
        if (cachedData) {
          console.log(`[EnviroSense] Sirviendo datos offline para: ${err.config.url}`);
          // Devolver una "falsa" respuesta Axios para mantener el contrato (OCP)
          return Promise.resolve({
            data: cachedData,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: err.config,
            request: {}
          });
        }
      } catch (dbErr) {
        console.warn('[EnviroSense] Error leyendo caché local:', dbErr);
      }
    }

    return Promise.reject(err);
  }
);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // Aquí podemos disparar un evento custom o limpiar cachés temporales si es necesario
    console.log('[EnviroSense] Conexión recuperada. Los próximos fetch serán datos frescos.');
  });
}

export default httpClient;
