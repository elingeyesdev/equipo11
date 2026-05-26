import { useState, useEffect } from 'react';

/**
 * Hook que detecta si la app se ejecuta en modo PWA standalone (instalada)
 * o en un navegador convencional.
 *
 * @returns {boolean} true si la app corre como PWA instalada
 */
export default function useIsPWA() {
  const checkIsMobileOrPWA = () => {
    if (typeof window === 'undefined') return false;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    const isMobileScreen = window.innerWidth < 768;
    return isStandalone || isMobileScreen;
  };

  const [isPWA, setIsPWA] = useState(checkIsMobileOrPWA);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    
    const handleResize = () => {
      setIsPWA(checkIsMobileOrPWA());
    };

    const handler = (e) => {
      setIsPWA(e.matches || window.innerWidth < 768);
    };

    mediaQuery.addEventListener('change', handler);
    window.addEventListener('resize', handleResize);

    return () => {
      mediaQuery.removeEventListener('change', handler);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return isPWA;
}
