import 'package:flutter/material.dart';
import '../../services/audio_engine.dart';
import '../theme/terminal_theme.dart';

class SettingsScreen extends StatefulWidget {
  final AudioEngine engine;

  const SettingsScreen({super.key, required this.engine});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late int minBpm;
  late int maxBpm;
  late String responseMode;
  late bool autoCalibrate;

  @override
  void initState() {
    super.initState();
    final s = widget.engine.settings;
    minBpm = s.minBpm;
    maxBpm = s.maxBpm;
    responseMode = s.responseMode;
    autoCalibrate = s.autoCalibrate;
  }

  void _save() {
    final s = widget.engine.settings;
    s.minBpm = minBpm;
    s.maxBpm = maxBpm;
    s.responseMode = responseMode;
    s.autoCalibrate = autoCalibrate;
    s.save();
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final hasManual = widget.engine.settings.calibration != null;

    return Scaffold(
      appBar: AppBar(
        title: const Text('CONFIGURACIÓN DEL INSTRUMENTO'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16.0),
        children: [
          _buildSectionHeader('RITMO Y RANGO DE TEMPO'),
          ListTile(
            title: const Text('Rango BPM mínimo'),
            trailing: DropdownButton<int>(
              value: minBpm,
              dropdownColor: TerminalTheme.surface,
              items: [40, 50, 60, 70, 80].map((v) => DropdownMenuItem(value: v, child: Text('$v BPM'))).toList(),
              onChanged: (v) => setState(() => minBpm = v!),
            ),
          ),
          ListTile(
            title: const Text('Rango BPM máximo'),
            trailing: DropdownButton<int>(
              value: maxBpm,
              dropdownColor: TerminalTheme.surface,
              items: [180, 200, 220, 240, 260].map((v) => DropdownMenuItem(value: v, child: Text('$v BPM'))).toList(),
              onChanged: (v) => setState(() => maxBpm = v!),
            ),
          ),
          const Divider(color: TerminalTheme.border),

          _buildSectionHeader('CALIBRACIÓN SPL ACÚSTICA'),
          SwitchListTile(
            title: const Text('Auto-calibración dBA'),
            subtitle: Text(
              autoCalibrate
                  ? 'Activa (estimación adaptativa según ruido de fondo)'
                  : 'Desactivada (muestra nivel en dBFS)',
              style: const TextStyle(fontSize: 12, color: TerminalTheme.textMuted),
            ),
            value: autoCalibrate,
            activeColor: TerminalTheme.green,
            onChanged: (v) => setState(() => autoCalibrate = v),
          ),
          ListTile(
            title: const Text('Estado de referencia'),
            subtitle: Text(
              hasManual
                  ? 'Calibrado manual guardado (${widget.engine.settings.calibration!.offset.toStringAsFixed(1)} dB)'
                  : 'Estimación acústica automática (~${widget.engine.state.autoOffset.toStringAsFixed(1)} dB)',
              style: const TextStyle(color: TerminalTheme.green, fontSize: 12),
            ),
            trailing: hasManual
                ? TextButton(
                    onPressed: () {
                      setState(() {
                        widget.engine.settings.calibration = null;
                        widget.engine.settings.save();
                      });
                    },
                    child: const Text('ELIMINAR', style: TextStyle(color: TerminalTheme.red)),
                  )
                : null,
          ),
          const Divider(color: TerminalTheme.border),

          _buildSectionHeader('RESPUESTA TEMPORAL'),
          RadioListTile<String>(
            title: const Text('FAST (125 ms) — Rápida / Picos'),
            value: 'FAST',
            groupValue: responseMode,
            activeColor: TerminalTheme.green,
            onChanged: (v) => setState(() => responseMode = v!),
          ),
          RadioListTile<String>(
            title: const Text('SLOW (1.0 s) — Lenta / Promedio estable'),
            value: 'SLOW',
            groupValue: responseMode,
            activeColor: TerminalTheme.green,
            onChanged: (v) => setState(() => responseMode = v!),
          ),
          const SizedBox(height: 32),

          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: TerminalTheme.green,
              foregroundColor: TerminalTheme.background,
              minimumSize: const Size.fromHeight(50),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(2)),
            ),
            onPressed: _save,
            child: const Text('GUARDAR AJUSTES ↵', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1.2)),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Text(
        title,
        style: const TextStyle(
          color: TerminalTheme.textMuted,
          fontSize: 12,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.2,
        ),
      ),
    );
  }
}
