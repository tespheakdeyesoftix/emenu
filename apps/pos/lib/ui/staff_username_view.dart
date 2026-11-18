import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../core/pos_api.dart';
import '../features/register/register_controller.dart';
import '../shared/forms/app_selection_field.dart';
import '../shared/forms/app_text_field.dart';

import 'shared_widgets.dart';

class StaffUsernameView extends StatefulWidget {
  const StaffUsernameView(this.register, {super.key});

  final RegisterController register;

  @override
  State<StaffUsernameView> createState() => _StaffUsernameViewState();
}

class _StaffUsernameViewState extends State<StaffUsernameView> {
  final _username = TextEditingController();
  List<Json>? _staff;
  String? _selected;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  @override
  void dispose() {
    _username.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final staff = await widget.register.loadStaffUsernames();
    if (!mounted || staff == null) return;
    _staff = staff;
    _select(staff.firstOrNull?['user_id'] as String?);
  }

  void _select(String? id) {
    final row = _staff?.where((row) => row['user_id'] == id).firstOrNull;
    _username.text = row?['username'] as String? ?? '';
    setState(() => _selected = id);
  }

  Future<void> _save(String id) async {
    final result = await widget.register.setStaffUsername(id, _username.text);
    if (!mounted || result == null) return;
    _username.text = result['username'] as String? ?? '';
    setState(() {
      _staff = [
        for (final row in _staff!)
          row['user_id'] == id ? {...row, ...result} : row,
      ];
    });
  }

  @override
  Widget build(BuildContext context) => Obx(() {
    final register = widget.register;
    final busy = register.busy.value;
    final staff = _staff;
    final selected = _selected;
    return AlertDialog(
      title: Text('staff_usernames'.tr),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            spacing: 12,
            children: [
              RegisterNotice(register.message.value),
              if (staff == null)
                TextButton(
                  onPressed: busy ? null : _load,
                  child: Text('refresh'.tr),
                )
              else if (staff.isEmpty)
                Text('no_profile_staff'.tr)
              else ...[
                AppSelectionField<String>(
                  key: ValueKey(selected),
                  initialValue: selected,
                  decoration: InputDecoration(labelText: 'staff'.tr),
                  isExpanded: true,
                  items: [
                    for (final row in staff)
                      DropdownMenuItem(
                        value: row['user_id'] as String,
                        child: Text(
                          row['name'] as String,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: busy ? null : _select,
                ),
                AppTextField(
                  controller: _username,
                  enabled: !busy,
                  autocorrect: false,
                  enableSuggestions: false,
                  maxLength: 40,
                  decoration: InputDecoration(
                    labelText: 'username'.tr,
                    helperText: 'empty_removes_username'.tr,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('back'.tr),
        ),
        RegisterButton(
          'save',
          onPressed: busy || selected == null ? null : () => _save(selected),
        ),
      ],
    );
  });
}
