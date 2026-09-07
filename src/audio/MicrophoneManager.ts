export class MicrophoneManager {
  async request(deviceId?: string) {
    if (
      !globalThis.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      !globalThis.AudioWorkletNode
    )
      throw new Error('UNSUPPORTED_BROWSER');
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    });
  }
  async devices() {
    return navigator.mediaDevices?.enumerateDevices
      ? (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput')
      : [];
  }
}
export function audioError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'MICROPHONE_PERMISSION_DENIED';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'NO_AUDIO_INPUT';
  if (name === 'NotReadableError') return 'AUDIO_CONTEXT_FAILED';
  return error instanceof Error ? error.message : 'AUDIO_CONTEXT_FAILED';
}
