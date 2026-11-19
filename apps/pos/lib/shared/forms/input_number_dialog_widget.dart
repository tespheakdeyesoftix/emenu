import 'package:flutter/gestures.dart' show PointerDeviceKind;
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
    this.decimalPlaces,
    this.value,
    this.min,
    this.max,
    this.label,
    this.confirmText,
    this.header,
    this.footer,
    this.canConfirm = true,
    this.validate,
    this.onConfirm,
    this.preset,
    this.presets = const [],
  });

  final String title;
  final bool isFloat;
  final int? decimalPlaces;
  final num? value, min, max;
  final String? label, confirmText;
  final Widget? header, footer;
  final bool canConfirm;
  final bool Function(num)? validate;
  final ValueChanged<num>? onConfirm;
  final ({String label, num value})? preset;
  final List<({String label, num value})> presets;

  @override
  State<InputNumberDialogWidget> createState() =>
      _InputNumberDialogWidgetState();
}

class _InputNumberDialogWidgetState extends State<InputNumberDialogWidget> {
  late final TextEditingController input;
  final _presetScroll = ScrollController();
  bool get _allowNegative => widget.min == null || widget.min! < 0;

  @override
  void initState() {
    super.initState();
    final text = _initialValue;
    input = TextEditingController.fromValue(TextEditingValue(
      text: text,
      selection: TextSelection(baseOffset: 0, extentOffset: text.length),
    ));
  }

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
        (widget.decimalPlaces != null &&
            double.parse(number.toStringAsFixed(widget.decimalPlaces!)) != number) ||
        (widget.min != null && number < widget.min!) ||
        (widget.max != null && number > widget.max!) ||
        widget.validate?.call(number) == false) {
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
    if (number == null || !widget.canConfirm) return;
    if (widget.onConfirm case final confirm?) {
      confirm(number);
    } else {
      Navigator.pop(context, number);
    }
  }

  @override
  void dispose() {
    input.dispose();
    _presetScroll.dispose();
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
          if (widget.header case final header?) header,
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
          if (widget.preset case final preset?)
            TextButton(
              onPressed: () => _setText(preset.value.toString()),
              child: Text(preset.label),
            ),
          if (widget.presets.isNotEmpty)
            ScrollConfiguration(
              behavior: ScrollConfiguration.of(context).copyWith(
                scrollbars: false,
                dragDevices: {
                  ...ScrollConfiguration.of(context).dragDevices,
                  PointerDeviceKind.mouse,
                },
              ),
              child: Scrollbar(
                controller: _presetScroll,
                thumbVisibility: true,
                thickness: 2,
                child: SingleChildScrollView(
                  controller: _presetScroll,
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    spacing: 6,
                    children: [
                      for (final preset in widget.presets)
                        ChoiceChip(
                          label: Text(preset.label),
                          selected: _number == preset.value,
                          showCheckmark: false,
                          visualDensity: VisualDensity.compact,
                          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          onSelected: (_) => _setText(preset.value.toString()),
                        ),
                    ],
                  ),
                ),
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
          if (widget.footer case final footer?) footer,
        ],
      ),
    ),
    actions: [
      TextButton(onPressed: () => Navigator.pop(context), child: Text('back'.tr)),
      FilledButton(
        onPressed: _number == null || !widget.canConfirm ? null : _save,
        child: Text(widget.confirmText ?? 'save'.tr),
      ),
    ],
  );
}
