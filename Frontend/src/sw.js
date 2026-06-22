import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// 1. Inyección automática del precache de Vite
precacheAndRoute(self.__WB_MANIFEST || []);

// 2. Control inmediato de clientes activos al instalar
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// 3. Fallback de Navegación (SPA Offline Support)
// En producción, cualquier URL de navegación se redirige al index.html cacheado si la red no responde.
const handler = async (params) => {
  try {
    return await new NetworkFirst({
      cacheName: 'envirosense-navigation',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 1,
          maxAgeSeconds: 24 * 60 * 60, // 1 día de persistencia
        }),
      ],
    }).handle(params);
  } catch (error) {
    // Si la red y la caché fallan, servimos el index.html del precache
    return createHandlerBoundToURL('/index.html')(params);
  }
};
registerRoute(new NavigationRoute(handler));

// 4. Estrategia de Cache para Archivos Estáticos (Estilo, Tipografías e Imágenes)
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.request?.url.includes('fonts.googleapis.com') ||
    request.request?.url.includes('fonts.gstatic.com'),
  new StaleWhileRevalidate({
    cacheName: 'envirosense-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
      }),
    ],
  })
);


