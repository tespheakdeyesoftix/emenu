import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import 'app_text_field.dart';
import 'number_pad.dart';

class InputNumberDialogWidget extends StatefulWidget {
  const InputNumberDialogWidget({
    super.key,
    required this.title,
    this.isFloat = false,
    this.value,
    this.min,
    this.max,
    this.label,
    this.confirmText,
  });

  final String title;
  final bool isFloat;
  final num? value, min, max;
  final String? label, confirmText;

  @override
  State<InputNumberDialogWidget> createState() =>
      _InputNumberDialogWidgetState();
}

class _InputNumberDialogWidgetState extends State<InputNumberDialogWidget> {
  late final input = TextEditingController(text: _initialValue);
  bool get _allowNegative => widget.min == null || widget.min! < 0;

  String get _initialValue {
    final value = widget.value;
    if (value == null) return '';
    return widget.isFloat ? value.toString() : value.toInt().toString();
  }

  num? get _number {
    final text = input.text.trim();
    final number = widget.isFloat ? double.tryParse(text) : int.tryParse(text);
    if (number == null ||
        !number.isFinite ||
        (widget.min != null && number < widget.min!) ||
        (widget.max != null && number > widget.max!)) {
      return null;
    }
    return number;
  }

  RegExp get _pattern => widget.isFloat
      ? (_allowNegative
            ? RegExp(r'^-?\d*\.?\d*(?:[eE][+-]?\d*)?$')
            : RegExp(r'^\d*\.?\d*(?:[eE][+-]?\d*)?$'))
      : (_allowNegative ? RegExp(r'^-?\d*$') : RegExp(r'^\d*$'));

  void _setText(String text) {
    input.value = TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
    setState(() {});
  }

  void _insert(String text) {
    final selection = input.selection;
    final start = selection.isValid ? selection.start : input.text.length;
    final end = selection.isValid ? selection.end : input.text.length;
    final next = input.text.replaceRange(start, end, text);
    if (next.length > 32 || !_pattern.hasMatch(next)) return;
    input.value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: start + text.length),
    );
    setState(() {});
  }

  void _backspace() {
    final selection = input.selection;
    final end = selection.isValid ? selection.end : input.text.length;
    final start = selection.isValid && !selection.isCollapsed
        ? selection.start
        : end - 1;
    if (start < 0) return;
    final text = input.text.replaceRange(start, end, '');
    input.value = TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: start),
    );
    setState(() {});
  }

  void _save() {
    final number = _number;
    if (number != null) Get.back<num>(result: number);
  }

  @override
  void dispose() {
    input.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    scrollable: true,
    title: Text(widget.title),
    content: SizedBox(
      width: 304,
      child: Column(
        spacing: 12,
        children: [
          AppTextField(
            controller: input,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineSmall,
            autofocus: true,
            keyboardType: TextInputType.numberWithOptions(
              decimal: widget.isFloat,
              signed: _allowNegative,
            ),
            inputFormatters: [
              TextInputFormatter.withFunction(
                (oldValue, newValue) =>
                    _pattern.hasMatch(newValue.text) ? newValue : oldValue,
              ),
              LengthLimitingTextInputFormatter(32),
            ],
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) => _save(),
            decoration: InputDecoration(
              labelText: widget.label ?? widget.title,
              errorText: input.text.isNotEmpty && _number == null
                  ? 'INVALID_NUMBER'.tr
                  : null,
            ),
          ),
          NumberPad(
            clearLabel: 'clear_count',
            backspaceLabel: 'delete_digit',
            enterDigit: (digit) => _insert(digit),
            backspace: input.text.isEmpty ? null : _backspace,
            clear: input.text.isEmpty ? null : () => _setText(''),
          ),
          if (widget.isFloat || _allowNegative)
            Row(
              spacing: 8,
              children: [
                if (_allowNegative)
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _setText(
                        input.text.startsWith('-')
                            ? input.text.substring(1)
                            : '-${input.text}',
                      ),
                      child: const Text('±'),
                    ),
                  ),
                if (widget.isFloat)
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _insert('.'),
                      child: const Text('.'),
                    ),
                  ),
              ],
            ),
        ],
      ),
    ),
    actions: [
      TextButton(onPressed: () => Get.back<num>(), child: Text('back'.tr)),
      FilledButton(
        onPressed: _number == null ? null : _save,
        child: Text(widget.confirmText ?? 'save'.tr),
      ),
    ],
  );
}
