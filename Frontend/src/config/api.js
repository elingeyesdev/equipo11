/**
 * Configuración centralizada de API.
 * 
 * En desarrollo (local): usa http://localhost:3000 por defecto.
 * En producción (Portainer/ZeroTier): se configura VITE_API_URL
 * en docker-compose.prod.yml con la IP del servidor.
 */
const rawApiUrl = import.meta.env.VITE_API_URL || '';

export const API_URL = rawApiUrl.endsWith('/api') 
  ? rawApiUrl.slice(0, -4) 
  : (rawApiUrl || 'http://localhost:3000');

export const API_BASE = `${API_URL}/api`;
