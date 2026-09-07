import { normalizeTempo, tempoCandidates } from './tempoNormalization';
export class TempoTracker {
  history: { bpm: number; confidence: number }[] = [];
  stable: number | null = null;
  update(raw: number, essentiaConfidence: number, min: number, max: number) {
    const normalized = normalizeTempo(raw, this.stable, min, max);
    // Essentia multifeature confidence is not a probability. Saturate c/(c+1),
    // then multiply by consistency and observed history length. Heuristic UI score.
    const source = Number.isFinite(essentiaConfidence)
      ? Math.max(0, essentiaConfidence) / (Math.max(0, essentiaConfidence) + 1)
      : 0;
    if (normalized === null || source < 0.1)
      return {
        raw,
        stable: this.stable,
        confidence: 0,
        candidates: tempoCandidates(raw, min, max),
      };
    this.history.push({ bpm: normalized, confidence: source });
    if (this.history.length > 6) this.history.shift();
    const sorted = [...this.history].sort((a, b) => a.bpm - b.bpm);
    const median = sorted[Math.floor(sorted.length / 2)].bpm;
    const inliers = this.history.filter((x) => Math.abs(x.bpm - median) / median < 0.04);
    this.stable =
      inliers.reduce((s, x) => s + x.bpm * x.confidence, 0) /
      inliers.reduce((s, x) => s + x.confidence, 0);
    const confidence =
      source * (inliers.length / this.history.length) * Math.min(1, this.history.length / 3);
    return { raw, stable: this.stable, confidence, candidates: tempoCandidates(raw, min, max) };
  }
}
