import 'package:flutter/material.dart';

class TerminalTheme {
  static const Color background = Color(0xFF141713);
  static const Color surface = Color(0xFF1B201A);
  static const Color border = Color(0xFF2C362B);

  static const Color green = Color(0xFF5AFF64);
  static const Color greenDim = Color(0xFF2E6333);
  static const Color amber = Color(0xFFFFB84D);
  static const Color red = Color(0xFFFF4D4D);
  static const Color textMuted = Color(0xFF6B7E69);
  static const Color textLight = Color(0xFFD6E3D4);

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: background,
      primaryColor: green,
      colorScheme: const ColorScheme.dark(
        primary: green,
        secondary: amber,
        surface: surface,
        error: red,
      ),
      fontFamily: 'monospace',
      appBarTheme: const AppBarTheme(
        backgroundColor: background,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: green,
          fontSize: 16,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.5,
          fontFamily: 'monospace',
        ),
      ),
    );
  }
}
