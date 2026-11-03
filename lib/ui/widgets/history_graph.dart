import 'package:flutter/material.dart';
import '../../services/audio_engine.dart';
import '../theme/terminal_theme.dart';

class HistoryGraphWidget extends StatelessWidget {
  final List<HistoryEntry> history;
  final bool isCalibrated;

  const HistoryGraphWidget({
    super.key,
    required this.history,
    required this.isCalibrated,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 120,
      decoration: BoxDecoration(
        color: TerminalTheme.surface,
        border: Border.all(color: TerminalTheme.border),
        borderRadius: BorderRadius.circular(2),
      ),
      child: CustomPaint(
        painter: _GraphPainter(
          history: history,
          isCalibrated: isCalibrated,
        ),
        size: Size.infinite,
      ),
    );
  }
}

class _GraphPainter extends CustomPainter {
  final List<HistoryEntry> history;
  final bool isCalibrated;

  _GraphPainter({
    required this.history,
    required this.isCalibrated,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (history.isEmpty) return;

    final double minVal = isCalibrated ? 35.0 : -80.0;
    final double maxVal = isCalibrated ? 115.0 : 0.0;

    // Dibujar rejilla tenue de terminal
    final gridPaint = Paint()
      ..color = TerminalTheme.border.withOpacity(0.4)
      ..strokeWidth = 1.0;

    for (int i = 1; i <= 3; i++) {
      final double y = size.height * (i / 4.0);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    // Dibujar línea continua de nivel acústico
    final path = Path();
    final linePaint = Paint()
      ..color = TerminalTheme.green
      ..strokeWidth = 1.8
      ..style = PaintingStyle.stroke;

    final int count = history.length;
    final double step = size.width / (count > 1 ? count - 1 : 1);

    for (int i = 0; i < count; i++) {
      final val = isCalibrated ? (history[i].dba ?? minVal) : history[i].dbfs;
      final double clamped = val.clamp(minVal, maxVal);
      final double norm = (clamped - minVal) / (maxVal - minVal);
      final double x = i * step;
      final double y = size.height * (1.0 - norm);

      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }

    canvas.drawPath(path, linePaint);
  }

  @override
  bool shouldRepaint(covariant _GraphPainter oldDelegate) => true;
}
