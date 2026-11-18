import 'package:flutter/material.dart';

class BillInfoChip extends StatelessWidget {
  const BillInfoChip({
    super.key,
    required this.icon,
    required this.label,
    this.trailing,
    this.onTap,
    this.tooltip,
  });

  final IconData icon;
  final String label;
  final IconData? trailing;
  final VoidCallback? onTap;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    const shape = StadiumBorder();
    final chip = Material(
      color: theme.colorScheme.secondaryContainer,
      shape: shape,
      child: InkWell(
        customBorder: shape,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            spacing: 5,
            children: [
              Icon(icon, size: 17, color: theme.colorScheme.onSurfaceVariant),
              Text(
                label,
                style: theme.textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (trailing != null)
                Icon(
                  trailing,
                  size: 14,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
            ],
          ),
        ),
      ),
    );
    return tooltip == null ? chip : Tooltip(message: tooltip!, child: chip);
  }
}
