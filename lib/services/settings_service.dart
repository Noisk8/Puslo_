import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../dsp/calibration.dart';

class SettingsService {
  static const String _key = 'pulso_mobile_settings';

  int minBpm = 40;
  int maxBpm = 220;
  String responseMode = 'SLOW'; // FAST (125ms) o SLOW (1s)
  bool keepAwake = true;
  bool autoCalibrate = true;
  List<double> thresholds = [-24.0, -12.0, -3.0];
  List<double> splThresholds = [80.0, 90.0, 100.0];
  Calibration? calibration;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString(_key);
    if (jsonStr != null) {
      try {
        final data = jsonDecode(jsonStr) as Map<String, dynamic>;
        minBpm = (data['minBpm'] as num?)?.toInt() ?? 40;
        maxBpm = (data['maxBpm'] as num?)?.toInt() ?? 220;
        responseMode = data['responseMode'] as String? ?? 'SLOW';
        keepAwake = data['keepAwake'] as bool? ?? true;
        autoCalibrate = data['autoCalibrate'] as bool? ?? true;
        if (data['calibration'] != null) {
          calibration = Calibration.fromJson(data['calibration'] as Map<String, dynamic>);
        }
      } catch (_) {}
    }
  }

  Future<void> save() async {
    final prefs = await SharedPreferences.getInstance();
    final data = {
      'minBpm': minBpm,
      'maxBpm': maxBpm,
      'responseMode': responseMode,
      'keepAwake': keepAwake,
      'autoCalibrate': autoCalibrate,
      'calibration': calibration?.toJson(),
    };
    await prefs.setString(_key, jsonEncode(data));
  }
}
