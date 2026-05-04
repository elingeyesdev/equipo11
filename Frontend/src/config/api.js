/**
 * Configuración centralizada de API.
 * 
 * En desarrollo (local): usa http://localhost:3000 por defecto.
 * En producción (Portainer/ZeroTier): se configura VITE_API_URL
 * en docker-compose.prod.yml con la IP del servidor.
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
export const API_BASE = `${API_URL}/api`
