import 'package:flutter/material.dart';
import 'package:get/get.dart';

import 'app_text_field.dart';

class CustomerSearchField extends StatelessWidget {
  const CustomerSearchField({
    super.key,
    required this.controller,
    required this.onChanged,
    this.autofocus = true,
    this.hint = 'customer_search_hint',
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final bool autofocus;
  final String hint;

  @override
  Widget build(BuildContext context) => AppTextField(
    controller: controller,
    autofocus: autofocus,
    decoration: InputDecoration(
      hintText: hint.tr,
      prefixIcon: const Icon(Icons.search, size: 20),
      isDense: true,
    ),
    onChanged: onChanged,
  );
}
