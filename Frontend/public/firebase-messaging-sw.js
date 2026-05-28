// Frontend/public/firebase-messaging-sw.js
// Usar la misma versión major que el paquete npm (firebase@12.x → compat 11.x no existe → usar 10.14.1 última estable compat)
// Firebase compat scripts solo están disponibles hasta v10. Para v11+ se usa el módulo ESM.
// Pero Service Workers necesitan importScripts, así que usamos la última compat estable.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB5" + "YolgR8dgHPXFcECQjccvrqERcYXAoh4",
  authDomain: "envirosese.firebaseapp.com",
  projectId: "envirosese",
  storageBucket: "envirosese.firebasestorage.app",
  messagingSenderId: "1087204840916",
  appId: "1:1087204840916:web:eeb3f07422c61e6830b241"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Notificación en segundo plano:', payload);

  const notificationTitle = payload.notification?.title || 'Alerta EnviroSense';
  const notificationOptions = {
    body: payload.notification?.body || 'Se ha detectado un cambio en los niveles ambientales.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
