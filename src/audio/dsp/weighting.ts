export type Weighting = 'A' | 'C' | 'Z';

/** Digital weighting filters used for indicative readings only. */
export class WeightingFilter {
  private sections: { b0: number; b1: number; b2: number; a1: number; a2: number; z1: number; z2: number }[];
  constructor(readonly weighting: Weighting, rate: number) {
    if (!Number.isFinite(rate) || rate < 8000) throw new Error('Unsupported sample rate');
    if (weighting === 'Z') {
      this.sections = [];
      return;
    }
    const poles = weighting === 'A'
      ? [20.598997, 20.598997, 107.65265, 737.86223, 12194.217, 12194.217]
      : [20.598997, 20.598997, 107.65265, 12194.217, 12194.217];
    const pole = (f: number) => (2 * rate - 2 * Math.PI * f) / (2 * rate + 2 * Math.PI * f);
    const p = poles.map(pole);
    this.sections = [];
    for (let i = 0; i < p.length; i += 2) {
      this.sections.push({ b0: 1, b1: i === (weighting === 'A' ? 4 : 2) ? 2 : -2, b2: 1, a1: -(p[i] + p[i + 1]), a2: p[i] * p[i + 1], z1: 0, z2: 0 });
    }
    const w = (2 * Math.PI * 1000) / rate;
    const response = (b0: number, b1: number, b2: number, a1: number, a2: number) => {
      const n = (b0 + b1 * Math.cos(w) + b2 * Math.cos(2 * w)) ** 2 + (b1 * Math.sin(w) + b2 * Math.sin(2 * w)) ** 2;
      const d = (1 + a1 * Math.cos(w) + a2 * Math.cos(2 * w)) ** 2 + (a1 * Math.sin(w) + a2 * Math.sin(2 * w)) ** 2;
      return Math.sqrt(n / d);
    };
    const gain = this.sections.reduce((v, s) => v * response(s.b0, s.b1, s.b2, s.a1, s.a2), 1);
    this.sections[0].b0 /= gain; this.sections[0].b1 /= gain; this.sections[0].b2 /= gain;
  }
  process(input: number) {
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

export const weightingBand = (w: Weighting) => `L${w}`;
