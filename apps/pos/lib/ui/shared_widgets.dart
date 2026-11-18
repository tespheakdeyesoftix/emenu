import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../shared/forms/app_text_form_field.dart';
import '../shared/register_toast.dart';

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

class LanguageButton extends StatelessWidget {
  const LanguageButton({super.key, this.iconOnly = false});

  final bool iconOnly;

  @override
  Widget build(BuildContext context) {
    final khmer = Get.locale?.languageCode == 'km';
    final label = khmer ? 'EN' : 'ខ្មែរ';
    void toggle() => Get.updateLocale(Locale(khmer ? 'en' : 'km'));

    if (iconOnly) {
      return IconButton(
        onPressed: toggle,
        tooltip: label,
        style: IconButton.styleFrom(
          foregroundColor: Theme.of(context).colorScheme.onSurfaceVariant,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
        ),
        icon: const Icon(Icons.translate),
      );
    }
    return TextButton(onPressed: toggle, child: Text(label));
  }
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
              AppTextFormField(
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
    final saved = isSuccessfulRegisterMessage(message);
    final colors = Theme.of(context).colorScheme;
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: saved ? colors.primaryContainer : colors.errorContainer,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          spacing: 10,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              saved
                  ? Icons.check_circle_outline_rounded
                  : Icons.info_outline_rounded,
              size: 20,
              color: saved ? colors.primary : colors.error,
            ),
            Expanded(
              child: Text(
                message!.tr,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: saved
                      ? colors.onPrimaryContainer
                      : colors.onErrorContainer,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
