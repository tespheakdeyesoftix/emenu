import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../ui/shared_widgets.dart';

import 'app_text_form_field.dart';

class ValueEditorDialog extends StatefulWidget {
  const ValueEditorDialog({
    super.key,
    required this.label,
    required this.initial,
    required this.validate,
    this.isNote = false,
    this.decimal = false,
    this.allowReset = false,
  });

  final String label, initial;
  final String? Function(String) validate;
  final bool isNote, decimal, allowReset;

  @override
  State<ValueEditorDialog> createState() => _ValueEditorDialogState();
}

class _ValueEditorDialogState extends State<ValueEditorDialog> {
  final _form = GlobalKey<FormState>();
  late String value = widget.initial;

  void save() {
    if (_form.currentState!.validate()) Navigator.pop(context, value.trim());
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    scrollable: true,
    title: Text(widget.label.tr),
    content: Form(
      key: _form,
      child: AppTextFormField(
        autofocus: true,
        initialValue: widget.initial,
        maxLength: widget.isNote ? 500 : 14,
        maxLines: widget.isNote ? 3 : 1,
        keyboardType: widget.isNote
            ? TextInputType.multiline
            : TextInputType.numberWithOptions(decimal: widget.decimal),
        inputFormatters: widget.isNote || widget.decimal
            ? null
            : [FilteringTextInputFormatter.digitsOnly],
        validator: (input) => widget.validate(input?.trim() ?? ''),
        onChanged: (text) => value = text,
        onFieldSubmitted: widget.isNote ? null : (_) => save(),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: Text('back'.tr),
      ),
      if (widget.allowReset)
        TextButton(
          onPressed: () => Navigator.pop(context, ''),
          child: Text('cart_reset_price'.tr),
        ),
      RegisterButton('save', onPressed: save),
    ],
  );
}
