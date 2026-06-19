import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: 'envirosense.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export let messaging = null;

isSupported().then((supported) => {
  if (supported) {
    messaging = getMessaging(app);
    
    // Listener de notificaciones en primer plano
    onMessage(messaging, (payload) => {
      console.log('[firebase.js] Notificación foreground:', payload);
      if (payload.notification) {
        const { title, body } = payload.notification;
        
        // Forzar la notificación nativa de Windows/OS aunque la app esté abierta
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(title, {
            body: body,
            icon: '/icons/icon-192.png'
          });
        }

        window.dispatchEvent(
          new CustomEvent('push-received', { detail: { title, body, data: payload.data } })
        );
      }
    });
  } else {
    console.warn('[firebase.js] Firebase Messaging no está soportado (o falta HTTPS).');
  }
}).catch(err => {
  console.warn('[firebase.js] Error al verificar soporte de Messaging:', err);
});

export async function getFCMToken() {
  const supported = await isSupported();
  if (!supported) {
    throw new Error('Push no soportado en este dispositivo (Se requiere HTTPS o un navegador compatible).');
  }
  if (!messaging) {
    messaging = getMessaging(app);
  }
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  const token = await getToken(messaging, { vapidKey });
  return token || null;
}
