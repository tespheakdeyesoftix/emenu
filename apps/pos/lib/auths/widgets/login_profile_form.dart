import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../shared/forms/app_selection_field.dart';
import '../../ui/shared_widgets.dart';
import '../login_controller.dart';

class LoginProfileForm extends GetView<LoginController> {
  const LoginProfileForm({super.key});

  @override
  Widget build(BuildContext context) => Obx(() {
    final busy = controller.busy;
    final selected = controller.selectedProfileId;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        AppSelectionField<String>(
          key: ValueKey(('select_profile', selected)),
          label: 'select_profile',
          initialValue: selected,
          isExpanded: true,
          items: [
            for (final row in controller.service.profiles)
              DropdownMenuItem(
                value: row['id'] as String,
                child: Text(
                  '${row['name']} · ${row['branch_name']}',
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ],
          onChanged: busy ? null : controller.selectProfileId,
        ),
        RegisterButton(
          'save',
          onPressed: busy || selected == null ? null : controller.selectProfile,
        ),
        TextButton(
          onPressed: busy ? null : controller.cancelProfileSelection,
          child: Text('back'.tr),
        ),
      ],
    );
  });
}
