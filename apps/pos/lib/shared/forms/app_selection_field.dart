import 'package:flutter/material.dart';
import 'package:get/get.dart';

/// Shared form selector for string or numeric values.
class AppSelectionField<T> extends StatelessWidget {
  const AppSelectionField({
    super.key,
    this.label,
    this.initialValue,
    this.decoration,
    this.isExpanded = false,
    required this.items,
    required this.onChanged,
  });

  final String? label;
  final T? initialValue;
  final InputDecoration? decoration;
  final bool isExpanded;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?>? onChanged;

  @override
  Widget build(BuildContext context) => DropdownButtonFormField<T>(
    initialValue: initialValue,
    decoration: decoration ?? InputDecoration(labelText: label?.tr),
    isExpanded: isExpanded,
    items: items,
    onChanged: onChanged,
  );
}
