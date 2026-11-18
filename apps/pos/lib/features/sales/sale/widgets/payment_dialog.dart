import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../core/pos_api.dart';
import '../../../../core/pricing.dart';
import '../../../../helpers/helper.dart';
import '../../../../shared/forms/app_checkbox_field.dart';
import '../../../../shared/forms/app_selection_field.dart';
import '../../../../shared/forms/app_text_field.dart';
import '../../../../ui/shared_widgets.dart';

class PaymentDialog extends StatefulWidget {
  const PaymentDialog({
    super.key,
    required this.total,
    required this.currency,
    required this.rate,
    required this.types,
    required this.defaultType,
  });

  final int total;
  final String currency;
  final String rate;
  final List<Json> types;
  final String? defaultType;

  @override
  State<PaymentDialog> createState() => _PaymentDialogState();
}

class _PaymentDialogState extends State<PaymentDialog> {
  final amount = TextEditingController();
  final reference = TextEditingController();
  final entries = <Json>[];
  late Json type;
  late String currency;
  bool change = false;
  String? error;

  @override
  void initState() {
    super.initState();
    type = widget.types.firstWhere(
      (row) => row['id'] == widget.defaultType,
      orElse: () => widget.types.first,
    );
    final accepted = paymentCurrencies(type);
    currency = accepted.contains(widget.currency)
        ? widget.currency
        : accepted.first;
    if (currency == widget.currency && widget.total > 0) {
      amount.text = amountInputValue(widget.total, currency);
    }
  }

  @override
  void dispose() {
    amount.dispose();
    reference.dispose();
    super.dispose();
  }

  int? get paid {
    try {
      return paymentTotal(
        entries: entries,
        paymentTypes: widget.types,
        primary: widget.currency,
        rate: widget.rate,
      );
    } on FormatException {
      return null;
    }
  }

  void _add() {
    final minor = parseAmount(amount.text, currency);
    if (minor == null || minor < 1 || entries.length >= 60) {
      setState(() => error = 'PAYMENT_TOTAL_MISMATCH');
      return;
    }
    setState(() {
      entries.add({
        'payment_type_id': type['id'],
        'currency': currency,
        'amount_minor': minor,
        'entry_type': change ? 'change' : 'tender',
        if (reference.text.trim().isNotEmpty)
          'reference': reference.text.trim(),
      });
      error = null;
      amount.clear();
      reference.clear();
    });
  }

  void _submit() {
    if (entries.isEmpty && widget.total > 0) _add();
    if (paid == widget.total) {
      Navigator.pop(context, List<Json>.of(entries));
    } else {
      setState(() => error = 'PAYMENT_TOTAL_MISMATCH');
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(
      displayAmount(widget.total, widget.currency),
      style: Theme.of(context).textTheme.headlineSmall
          ?.copyWith(color: Theme.of(context).colorScheme.primary),
    ),
    content: SizedBox(
      width: 440,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 8,
          children: [
            RegisterNotice(error),
            for (final (index, entry) in entries.indexed)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  displayAmount(
                    (entry['entry_type'] == 'change' ? -1 : 1) *
                        (entry['amount_minor'] as int),
                    entry['currency'] as String,
                  ),
                ),
                subtitle: Text(
                  widget.types.firstWhere(
                        (row) => row['id'] == entry['payment_type_id'],
                      )['name']
                      as String,
                ),
                trailing: IconButton(
                  icon: const Icon(Icons.remove_circle_outline),
                  onPressed: () => setState(() => entries.removeAt(index)),
                ),
              ),
            AppSelectionField<String>(
              initialValue: type['id'] as String,
              decoration: InputDecoration(labelText: 'payment_type'.tr),
              items: widget.types
                  .map(
                    (row) => DropdownMenuItem(
                      value: row['id'] as String,
                      child: Text(row['name'] as String),
                    ),
                  )
                  .toList(),
              onChanged: (id) => setState(() {
                type = widget.types.firstWhere((row) => row['id'] == id);
                final accepted = paymentCurrencies(type);
                if (!accepted.contains(currency)) {
                  currency = accepted.first;
                  amount.clear();
                }
                if (type['kind'] != 'cash') change = false;
              }),
            ),
            AppSelectionField<String>(
              key: ValueKey((type['id'], currency)),
              initialValue: currency,
              decoration: InputDecoration(labelText: 'currency'.tr),
              items: paymentCurrencies(type)
                  .map(
                    (value) =>
                        DropdownMenuItem(value: value, child: Text(value)),
                  )
                  .toList(),
              onChanged: paymentCurrencies(type).length > 1
                  ? (value) => setState(() {
                      currency = value!;
                      amount.clear();
                    })
                  : null,
            ),
            AppTextField(
              controller: amount,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: InputDecoration(labelText: 'amount'.tr),
            ),
            if (type['kind'] == 'cash')
              AppCheckboxField(
                value: change,
                title: Text('change'.tr),
                onChanged: (value) => setState(() => change = value!),
              )
            else
              AppTextField(
                controller: reference,
                maxLength: 160,
                decoration: InputDecoration(
                  labelText: 'reference'.tr,
                  counterText: '',
                ),
              ),
            OutlinedButton.icon(
              onPressed: _add,
              icon: const Icon(Icons.add),
              label: Text('add'.tr),
            ),
          ],
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: Text('back'.tr),
      ),
      RegisterButton('pay', onPressed: _submit),
    ],
  );
}
