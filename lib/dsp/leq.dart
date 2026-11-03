import 'dart:math' as math;

class _LeqSlice {
  final double energy;
  final double duration;
  _LeqSlice(this.energy, this.duration);
}

/// Integrador de nivel sonoro continuo equivalente (LAeq / LEQ) con ventana móvil de 60 segundos
class LeqIntegrator {
  final double windowSeconds;
  final List<_LeqSlice> _slices = [];
  double _totalEnergy = 0.0;
  double _totalDuration = 0.0;

  LeqIntegrator({this.windowSeconds = 60.0});

  double get duration => _totalDuration;

  double get level {
    if (_totalDuration <= 0.0 || _totalEnergy <= 0.0) return -100.0;
    final double meanEnergy = _totalEnergy / _totalDuration;
    if (meanEnergy <= 0.0) return -100.0;
    return 10.0 * (math.log(meanEnergy) / math.ln10);
  }

  void add(double energy, double duration) {
    if (!energy.isFinite || !duration.isFinite || duration <= 0) return;
    _slices.add(_LeqSlice(energy * duration, duration));
    _totalEnergy += energy * duration;
    _totalDuration += duration;

    while (_totalDuration > windowSeconds && _slices.isNotEmpty) {
      final first = _slices.first;
      final double excess = _totalDuration - windowSeconds;
      if (first.duration <= excess) {
        _totalEnergy -= first.energy;
        _totalDuration -= first.duration;
        _slices.removeAt(0);
      } else {
        final double fraction = excess / first.duration;
        _totalEnergy -= first.energy * fraction;
        _totalDuration -= excess;
        _slices[0] = _LeqSlice(first.energy * (1.0 - fraction), first.duration - excess);
        break;
      }
    }
  }

  void reset() {
    _slices.clear();
    _totalEnergy = 0.0;
    _totalDuration = 0.0;
  }
}
