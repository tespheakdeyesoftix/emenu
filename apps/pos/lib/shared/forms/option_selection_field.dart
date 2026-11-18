import 'package:flutter/material.dart';
import 'package:get/get.dart';

import 'app_selection_field.dart';

/// Selects an optional record while displaying a separate empty-state label.
class OptionSelectionField<T> extends StatelessWidget {
  const OptionSelectionField({
    super.key,
    required this.label,
    required this.empty,
    required this.options,
    required this.selected,
    required this.onChanged,
    this.enabled,
    required this.optionValue,
    required this.optionLabel,
    this.version = 0,
  });

  final String label, empty;
  final List<T> options;
  final String? selected;
  final ValueChanged<String?>? onChanged;
  final bool Function(T)? enabled;
  final String Function(T) optionValue, optionLabel;
  final int version;

  @override
  Widget build(BuildContext context) {
    final selection = options.any((row) => optionValue(row) == selected)
        ? selected
        : null;
    return AppSelectionField<String>(
      key: ValueKey((label, selection, version)),
      initialValue: selection ?? '',
      isExpanded: true,
      decoration: InputDecoration(
        labelText: label.tr,
        filled: false,
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        disabledBorder: InputBorder.none,
        focusedBorder: UnderlineInputBorder(
          borderSide: BorderSide(color: Theme.of(context).colorScheme.primary),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      ),
      items: [
        DropdownMenuItem(
          value: '',
          child: Text(empty, overflow: TextOverflow.ellipsis),
        ),
        for (final row in options)
          DropdownMenuItem(
            value: optionValue(row),
            enabled: enabled?.call(row) ?? true,
            child: Text(optionLabel(row), overflow: TextOverflow.ellipsis),
          ),
      ],
      onChanged: onChanged == null
          ? null
          : (value) => onChanged!(value == '' ? null : value),
    );
  }
}
