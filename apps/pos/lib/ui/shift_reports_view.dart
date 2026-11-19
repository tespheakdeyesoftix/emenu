import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:get/get.dart';
import 'package:printing/printing.dart';
import 'package:timezone/timezone.dart' as tz;

import '../core/api_endpoint.dart';
import '../core/pos_api.dart';
import '../core/pricing.dart';
import '../features/register/register_controller.dart';
import '../features/sales/sale/receipt_document.dart';
import '../shared/forms/app_selection_field.dart';
import '../shared/surface_card.dart';
import 'shared_widgets.dart';

String shiftTimestamp(
  BuildContext context,
  Object? value,
  String timezone, {
  String? businessDate,
}) {
  final parsed = DateTime.tryParse(value?.toString() ?? '');
  if (parsed == null) return 'shift_unavailable'.tr;
  final date = tz.TZDateTime.from(parsed, tz.getLocation(timezone));
  final material = MaterialLocalizations.of(context);
  final time = material.formatTimeOfDay(
    TimeOfDay.fromDateTime(date),
    alwaysUse24HourFormat: MediaQuery.alwaysUse24HourFormatOf(context),
  );
  final localDate = date.toIso8601String().substring(0, 10);
  return localDate == businessDate
      ? time
      : '${material.formatMediumDate(date)} · $time';
}

String shiftPerson(Json data, String key) =>
    (data['${key}_name'] ?? data[key] ?? 'shift_unavailable'.tr).toString();

String shiftAmount(Json row, String field) =>
    displayAmount((row[field] as int?) ?? 0, row['currency'] as String);

String shiftVariance(Json row) {
  final value = row['variance_minor'] as int;
  if (value == 0) return 'shift_balanced'.tr;
  final label = value < 0 ? 'shift_short' : 'shift_over';
  return '${label.tr} ${displayAmount(value.abs(), row['currency'] as String)}';
}

class ShiftTotals {
  ShiftTotals(Json report, Json business)
    : currency = (report['base_currency'] ?? business['currency']) as String,
      _fallbackRate = business['secondary_exchange_rate'].toString() {
    final saleRows = jsonRows(report['sales']);
    paidBills = saleRows.fold(
      0,
      (total, row) => total + (row['paid_bills'] as int),
    );
    netSales = _sum(
      saleRows,
      (row) => row['exchange_rate']?.toString(),
      rateUsesSourceCurrency: true,
    );
    final cash = jsonRows(report['cash']);
    final rate = report['exchange_rate']?.toString();
    cashIn = _sum(cash.where((row) => row['kind'] == 'cash_in'), (_) => rate);
    cashOut = _sum(cash.where((row) => row['kind'] == 'cash_out'), (_) => rate);
  }

  final String currency;
  final String _fallbackRate;
  late final int paidBills;
  late final int? netSales;
  late final int? cashIn;
  late final int? cashOut;
  bool estimated = false;

  int? _sum(
    Iterable<Json> rows,
    String? Function(Json) rateOf, {
    bool rateUsesSourceCurrency = false,
  }) {
    var total = 0;
    for (final row in rows) {
      final amount = row['amount_minor'] as int;
      if (amount == 0 || row['currency'] == currency) {
        total += amount;
        continue;
      }
      final rate = rateOf(row);
      if (rate == null) estimated = true;
      try {
        total += rateUsesSourceCurrency && rate != null
            ? primaryToSecondary(amount, row['currency'] as String, rate)
            : secondaryToPrimary(amount, currency, rate ?? _fallbackRate);
      } on FormatException {
        return null;
      }
    }
    return total;
  }

  String amount(int? value) =>
      value == null ? 'shift_unavailable'.tr : displayAmount(value, currency);
}

class ShiftMetric extends StatelessWidget {
  const ShiftMetric(this.label, this.value, {this.icon, super.key});

  final String label;
  final String value;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SurfaceCard(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      child: Row(
        children: [
          if (icon != null) ...[
            Icon(icon, color: theme.colorScheme.primary),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label.tr, style: theme.textTheme.bodySmall),
                Text(value, style: theme.textTheme.titleLarge),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ShiftCountReview extends StatelessWidget {
  const ShiftCountReview(this.review, this.register, this.id, {super.key});

  final Json review;
  final String register;
  final String id;

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text('shift_review_count'.tr),
    content: SizedBox(
      width: 490,
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('$register · $id'),
            for (final row in jsonRows(review['counts']))
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('${row['payment_type_name']} · ${row['currency']}'),
                subtitle: Text(
                  '${'shift_declared'.tr} ${shiftAmount(row, 'declared_minor')}',
                ),
                trailing: Text(
                  shiftVariance(row),
                  style: TextStyle(
                    color: row['variance_minor'] != 0
                        ? Theme.of(context).colorScheme.error
                        : null,
                  ),
                ),
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
      OutlinedButton(
        onPressed: () => Navigator.pop(context, false),
        child: Text('shift_recount'.tr),
      ),
      RegisterButton(
        'close_shift',
        onPressed: () => Navigator.pop(context, true),
      ),
    ],
  );
}

class ShiftDayReview extends StatelessWidget {
  const ShiftDayReview(
    this.details,
    this.business, {
    required this.connected,
    required this.unsent,
    this.register,
    super.key,
  });

  final Json details;
  final Json business;
  final bool connected;
  final bool unsent;
  final String? register;

  @override
  Widget build(BuildContext context) {
    final shifts = jsonRows(details['shifts']);
    final active = shifts.where((row) => row['closed_at'] == null);
    final bills = jsonRows(details['open_bills']);
    final blocked = active.isNotEmpty || bills.isNotEmpty || unsent;
    final totals = ShiftTotals(details, business);
    return AlertDialog(
      title: Text('shift_review_day'.tr),
      content: SizedBox(
        width: 560,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                (details['business_date'] ?? '').toString(),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              if (details['sales'] != null) ...[
                Text(
                  '${'shift_net_sales'.tr}  ${totals.amount(totals.netSales)}',
                ),
                Text(
                  '${details['register_count']} ${'shift_registers'.tr} · ${shifts.length} ${'shift_shifts'.tr}',
                ),
              ],
              const Divider(),
              Text(
                (blocked ? 'shift_day_blocked' : 'shift_day_ready').tr,
                style: Theme.of(context).textTheme.titleSmall,
              ),
              for (final row in active)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.point_of_sale),
                  title: Text(
                    (row['profile_name'] ?? 'shift_register'.tr).toString(),
                  ),
                  subtitle: Text(
                    '${'shift_resolve_open_shift'.tr} · ${shiftPerson(row, 'opened_by')}',
                  ),
                ),
              for (final row in bills)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.receipt_long_outlined),
                  title: Text(
                    '${row['profile_name'] ?? 'shift_register'.tr} · ${row['table_code'] ?? row['id']}',
                  ),
                  subtitle: Text('shift_resolve_open_bill'.tr),
                ),
              if (unsent)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.sync_problem),
                  title: Text(register ?? 'shift_register'.tr),
                  subtitle: Text('UNSYNCED_DAY_SALES'.tr),
                ),
              for (final row in jsonRows(details['discrepancies']))
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.balance),
                  title: Text(
                    '${row['payment_type_name']} · ${shiftVariance(row)}',
                  ),
                  subtitle: Text(
                    (shifts
                                .where((item) => item['id'] == row['shift_id'])
                                .firstOrNull?['profile_name'] ??
                            row['shift_id'])
                        .toString(),
                  ),
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
        RegisterButton(
          'close_day',
          onPressed: blocked || !connected
              ? null
              : () => Navigator.pop(context, true),
        ),
      ],
    );
  }
}

class ShiftActivity extends StatelessWidget {
  const ShiftActivity(
    this.data, {
    required this.timezone,
    required this.manager,
    super.key,
  });

  final Json data;
  final String timezone;
  final bool manager;

  String _drawerFormula(String currency) {
    int sum(String list, String field, bool Function(Json) matches) =>
        jsonRows(data[list])
            .where((row) => row['currency'] == currency && matches(row))
            .fold(0, (sum, row) => sum + (row[field] as int? ?? 0));
    return [
      for (final (label, kind) in [
        ('opening_cash', 'opening'),
        ('cash_in', 'cash_in'),
        ('cash_out', 'cash_out'),
      ])
        '${label.tr} ${displayAmount(sum('cash', 'amount_minor', (row) => row['kind'] == kind), currency)}',
      for (final (label, field) in [
        ('shift_cash_payments', 'payments_minor'),
        ('shift_cash_reversals', 'reversals_minor'),
      ])
        '${label.tr} ${displayAmount(sum('payments', field, (row) => row['payment_kind'] == 'cash'), currency)}',
    ].join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final activity = jsonRows(data['movements']);
    final drawer = jsonRows(data['drawer_counts'])
        .where((row) => row['payment_kind'] == 'cash')
        .toList();
    final types = {
      for (final row in jsonRows(data['tenders']))
        '${row['payment_type_id']}:${row['currency']}': row,
      for (final row in jsonRows(data['payments']))
        '${row['payment_type_id']}:${row['currency']}': row,
    };
    return SurfaceCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      child: Material(
        type: MaterialType.transparency,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ExpansionTile(
              title: Text('shift_recent_activity'.tr),
              leading: const Icon(Icons.list_alt),
              initiallyExpanded: true,
              children: [
                if (activity.isEmpty)
                  ListTile(title: Text('shift_no_cash_activity'.tr)),
                for (final row in activity)
                  ListTile(
                    leading: Icon(
                      row['kind'] == 'cash_in'
                          ? Icons.add_circle_outline
                          : Icons.remove_circle_outline,
                    ),
                    title: Text(
                      '${(row['kind'] as String).tr} · ${shiftAmount(row, 'amount_minor')}',
                    ),
                    subtitle: Text(
                      [
                        shiftTimestamp(
                          context,
                          row['created_at'],
                          timezone,
                          businessDate: data['business_date'] as String?,
                        ),
                        shiftPerson(row, 'created_by'),
                        if (row['reason_code'] != null &&
                            row['reason_code'] != 'other')
                          'shift_reason_${row['reason_code']}'.tr,
                        if (row['reason'] != null &&
                            row['reason'] != row['reason_code'])
                          row['reason'].toString(),
                      ].join(' · '),
                    ),
                  ),
              ],
            ),
            ExpansionTile(
              title: Text('shift_payments'.tr),
              leading: const Icon(Icons.credit_card),
              children: [
                if (types.isEmpty)
                  ListTile(title: Text('shift_no_payments'.tr)),
                for (final row in types.values)
                  ListTile(
                    title: Text(
                      '${row['payment_type_name'] ?? row['payment_type_id']} · ${row['currency']}',
                    ),
                    trailing: Text(shiftAmount(row, 'amount_minor')),
                  ),
              ],
            ),
            if (manager && drawer.isNotEmpty)
              ExpansionTile(
                title: Text('shift_expected_drawer'.tr),
                leading: const Icon(Icons.account_balance_wallet_outlined),
                children: [
                  for (final row in drawer)
                    ListTile(
                      title: Text(
                        '${row['payment_type_name']} · ${row['currency']}',
                      ),
                      trailing: Text(shiftAmount(row, 'expected_minor')),
                    ),
                  for (final currency
                      in drawer.map((row) => row['currency'] as String).toSet())
                    ListTile(
                      title: Text(currency),
                      subtitle: Text(_drawerFormula(currency)),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

class ShiftHistoryDialog extends StatefulWidget {
  const ShiftHistoryDialog(this.controller, {super.key});

  final RegisterController controller;

  @override
  State<ShiftHistoryDialog> createState() => _ShiftHistoryDialogState();
}

class _ShiftHistoryDialogState extends State<ShiftHistoryDialog> {
  final rows = <Object?, Json>{};
  final registers = <Object?, Json>{};
  final operators = <Object?, Json>{};
  bool branch = false, loading = false, more = false;
  String? error, date, register, operator;
  int page = 0, request = 0;

  RegisterController get controller => widget.controller;
  bool get manager =>
      const {'owner', 'manager'}.contains(controller.operator.value?.role);
  Json get _business => jsonObject(controller.context['business']);

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  Future<void> _load({bool reset = false}) async {
    final ticket = ++request;
    setState(() {
      loading = true;
      error = null;
      if (reset) {
        rows.clear();
        page = 0;
        more = false;
      }
    });
    final next = page + 1;
    try {
      final reply = await controller.readShiftManagement({
        'kind': 'history',
        'page': next,
        if (branch) 'scope': 'branch',
        if (date != null) 'business_date': date,
        if (register != null) 'profile_id': register,
        if (operator != null) 'opened_by': operator,
      });
      if (!mounted || ticket != request) return;
      setState(() {
        for (final row in jsonRows(reply['cashier_shifts'])) {
          rows[row['id']] = row;
          registers[row['profile_id']] = {
            'id': row['profile_id'],
            'name': row['profile_name'],
          };
          operators[row['opened_by']] = {
            'id': row['opened_by'],
            'name': shiftPerson(row, 'opened_by'),
          };
        }
        for (final row in jsonRows(reply['registers'])) {
          registers[row['id']] = row;
        }
        for (final row in jsonRows(reply['operators'])) {
          operators[row['id']] = row;
        }
        page = next;
        more = reply['has_more'] == true;
      });
    } catch (failure) {
      if (mounted && ticket == request) {
        setState(() {
          error = failure is PosApiError
              ? failure.code
              : 'SHIFT_DETAILS_UNAVAILABLE';
        });
      }
    } finally {
      if (mounted && ticket == request) setState(() => loading = false);
    }
  }

  Future<void> _date() async {
    final zone = tz.getLocation(_business['timezone'] as String);
    final today = tz.TZDateTime.now(zone);
    final selected = await showDatePicker(
      context: context,
      firstDate: DateTime(2000),
      lastDate: today,
      initialDate: DateTime.tryParse(date ?? '') ?? today,
    );
    if (selected == null || !mounted) return;
    setState(() => date = selected.toIso8601String().substring(0, 10));
    await _load(reset: true);
  }

  Future<void> _report(Json row) async {
    final reopened = await showDialog<bool>(
      context: context,
      builder: (_) =>
          ShiftReportDialog(controller, row['id'] as String, branch: branch),
    );
    if (reopened == true && mounted) await _load(reset: true);
  }

  Widget _filter(
    String label,
    String? current,
    Iterable<Json> entries,
    ValueChanged<String?> change,
  ) => SizedBox(
    width: 200,
    child: AppSelectionField<String>(
      initialValue: current ?? '',
      decoration: InputDecoration(labelText: label.tr),
      items: [
        DropdownMenuItem(value: '', child: Text('shift_all'.tr)),
        for (final entry in entries)
          if (entry['id'] is String)
            DropdownMenuItem(
              value: entry['id'] as String,
              child: Text(
                (entry['name'] ?? entry['id']).toString(),
                overflow: TextOverflow.ellipsis,
              ),
            ),
      ],
      onChanged: (value) {
        change(value == '' ? null : value);
        _load(reset: true);
      },
    ),
  );

  @override
  Widget build(BuildContext context) {
    final sorted = rows.values.toList()
      ..sort(
        (a, b) =>
            (b['opened_at'] as String).compareTo(a['opened_at'] as String),
      );
    return AlertDialog(
      title: Text('shift_history'.tr),
      content: SizedBox(
        width: 760,
        height: 480,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Wrap(
              spacing: 10,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                OutlinedButton.icon(
                  onPressed: _date,
                  icon: const Icon(Icons.date_range),
                  label: Text(date ?? 'shift_business_date'.tr),
                ),
                if (date != null)
                  IconButton(
                    onPressed: () {
                      date = null;
                      _load(reset: true);
                    },
                    tooltip: 'shift_clear_date'.tr,
                    icon: const Icon(Icons.clear),
                  ),
                if (manager)
                  FilterChip(
                    label: Text('shift_branch'.tr),
                    selected: branch,
                    onSelected: (value) {
                      branch = value;
                      register = null;
                      operator = null;
                      registers.clear();
                      operators.clear();
                      _load(reset: true);
                    },
                  ),
                if (branch)
                  _filter(
                    'shift_register',
                    register,
                    registers.values,
                    (value) => register = value,
                  ),
                if (branch)
                  _filter(
                    'shift_opened_by',
                    operator,
                    operators.values,
                    (value) => operator = value,
                  ),
              ],
            ),
            const SizedBox(height: 12),
            if (loading) const LinearProgressIndicator(),
            if (error != null) RegisterNotice(error),
            Expanded(
              child: !loading && sorted.isEmpty
                  ? Center(child: Text('shift_no_history'.tr))
                  : ListView(
                      children: [
                        for (final row in sorted)
                          ListTile(
                            title: Text(
                              '${row['business_date']} · ${row['profile_name'] ?? 'shift_register'.tr}',
                            ),
                            subtitle: Text(
                              '${shiftPerson(row, 'opened_by')} · ${shiftTimestamp(context, row['opened_at'], _business['timezone'] as String, businessDate: row['business_date'] as String?)}',
                            ),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => _report(row),
                          ),
                        if (more || error != null)
                          TextButton(
                            onPressed: loading ? null : () => _load(),
                            child: Text(
                              (more ? 'shift_load_more' : 'retry').tr,
                            ),
                          ),
                      ],
                    ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('back'.tr),
        ),
      ],
    );
  }
}

class ShiftReportDialog extends StatefulWidget {
  const ShiftReportDialog(
    this.controller,
    this.id, {
    this.branch = false,
    super.key,
  });

  final RegisterController controller;
  final String id;
  final bool branch;

  @override
  State<ShiftReportDialog> createState() => _ShiftReportDialogState();
}

class _ShiftReportDialogState extends State<ShiftReportDialog> {
  final paper = GlobalKey();
  late final report = widget.controller.readShiftManagement({
    'kind': 'summary',
    'id': widget.id,
    'historical': true,
    if (widget.branch) 'scope': 'branch',
  });
  bool printing = false;
  String? status;

  Future<void> _print() async {
    setState(() {
      printing = true;
      status = null;
    });
    try {
      final boundary =
          paper.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 2);
      final ByteData? pixels;
      final double ratio;
      try {
        ratio = image.height / image.width;
        pixels = await image.toByteData(format: ui.ImageByteFormat.png);
      } finally {
        image.dispose();
      }
      if (pixels == null) throw StateError('Receipt unavailable');
      final document = await receiptDocument(
        png: pixels.buffer.asUint8List(
          pixels.offsetInBytes,
          pixels.lengthInBytes,
        ),
        heightToWidth: ratio,
        widthMm: 80,
        copies: 1,
      );
      final sent = await Printing.layoutPdf(
        name: 'Shift ${widget.id}',
        format: document.format,
        dynamicLayout: false,
        onLayout: (_) async => document.bytes,
      );
      if (sent && mounted) setState(() => status = 'PRINT_SENT');
    } catch (_) {
      if (mounted) setState(() => status = 'PRINT_FAILED');
    } finally {
      if (mounted) setState(() => printing = false);
    }
  }

  Future<void> _reopen() async {
    final reason = await showDialog<String>(
      context: context,
      builder: (_) => const ReasonDialog('reopen_shift'),
    );
    if (reason == null || !mounted) return;
    final saved = await widget.controller.operation(
      ApiEndpoint.reopenCashierShiftFor(widget.id),
      {'reason': reason},
    );
    if (saved && mounted) Navigator.pop(context, true);
    if (!saved && mounted) {
      setState(() => status = widget.controller.message.value);
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<Json>(
    future: report,
    builder: (context, snapshot) {
      final data = snapshot.data;
      final business = jsonObject(widget.controller.context['business']);
      final totals = data == null ? null : ShiftTotals(data, business);
      return AlertDialog(
        title: Text('shift_report'.tr),
        content: SizedBox(
          width: 430,
          child: data == null
              ? (snapshot.hasError
                    ? const RegisterNotice('SHIFT_DETAILS_UNAVAILABLE')
                    : const LinearProgressIndicator())
              : SingleChildScrollView(
                  child: Column(
                    children: [
                      RepaintBoundary(
                        key: paper,
                        child: Container(
                          color: Colors.white,
                          padding: const EdgeInsets.all(16),
                          child: DefaultTextStyle.merge(
                            style: const TextStyle(color: Colors.black),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Text(
                                  (business['name'] ?? '').toString(),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 20,
                                  ),
                                ),
                                Text(
                                  '${'shift_report'.tr} · ${data['profile_name'] ?? ''}',
                                ),
                                Text(
                                  '${data['business_date']} · ${data['id']}',
                                ),
                                for (final event in ['opened', 'closed'])
                                  Text(
                                    '${'shift_${event}_by'.tr} ${shiftPerson(data, '${event}_by')} · ${shiftTimestamp(context, data['${event}_at'], business['timezone'] as String, businessDate: data['business_date'] as String?)}',
                                  ),
                                if (data['note'] case final String note
                                    when note.isNotEmpty)
                                  Text('${'cart_note'.tr}  $note'),
                                const Divider(),
                                if (totals != null) ...[
                                  Text(
                                    '${'shift_net_sales'.tr}  ${totals.amount(totals.netSales)}',
                                  ),
                                  Text(
                                    '${'shift_paid_bills'.tr}  ${totals.paidBills}',
                                  ),
                                  Text(
                                    '${'cash_in'.tr}  ${totals.amount(totals.cashIn)}',
                                  ),
                                  Text(
                                    '${'cash_out'.tr}  ${totals.amount(totals.cashOut)}',
                                  ),
                                  if (totals.estimated)
                                    Text('shift_estimated_currency'.tr),
                                ],
                                for (final row in jsonRows(
                                  data['closing_counts'],
                                )) ...[
                                  const Divider(),
                                  Text(
                                    '${row['payment_type_name']} · ${row['currency']}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  Text(
                                    '${'expected'.tr} ${shiftAmount(row, 'expected_minor')}   ${'shift_declared'.tr} ${shiftAmount(row, 'declared_minor')}',
                                  ),
                                  Text(shiftVariance(row)),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ),
                      if (status != null) RegisterNotice(status),
                    ],
                  ),
                ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('back'.tr),
          ),
          if (data?['can_reopen'] == true)
            OutlinedButton(
              onPressed: printing || widget.controller.commandPending.value
                  ? null
                  : _reopen,
              child: Text('reopen_shift'.tr),
            ),
          if (data != null)
            RegisterButton(
              'shift_print',
              icon: Icons.print_outlined,
              onPressed: printing ? null : _print,
            ),
        ],
      );
    },
  );
}
