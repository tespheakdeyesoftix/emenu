import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../ui/shared_widgets.dart';

import 'app_text_field.dart';
import 'number_pad.dart';

/// PIN input with touch keypad and keyboard submission, independent of GetX.
class PinInputField extends StatelessWidget {
  const PinInputField({
    super.key,
    required this.pin,
    required this.length,
    required this.enabled,
    required this.onDigit,
    required this.onBackspace,
    required this.onSubmit,
    required this.submitLabel,
    this.label = 'pin',
  });

  final TextEditingController pin;
  final int length;
  final bool enabled;
  final ValueChanged<String> onDigit;
  final VoidCallback onBackspace, onSubmit;
  final String label, submitLabel;

  @override
  Widget build(
    BuildContext context,
  ) => ValueListenableBuilder<TextEditingValue>(
    valueListenable: pin,
    builder: (context, value, _) {
      final submit = enabled && value.text.length == length ? onSubmit : null;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          AppTextField(
            controller: pin,
            label: label,
            obscureText: true,
            autocorrect: false,
            enableSuggestions: false,
            enabled: enabled,
            keyboardType: TextInputType.none,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(length),
            ],
            onSubmitted: submit == null ? null : (_) => submit(),
          ),
          NumberPad(
            enterDigit:
                enabled &&
                    (value.text.length < length || !value.selection.isCollapsed)
                ? onDigit
                : null,
            backspace: enabled && value.text.isNotEmpty ? onBackspace : null,
            clear: enabled && value.text.isNotEmpty ? pin.clear : null,
          ),
          RegisterButton(submitLabel, onPressed: submit),
        ],
      );
    },
  );
}
