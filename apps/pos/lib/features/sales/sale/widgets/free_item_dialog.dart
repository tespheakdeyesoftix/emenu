import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../core/pricing.dart';
import '../../../../shared/forms/input_number_dialog_widget.dart';
import '../../../../shared/forms/reusable_reason_field.dart';

typedef FreeItem = ({num quantity, CartReason reason});

class FreeItemDialog extends StatefulWidget {
  const FreeItemDialog({
    super.key,
    required this.quantity,
    required this.reasons,
  });

  final num quantity;
  final List<String> reasons;

  @override
  State<FreeItemDialog> createState() => _FreeItemDialogState();
}

class _FreeItemDialogState extends State<FreeItemDialog> {
  late num _quantity = widget.quantity < 1 ? widget.quantity : 1;
  CartReason _reason = (text: '', remember: false);
  bool _showReason = false;

  @override
  Widget build(BuildContext context) {
    if (!_showReason) {
      return InputNumberDialogWidget(
        title: 'cart_mark_free'.tr,
        label: 'cart_free_qty'.tr,
        value: _quantity,
        isFloat: true,
        decimalPlaces: 3,
        min: 0.001,
        max: widget.quantity,
        confirmText: 'next'.tr,
        onConfirm: (quantity) => setState(() {
          _quantity = normalizedQuantity(quantity);
          _showReason = true;
        }),
      );
    }

    return AlertDialog(
      scrollable: true,
      title: Text('cart_mark_free'.tr),
      content: SizedBox(
        width: 304,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 12,
          children: [
            Text('${'cart_free_qty'.tr} · $_quantity'),
            ReusableReasonField(
              reasons: widget.reasons,
              initialReason: _reason,
              onChanged: (reason) => setState(() => _reason = reason),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => setState(() => _showReason = false),
          child: Text('back'.tr),
        ),
        FilledButton(
          onPressed: _reason.text.isEmpty
              ? null
              : () => Navigator.pop<FreeItem>(
                  context,
                  (quantity: _quantity, reason: _reason),
                ),
          child: Text('save'.tr),
        ),
      ],
    );
  }
}
