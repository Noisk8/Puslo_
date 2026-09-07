import { it, expect } from 'vitest';
import { normalizeTempo, tempoCandidates } from '../../src/audio/rhythm/tempoNormalization';
import { TempoTracker } from '../../src/audio/rhythm/TempoTracker';
it('resolves octave candidates with historical anchor, preserves slow music', () => {
  expect(normalizeTempo(62, 124)).toBe(124);
  expect(normalizeTempo(248, 124)).toBe(124);
  expect(normalizeTempo(62, null)).toBe(62);
  expect(tempoCandidates(NaN)).toEqual([]);
  expect(normalizeTempo(0, null)).toBe(null);
});
it('stabilizes octave jumps, bounds history and changes when evidence persists', () => {
  const t = new TempoTracker();
  for (const bpm of [124, 124.2, 62, 248, 123.8]) t.update(bpm, 3, 40, 220);
  expect(t.stable).toBeCloseTo(124, 0);
  for (let i = 0; i < 10; i++) t.update(140, 3, 40, 220);
  expect(t.stable).toBeCloseTo(140);
  expect(t.history.length).toBe(6);
  expect(t.update(NaN, 0, 40, 220).confidence).toBe(0);
});
