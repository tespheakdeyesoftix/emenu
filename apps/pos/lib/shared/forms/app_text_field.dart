import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

/// Shared text input for credentials, search, amounts, and settings.
class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    required this.controller,
    this.label,
    this.decoration,
    this.obscureText = false,
    this.enabled = true,
    this.autocorrect = true,
    this.enableSuggestions = true,
    this.autofocus = false,
    this.keyboardType,
    this.inputFormatters,
    this.onSubmitted,
    this.onChanged,
    this.onTap,
    this.focusNode,
    this.maxLength,
    this.maxLines = 1,
    this.style,
    this.textAlign = TextAlign.start,
  });

  final TextEditingController controller;
  final String? label;
  final InputDecoration? decoration;
  final bool obscureText, enabled, autocorrect, enableSuggestions, autofocus;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final ValueChanged<String>? onSubmitted, onChanged;
  final VoidCallback? onTap;
  final FocusNode? focusNode;
  final int? maxLength, maxLines;
  final TextStyle? style;
  final TextAlign textAlign;

  @override
  Widget build(BuildContext context) => TextField(
    controller: controller,
    decoration: decoration ?? InputDecoration(labelText: label?.tr),
    obscureText: obscureText,
    autocorrect: autocorrect,
    enableSuggestions: enableSuggestions,
    enabled: enabled,
    keyboardType: keyboardType,
    inputFormatters: inputFormatters,
    onSubmitted: onSubmitted,
    onChanged: onChanged,
    onTap: onTap,
    autofocus: autofocus,
    focusNode: focusNode,
    maxLength: maxLength,
    maxLines: maxLines,
    style: style,
    textAlign: textAlign,
  );
}
