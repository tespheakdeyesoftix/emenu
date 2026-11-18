import 'package:flutter/material.dart';
import 'package:get/get.dart';

/// Touch keypad shared by PIN and numeric inputs.
class NumberPad extends StatelessWidget {
  const NumberPad({
    super.key,
    required this.enterDigit,
    required this.backspace,
    required this.clear,
    this.clearLabel = 'clear_pin',
    this.backspaceLabel = 'delete_pin_digit',
  });

  final ValueChanged<String>? enterDigit;
  final VoidCallback? backspace;
  final VoidCallback? clear;
  final String clearLabel, backspaceLabel;

  @override
  Widget build(BuildContext context) {
    final style = OutlinedButton.styleFrom(
      minimumSize: const Size(0, 56),
      padding: EdgeInsets.zero,
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
      foregroundColor: Theme.of(context).colorScheme.onSurface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      textStyle: Theme.of(context).textTheme.titleLarge,
    );
    Widget digit(String number) => OutlinedButton(
      style: style,
      onPressed: enterDigit == null ? null : () => enterDigit!(number),
      child: Text(number),
    );
    Widget keyAction(String label, IconData icon, VoidCallback? action) =>
        Tooltip(
          message: label.tr,
          child: OutlinedButton(
            style: style,
            onPressed: action,
            child: Icon(icon),
          ),
        );
    Widget row(List<Widget> keys) => Row(
      spacing: 8,
      children: [for (final key in keys) Expanded(child: key)],
    );

    return Column(
      spacing: 8,
      children: [
        for (var start = 1; start < 10; start += 3)
          row([
            for (var index = start; index < start + 3; index++)
              digit(index.toString()),
          ]),
        row([
          keyAction(clearLabel, Icons.clear, clear),
          digit('0'),
          keyAction(backspaceLabel, Icons.backspace_outlined, backspace),
        ]),
      ],
    );
  }
}
