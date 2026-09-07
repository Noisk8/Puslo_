import { it, expect } from 'vitest';
import { resample } from '../../src/audio/dsp/resample';
import { rms, dbfs } from '../../src/audio/dsp/levels';
it('preserves 1kHz level and duration, suppresses aliasing', () => {
  for (const rate of [48000, 96000]) {
    const sine = (hz: number) =>
      Float32Array.from({ length: rate }, (_, i) => Math.sin((2 * Math.PI * hz * i) / rate));
    const out = resample(sine(1000), rate);
    expect(out.length).toBe(44100);
    expect(dbfs(rms(out.subarray(100, -100)))).toBeCloseTo(-3.0103, 1);
    expect(
      dbfs(rms(resample(sine(rate === 48000 ? 23500 : 30000), rate).subarray(100, -100))),
    ).toBeLessThan(-40);
  }
});
