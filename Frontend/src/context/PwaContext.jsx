import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const PwaContext = createContext(null);

export const PwaProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState(null);
  
  const checkIsMobileOrPWA = () => {
    if (typeof window === 'undefined') return false;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    return isStandalone || window.innerWidth < 768;
  };

  const [isPWA, setIsPWA] = useState(checkIsMobileOrPWA);

  // Utiliza el helper reactivo de vite-plugin-pwa
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // SW Registrado
    },
    onRegisterError(error) {
      // Error al registrar SW
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

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleResize = () => setIsPWA(checkIsMobileOrPWA());
    const handler = (e) => setIsPWA(e.matches || window.innerWidth < 768);

    mediaQuery.addEventListener('change', handler);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      mediaQuery.removeEventListener('change', handler);
      window.removeEventListener('resize', handleResize);
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
        isPWA,
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
