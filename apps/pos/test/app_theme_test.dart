import 'package:emenu_pos/shared/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

double contrast(Color foreground, Color background) {
  final a = foreground.computeLuminance();
  final b = background.computeLuminance();
  return ((a > b ? a : b) + .05) / ((a < b ? a : b) + .05);
}

void main() {
  test('workspace text stays readable on both cards and the canvas', () {
    final theme = AppTheme.light;
    for (final style in [
      theme.textTheme.headlineMedium,
      theme.textTheme.headlineSmall,
      theme.textTheme.titleLarge,
      theme.textTheme.titleMedium,
      theme.textTheme.titleSmall,
      theme.textTheme.bodyLarge,
      theme.textTheme.bodyMedium,
      theme.textTheme.bodySmall,
    ]) {
      expect(style?.color, isNotNull);
      expect(
        contrast(style!.color!, theme.colorScheme.surface),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        contrast(style.color!, theme.scaffoldBackgroundColor),
        greaterThanOrEqualTo(4.5),
      );
    }
    expect(
      contrast(AppColors.muted, theme.scaffoldBackgroundColor),
      greaterThanOrEqualTo(4.5),
    );
  });

  test('monochrome controls keep accessible contrast', () {
    final scheme = AppTheme.light.colorScheme;
    expect(scheme.secondary, const Color(0xfff5f5f5));
    expect(scheme.surface, Colors.white);
    for (final (foreground, background) in [
      (scheme.onPrimary, scheme.primary),
      (scheme.onPrimaryContainer, scheme.primaryContainer),
      (scheme.onSecondary, scheme.secondary),
      (scheme.onSecondaryContainer, scheme.secondaryContainer),
      (scheme.onSecondaryContainer, scheme.surface),
      (scheme.onTertiary, scheme.tertiary),
      (scheme.onTertiaryContainer, scheme.tertiaryContainer),
      (scheme.onInverseSurface, scheme.inverseSurface),
      (scheme.primary, scheme.secondaryContainer),
      (scheme.onErrorContainer, scheme.errorContainer),
      (scheme.primary, AppColors.card),
      (scheme.primary, AppColors.selectedCard),
      (AppColors.cardMuted, AppColors.card),
      (AppColors.cardMuted, AppColors.selectedCard),
      (scheme.onSurface, AppColors.menuCard),
    ]) {
      expect(contrast(foreground, background), greaterThanOrEqualTo(4.5));
    }
    for (final color in [
      AppColors.canvas,
      AppColors.card,
      AppColors.selectedCard,
      scheme.primary,
      scheme.primaryContainer,
      scheme.secondary,
      scheme.secondaryContainer,
      scheme.tertiary,
      scheme.tertiaryContainer,
      scheme.inverseSurface,
      scheme.inversePrimary,
      scheme.onSurface,
      scheme.onSurfaceVariant,
      scheme.outline,
    ]) {
      expect(color.r, color.g);
      expect(color.g, color.b);
    }
    expect(contrast(scheme.outline, scheme.surface), greaterThanOrEqualTo(3));
  });
}
