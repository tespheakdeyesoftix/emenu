import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import 'app_text_field.dart';

class CustomerCodeField extends StatelessWidget {
  const CustomerCodeField({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.onSubmitted,
    required this.onChanged,
    this.error,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onSubmitted, onChanged;
  final String? error;

  @override
  Widget build(BuildContext context) => Focus(
    onKeyEvent: (_, event) {
      if (event is KeyDownEvent &&
          (event.logicalKey == LogicalKeyboardKey.enter ||
              event.logicalKey == LogicalKeyboardKey.numpadEnter)) {
        onSubmitted(controller.text);
        return KeyEventResult.handled;
      }
      return KeyEventResult.ignored;
    },
    child: AppTextField(
      controller: controller,
      focusNode: focusNode,
      autofocus: true,
      autocorrect: false,
      enableSuggestions: false,
      decoration: InputDecoration(
        labelText: 'customer_code'.tr,
        hintText: 'customer_code_hint'.tr,
        prefixIcon: const Icon(Icons.qr_code_scanner_rounded, size: 22),
        errorText: error?.tr,
        errorMaxLines: 3,
      ),
      onSubmitted: onSubmitted,
      onChanged: onChanged,
    ),
  );
}
