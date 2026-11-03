import 'package:flutter/material.dart';
import '../theme/terminal_theme.dart';

class MeterBar extends StatelessWidget {
  final double value;
  final double min;
  final double max;
  final int totalSegments;

  const MeterBar({
    super.key,
    required this.value,
    this.min = 30.0,
    this.max = 120.0,
    this.totalSegments = 48,
  });

  @override
  Widget build(BuildContext context) {
    final double clamped = value.clamp(min, max);
    final double fraction = (clamped - min) / (max - min);
    final int activeCount = (fraction * totalSegments).round();

    return LayoutBuilder(
      builder: (context, constraints) {
        return Row(
          children: List.generate(totalSegments, (i) {
            final bool isActive = i < activeCount;
            Color color;
            if (i > 42) {
              color = isActive ? TerminalTheme.red : TerminalTheme.red.withOpacity(0.15);
            } else if (i > 32) {
              color = isActive ? TerminalTheme.amber : TerminalTheme.amber.withOpacity(0.15);
            } else {
              color = isActive ? TerminalTheme.green : TerminalTheme.greenDim.withOpacity(0.25);
            }

            return Expanded(
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 1.0),
                height: 18.0,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(1.0),
                ),
              ),
            );
          }),
        );
      },
    );
  }
}
