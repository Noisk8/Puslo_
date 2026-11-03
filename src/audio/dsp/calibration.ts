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

/**
 * AutoCalibrator:
 * Proporciona calibración acústica automática (dBA est.) sin requerir sonómetro físico.
 *
 * Combina la sensibilidad nominal de micrófonos estándar con el seguimiento del umbral
 * de ruido ambiental en reposo (~38 dBA para espacios interiores silenciosos).
 */
export class AutoCalibrator {
  private currentOffset = 100.0;
  private floorDbfs = -62.0;

  constructor(initialOffset = 100.0) {
    this.currentOffset = initialOffset;
  }

  get offset(): number {
    return Math.round(this.currentOffset * 10) / 10;
  }

  update(aDbfs: number, dtSeconds: number): number {
    if (!Number.isFinite(aDbfs) || aDbfs < -95 || aDbfs > 0) return this.offset;

    // Seguimiento asimétrico del piso de ruido ambiental
    if (aDbfs < this.floorDbfs) {
      const alpha = 1 - Math.exp(-dtSeconds / 1.5);
      this.floorDbfs += (aDbfs - this.floorDbfs) * alpha;
    } else {
      const alpha = 1 - Math.exp(-dtSeconds / 30.0);
      this.floorDbfs += (aDbfs - this.floorDbfs) * alpha;
    }

    // El piso ambiental interior típico en silencio está entre 36 y 40 dBA (~38 dBA)
    const targetOffset = Math.max(86, Math.min(116, 38 - this.floorDbfs));
    const convergeAlpha = 1 - Math.exp(-dtSeconds / 8.0);
    this.currentOffset += (targetOffset - this.currentOffset) * convergeAlpha;

    return this.offset;
  }

  reset(offset = 100.0) {
    this.currentOffset = offset;
    this.floorDbfs = -62.0;
  }
}
