import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const PwaContext = createContext(null);

export const PwaProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState(null);
  
  // Utiliza el helper reactivo de vite-plugin-pwa
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      console.log('SW registrado correctamente:', swUrl);
    },
    onRegisterError(error) {
      console.error('Error al registrar SW:', error);
    }
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const triggerInstall = async () => {
    if (!installPrompt) return false;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      return true;
    }
    return false;
  };

  const reloadApp = () => {
    updateServiceWorker(true);
  };

  return (
    <PwaContext.Provider
      value={{
        isOnline,
        needRefresh,
        canInstall: !!installPrompt,
        triggerInstall,
        reloadApp,
        dismissRefresh: () => setNeedRefresh(false)
      }}
    >
      {children}
    </PwaContext.Provider>
  );
};

export const usePwa = () => {
  const context = useContext(PwaContext);
  if (!context) throw new Error('usePwa debe usarse dentro de un PwaProvider');
  return context;
};
