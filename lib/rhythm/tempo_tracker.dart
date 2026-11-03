import 'dart:math' as math;

class TempoTracker {
  final List<_BpmPoint> _history = [];
  double? _stable;

  double? get stable => _stable;
  int get historyLength => _history.length;

  TempoResult update(double raw, double confidenceScore, {int min = 40, int max = 220, int ticksCount = 0}) {
    if (!raw.isFinite || raw <= 0) {
      return TempoResult(raw: raw, stable: _stable, confidence: 0.0, candidates: []);
    }

    final double? normalized = _normalizeTempo(raw, _stable, min, max);

    // Ponderación de confianza (incluye arranque rápido con ticks de compás)
    double source = 0.0;
    if (confidenceScore.isFinite && confidenceScore > 0) {
      source = math.max(0.35, confidenceScore / (confidenceScore + 1.0));
    } else if (ticksCount >= 3 && raw >= min && raw <= max) {
      source = math.min(0.65, 0.35 + (ticksCount / 10.0) * 0.3);
    }

    final candidates = _tempoCandidates(raw, min, max);
    if (normalized == null || source < 0.1) {
      return TempoResult(raw: raw, stable: _stable, confidence: 0.0, candidates: candidates);
    }

    _history.add(_BpmPoint(normalized, source));
    if (_history.length > 6) _history.removeAt(0);

    final sorted = List<_BpmPoint>.from(_history)..sort((a, b) => a.bpm.compareTo(b.bpm));
    final double median = sorted[sorted.length ~/ 2].bpm;

    // Rechazo de outliers al 3.5% respecto a la mediana
    final inliers = _history.where((p) => (p.bpm - median).abs() / median < 0.035).toList();
    final activeInliers = inliers.isNotEmpty ? inliers : [_BpmPoint(normalized, source)];

    double totalWeight = 0.0;
    double weightedSum = 0.0;
    for (int i = 0; i < activeInliers.length; i++) {
      final p = activeInliers[i];
      final double recency = 0.75 + 0.25 * ((i + 1) / activeInliers.length);
      final double w = p.confidence * recency;
      weightedSum += p.bpm * w;
      totalWeight += w;
    }

    final double calculated = totalWeight > 0 ? weightedSum / totalWeight : median;
    _stable = (calculated * 10).round() / 10.0; // Precisión a 0.1 BPM

    final double inlierRatio = activeInliers.length / _history.length;
    final double ramp = math.min(1.0, _history.length / 2.0);
    final double finalConfidence = source * inlierRatio * ramp;

    return TempoResult(
      raw: raw,
      stable: _stable,
      confidence: finalConfidence,
      candidates: candidates,
    );
  }

  void reset() {
    _history.clear();
    _stable = null;
  }

  List<double> _tempoCandidates(double raw, int min, int max) {
    if (!raw.isFinite || raw <= 0) return [];
    return [raw / 4.0, raw / 2.0, raw, raw * 2.0, raw * 4.0]
        .where((x) => x >= min && x <= max)
        .toList();
  }

  double? _normalizeTempo(double raw, double? previous, int min, int max) {
    final candidates = _tempoCandidates(raw, min, max);
    if (candidates.isEmpty) return null;
    final double target = previous ?? raw;
    candidates.sort((a, b) =>
        (math.log(a / target)).abs().compareTo((math.log(b / target)).abs()));
    return candidates.first;
  }
}

class _BpmPoint {
  final double bpm;
  final double confidence;
  _BpmPoint(this.bpm, this.confidence);
}

class TempoResult {
  final double raw;
  final double? stable;
  final double confidence;
  final List<double> candidates;

  TempoResult({
    required this.raw,
    required this.stable,
    required this.confidence,
    required this.candidates,
  });
}
