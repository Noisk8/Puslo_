import { normalizeTempo, tempoCandidates } from './tempoNormalization';

export class TempoTracker {
  history: { bpm: number; confidence: number }[] = [];
  stable: number | null = null;

  update(raw: number, essentiaConfidence: number, min: number, max: number, ticksCount = 0) {
    if (!Number.isFinite(raw) || raw <= 0) {
      return {
        raw,
        stable: this.stable,
        confidence: 0,
        candidates: [],
      };
    }

    const normalized = normalizeTempo(raw, this.stable, min, max);

    // Essentia multifeature confidence is not a standard probability.
    // On short warmup windows (3-5s), Essentia's confidence is often 0 even when raw BPM is clean.
    let source = 0;
    if (Number.isFinite(essentiaConfidence) && essentiaConfidence > 0) {
      source = Math.max(0.35, essentiaConfidence / (essentiaConfidence + 1));
    } else if (ticksCount >= 3 && raw >= min && raw <= max) {
      // Early warmup confidence from detected rhythmic beat ticks
      source = Math.min(0.65, 0.35 + (ticksCount / 10) * 0.3);
    }

    if (normalized === null || source < 0.1) {
      return {
        raw,
        stable: this.stable,
        confidence: 0,
        candidates: tempoCandidates(raw, min, max),
      };
    }

    this.history.push({ bpm: normalized, confidence: source });
    if (this.history.length > 6) this.history.shift();

    const sorted = [...this.history].sort((a, b) => a.bpm - b.bpm);
    const median = sorted[Math.floor(sorted.length / 2)].bpm;

    // Reject outliers deviating > 3.5% from median
    const inliers = this.history.filter((x) => Math.abs(x.bpm - median) / median < 0.035);
    const activeInliers = inliers.length > 0 ? inliers : [{ bpm: normalized, confidence: source }];

    // Weight inliers by confidence and recency for ultra-precise stabilization
    let totalWeight = 0;
    let weightedBpmSum = 0;
    for (let i = 0; i < activeInliers.length; i++) {
      const item = activeInliers[i];
      const recency = 0.75 + 0.25 * ((i + 1) / activeInliers.length);
      const w = item.confidence * recency;
      weightedBpmSum += item.bpm * w;
      totalWeight += w;
    }

    const calculatedStable = totalWeight > 0 ? weightedBpmSum / totalWeight : median;
    this.stable = Math.round(calculatedStable * 10) / 10;

    // Rapid confidence lock: ramps to full in 2 consistent measurements
    const inlierRatio = activeInliers.length / this.history.length;
    const ramp = Math.min(1, this.history.length / 2);
    const confidence = source * inlierRatio * ramp;

    return {
      raw,
      stable: this.stable,
      confidence,
      candidates: tempoCandidates(raw, min, max),
    };
  }
}
