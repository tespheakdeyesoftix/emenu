import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../shared/forms/app_selection_field.dart';
import '../../shared/forms/pin_input_field.dart';
import '../login_controller.dart';

class LoginPinForm extends GetView<LoginController> {
  const LoginPinForm({super.key});

  @override
  Widget build(BuildContext context) => Obx(() {
    final busy = controller.busy;
    final selected = controller.selectedStaffId;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        AppSelectionField<String>(
          key: ValueKey(('staff', selected)),
          label: 'staff',
          initialValue: selected,
          isExpanded: true,
          items: [
            for (final user in controller.register.staff)
              DropdownMenuItem(
                value: user.id,
                child: Text(user.displayName, overflow: TextOverflow.ellipsis),
              ),
          ],
          onChanged: busy ? null : controller.selectStaff,
        ),
        PinInputField(
          submitLabel: 'sign_in',
          pin: controller.pin,
          length: LoginController.pinLength,
          enabled: !busy && selected != null,
          onDigit: controller.editPin,
          onBackspace: () => controller.editPin(null),
          onSubmit: controller.unlock,
        ),
        TextButton(
          onPressed: busy ? null : controller.showPasswordLogin,
          child: Text('password_login'.tr),
        ),
      ],
    );
  });
}
