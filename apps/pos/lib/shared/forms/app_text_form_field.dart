import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

/// Shared text input for dialogs and forms that use Flutter validation.
class AppTextFormField extends StatelessWidget {
  const AppTextFormField({
    super.key,
    this.controller,
    this.initialValue,
    this.label,
    this.decoration,
    this.autofocus = false,
    this.enabled = true,
    this.maxLength,
    this.maxLines = 1,
    this.keyboardType,
    this.inputFormatters,
    this.validator,
    this.onChanged,
    this.onFieldSubmitted,
  });

  final TextEditingController? controller;
  final String? initialValue, label;
  final InputDecoration? decoration;
  final bool autofocus;
  final bool enabled;
  final int? maxLength, maxLines;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final FormFieldValidator<String>? validator;
  final ValueChanged<String>? onChanged, onFieldSubmitted;

  @override
  Widget build(BuildContext context) => TextFormField(
    controller: controller,
    initialValue: initialValue,
    decoration: decoration ?? InputDecoration(labelText: label?.tr),
    autofocus: autofocus,
    enabled: enabled,
    maxLength: maxLength,
    maxLines: maxLines,
    keyboardType: keyboardType,
    inputFormatters: inputFormatters,
    validator: validator,
    onChanged: onChanged,
    onFieldSubmitted: onFieldSubmitted,
  );
}
