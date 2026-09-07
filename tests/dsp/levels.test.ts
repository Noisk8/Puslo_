import { describe, it, expect } from 'vitest';
import { rms, dbfs, peak, clipping } from '../../src/audio/dsp/levels';
import { Leq } from '../../src/audio/dsp/leq';
import { EnergySmoother } from '../../src/audio/dsp/smoothing';
describe('digital signal', () => {
  it('handles silence, invalid values and full scale', () => {
    expect(rms([])).toBe(0);
    expect(rms([0, 0])).toBe(0);
    expect(rms([1, -1])).toBe(1);
    expect(dbfs(0)).toBe(-100);
    expect(dbfs(NaN)).toBe(-100);
    expect(dbfs(Infinity)).toBe(-100);
    expect(dbfs(1)).toBe(0);
    expect(peak([NaN, -0.9, 0.2])).toBe(0.9);
    expect(clipping([1, -1, 0.5, NaN])).toBe(2);
  });
  it('measures sine RMS', () => {
    const s = Float32Array.from({ length: 48000 }, (_, i) =>
      Math.sin((2 * Math.PI * 1000 * i) / 48000),
    );
    expect(dbfs(rms(s))).toBeCloseTo(-3.0103, 3);
  });
  it('integrates energy and trims rolling window', () => {
    const l = new Leq(2);
    l.add(1, 1);
    l.add(0.01, 1);
    expect(l.level).toBeCloseTo(10 * Math.log10(0.505));
    l.add(0.01, 2);
    expect(l.level).toBeCloseTo(-20);
    expect(l.duration).toBe(2);
  });
  it('smooths energy by elapsed time', () => {
    const s = new EnergySmoother();
    s.update(0, 0.1, 1);
    expect(s.update(1, 1, 1)).toBeCloseTo(1 - Math.exp(-1));
    expect(s.update(NaN, 1, 1)).toBeCloseTo(1 - Math.exp(-1));
  });
});
