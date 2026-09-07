/** A-weighting analog poles from IEC 61672, discretized by bilinear transform.
 * Method: https://www.mathworks.com/help/audio/ref/weightingfilter-system-object.html
 * Three second-order sections, four DC zeros and two Nyquist zeros.
 * Gain normalized at 1 kHz for the ACTUAL sample rate. No compliance claim:
 * bilinear warping increasingly attenuates near Nyquist, especially at low rates.
 */
export class AWeighting {
  private sections: {
    b0: number;
    b1: number;
    b2: number;
    a1: number;
    a2: number;
    z1: number;
    z2: number;
  }[];
  constructor(rate: number) {
    if (!Number.isFinite(rate) || rate < 8000) throw new Error('Unsupported sample rate');
    const pole = (f: number) => (2 * rate - 2 * Math.PI * f) / (2 * rate + 2 * Math.PI * f);
    const p = [20.598997, 20.598997, 107.65265, 737.86223, 12194.217, 12194.217].map(pole);
    this.sections = [0, 2, 4].map((i) => ({
      b0: 1,
      b1: i === 4 ? 2 : -2,
      b2: 1,
      a1: -(p[i] + p[i + 1]),
      a2: p[i] * p[i + 1],
      z1: 0,
      z2: 0,
    }));
    const w = (2 * Math.PI * 1000) / rate;
    let magnitude = 1;
    for (const s of this.sections) {
      const power = (a: number, b: number, c: number) =>
        (a + b * Math.cos(w) + c * Math.cos(2 * w)) ** 2 +
        (b * Math.sin(w) + c * Math.sin(2 * w)) ** 2;
      magnitude *= Math.sqrt(power(s.b0, s.b1, s.b2) / power(1, s.a1, s.a2));
    }
    this.sections[0].b0 /= magnitude;
    this.sections[0].b1 /= magnitude;
    this.sections[0].b2 /= magnitude;
  }
  process(input: number): number {
    let x = Number.isFinite(input) ? input : 0;
    for (const s of this.sections) {
      const y = s.b0 * x + s.z1;
      s.z1 = s.b1 * x - s.a1 * y + s.z2;
      s.z2 = s.b2 * x - s.a2 * y;
      x = y;
    }
    return x;
  }
}
