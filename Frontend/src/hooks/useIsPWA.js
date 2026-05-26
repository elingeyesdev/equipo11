import { useState, useEffect } from 'react';

/**
 * Hook que detecta si la app se ejecuta en modo PWA standalone (instalada)
 * o en un navegador convencional.
 *
 * @returns {boolean} true si la app corre como PWA instalada
 */
export default function useIsPWA() {
  const [isPWA, setIsPWA] = useState(() => {
    // Evaluación síncrona inicial para evitar flash de layout incorrecto
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');

    const handler = (e) => setIsPWA(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return isPWA;
}
