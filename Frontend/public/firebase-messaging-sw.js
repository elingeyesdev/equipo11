// Frontend/public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Inicializa Firebase en el Service Worker.
// Nota: Dado que este archivo se sirve como un recurso estático en el navegador,
// no puede acceder directamente a las variables de entorno de Vite en tiempo de compilación.
// En producción, reemplaza estos marcadores con tus credenciales reales de Firebase.
firebase.initializeApp({
  apiKey: "tu_api_key_aqui",
  authDomain: "tu_auth_domain_aqui",
  projectId: "tu_proyecto_id_aqui",
  messagingSenderId: "tu_messaging_sender_id_aqui",
  appId: "tu_app_id_aqui"
});

const messaging = firebase.messaging();

// Handler para recibir notificaciones en segundo plano (cuando la app está cerrada)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Recibida notificación en segundo plano:', payload);

  const notificationTitle = payload.notification.title || 'Alerta EnviroSense';
  const notificationOptions = {
    body: payload.notification.body || 'Se ha detectado un cambio en los niveles ambientales.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
