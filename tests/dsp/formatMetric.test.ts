import { describe, expect, it } from 'vitest';
import { formatMetric } from '../../src/audio/dsp/formatMetric';
describe('formatMetric', () => {
  it('always carries weighting and time constant', () => {
    expect(formatMetric(42.34, 'A', 'F', true)).toBe('42.3 dBA (AF)');
    expect(formatMetric(-12, 'Z', 'eq', false)).toBe('-12.0 dBFS (Zeq)');
    expect(formatMetric(null, 'C', 'peak', true)).toBe('— dBC (Cpeak)');
  });
});
