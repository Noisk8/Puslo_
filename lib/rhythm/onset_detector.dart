import 'dart:math' as math;

/// Detector de transitorios rítmicos (Onsets) basado en flujo de energía espectral
class OnsetDetector {
  double _prevEnergy = 0.0;
  double _threshold = 0.005;
  double _decay = 0.95;

  bool processBlock(List<double> samples) {
    if (samples.isEmpty) return false;
    double currentEnergy = 0.0;
    for (int i = 0; i < samples.length; i++) {
      currentEnergy += samples[i] * samples[i];
    }
    currentEnergy /= samples.length;

    // Incremento súbito de energía (ataque percusivo o golpe de bombo/batería)
    final double diff = math.max(0.0, currentEnergy - _prevEnergy);
    _prevEnergy = currentEnergy;

    final bool isOnset = diff > _threshold && currentEnergy > 1e-4;

    // Umbral adaptativo para no disparar falsos positivos con ruidos sostenidos
    if (isOnset) {
      _threshold = diff * 0.7;
    } else {
      _threshold = math.max(0.002, _threshold * _decay);
    }

    return isOnset;
  }

  void reset() {
    _prevEnergy = 0.0;
    _threshold = 0.005;
  }
}
