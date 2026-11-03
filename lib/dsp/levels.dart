import 'dart:math' as math;

const double floorDbfs = -100.0;

double dbfs(double amplitude) {
  if (amplitude.isNaN || amplitude.isInfinite || amplitude <= 0) {
    return floorDbfs;
  }
  return math.max(floorDbfs, 20.0 * (math.log(amplitude) / math.ln10));
}

double calculateRms(List<double> samples) {
  if (samples.isEmpty) return 0.0;
  double sum = 0.0;
  for (int i = 0; i < samples.length; i++) {
    final s = samples[i].isFinite ? samples[i] : 0.0;
    sum += s * s;
  }
  return math.sqrt(sum / samples.length);
}

double calculatePeak(List<double> samples) {
  double value = 0.0;
  for (int i = 0; i < samples.length; i++) {
    final s = samples[i];
    if (s.isFinite) {
      final abs = s.abs();
      if (abs > value) value = abs;
    }
  }
  return value;
}

int countClipping(List<double> samples, [double threshold = 0.999]) {
  int count = 0;
  for (int i = 0; i < samples.length; i++) {
    final s = samples[i];
    if (s.isFinite && s.abs() >= threshold) {
      count++;
    }
  }
  return count;
}
