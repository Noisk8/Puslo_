import { useCallback, useEffect, useState } from 'react';
export function useFullscreen() {
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const update = () => setActive(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else setError('Pantalla completa no disponible en este navegador.');
    } catch {
      setError('No se pudo activar la pantalla completa.');
    }
  }, []);
  return { active, toggle, error };
}
