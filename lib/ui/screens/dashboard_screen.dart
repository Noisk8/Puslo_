import 'package:flutter/material.dart';
import '../../services/audio_engine.dart';
import '../theme/terminal_theme.dart';
import '../widgets/meter_bar.dart';
import '../widgets/history_graph.dart';
import 'settings_screen.dart';

class DashboardScreen extends StatelessWidget {
  final AudioEngine engine;

  const DashboardScreen({super.key, required this.engine});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: engine,
      builder: (context, _) {
        final state = engine.state;
        final bool isCalibrated = state.isCalibrated;
        final double displayValue = isCalibrated ? (state.dba ?? 38.0) : state.dbfs;
        final String unit = isCalibrated
            ? (state.calibrationMode == 'manual' ? 'dBA cal.' : 'dBA auto')
            : 'dBFS';

        return Scaffold(
          appBar: AppBar(
            title: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: state.isRunning ? TerminalTheme.green : TerminalTheme.textMuted,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Text(state.isRunning ? 'PULSO — SEÑAL EN VIVO' : 'PULSO — EN ESPERA'),
              ],
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.settings, color: TerminalTheme.green),
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => SettingsScreen(engine: engine),
                    ),
                  );
                },
              ),
            ],
          ),
          body: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Subtítulo técnico
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'REALTIME PRO ANALYSIS',
                        style: TextStyle(color: TerminalTheme.textMuted, fontSize: 11, letterSpacing: 1),
                      ),
                      Text(
                        state.rhythmStatus.toUpperCase(),
                        style: TextStyle(color: TerminalTheme.green, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // PANEL 1: TEMPO (BPM)
                  _buildPanel(
                    title: '01 — TEMPO / RHYTHM',
                    badge: state.bpmConfidence > 0.25 ? 'SYNC LOCK' : 'SCANNING',
                    badgeColor: state.bpmConfidence > 0.25 ? TerminalTheme.green : TerminalTheme.amber,
                    content: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              state.bpm != null ? state.bpm!.toStringAsFixed(1) : '— — —',
                              style: TextStyle(
                                fontSize: 54,
                                fontWeight: FontWeight.bold,
                                color: state.isRunning ? TerminalTheme.textLight : TerminalTheme.textMuted,
                                letterSpacing: 2,
                              ),
                            ),
                            const SizedBox(width: 12),
                            const Text(
                              'BPM',
                              style: TextStyle(fontSize: 16, color: TerminalTheme.green, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            // Indicador de golpe rítmico (Beat Pulse)
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 120),
                              width: 14,
                              height: 14,
                              decoration: BoxDecoration(
                                color: state.isBeatActive ? TerminalTheme.green : TerminalTheme.surface,
                                border: Border.all(color: TerminalTheme.green),
                                shape: BoxShape.circle,
                                boxShadow: state.isBeatActive
                                    ? [BoxShadow(color: TerminalTheme.green.withOpacity(0.6), blurRadius: 6)]
                                    : [],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'BEAT PULSE (${state.beatMode.toUpperCase()})',
                              style: TextStyle(color: TerminalTheme.textMuted, fontSize: 12),
                            ),
                            const Spacer(),
                            Text(
                              'CONF: ${(state.bpmConfidence * 100).toInt()}%',
                              style: TextStyle(
                                color: state.bpmConfidence > 0.4 ? TerminalTheme.green : TerminalTheme.textMuted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // PANEL 2: SOUND PRESSURE (dBA)
                  _buildPanel(
                    title: '02 — SOUND LEVEL / SPL',
                    badge: isCalibrated
                        ? (state.calibrationMode == 'manual' ? 'A / CALIBRADO' : 'A / AUTO-CAL')
                        : 'SPL SIN CALIBRAR',
                    badgeColor: isCalibrated ? TerminalTheme.green : TerminalTheme.amber,
                    content: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              state.isRunning ? displayValue.toStringAsFixed(1) : '— —',
                              style: TextStyle(
                                fontSize: 54,
                                fontWeight: FontWeight.bold,
                                color: state.isRunning ? TerminalTheme.textLight : TerminalTheme.textMuted,
                                letterSpacing: 2,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              unit,
                              style: TextStyle(
                                fontSize: 16,
                                color: isCalibrated ? TerminalTheme.green : TerminalTheme.amber,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        MeterBar(
                          value: displayValue,
                          min: isCalibrated ? 35.0 : -80.0,
                          max: isCalibrated ? 115.0 : 0.0,
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              state.isClipping ? '■ INPUT CLIPPING' : '□ NORMAL',
                              style: TextStyle(
                                color: state.isClipping ? TerminalTheme.red : TerminalTheme.textMuted,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              '${engine.settings.responseMode} RESPONSE',
                              style: TextStyle(color: TerminalTheme.textMuted, fontSize: 11),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // PANEL 3: MÉTRICAS LEQ Y HISTORIAL
                  Row(
                    children: [
                      Expanded(
                        child: _buildMetricBox(
                          label: 'LAeq 1 MIN',
                          value: state.laeq1m != null ? '${state.laeq1m!.toStringAsFixed(1)} dBA' : '— —',
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildMetricBox(
                          label: 'MAX SESIÓN',
                          value: state.maxLevel != null
                              ? '${state.maxLevel!.toStringAsFixed(1)} ${isCalibrated ? "dBA" : "dBFS"}'
                              : '— —',
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // GRÁFICO TEMPORAL EN VIVO
                  HistoryGraphWidget(
                    history: state.history,
                    isCalibrated: isCalibrated,
                  ),

                  const SizedBox(height: 24),

                  // BOTÓN INICIAR / DETENER
                  SizedBox(
                    height: 54,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: state.isRunning ? TerminalTheme.red : TerminalTheme.green,
                        foregroundColor: TerminalTheme.background,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(2)),
                      ),
                      onPressed: () {
                        if (state.isRunning) {
                          engine.stop();
                        } else {
                          engine.start();
                        }
                      },
                      child: Text(
                        state.isRunning ? '■ DETENER MONITOREO' : '● INICIAR MICRÓFONO',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.5,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildPanel({
    required String title,
    required String badge,
    required Color badgeColor,
    required Widget content,
  }) {
    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: TerminalTheme.surface,
        border: Border.all(color: TerminalTheme.border),
        borderRadius: BorderRadius.circular(2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(fontSize: 12, color: TerminalTheme.textMuted, fontWeight: FontWeight.bold)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  border: Border.all(color: badgeColor),
                  borderRadius: BorderRadius.circular(2),
                ),
                child: Text(badge, style: TextStyle(color: badgeColor, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          content,
        ],
      ),
    );
  }

  Widget _buildMetricBox({required String label, required String value}) {
    return Container(
      padding: const EdgeInsets.all(12.0),
      decoration: BoxDecoration(
        color: TerminalTheme.surface,
        border: Border.all(color: TerminalTheme.border),
        borderRadius: BorderRadius.circular(2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: TerminalTheme.textMuted)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 18, color: TerminalTheme.textLight, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

