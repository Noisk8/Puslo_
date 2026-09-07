import { useEffect, useState } from 'react';
export function useWakeLock(enabled: boolean) {
  const [status, setStatus] = useState('');
  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    let disposed = false;
    const request = async () => {
      if (!enabled || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      if (!('wakeLock' in navigator)) {
        setStatus('Pantalla activa no disponible.');
        return;
      }
      try {
        const next = await navigator.wakeLock.request('screen');
        if (disposed) await next.release();
        else {
          lock = next;
          setStatus('Pantalla activa');
        }
      } catch {
        setStatus('No se pudo mantener la pantalla activa.');
      }
    };
    void request();
    document.addEventListener('visibilitychange', request);
    return () => {
      disposed = true;
      void lock?.release();
      document.removeEventListener('visibilitychange', request);
      setStatus('');
    };
  }, [enabled]);
  return status;
}
