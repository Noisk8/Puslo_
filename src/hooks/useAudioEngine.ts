import { useSyncExternalStore } from 'react';
import { audioEngine } from '../state/audioStore';
export function useAudioEngine() {
  return useSyncExternalStore(audioEngine.subscribe, audioEngine.getState);
}
