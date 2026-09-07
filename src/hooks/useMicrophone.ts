import { useEffect, useState } from 'react';
import { audioEngine } from '../state/audioStore';
export function useMicrophone(running: boolean) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void audioEngine.microphone
        .devices()
        .then((d) => {
          if (active) setDevices(d);
        })
        .catch(() => {});
    };
    refresh();
    navigator.mediaDevices?.addEventListener('devicechange', refresh);
    return () => {
      active = false;
      navigator.mediaDevices?.removeEventListener('devicechange', refresh);
    };
  }, [running]);
  return devices;
}
