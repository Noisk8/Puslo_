import type { Calibration } from '../audio/dsp/calibration';
export interface Settings {
  deviceId: string;
  minBpm: number;
  maxBpm: number;
  response: 'FAST' | 'SLOW';
  keepAwake: boolean;
  fullscreen: boolean;
  thresholds: number[];
  splThresholds: number[];
  calibration: Calibration | null;
}
const defaults: Settings = {
  deviceId: '',
  minBpm: 40,
  maxBpm: 220,
  response: 'SLOW',
  keepAwake: false,
  fullscreen: false,
  thresholds: [-24, -12, -3],
  splThresholds: [80, 90, 100],
  calibration: null,
};
export function readSettings(): Settings {
  try {
    const data = JSON.parse(localStorage.getItem('pulso.settings') ?? 'null');
    if (!data) return { ...defaults };
    const c = data.calibration;
    const calibration =
      c &&
      Number.isFinite(c.offset) &&
      Math.abs(c.offset) < 240 &&
      typeof c.date === 'string' &&
      typeof c.deviceId === 'string' &&
      typeof c.deviceLabel === 'string' &&
      Number.isFinite(c.sampleRate) &&
      Number.isFinite(c.reference) &&
      c.weighting === 'A'
        ? c
        : null;
    const validThresholds = (x: unknown, low: number, high: number): x is number[] =>
      Array.isArray(x) &&
      x.length === 3 &&
      x.every((v, i) => Number.isFinite(v) && v >= low && v <= high && (i === 0 || v > x[i - 1]));
    return {
      ...defaults,
      deviceId: typeof data.deviceId === 'string' ? data.deviceId : '',
      minBpm:
        Number.isInteger(data.minBpm) && data.minBpm >= 40 && data.minBpm <= 180 ? data.minBpm : 40,
      maxBpm:
        Number.isInteger(data.maxBpm) &&
        data.maxBpm >= 60 &&
        data.maxBpm <= 250 &&
        data.maxBpm > data.minBpm
          ? data.maxBpm
          : 220,
      response: data.response === 'FAST' ? 'FAST' : 'SLOW',
      keepAwake: data.keepAwake === true,
      fullscreen: data.fullscreen === true,
      thresholds: validThresholds(data.thresholds, -100, 0) ? data.thresholds : defaults.thresholds,
      splThresholds: validThresholds(data.splThresholds, 30, 140)
        ? data.splThresholds
        : defaults.splThresholds,
      calibration,
    };
  } catch {
    return { ...defaults };
  }
}
export function saveSettings(settings: Settings): boolean {
  try {
    localStorage.setItem('pulso.settings', JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
