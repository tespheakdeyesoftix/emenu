import 'package:flutter/material.dart';
import 'package:get/get.dart';

import 'app_text_field.dart';

class SearchInputField extends StatelessWidget {
  const SearchInputField({
    super.key,
    required this.controller,
    required this.onChanged,
    required this.onClear,
    required this.onSubmitted,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged, onSubmitted;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: BorderSide.none,
    );
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) => AppTextField(
        controller: controller,
        style: theme.textTheme.bodyLarge,
        decoration: InputDecoration(
          hintText: 'search'.tr,
          filled: true,
          fillColor: theme.colorScheme.surfaceContainerHighest,
          enabledBorder: border,
          focusedBorder: border.copyWith(
            borderSide: BorderSide(color: theme.colorScheme.outline),
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 12,
          ),
          prefixIcon: const Icon(Icons.search, size: 22),
          suffixIcon: value.text.isEmpty
              ? null
              : IconButton(
                  tooltip: 'clear_search'.tr,
                  icon: const Icon(Icons.close, size: 20),
                  onPressed: onClear,
                ),
        ),
        onChanged: onChanged,
        onSubmitted: onSubmitted,
      ),
    );
  }
}
