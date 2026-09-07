export const FLOOR = -100;
export function dbfs(amplitude: number): number {
  return Number.isFinite(amplitude) && amplitude > 0
    ? Math.max(FLOOR, 20 * Math.log10(amplitude))
    : FLOOR;
}
export function rms(samples: ArrayLike<number>): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = Number.isFinite(samples[i]) ? samples[i] : 0;
    sum += s * s;
  }
  return Math.sqrt(sum / samples.length);
}
export function peak(samples: ArrayLike<number>): number {
  let value = 0;
  for (let i = 0; i < samples.length; i++)
    if (Number.isFinite(samples[i])) value = Math.max(value, Math.abs(samples[i]));
  return value;
}
export function clipping(samples: ArrayLike<number>, threshold = 0.999): number {
  let count = 0;
  for (let i = 0; i < samples.length; i++)
    if (Number.isFinite(samples[i]) && Math.abs(samples[i]) >= threshold) count++;
  return count;
}
