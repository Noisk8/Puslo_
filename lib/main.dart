import 'package:flutter/material.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'services/audio_engine.dart';
import 'services/settings_service.dart';
import 'ui/screens/dashboard_screen.dart';
import 'ui/theme/terminal_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final settings = SettingsService();
  await settings.load();

  if (settings.keepAwake) {
    WakelockPlus.enable();
  }

  final audioEngine = AudioEngine(settings);

  runApp(PulsoMobileApp(engine: audioEngine));
}

class PulsoMobileApp extends StatelessWidget {
  final AudioEngine engine;

  const PulsoMobileApp({super.key, required this.engine});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PULSO — BPM + Sound Meter',
      debugShowCheckedModeBanner: false,
      theme: TerminalTheme.darkTheme,
      home: DashboardScreen(engine: engine),
    );
  }
}
