import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:get/get.dart';
import 'package:printing/printing.dart';

import '../../../../core/pos_api.dart';
import '../../../../core/pricing.dart';
import '../../../../core/register_database.dart';
import '../../../../global.dart';
import '../../../../shared/forms/app_dropdown.dart';
import '../../../../ui/shared_widgets.dart';
import '../receipt_document.dart';

class ReceiptDialog extends StatefulWidget {
  const ReceiptDialog({
    super.key,
    required this.sale,
    required this.syncStatus,
    required this.recordPrint,
    this.reverse,
  });

  final LocalSale sale;
  final String syncStatus;
  final Future<void> Function(int copies) recordPrint;
  final VoidCallback? reverse;

  @override
  State<ReceiptDialog> createState() => _ReceiptDialogState();
}

class _ReceiptDialogState extends State<ReceiptDialog> {
  final _paper = GlobalKey();
  late final Json _data = jsonObject(jsonDecode(widget.sale.request));
  late final Json _receipt = _data['receipt'] is Map
      ? jsonObject(_data['receipt'])
      : {};
  late final Json _template = _receipt['template'] is Map
      ? jsonObject(_receipt['template'])
      : {};
  late final int _copies = (_receipt['copies'] as int? ?? 1).clamp(1, 10);
  int _paperMm = 80;
  bool _printing = false;
  String? _status;

  LocalSale get _sale => widget.sale;
  String get _number => _receiptNumber(_sale.id);

  Future<void> _print() async {
    if (_printing) return;
    setState(() {
      _printing = true;
      _status = null;
    });
    var sent = false;
    LoadingHandle? loading;
    try {
      loading = await app.showLoading();
      if (!mounted) return;
      final boundary =
          _paper.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 2.25);
      final double ratio;
      final ByteData? pixels;
      try {
        ratio = image.height / image.width;
        pixels = await image.toByteData(format: ui.ImageByteFormat.png);
      } finally {
        image.dispose();
      }
      if (pixels == null) throw StateError('Receipt image was unavailable');
      final document = await receiptDocument(
        png: pixels.buffer.asUint8List(
          pixels.offsetInBytes,
          pixels.lengthInBytes,
        ),
        heightToWidth: ratio,
        widthMm: _paperMm,
        copies: _copies,
      );
      sent = await Printing.layoutPdf(
        name: 'eMenu POS $_number',
        format: document.format,
        dynamicLayout: false,
        onLayout: (_) async => document.bytes,
      );
      if (sent) {
        await widget.recordPrint(_copies);
        _status = 'PRINT_SENT';
      }
    } catch (_) {
      _status = sent ? 'PRINT_LOG_ERROR' : 'PRINT_FAILED';
    } finally {
      loading?.close();
      if (mounted) setState(() => _printing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final language = Get.locale?.languageCode ?? 'km';
    final title = (_template['title'] as String?)?.trim() ?? '';
    final lines = jsonRows(_data['quote']);
    final names = _receipt['payment_type_names'] as Map? ?? const {};
    return AlertDialog(
      title: Text('receipt'.tr),
      content: SizedBox(
        width: 400,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: SingleChildScrollView(
                child: Center(
                  child: SizedBox(
                    width: _paperMm == 58 ? 260 : 340,
                    child: RepaintBoundary(
                      key: _paper,
                      child: ColoredBox(
                        color: Colors.white,
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: DefaultTextStyle(
                            style: const TextStyle(
                              fontFamily: 'Noto Sans Khmer',
                              fontSize: 14,
                              color: Colors.black,
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Text(
                                  title.isNotEmpty
                                      ? title
                                      : (_receipt['business_name'] as String? ??
                                            'eMenu POS'),
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  '$_number · ${_receipt['business_date'] ?? ''}',
                                  textAlign: TextAlign.center,
                                ),
                                if (_sale.reversesSaleId != null) ...[
                                  Text(
                                    'reversal'.tr,
                                    textAlign: TextAlign.center,
                                  ),
                                  Text(
                                    '${'original_receipt'.tr} ${_receiptNumber(_sale.reversesSaleId!)}',
                                  ),
                                  Text(_data['reason'] as String),
                                ],
                                for (final key in [
                                  'operator_name',
                                  'table_label',
                                  'customer_name',
                                ])
                                  if (_receipt[key] is String)
                                    Text(_receipt[key] as String),
                                const Divider(color: Colors.black),
                                for (final line in lines)
                                  _ReceiptRow(
                                    '${line['quantity']} × ${line['name_$language'] ?? line['product_id']}',
                                    displayAmount(
                                      line['total_minor'] as int,
                                      _sale.currency,
                                    ),
                                  ),
                                const Divider(color: Colors.black),
                                if (_template['show_tax'] == true)
                                  _ReceiptRow(
                                    'receipt_tax'.tr,
                                    displayAmount(
                                      lines.fold(
                                        0,
                                        (sum, row) =>
                                            sum + (row['tax_minor'] as int),
                                      ),
                                      _sale.currency,
                                    ),
                                  ),
                                _ReceiptRow(
                                  'total'.tr,
                                  displayAmount(_sale.total, _sale.currency),
                                  bold: true,
                                ),
                                for (final payment in jsonRows(
                                  _data['payments'],
                                ))
                                  _ReceiptRow(
                                    payment['entry_type'] == 'change'
                                        ? 'change'.tr
                                        : names[payment['payment_type_id']]
                                                  as String? ??
                                              'payment_type'.tr,
                                    displayAmount(
                                      payment['amount_minor'] as int,
                                      payment['currency'] as String,
                                    ),
                                  ),
                                if (widget.syncStatus != 'synced')
                                  Text(
                                    widget.syncStatus.tr,
                                    textAlign: TextAlign.center,
                                  ),
                                if (_template['footer'] is String)
                                  Text(
                                    _template['footer'] as String,
                                    textAlign: TextAlign.center,
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            if (_status != null) RegisterNotice(_status),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('${'receipt_copies'.tr} $_copies'),
                AppDropdown<int>(
                  value: _paperMm,
                  items: const [
                    DropdownMenuItem(value: 58, child: Text('58 mm')),
                    DropdownMenuItem(value: 80, child: Text('80 mm')),
                  ],
                  onChanged: _printing
                      ? null
                      : (value) => setState(() => _paperMm = value!),
                ),
              ],
            ),
          ],
        ),
      ),
      actions: [
        if (widget.reverse != null)
          TextButton(
            onPressed: _printing ? null : widget.reverse,
            child: Text('reverse_sale'.tr),
          ),
        TextButton(
          onPressed: _printing ? null : () => Navigator.pop(context),
          child: Text('close'.tr),
        ),
        RegisterButton(
          'print',
          icon: Icons.print_outlined,
          onPressed: _printing ? null : _print,
        ),
      ],
    );
  }
}

class ReversalDialog extends StatelessWidget {
  const ReversalDialog({
    super.key,
    required this.sale,
    required this.offlineOperations,
  });

  final LocalSale sale;
  final bool offlineOperations;

  @override
  Widget build(BuildContext context) => ReasonDialog(
    'reverse_sale',
    details: [
      Text(
        displayAmount(sale.total, sale.currency),
        style: Theme.of(context).textTheme.titleLarge,
      ),
      Text((offlineOperations ? 'reversal_external' : 'reversal_wait').tr),
      for (final entry in _netTenders(sale).entries)
        if (entry.value > 0)
          _ReceiptRow(entry.key.$1, displayAmount(entry.value, entry.key.$2)),
    ],
  );
}

String _receiptNumber(String id) =>
    id.substring(0, min(8, id.length)).toUpperCase();

Map<(String, String), int> _netTenders(LocalSale sale) {
  final request = jsonObject(jsonDecode(sale.request));
  final receipt = request['receipt'] as Map?;
  final names = receipt?['payment_type_names'] as Map?;
  final totals = <(String, String), int>{};
  for (final payment in jsonRows(request['payments'])) {
    final label =
        names?[payment['payment_type_id']] as String? ?? 'payment_type'.tr;
    final key = (label, payment['currency'] as String);
    final amount = payment['amount_minor'] as int;
    totals.update(
      key,
      (total) => total + (payment['entry_type'] == 'change' ? -amount : amount),
      ifAbsent: () => payment['entry_type'] == 'change' ? -amount : amount,
    );
  }
  return totals;
}

class _ReceiptRow extends StatelessWidget {
  const _ReceiptRow(this.label, this.amount, {this.bold = false});

  final String label;
  final String amount;
  final bool bold;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 2),
    child: DefaultTextStyle.merge(
      style: TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.normal),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Text(label)),
          const SizedBox(width: 8),
          Text(amount),
        ],
      ),
    ),
  );
}
