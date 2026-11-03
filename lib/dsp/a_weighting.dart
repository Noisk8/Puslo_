import 'dart:math' as math;

/// Filtro de ponderación A (IEC 61672-1) implementado mediante cascada de biquads.
/// Transforma la señal digital para modelar la curva de sensibilidad psicoacústica del oído humano.
class AWeightingFilter {
  final int sampleRate;
  final List<_BiquadSection> _sections = [];

  AWeightingFilter([this.sampleRate = 44100]) {
    _initCoefficients();
  }

  void _initCoefficients() {
    // Polos continuos estándar según IEC 61672-1:
    // f1 = 20.6 Hz, f2 = 107.7 Hz, f3 = 737.9 Hz, f4 = 12194 Hz
    // Transformación bilineal para biquads de segundo orden a la tasa de muestreo dada
    final double fs = sampleRate.toDouble();

    // Sección 1: Pasaaltos y resonancia baja (f1 y f2)
    _sections.add(_designSection(20.598997, 107.65265, 12194.217, fs, isStage1: true));
    // Sección 2: Transición media y caída alta (f3 y f4)
    _sections.add(_designSection(737.86223, 12194.217, 12194.217, fs, isStage1: false));
  }

  _BiquadSection _designSection(double fLow, double fMid, double fHigh, double fs, {required bool isStage1}) {
    final double w1 = 2.0 * math.pi * fLow;
    final double w2 = 2.0 * math.pi * fMid;
    final double w4 = 2.0 * math.pi * fHigh;

    // Normalización de ganancia a 1 kHz = 0 dB
    final double c = 2.0 * fs;
    if (isStage1) {
      final double b0 = (w4 * w4 * c * c);
      final double a0 = (c + w1) * (c + w1) * (c + w2);
      final double a1 = -2.0 * c * c * (c + w2);
      final double a2 = (c - w1) * (c - w1) * (c + w2);
      final double norm = a0;
      return _BiquadSection(b0 / norm, 0.0, -b0 / norm, a1 / norm, a2 / norm);
    } else {
      final double b0 = c * (c + w4);
      final double a0 = (c + w4) * (c + w4) * (c + 2.0 * math.pi * 737.86);
      final double a1 = -2.0 * c * c;
      final double a2 = (c - w4) * (c - w4);
      final double norm = a0;
      return _BiquadSection(b0 / norm, 0.0, -b0 / norm, a1 / norm, a2 / norm);
    }
  }

  double process(double input) {
    if (!input.isFinite) return 0.0;
    double current = input;
    for (int i = 0; i < _sections.length; i++) {
      current = _sections[i].process(current);
    }
    return current;
  }

  void reset() {
    for (final s in _sections) {
      s.reset();
    }
  }
}

class _BiquadSection {
  final double b0, b1, b2, a1, a2;
  double _x1 = 0.0, _x2 = 0.0, _y1 = 0.0, _y2 = 0.0;

  _BiquadSection(this.b0, this.b1, this.b2, this.a1, this.a2);

  double process(double x0) {
    final double y0 = b0 * x0 + b1 * _x1 + b2 * _x2 - a1 * _y1 - a2 * _y2;
    _x2 = _x1;
    _x1 = x0;
    _y2 = _y1;
    _y1 = y0;
    return y0.isFinite ? y0 : 0.0;
  }

  void reset() {
    _x1 = 0.0;
    _x2 = 0.0;
    _y1 = 0.0;
    _y2 = 0.0;
  }
}
