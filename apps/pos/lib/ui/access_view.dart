import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../features/register/register_controller.dart';
import 'shared_widgets.dart';

class AccessView extends StatefulWidget {
  const AccessView(this.controller, {super.key});

  final RegisterController controller;

  @override
  State<AccessView> createState() => _AccessViewState();
}

class _AccessViewState extends State<AccessView> {
  final origin = TextEditingController(
    text: const String.fromEnvironment(
      'POS_API_ORIGIN',
      defaultValue: 'http://127.0.0.1:8787',
    ),
  );
  final slug = TextEditingController();
  final account = TextEditingController();
  final password = TextEditingController();
  final pin = TextEditingController();
  final confirmation = TextEditingController();
  String? staffId;
  String? profileId;
  bool usePassword = false;

  RegisterController get controller => widget.controller;

  @override
  void dispose() {
    for (final input in [origin, slug, account, password, pin, confirmation]) {
      input.dispose();
    }
    super.dispose();
  }

  Widget input(
    TextEditingController controller,
    String label, {
    bool hidden = false,
    bool numeric = false,
    VoidCallback? submit,
  }) => TextField(
    controller: controller,
    decoration: InputDecoration(labelText: label.tr),
    obscureText: hidden,
    autocorrect: !hidden,
    enableSuggestions: !hidden,
    keyboardType: numeric ? TextInputType.number : TextInputType.text,
    inputFormatters: numeric
        ? [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(6),
          ]
        : null,
    onSubmitted: submit == null ? null : (_) => submit(),
  );

  Future<void> _signIn() async {
    final setup = controller.installation.value;
    await controller.signIn(
      setup?.apiOrigin ?? origin.text,
      setup?.businessSlug ?? slug.text,
      account.text,
      password.text,
    );
    if (mounted) password.clear();
  }

  @override
  Widget build(BuildContext context) => Obx(() {
    final stage = controller.stage.value;
    final busy = controller.busy.value;
    final setup = controller.installation.value;
    final choosing = stage == RegisterStage.selectProfile;
    final showPassword =
        setup == null || usePassword || controller.staff.isEmpty;
    final selected = staffId ?? controller.staff.firstOrNull?.id;
    final profile =
        profileId ?? controller.profiles.firstOrNull?['id'] as String?;
    final title = choosing
        ? 'select_profile'
        : setup == null
        ? 'activate'
        : 'sign_in';
    return Scaffold(
      appBar: AppBar(
        title: const Text('eMenu POS'),
        actions: const [LanguageButton()],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: AutofillGroup(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 14,
                children: [
                  Text(
                    title.tr,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  RegisterNotice(controller.message.value),
                  if (busy) const LinearProgressIndicator(),
                  if (choosing) ...[
                    DropdownButtonFormField<String>(
                      initialValue: profile,
                      decoration: InputDecoration(
                        labelText: 'select_profile'.tr,
                      ),
                      isExpanded: true,
                      items: controller.profiles
                          .map(
                            (row) => DropdownMenuItem<String>(
                              value: row['id'] as String,
                              child: Text(
                                '${row['name']} · ${row['branch_name']}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: busy
                          ? null
                          : (id) => setState(() => profileId = id),
                    ),
                    input(pin, 'pin', numeric: true, hidden: true),
                    input(
                      confirmation,
                      'confirm_pin',
                      numeric: true,
                      hidden: true,
                    ),
                    RegisterButton(
                      'save',
                      onPressed: busy || profile == null
                          ? null
                          : () => controller.selectProfile(
                              profile,
                              pin.text,
                              confirmation.text,
                            ),
                    ),
                    TextButton(
                      onPressed: busy
                          ? null
                          : () {
                              profileId = null;
                              pin.clear();
                              confirmation.clear();
                              controller.cancelSignIn();
                            },
                      child: Text('back'.tr),
                    ),
                  ] else if (showPassword) ...[
                    if (setup == null) ...[
                      input(origin, 'api'),
                      input(slug, 'business'),
                    ],
                    input(
                      account,
                      setup == null ? 'email' : 'username_or_email',
                    ),
                    input(
                      password,
                      'password',
                      hidden: true,
                      submit: busy ? null : _signIn,
                    ),
                    RegisterButton('sign_in', onPressed: busy ? null : _signIn),
                    if (setup != null)
                      TextButton(
                        onPressed: busy
                            ? null
                            : () => setState(() => usePassword = false),
                        child: Text('back'.tr),
                      ),
                  ] else ...[
                    DropdownButtonFormField<String>(
                      initialValue: selected,
                      decoration: InputDecoration(labelText: 'staff'.tr),
                      isExpanded: true,
                      items: controller.staff
                          .map(
                            (user) => DropdownMenuItem(
                              value: user.id,
                              child: Text(user.displayName),
                            ),
                          )
                          .toList(),
                      onChanged: busy
                          ? null
                          : (id) => setState(() => staffId = id),
                    ),
                    input(
                      pin,
                      'pin',
                      numeric: true,
                      hidden: true,
                      submit: busy || selected == null
                          ? null
                          : () => controller.unlock(selected, pin.text),
                    ),
                    RegisterButton(
                      'sign_in',
                      onPressed: busy || selected == null
                          ? null
                          : () => controller.unlock(selected, pin.text),
                    ),
                    TextButton(
                      onPressed: busy
                          ? null
                          : () {
                              pin.clear();
                              setState(() => usePassword = true);
                            },
                      child: Text('password_login'.tr),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  });
}
