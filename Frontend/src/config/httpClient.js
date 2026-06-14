import axios from 'axios';
import { clearSession } from '../utils/auth';
import { get, set, del } from 'idb-keyval';
import { API_BASE } from './api';

const httpClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// TTL por defecto para peticiones cacheadas (5 minutos)
const DEFAULT_TTL = 5 * 60 * 1000;

// Interceptor de Request: Retornar caché en IndexedDB si estamos offline
httpClient.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Solo cacheamos llamadas GET que no sean dinámicas
  const isDynamic = config.url && (
    config.url.includes('/sensores') ||
    config.url.includes('/alertas') ||
    config.url.includes('/notificaciones') ||
    config.url.includes('/simulacion')
  );

  if (config.method?.toLowerCase() === 'get' && config.cacheTTL !== false && !isDynamic) {
    const cacheKey = `http_cache:${config.url}:${JSON.stringify(config.params || {})}`;
    
    try {
      const cached = await get(cacheKey);
      const isOnline = navigator.onLine;

      if (cached) {
        const { data, expiresAt } = cached;
        const now = Date.now();

        // Si estamos offline o la caché no ha expirado, resolvemos la petición con la caché
        if (!isOnline || now < expiresAt) {
          config.adapter = () => {
            return Promise.resolve({
              data,
              status: 200,
              statusText: 'OK',
              headers: config.headers,
              config,
            });
          };
        }
      }
    } catch (err) {
      console.warn('Error accediendo a IndexedDB Cache:', err);
    }
  }

  return config;
}, (error) => Promise.reject(error));

// Interceptor de Response: Guardar en caché si la llamada fue exitosa
httpClient.interceptors.response.use(async (response) => {
  const { config } = response;
  
  const isDynamic = config.url && (
    config.url.includes('/sensores') ||
    config.url.includes('/alertas') ||
    config.url.includes('/notificaciones') ||
    config.url.includes('/simulacion')
  );

  if (config.method?.toLowerCase() === 'get' && config.cacheTTL !== false && !isDynamic) {
    const cacheKey = `http_cache:${config.url}:${JSON.stringify(config.params || {})}`;
    const ttl = config.cacheTTL || DEFAULT_TTL;
    
    try {
      await set(cacheKey, {
        data: response.data,
        expiresAt: Date.now() + ttl,
      });
    } catch (err) {
      console.warn('Error guardando en IndexedDB Cache:', err);
    }
  }
  return response;
}, (error) => {
  // Manejo global del 401 para expiración de sesión
  if (error.response?.status === 401) {
    clearSession();
    window.location.href = '/login';
  }
  return Promise.reject(error);
});

export default httpClient;
