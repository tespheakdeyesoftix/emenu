import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../features/register/register_controller.dart';
import '../shared/forms/app_text_field.dart';
import '../shared/forms/number_pad.dart';

import 'shared_widgets.dart';

class OperatorProfileView extends StatelessWidget {
  const OperatorProfileView(this.controller, {super.key});

  final RegisterController controller;

  @override
  Widget build(BuildContext context) => Obx(() {
    final actor = controller.operator.value!;
    final configured = controller.pinConfigured.value;
    final colors = Theme.of(context).colorScheme;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Align(
        alignment: AlignmentDirectional.topStart,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 540),
          child: Column(
            spacing: 16,
            children: [
              ListTile(
                contentPadding: const EdgeInsets.all(16),
                tileColor: colors.surface,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                  side: BorderSide(color: colors.outlineVariant),
                ),
                leading: CircleAvatar(
                  backgroundColor: colors.primaryContainer,
                  child: Icon(
                    Icons.person_outline,
                    color: colors.onPrimaryContainer,
                  ),
                ),
                title: Text(
                  actor.displayName,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                subtitle: Text(actor.email),
              ),
              ListTile(
                contentPadding: const EdgeInsets.all(16),
                tileColor: colors.surface,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                  side: BorderSide(color: colors.outlineVariant),
                ),
                leading: const Icon(Icons.pin_outlined),
                title: Text('pin'.tr),
                subtitle: Text((configured ? 'pin_enabled' : 'pin_not_set').tr),
                trailing: const Icon(Icons.chevron_right),
                onTap: controller.busy.value
                    ? null
                    : () => showPinEditor(context, controller),
              ),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: OutlinedButton.icon(
                  onPressed: controller.busy.value ? null : controller.lock,
                  icon: const Icon(Icons.lock_outline),
                  label: Text('lock'.tr),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  });
}

Future<void> showPinOffer(
  BuildContext context,
  RegisterController controller,
) async {
  final accepted = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      icon: const Icon(Icons.pin_outlined),
      title: Text('offer_pin'.tr),
      content: Text('offer_pin_info'.tr),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: Text('skip'.tr),
        ),
        RegisterButton(
          'set_pin',
          onPressed: () => Navigator.pop(context, true),
        ),
      ],
    ),
  );
  if (accepted == true && context.mounted) {
    await showPinEditor(context, controller);
  }
}

Future<void> showPinEditor(
  BuildContext context,
  RegisterController controller,
) => showDialog<void>(
  context: context,
  builder: (context) => _PinEditor(controller),
);

class _PinEditor extends StatefulWidget {
  const _PinEditor(this.controller);

  final RegisterController controller;

  @override
  State<_PinEditor> createState() => _PinEditorState();
}

class _PinEditorState extends State<_PinEditor> {
  final pin = TextEditingController();
  final confirmation = TextEditingController();
  final pinFocus = FocusNode();
  final confirmationFocus = FocusNode();
  bool saving = false;

  @override
  void dispose() {
    pin.dispose();
    confirmation.dispose();
    pinFocus.dispose();
    confirmationFocus.dispose();
    super.dispose();
  }

  Future<void> save() async {
    setState(() => saving = true);
    final saved = await widget.controller.configurePin(pin.text);
    if (!mounted) return;
    if (saved) {
      Navigator.pop(context);
    } else {
      setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final input = confirmationFocus.hasFocus ? confirmation : pin;
    final matches = pin.text.length == 6 && pin.text == confirmation.text;
    Widget field(TextEditingController input, FocusNode focus, String label) =>
        AppTextField(
          controller: input,
          focusNode: focus,
          autofocus: identical(focus, pinFocus),
          enabled: !saving,
          onTap: () => setState(() {}),
          onChanged: (_) => setState(() {}),
          obscureText: true,
          keyboardType: TextInputType.none,
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(6),
          ],
          decoration: InputDecoration(labelText: label.tr),
        );

    return AlertDialog(
      scrollable: true,
      title: Text(
        (widget.controller.pinConfigured.value ? 'change_pin' : 'set_pin').tr,
      ),
      content: SizedBox(
        width: 320,
        child: Column(
          spacing: 12,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            field(pin, pinFocus, 'pin'),
            field(confirmation, confirmationFocus, 'confirm_pin'),
            if (confirmation.text.length == 6 && !matches)
              Text(
                'PIN_MATCH'.tr,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            NumberPad(
              enterDigit: saving
                  ? null
                  : (digit) {
                      if (input.text.length == 6) return;
                      setState(() => input.text += digit);
                      if (input == pin && pin.text.length == 6) {
                        confirmationFocus.requestFocus();
                        setState(() {});
                      }
                    },
              backspace: saving || input.text.isEmpty
                  ? null
                  : () => setState(
                      () => input.text = input.text.substring(
                        0,
                        input.text.length - 1,
                      ),
                    ),
              clear: saving || input.text.isEmpty
                  ? null
                  : () => setState(input.clear),
            ),
            Obx(() => RegisterNotice(widget.controller.message.value)),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: saving ? null : () => Navigator.pop(context),
          child: Text('back'.tr),
        ),
        RegisterButton('save', onPressed: saving || !matches ? null : save),
      ],
    );
  }
}
