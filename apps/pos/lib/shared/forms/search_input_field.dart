import 'package:flutter/material.dart';
import 'package:get/get.dart';

import 'app_text_field.dart';

class SearchInputField extends StatelessWidget {
  const SearchInputField({
    super.key,
    required this.controller,
    required this.onChanged,
    required this.onSubmitted,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged, onSubmitted;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: (MediaQuery.textScalerOf(context).scale(13) * 1.4 + 14).clamp(
      36,
      double.infinity,
    ),
    child: AppTextField(
      controller: controller,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(fontSize: 13),
      decoration: InputDecoration(
        hintText: 'search'.tr,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        prefixIcon: const Icon(Icons.search, size: 18),
        prefixIconConstraints: const BoxConstraints(
          minWidth: 34,
          minHeight: 32,
        ),
      ),
      onChanged: onChanged,
      onSubmitted: onSubmitted,
    ),
  );
}
