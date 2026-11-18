import 'package:flutter/material.dart';

/// Compact selector for controls that do not need a form-field decoration.
class AppDropdown<T> extends StatelessWidget {
  const AppDropdown({
    super.key,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?>? onChanged;

  @override
  Widget build(BuildContext context) =>
      DropdownButton<T>(value: value, items: items, onChanged: onChanged);
}
