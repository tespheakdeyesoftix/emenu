import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:timezone/timezone.dart' as tz;

import '../../../core/pos_api.dart';
import '../../../core/pricing.dart';
import '../../../helpers/helper.dart';
import 'cart_line.dart';
import 'sale_history_entry.dart';
import 'sale_service.dart';
import 'widgets/receipt_dialog.dart';

String salesActivityLabel(
  BuildContext context,
  DateTime time,
  tz.Location zone,
) {
  final local = tz.TZDateTime.from(time, zone);
  final format = MaterialLocalizations.of(context);
  return '${format.formatShortDate(local)} · '
      '${format.formatTimeOfDay(TimeOfDay.fromDateTime(local))}';
}

class SaleDetailDialogWidget extends StatefulWidget {
  const SaleDetailDialogWidget({
    super.key,
    required this.entry,
    required this.service,
    required this.operatorId,
    required this.timeZone,
    required this.isCurrent,
    required this.afterChange,
    this.loadServer,
  });

  final SaleHistoryEntry entry;
  final SaleService service;
  final String operatorId;
  final tz.Location timeZone;
  final bool Function() isCurrent;
  final VoidCallback afterChange;
  final Future<Json> Function()? loadServer;

  @override
  State<SaleDetailDialogWidget> createState() => _SaleDetailDialogWidgetState();
}

class _SaleDetailDialogWidgetState extends State<SaleDetailDialogWidget> {
  late Future<Json>? _server = widget.loadServer?.call();

  SaleHistoryEntry get _entry => widget.entry;
  SaleService get _service => widget.service;

  void _resume() {
    if (!widget.isCurrent()) return;
    Navigator.pop(context);
    _service.openHeldBillFromHistory(_entry.bill!);
  }

  Future<void> _discard() async {
    if (!widget.isCurrent() || !await confirmDiscard(context, 'discard')) {
      return;
    }
    if (!mounted || !widget.isCurrent()) return;
    Navigator.pop(context);
    await _service.discardBill(_entry.bill!);
    widget.afterChange();
  }

  Future<void> _reverse() async {
    final sale = _entry.sale!;
    if (!widget.isCurrent() || !_service.canReverseSale(sale)) return;
    final expected = _service.operatingContext;
    final reason = await showDialog<String>(
      context: context,
      builder: (_) => ReversalDialog(
        sale: sale,
        offlineOperations: _service.storeOperations,
      ),
    );
    if (reason == null || !mounted || !widget.isCurrent()) return;
    Navigator.pop(context);
    await _service.reverseSale(sale, reason, expected);
    widget.afterChange();
  }

  Future<void> _receipt() => showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => ReceiptDialog(
      sale: _entry.sale!,
      syncStatus: _entry.sync!.status,
      recordPrint: (copies) =>
          _service.recordReceiptPrint(_entry.sale!, widget.operatorId, copies),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final sale = _entry.sale;
    return AlertDialog(
      title: Text('${'sales_details'.tr} #${_entry.reference}'),
      content: SizedBox(
        width: 560,
        child: SingleChildScrollView(
          child: _server == null
              ? _details(_entry.data)
              : FutureBuilder<Json>(
                  future: _server,
                  builder: (context, snapshot) {
                    if (snapshot.connectionState != ConnectionState.done) {
                      return const Center(child: CircularProgressIndicator());
                    }
                    if (snapshot.hasError) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _header(_entry.data),
                          const SizedBox(height: 12),
                          Text('sales_details_unavailable'.tr),
                          TextButton(
                            onPressed: !widget.isCurrent()
                                ? null
                                : () => setState(
                                    () => _server = widget.loadServer!(),
                                  ),
                            child: Text('refresh'.tr),
                          ),
                        ],
                      );
                    }
                    return _details(snapshot.data!);
                  },
                ),
        ),
      ),
      actions: [
        if (_entry.bill != null) ...[
          TextButton(onPressed: _discard, child: Text('discard'.tr)),
          FilledButton(onPressed: _resume, child: Text('sales_resume'.tr)),
        ],
        if (sale != null) ...[
          if (_entry.reversalStatus == null && _service.canReverseSale(sale))
            TextButton(onPressed: _reverse, child: Text('reverse_sale'.tr)),
          FilledButton.icon(
            onPressed: _receipt,
            icon: const Icon(Icons.receipt_long_outlined),
            label: Text('receipt'.tr),
          ),
        ],
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('close'.tr),
        ),
      ],
    );
  }

  Widget _header(Json data) {
    final tender = historyObject(data['receipt']);
    final theme = Theme.of(context);
    final status = !_entry.serverOnly
        ? _entry.status
        : switch (data['status']) {
            'cancelled' => SaleHistoryStatus.voided,
            'paid' =>
              data['reverses_sale_id'] == null
                  ? SaleHistoryStatus.closed
                  : SaleHistoryStatus.voided,
            _ => _entry.status,
          };
    final customer = data['customer_name'] as String? ?? _entry.customer;
    final operatorName =
        tender['operator_name'] as String? ?? _entry.operatorName;
    final table = data['table_label'] as String? ?? _entry.table;
    final cover = data['guest_cover'] ?? tender['guest_cover'];
    final labels = [
      status.label.tr,
      if (_entry.carryover) 'sales_carryover'.tr,
      if (_entry.reversalStatus case final reversal?) reversal.tr,
      if (_entry.sync case final job? when job.status != 'synced')
        job.status.tr,
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(labels.join(' · '), style: theme.textTheme.titleSmall),
        Text(salesActivityLabel(context, _entry.activity, widget.timeZone)),
        const SizedBox(height: 8),
        Text(table ?? 'counter'.tr, style: theme.textTheme.titleMedium),
        if (customer != null) Text(customer),
        if (operatorName != null) Text(operatorName),
        if (cover is int && cover > 0) Text('${'guest_cover'.tr} · $cover'),
      ],
    );
  }

  Widget _details(Json data) {
    final receipt = historyObject(data['receipt']);
    final config = historyObject(
      historyObject(data['quote_context'])['profile'],
    )['config'];
    final isHeldSnapshot = !_entry.serverOnly && _entry.sale == null;
    final language = Get.locale?.languageCode ?? 'km';
    final lines = jsonRows(
      isHeldSnapshot || _entry.serverOnly ? data['lines'] : data['quote'],
    );
    final payments = jsonRows(data['payments']);
    final totals = <String, int>{};
    final currency = data['currency'] as String? ?? _entry.currency;
    final total = data['total_minor'] as int? ?? _entry.amount;
    final reason = data['reason'] as String?;
    final original =
        data['reverses_sale_id'] as String? ?? _entry.sale?.reversesSaleId;
    final reversedBy = data['reversed_by_sale_id'] as String?;

    final itemRows = <Widget>[];
    for (final saved in lines) {
      final line = isHeldSnapshot
          ? CartLine.fromHeldSnapshot(saved).quote(historyObject(config))
          : saved;
      final name =
          line['name_$language'] ?? line['product_name'] ?? line['product_id'];
      final portion =
          line['portion_name'] ?? historyObject(saved['portion'])['label'];
      final note = line['note'] as String?;
      for (final field in const [
        'subtotal_minor',
        'discount_minor',
        'tax_minor',
      ]) {
        if (line[field] case final int amount) {
          totals.update(field, (sum) => sum + amount, ifAbsent: () => amount);
        }
      }
      itemRows.add(
        _detailRow(
          '${line['quantity']} × $name${portion == null ? '' : ' · $portion'}'
          '${note == null || note.isEmpty ? '' : '\n$note'}',
          line['total_minor'] is int
              ? displayAmount(line['total_minor'] as int, currency)
              : '—',
        ),
      );
    }
    final names = historyObject(receipt['payment_type_names']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _header(data),
        if (original != null)
          Text('${'original_receipt'.tr} #${saleHistoryReference(original)}'),
        if (reversedBy != null)
          Text('${'reversal'.tr} #${saleHistoryReference(reversedBy)}'),
        if (reason != null && reason.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text('${'reason'.tr} · $reason'),
        ],
        const Divider(),
        ...itemRows,
        if (itemRows.isNotEmpty) const Divider(),
        if (totals['subtotal_minor'] case final subtotal?)
          _detailRow('cart_subtotal'.tr, displayAmount(subtotal, currency)),
        if (totals['discount_minor'] case final discount? when discount != 0)
          _detailRow('sales_discount'.tr, displayAmount(discount, currency)),
        if (totals['tax_minor'] case final tax? when tax != 0)
          _detailRow('receipt_tax'.tr, displayAmount(tax, currency)),
        _detailRow(
          'total'.tr,
          displayAmount(total, currency),
          emphasized: true,
        ),
        if (payments.isNotEmpty) const Divider(),
        for (final payment in payments)
          _detailRow(
            payment['entry_type'] == 'change'
                ? 'change'.tr
                : (payment['payment_type_name'] ??
                          names[payment['payment_type_id']] ??
                          'payment_type'.tr)
                      as String,
            displayAmount(
              payment['amount_minor'] as int,
              payment['currency'] as String,
            ),
          ),
        if (_entry.sync?.lastError case final error?)
          Text(
            error.tr,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
      ],
    );
  }

  Widget _detailRow(String label, String value, {bool emphasized = false}) {
    final style = emphasized ? Theme.of(context).textTheme.titleMedium : null;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Text(label, style: style)),
          const SizedBox(width: 12),
          Text(value, style: style),
        ],
      ),
    );
  }
}
