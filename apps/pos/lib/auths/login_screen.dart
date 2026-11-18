import 'package:flutter/material.dart';
import 'package:get/get.dart';

import 'login_controller.dart';
import 'widgets/access_layout.dart';
import 'widgets/login_header.dart';
import 'widgets/login_password_form.dart';
import 'widgets/login_pin_form.dart';
import 'widgets/login_profile_form.dart';
import 'widgets/login_status.dart';

class LoginScreen extends GetView<LoginController> {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) => AccessLayout(
    child: AutofillGroup(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 14,
        children: [
          Obx(
            () => LoginHeader(
              title: controller.title,
              installation: controller.register.installation.value,
            ),
          ),
          Obx(() => LoginStatus(message: controller.register.message.value)),
          Obx(
            () => controller.choosingProfile
                ? const LoginProfileForm()
                : controller.showPassword
                ? const LoginPasswordForm()
                : const LoginPinForm(),
          ),
        ],
      ),
    ),
  );
}
