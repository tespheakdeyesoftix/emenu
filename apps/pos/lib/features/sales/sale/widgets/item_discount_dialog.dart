import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../core/pricing.dart';
import '../../../../shared/forms/input_number_dialog_widget.dart';
import '../../../../shared/forms/reusable_reason_field.dart';

typedef ItemDiscount = ({int amount, int? bps, CartReason reason});

class ItemDiscountDialog extends StatefulWidget {
  const ItemDiscountDialog({
    super.key,
    required this.currency,
    required this.subtotal,
    required this.reasons,
  });

  final String currency;
  final int subtotal;
  final List<String> reasons;

  @override
  State<ItemDiscountDialog> createState() => _ItemDiscountDialogState();
}

class _ItemDiscountDialogState extends State<ItemDiscountDialog> {
  CartReason _reason = (text: '', remember: false);
  bool _percent = true;
  bool _showNote = false;
  num? _value;

  @override
  Widget build(BuildContext context) {
    final decimal = _percent || widget.currency == 'USD';
    final scale = decimal ? 100 : 1;
    if (!_showNote) {
      return InputNumberDialogWidget(
        key: ValueKey(_percent),
        title: 'cart_discount'.tr,
        header: SegmentedButton<bool>(
          segments: [
            ButtonSegment(value: true, label: Text('cart_discount_percent'.tr)),
            ButtonSegment(value: false, label: Text('cart_discount_amount'.tr)),
          ],
          selected: {_percent},
          showSelectedIcon: false,
          onSelectionChanged: (selection) => setState(() {
            _percent = selection.single;
            _value = null;
          }),
        ),
        label: _percent ? '%' : widget.currency,
        presets: [
          if (_percent)
            for (var rate = 5; rate <= 50; rate += 5)
              (label: '$rate%', value: rate),
        ],
        value: _value,
        isFloat: decimal,
        decimalPlaces: decimal ? 2 : 0,
        min: 1 / scale,
        max: _percent ? 100 : widget.subtotal / scale,
        confirmText: 'next'.tr,
        onConfirm: (value) => setState(() {
          _value = value;
          _showNote = true;
        }),
      );
    }

    final units = (_value! * scale).round();
    return AlertDialog(
      scrollable: true,
      title: Text('cart_discount'.tr),
      content: SizedBox(
        width: 304,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 12,
          children: [
            Text(_percent ? '$_value%' : displayAmount(units, widget.currency)),
            ReusableReasonField(
              reasons: widget.reasons,
              initialReason: _reason,
              label: 'cart_discount_note'.tr,
              autofocus: true,
              onChanged: (reason) => setState(() => _reason = reason),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => setState(() => _showNote = false),
          child: Text('back'.tr),
        ),
        FilledButton(
          onPressed: _reason.text.isEmpty
              ? null
              : () => Navigator.pop<ItemDiscount>(context, (
                  amount: _percent ? 0 : units,
                  bps: _percent ? units : null,
                  reason: _reason,
                )),
          child: Text('save'.tr),
        ),
      ],
    );
  }
}
