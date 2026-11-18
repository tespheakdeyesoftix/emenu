import 'package:flutter/material.dart';

class AppCheckboxField extends StatelessWidget {
  const AppCheckboxField({
    super.key,
    required this.value,
    required this.title,
    required this.onChanged,
    this.subtitle,
  });

  final bool? value;
  final Widget title;
  final Widget? subtitle;
  final ValueChanged<bool?>? onChanged;

  @override
  Widget build(BuildContext context) => CheckboxListTile(
    value: value,
    title: title,
    subtitle: subtitle,
    onChanged: onChanged,
  );
}
