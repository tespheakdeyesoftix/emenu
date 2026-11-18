import 'package:flutter/material.dart';

import '../../shared/forms/app_text_field.dart';

class LoginActivationFields extends StatelessWidget {
  const LoginActivationFields({
    super.key,
    required this.origin,
    required this.slug,
    required this.enabled,
  });

  final TextEditingController origin, slug;
  final bool enabled;

  @override
  Widget build(BuildContext context) => Column(
    spacing: 14,
    children: [
      AppTextField(controller: origin, label: 'api', enabled: enabled),
      AppTextField(controller: slug, label: 'business', enabled: enabled),
    ],
  );
}
