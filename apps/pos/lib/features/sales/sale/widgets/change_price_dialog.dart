import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../core/pricing.dart';
import '../../../../shared/forms/input_number_dialog_widget.dart';
import '../cart_line.dart';
import '../../../../shared/forms/reusable_reason_field.dart';

typedef PriceChange = ({int amount, String reason, bool remember});

class ChangePriceDialog extends StatefulWidget {
  const ChangePriceDialog({
    super.key,
    required this.line,
    required this.currency,
    required this.reasons,
    required this.validAmount,
  });

  final CartLine line;
  final String currency;
  final List<String> reasons;
  final bool Function(int) validAmount;

  @override
  State<ChangePriceDialog> createState() => _ChangePriceDialogState();
}

class _ChangePriceDialogState extends State<ChangePriceDialog> {
  CartReason _reason = (text: '', remember: false);

  @override
  Widget build(BuildContext context) {
    final usd = widget.currency == 'USD';
    num major(int amount) => usd ? amount / 100 : amount;
    int minor(num value) => usd ? (value * 100).round() : value.toInt();
    return InputNumberDialogWidget(
      title: 'cart_base_price'.tr,
      label: widget.currency,
      value: major(widget.line.basePrice),
      isFloat: usd,
      decimalPlaces: usd ? 2 : 0,
      min: 0,
      max: major(maxPosAmount),
      preset: widget.line.basePriceOverride == null
          ? null
          : (label: 'cart_reset_price'.tr, value: major(widget.line.catalogBase)),
      validate: (value) => widget.validAmount(minor(value)),
      canConfirm: _reason.text.isNotEmpty,
      onConfirm: (value) => Navigator.pop<PriceChange>(context, (
        amount: minor(value),
        reason: _reason.text,
        remember: _reason.remember,
      )),
      footer: ReusableReasonField(
        reasons: widget.reasons,
        onChanged: (reason) => setState(() => _reason = reason),
      ),
    );
  }
}
