import { it, expect } from 'vitest';
import { AWeighting } from '../../src/audio/dsp/weightingA';
import { dbfs, rms } from '../../src/audio/dsp/levels';
import { calibrationOffset, matchesCalibration } from '../../src/audio/dsp/calibration';
for (const rate of [44100, 48000, 96000])
  it(`A-weighting at ${rate} Hz`, () => {
    for (const [frequency, target] of [
      [1000, 0],
      [100, -19.1],
      [31.5, -39.4],
      [4000, 1],
    ]) {
      const filter = new AWeighting(rate);
      const output = new Float32Array(rate);
      for (let i = 0; i < rate * 2; i++) {
        const value = filter.process(Math.sin((2 * Math.PI * frequency * i) / rate));
        if (i >= rate) output[i - rate] = value;
      }
      expect(dbfs(rms(output)) + 3.0103).toBeCloseTo(target, 0);
    }
    const filter = new AWeighting(rate);
    let last = 0;
    for (let i = 0; i < rate; i++) last = filter.process(1);
    expect(Math.abs(last)).toBeLessThan(1e-5);
  });
it('calibration uses energy and rejects unstable, silent or insufficient samples', () => {
  expect(calibrationOffset(94, Array(50).fill(-30))).toBeCloseTo(124);
  expect(() => calibrationOffset(94, [-30])).toThrow();
  expect(() => calibrationOffset(94, Array(50).fill(-100))).toThrow();
  expect(() =>
    calibrationOffset(
      94,
      Array.from({ length: 50 }, (_, i) => (i % 2 ? -10 : -30)),
    ),
  ).toThrow();
  expect(() => calibrationOffset(NaN, Array(50).fill(-30))).toThrow();
  const c = {
    offset: 124,
    date: '2026-09-07',
    deviceId: 'a',
    deviceLabel: 'mic',
    sampleRate: 48000,
    reference: 94,
    weighting: 'A' as const,
  };
  expect(matchesCalibration(c, 'a', 48000, 'mic')).toBe(true);
  expect(matchesCalibration(c, 'b', 48000, 'mic')).toBe(false);
  expect(matchesCalibration(c, 'a', 44100, 'mic')).toBe(false);
});
