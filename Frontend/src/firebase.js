import { initializeApp } from 'firebase/app';
import { getMessaging, onMessage } from 'firebase/messaging';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'tu_api_key_aqui',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'tu_auth_domain_aqui',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'tu_project_id_aqui',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'tu_messaging_sender_id_aqui',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'tu_app_id_aqui',
});

export const messaging = getMessaging(app);

// Registro explícito del Service Worker de Firebase con su alcance específico
// para asegurar que cumpla con las precondiciones sin entrar en conflicto con la PWA.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: '/firebase-cloud-messaging-push-scope'
  }).then((registration) => {
    console.log('Firebase Service Worker registrado con alcance:', registration.scope);
  }).catch((err) => {
    console.error('Error al registrar el Firebase Service Worker:', err);
  });
}

onMessage(messaging, (payload) => {
  console.log('[firebase.js] Recibida notificación en primer plano (foreground):', payload);
  if (payload.notification) {
    const { title, body } = payload.notification;
    window.dispatchEvent(new CustomEvent('push-received', { detail: { title, body, data: payload.data } }));
  }
});
