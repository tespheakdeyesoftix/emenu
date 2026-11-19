import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/api_endpoint.dart';
import '../../../core/pos_api.dart';
import '../../../core/pricing.dart';
import '../../../shared/forms/app_text_field.dart';
import '../../../ui/shared_widgets.dart';
import '../../register/register_controller.dart';

typedef _FloatTender = ({String id, String name, String currency});

class OpenShiftDialogWidget extends StatefulWidget {
  const OpenShiftDialogWidget._({
    required this.paymentTypes,
    required this.currency,
    required this.exchangeRate,
  });

  final List<Json> paymentTypes;
  final String currency;
  final String exchangeRate;

  static Future<void> open(
    BuildContext context,
    RegisterController controller,
  ) async {
    if (!controller.canOpenOperatingSession ||
        controller.needsWorkingDay ||
        !controller.needsCashierShift) {
      return;
    }
    final dayId = (controller.context['working_day'] as Map?)?['id'];
    final business = jsonObject(controller.context['business']);
    final operator = controller.operator.value?.id;
    final profile = controller.installation.value?.profileId;
    final paymentTypes = controller.paymentTypes.where(allowsCashFloat).toList();
    final input = await showDialog<Json>(
      context: context,
      builder: (_) => OpenShiftDialogWidget._(
        paymentTypes: paymentTypes,
        currency: business['currency'] as String,
        exchangeRate: business['secondary_exchange_rate'].toString(),
      ),
    );
    if (input == null ||
        !context.mounted ||
        operator != controller.operator.value?.id ||
        profile != controller.installation.value?.profileId) {
      return;
    }
    if (!controller.canOpenOperatingSession ||
        !controller.needsCashierShift ||
        controller.needsWorkingDay ||
        dayId != (controller.context['working_day'] as Map?)?['id']) {
      controller.message.value = 'SALE_CONTEXT_CHANGED';
      return;
    }
    await controller.operation(ApiEndpoint.cashierShifts, {
      ...input,
      'day_id': dayId,
    });
  }

  @override
  State<OpenShiftDialogWidget> createState() => _OpenShiftDialogWidgetState();
}

class _OpenShiftDialogWidgetState extends State<OpenShiftDialogWidget> {
  late final List<_FloatTender> _tenders = [
    for (final type in widget.paymentTypes)
      for (final currency in paymentCurrencies(type))
        (
          id: type['id'] as String,
          name: type['name'] as String,
          currency: currency,
        ),
  ];
  late final _amounts = [for (final _ in _tenders) TextEditingController()];
  final _note = TextEditingController();

  @override
  void dispose() {
    for (final controller in _amounts) {
      controller.dispose();
    }
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final entries = <Json>[];
    final invalid = <int>{};
    for (final (index, tender) in _tenders.indexed) {
      final input = _amounts[index].text.trim();
      final amount = input.isEmpty ? 0 : parseAmount(input, tender.currency);
      if (amount == null) {
        invalid.add(index);
      } else if (amount > 0) {
        entries.add({
          'payment_type_id': tender.id,
          'currency': tender.currency,
          'amount_minor': amount,
        });
      }
    }
    int? total;
    if (invalid.isEmpty) {
      try {
        total = paymentTotal(
          entries: entries,
          paymentTypes: widget.paymentTypes,
          primary: widget.currency,
          rate: widget.exchangeRate,
        );
      } on FormatException {
        total = null;
      }
    }
    final theme = Theme.of(context);
    final note = _note.text.trim();
    final noteTooLong = note.length > 500;
    return AlertDialog(
      scrollable: true,
      title: Text('open_shift'.tr),
      content: SizedBox(
        width: 420,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          spacing: 12,
          children: [
            if (_tenders.isNotEmpty) ...[
              Text('shift_opening_instructions'.tr),
              for (final (index, tender) in _tenders.indexed)
                AppTextField(
                  controller: _amounts[index],
                  keyboardType: TextInputType.numberWithOptions(
                    decimal: tender.currency == 'USD',
                  ),
                  decoration: InputDecoration(
                    labelText: '${tender.name} · ${tender.currency}',
                    hintText: tender.currency == 'USD' ? '0.00' : '0',
                    errorText: invalid.contains(index)
                        ? 'INVALID_AMOUNT'.tr
                        : null,
                  ),
                  onChanged: (_) => setState(() {}),
                ),
            ],
            ListTile(
              dense: true,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              tileColor: theme.colorScheme.surfaceContainerHighest,
              title: Text('${'shift_opening_total'.tr} · ${widget.currency}'),
              trailing: Text(
                total == null ? '—' : displayAmount(total, widget.currency),
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            AppTextField(
              controller: _note,
              decoration: InputDecoration(
                labelText: 'shift_optional_note'.tr,
                errorText: noteTooLong ? 'cart_note_too_long'.tr : null,
              ),
              maxLength: 500,
              maxLines: 2,
              onChanged: (_) => setState(() {}),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('back'.tr),
        ),
        RegisterButton(
          'open_shift',
          onPressed: total == null || noteTooLong
              ? null
              : () => Navigator.pop(context, {
                  'opening_cash': entries,
                  if (note.isNotEmpty) 'note': note,
                }),
        ),
      ],
    );
  }
}
