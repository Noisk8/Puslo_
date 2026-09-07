export interface Calibration {
  offset: number;
  date: string;
  deviceId: string;
  deviceLabel: string;
  sampleRate: number;
  reference: number;
  weighting: 'A';
}
export function calibrationOffset(reference: number, levels: number[]): number {
  if (
    !Number.isFinite(reference) ||
    reference < 30 ||
    reference > 140 ||
    levels.length < 40 ||
    levels.some((x) => !Number.isFinite(x) || x <= -90)
  )
    throw new Error('Se necesitan al menos 4 segundos de señal válida.');
  const average = levels.reduce((a, b) => a + b, 0) / levels.length;
  const deviation = Math.sqrt(levels.reduce((a, b) => a + (b - average) ** 2, 0) / levels.length);
  if (deviation > 1.5)
    throw new Error('La señal varía demasiado. Usa una referencia estable y vuelve a intentar.');
  return (
    reference - 10 * Math.log10(levels.reduce((a, b) => a + 10 ** (b / 10), 0) / levels.length)
  );
}
export function matchesCalibration(
  c: Calibration | null,
  deviceId: string,
  rate: number,
  label: string,
): boolean {
  return (
    !!c &&
    !!deviceId &&
    c.deviceId === deviceId &&
    c.sampleRate === rate &&
    c.deviceLabel === label &&
    c.weighting === 'A'
  );
}
