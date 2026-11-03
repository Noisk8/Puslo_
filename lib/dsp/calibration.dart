import 'dart:math' as math;

class Calibration {
  final double offset;
  final String date;
  final String deviceId;
  final String deviceLabel;
  final int sampleRate;
  final double reference;
  final String weighting;

  Calibration({
    required this.offset,
    required this.date,
    required this.deviceId,
    required this.deviceLabel,
    required this.sampleRate,
    required this.reference,
    this.weighting = 'A',
  });

  Map<String, dynamic> toJson() => {
        'offset': offset,
        'date': date,
        'deviceId': deviceId,
        'deviceLabel': deviceLabel,
        'sampleRate': sampleRate,
        'reference': reference,
        'weighting': weighting,
      };

  factory Calibration.fromJson(Map<String, dynamic> json) => Calibration(
        offset: (json['offset'] as num).toDouble(),
        date: json['date'] as String,
        deviceId: json['deviceId'] as String,
        deviceLabel: json['deviceLabel'] as String,
        sampleRate: (json['sampleRate'] as num).toInt(),
        reference: (json['reference'] as num).toDouble(),
        weighting: json['weighting'] as String? ?? 'A',
      );
}

/// AutoCalibrator acústico para dispositivos móviles:
/// Proporciona calibración continua en dBA sin requerir sonómetro físico de referencia.
class AutoCalibrator {
  double _currentOffset = 100.0;
  double _floorDbfs = -62.0;

  AutoCalibrator([double initialOffset = 100.0]) {
    _currentOffset = initialOffset;
  }

  double get offset => (_currentOffset * 10).round() / 10;

  double update(double aDbfs, double dtSeconds) {
    if (!aDbfs.isFinite || aDbfs < -95.0 || aDbfs > 0.0) return offset;

    // Seguimiento asimétrico del piso de ruido ambiental
    if (aDbfs < _floorDbfs) {
      final double alpha = 1.0 - math.exp(-dtSeconds / 1.5);
      _floorDbfs += (aDbfs - _floorDbfs) * alpha;
    } else {
      final double alpha = 1.0 - math.exp(-dtSeconds / 30.0);
      _floorDbfs += (aDbfs - _floorDbfs) * alpha;
    }

    // Nivel ambiental silencioso típico en interiores: ~38 dBA
    final double targetOffset = math.max(86.0, math.min(116.0, 38.0 - _floorDbfs));
    final double convergeAlpha = 1.0 - math.exp(-dtSeconds / 8.0);
    _currentOffset += (targetOffset - _currentOffset) * convergeAlpha;

    return offset;
  }

  void reset([double offset = 100.0]) {
    _currentOffset = offset;
    _floorDbfs = -62.0;
  }
}
