import 'package:flutter/material.dart';
import 'package:get/get.dart';

class RegisterButton extends StatelessWidget {
  const RegisterButton(
    this.label, {
    super.key,
    required this.onPressed,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    if (icon == null) {
      return FilledButton(onPressed: onPressed, child: Text(label.tr));
    }
    return FilledButton.icon(
      onPressed: onPressed,
      icon: Icon(icon),
      label: Text(label.tr),
    );
  }
}

Future<bool> confirmDiscard(BuildContext context, String label) async =>
    await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(label.tr),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('back'.tr),
          ),
          RegisterButton(
            'discard',
            onPressed: () => Navigator.pop(context, true),
          ),
        ],
      ),
    ) ??
    false;

class LanguageButton extends StatelessWidget {
  const LanguageButton({super.key});

  @override
  Widget build(BuildContext context) => TextButton(
    onPressed: () => Get.updateLocale(
      Locale(Get.locale?.languageCode == 'km' ? 'en' : 'km'),
    ),
    child: Text(Get.locale?.languageCode == 'km' ? 'EN' : 'ខ្មែរ'),
  );
}

class ReasonDialog extends StatefulWidget {
  const ReasonDialog(this.action, {super.key, this.details = const []});

  final String action;
  final List<Widget> details;

  @override
  State<ReasonDialog> createState() => _ReasonDialogState();
}

class _ReasonDialogState extends State<ReasonDialog> {
  final _form = GlobalKey<FormState>();
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.action.tr),
    content: SizedBox(
      width: 360,
      child: SingleChildScrollView(
        child: Form(
          key: _form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 12,
            mainAxisSize: MainAxisSize.min,
            children: [
              ...widget.details,
              TextFormField(
                controller: _reason,
                autofocus: true,
                maxLength: 500,
                decoration: InputDecoration(labelText: 'reason'.tr),
                validator: (value) =>
                    (value ?? '').trim().isEmpty ? 'REASON_REQUIRED'.tr : null,
              ),
            ],
          ),
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: Text('back'.tr),
      ),
      RegisterButton(
        widget.action,
        onPressed: () {
          if (_form.currentState!.validate()) {
            Navigator.pop(context, _reason.text.trim());
          }
        },
      ),
    ],
  );
}

class RegisterNotice extends StatelessWidget {
  const RegisterNotice(this.message, {super.key});

  final String? message;

  @override
  Widget build(BuildContext context) {
    if (message == null) return const SizedBox.shrink();
    final saved =
        message == 'SAVED' ||
        message == 'BILL_HELD' ||
        message == 'PRINT_SENT' ||
        message == 'POS_USERNAME_SAVED' ||
        message == 'REVERSAL_SAVED' ||
        message == 'REVERSAL_QUEUED';
    final colors = Theme.of(context).colorScheme;
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        color: saved ? colors.secondaryContainer : colors.errorContainer,
        child: Text(message!.tr),
      ),
    );
  }
}
