import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../shared/forms/app_text_field.dart';
import '../../ui/shared_widgets.dart';
import '../login_controller.dart';

import 'login_activation_fields.dart';

class LoginPasswordForm extends GetView<LoginController> {
  const LoginPasswordForm({super.key});

  @override
  Widget build(BuildContext context) => Obx(() {
    final setup = controller.register.installation.value;
    final busy = controller.busy;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        if (setup == null)
          LoginActivationFields(
            origin: controller.origin,
            slug: controller.slug,
            enabled: !busy,
          ),
        AppTextField(
          controller: controller.account,
          label: setup == null ? 'email' : 'username_or_email',
          enabled: !busy,
        ),
        AppTextField(
          controller: controller.password,
          label: 'password',
          obscureText: true,
          autocorrect: false,
          enableSuggestions: false,
          enabled: !busy,
          onSubmitted: busy ? null : (_) => controller.signIn(),
        ),
        RegisterButton('sign_in', onPressed: busy ? null : controller.signIn),
        if (setup != null && controller.register.staff.isNotEmpty)
          TextButton(
            onPressed: busy ? null : controller.showPinLogin,
            child: Text('back'.tr),
          ),
      ],
    );
  });
}
