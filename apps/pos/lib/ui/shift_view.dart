import 'dart:async';

import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../core/api_endpoint.dart';
import '../core/pos_api.dart';
import '../core/pricing.dart';
import '../core/register_database.dart';
import '../core/register_shift_reports.dart';
import '../features/register/register_controller.dart';
import '../features/shifts/widgets/open_shift_dialog_widget.dart';
import '../shared/forms/app_selection_field.dart';
import '../shared/forms/app_text_field.dart';
import '../shared/surface_card.dart';
import 'shared_widgets.dart';
import 'shift_reports_view.dart';

class ShiftView extends StatefulWidget {
  const ShiftView(this.controller, {super.key});

  final RegisterController controller;

  @override
  State<ShiftView> createState() => _ShiftViewState();
}

class _ShiftViewState extends State<ShiftView> {
  RegisterController get controller => widget.controller;
  late final Worker watcher;
  Timer? refreshDelay;
  Json? report, sync;
  DateTime? updatedAt;
  bool loading = false, unavailable = false;
  int request = 0;

  Json get business => jsonObject(controller.context['business']);
  bool get manager => shiftManager(controller.operator.value?.role ?? '');
  bool get detailsEnabled => controller.storeOperations
      ? controller.supportsStoreShiftManagement
      : controller.supportsShiftManagement;

  @override
  void initState() {
    super.initState();
    watcher = everAll([
      controller.snapshot,
      controller.shiftRefreshRevision,
      controller.pending,
      controller.storeSyncHead,
    ], (_) => _schedule());
    _schedule();
  }

  @override
  void dispose() {
    watcher.dispose();
    refreshDelay?.cancel();
    super.dispose();
  }

  void _schedule() {
    refreshDelay?.cancel();
    refreshDelay = Timer(const Duration(milliseconds: 120), _load);
  }

  Future<void> _load() async {
    final operator = controller.operator.value?.id;
    if (!mounted || operator == null || controller.snapshot.value == null) {
      return;
    }
    final ticket = ++request;
    final id = (controller.context['cashier_shift'] as Map?)?['id'];
    setState(() => loading = true);
    try {
      final responses = await Future.wait<Json?>([
        if (detailsEnabled && id != null)
          controller.readShiftManagement({'kind': 'summary', 'id': id})
        else
          Future.value(null),
        if (controller.supportsStoreShiftManagement)
          controller.readShiftManagement({'kind': 'sync'})
        else
          Future.value(null),
      ]);
      if (!mounted ||
          ticket != request ||
          operator != controller.operator.value?.id) {
        return;
      }
      setState(() {
        report = responses[0];
        sync = responses[1];
        if (responses[0] != null ||
            responses[1] != null ||
            controller.online.value) {
          updatedAt = DateTime.now();
        }
        unavailable = false;
      });
    } catch (_) {
      if (mounted && ticket == request) setState(() => unavailable = true);
    } finally {
      if (mounted && ticket == request) setState(() => loading = false);
    }
  }

  Future<void> _refresh() async {
    await controller.refreshRegister();
    if (!mounted) return;
    refreshDelay?.cancel();
    await _load();
  }

  Future<void> _recover(StoreOperatingEvent event) async {
    final payload = jsonObject(jsonObjectFromString(event.envelope)['payload']);
    final amount = payload['total_minor'] ?? payload['amount_minor'];
    final currency = payload['currency'];
    final profile = await controller.database.readSnapshot(
      event.profileId ?? controller.installation.value!.profileId,
    );
    if (!mounted) return;
    final name = ((profile?['context'] as Map?)?['profile'] as Map?)?['name'];
    final action = switch (event.kind) {
      'checkout' => 'pay',
      'reversal' => 'reverse_sale',
      'cash_movement' => payload['kind'] as String,
      _ => event.kind,
    };
    final reason = await showDialog<String>(
      context: context,
      builder: (_) => ReasonDialog(
        'approve_store_sync',
        details: [
          if (name is String) Text(name),
          Text('${action.tr} · ${event.operatorName ?? event.operatorId}'),
          if (amount is int && currency is String)
            Text(displayAmount(amount, currency)),
          Text('recover_original_operator'.tr),
        ],
      ),
    );
    if (reason != null) await controller.approveStoreSync(event, reason);
  }

  List<_CountRow> get floatTypes => [
    for (final type in controller.paymentTypes.where(allowsCashFloat))
      for (final currency in paymentCurrencies(type))
        (
          id: type['id'] as String,
          name: type['name'] as String,
          currency: currency,
          cash: true,
        ),
  ];

  Future<void> _cashMovement(String id, String kind) async {
    final input = await showDialog<Json>(
      context: context,
      builder: (_) => _CashMovementDialog(kind, floatTypes),
    );
    if (input != null) {
      await controller.operation(
        ApiEndpoint.cashierShiftCashFloatsFor(id),
        input,
      );
    }
  }

  Future<void> _closeShift(String id) async {
    var entered = <String, int>{};
    var changed = false;
    while (mounted) {
      final preview = await controller.shiftPreview(id);
      if (preview == null || !mounted) return;
      final rows = [
        for (final row in jsonRows(preview['counts']))
          (
            id: row['payment_type_id'] as String,
            name: row['payment_type_name'] as String,
            currency: row['currency'] as String,
            cash: row['payment_kind'] == 'cash',
          ),
      ];
      final counts = await showDialog<List<Json>>(
        context: context,
        builder: (_) => _ClosingCountDialog(
          rows,
          initial: entered,
          changed: changed,
        ),
      );
      if (counts == null || !mounted) return;
      entered = {
        for (final row in counts)
          shiftCountKey(row): row['declared_minor'] as int,
      };
      final input = {
        'activity_revision': preview['activity_revision'],
        'counts': counts,
      };
      Json review;
      try {
        final requiresReview =
            !controller.storeOperations &&
            jsonRows(preview['counts'])
                .any((row) => row['expected_minor'] == null);
        review = detailsEnabled || requiresReview
            ? await controller.readShiftManagement({
                'kind': 'review',
                'id': id,
                'count': input,
              })
            : reviewRegisterShift(preview, input);
      } catch (error) {
        if (error is PosApiError && error.code == 'RECONCILIATION_CHANGED') {
          await controller.refreshRegister();
          changed = true;
          continue;
        }
        controller.showError(error);
        return;
      }
      if (!mounted) return;
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (_) => ShiftCountReview(
          review,
          (controller.context['profile'] as Map?)?['name']?.toString() ?? '',
          id,
        ),
      );
      if (!mounted || confirmed == null) return;
      if (!confirmed) {
        changed = false;
        continue;
      }
      final saved = await controller.operation(
        ApiEndpoint.closeCashierShiftFor(id),
        input,
      );
      if (!mounted) return;
      if (saved) {
        if (detailsEnabled) {
          await showDialog<bool>(
            context: context,
            builder: (_) => ShiftReportDialog(controller, id),
          );
        }
        return;
      }
      if (controller.message.value != 'RECONCILIATION_CHANGED') return;
      await controller.refreshRegister();
      changed = true;
    }
  }

  Future<void> _closeDay(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('close_day'.tr),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text('cancel'.tr)),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: Text('confirm'.tr)),
        ],
      ),
    );
    if (confirmed == true) {
      await controller.operation(ApiEndpoint.closeWorkingDayFor(id), {});
    }
  }

  Future<void> _reviewDay(String id, bool connected) async {
    final data = controller.context;
    Json details = jsonObject(data['working_day']);
    if (detailsEnabled) {
      try {
        details = await controller.readShiftManagement({
          'kind': 'day',
          'id': id,
        });
      } catch (error) {
        controller.showError(error);
        return;
      }
    }
    if (!mounted) return;
    final register = (data['profile'] as Map?)?['name'];
    final shifts = {
      for (final row in jsonRows(details['shifts'])) row['id']: row,
    };
    final active = data['cashier_shift'] as Map?;
    if (active != null) {
      shifts.putIfAbsent(
        active['id'],
        () => {...jsonObject(active), 'profile_name': register},
      );
    }
    final bills = {
      for (final row in jsonRows(details['open_bills'])) row['id']: row,
    };
    for (final bill in controller.heldBills.where(
      (bill) => bill.workingDayId == id,
    )) {
      bills.putIfAbsent(
        bill.id,
        () => {
          'id': bill.id,
          'profile_name': register,
          'table_code': jsonObjectFromString(bill.payload)['table_code'],
        },
      );
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => ShiftDayReview(
        {
          ...details,
          'shifts': shifts.values.toList(),
          'open_bills': bills.values.toList(),
        },
        business,
        connected: connected,
        register: register?.toString(),
        unsent:
            !controller.storeOperations &&
            controller.hasUnsentSales('working_day_id', id),
      ),
    );
    if (confirmed == true && mounted) {
      final ok = await controller.operation(
        ApiEndpoint.closeWorkingDayFor(id),
        {},
      );
      if (!ok &&
          mounted &&
          controller.message.value == 'WORKING_DAY_HAS_ACTIVITY') {
        await _reviewDay(id, connected);
      }
    }
  }

  Widget _status(
    String label,
    IconData icon, {
    bool warning = false,
    bool positive = false,
  }) => Chip(
    avatar: Icon(icon, size: 16),
    label: Text(label),
    backgroundColor: warning
        ? Theme.of(context).colorScheme.errorContainer
        : positive
        ? Theme.of(context).colorScheme.secondaryContainer
        : null,
  );

  Widget _card(
    String title,
    IconData icon,
    Json? data,
    List<Widget> rows, {
    Widget? action,
  }) => SurfaceCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                title.tr,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            _status(
              (data == null ? 'closed' : 'open').tr,
              data == null ? Icons.lock_outline : Icons.check_circle_outline,
              positive: data != null,
            ),
          ],
        ),
        if (rows.isNotEmpty) ...[const SizedBox(height: 8), ...rows],
        if (action != null) ...[const SizedBox(height: 12), action],
      ],
    ),
  );

  Widget _detail(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 2),
    child: Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: '${label.tr}  ',
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          TextSpan(
            text: value,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ],
      ),
    ),
  );

  Widget _adaptive(List<Widget> panels, double minWidth) => LayoutBuilder(
    builder: (context, constraints) {
      if (panels.isEmpty) return const SizedBox.shrink();
      final columns = ((constraints.maxWidth + 12) / (minWidth + 12))
          .floor()
          .clamp(1, panels.length);
      final width = (constraints.maxWidth - (columns - 1) * 12) / columns;
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          for (final panel in panels) SizedBox(width: width, child: panel),
        ],
      );
    },
  );

  @override
  Widget build(BuildContext context) => Obx(() {
    final settings = controller.context;
    final day = settings['working_day'] as Json?;
    final shift = settings['cashier_shift'] as Json?;
    final dayId = day?['id'] as String?;
    final shiftId = shift?['id'] as String?;
    final config = controller.config;
    final hasDay = config['working_day_enabled'] == true;
    final hasShift = config['cashier_shift_enabled'] == true;
    final needsDay = hasDay && day == null;
    final date =
        day?['business_date'] as String? ??
        shift?['business_date'] as String? ??
        settings['local_date'] as String?;
    final zone = business['timezone'] as String? ?? 'UTC';
    final store = controller.storeOperations,
        paired = controller.paired.value,
        online = controller.online.value;
    final commandPending = controller.commandPending.value;
    final connected = controller.operatingCommandsAvailable;
    final canOpen = controller.canOpenOperatingSession;
    final unsent =
        !store &&
        shiftId != null &&
        controller.hasUnsentSales('shift_id', shiftId);
    final head = controller.storeSyncHead.value;
    final pending = store
        ? (sync?['pending'] as int? ?? (head == null ? 0 : 1))
        : controller.pending
              .where((entry) => entry.$2.status != 'synced')
              .length;
    final storeError =
        (head?.status == 'attention' ? head?.lastError : null) ??
        (sync?['error'] as String?);
    final syncError = store
        ? storeError
        : controller.pending
              .map((entry) => entry.$2)
              .where((job) => job.status == 'attention')
              .firstOrNull
              ?.lastError;
    final summary = shiftId != null && report?['id'] == shiftId ? report : null;
    final totals = summary == null ? null : ShiftTotals(summary, business);
    final register =
        (settings['profile'] as Map?)?['name']?.toString() ??
        'shift_register'.tr;
    final operator = controller.operator.value;
    String stamp(Object? value) =>
        shiftTimestamp(context, value, zone, businessDate: date);

    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 18, 24, 28),
      children: [
        Wrap(
          spacing: 10,
          runSpacing: 6,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            _status(
              (online
                      ? (paired ? 'shift_store_connected' : 'online')
                      : (paired
                            ? 'shift_store_disconnected'
                            : 'shift_cloud_offline'))
                  .tr,
              online ? Icons.wifi : Icons.wifi_off,
              warning: !online,
            ),
            if (store || pending > 0)
              _status(
                syncError != null
                    ? 'shift_sync_attention'.tr
                    : (pending > 0
                          ? '$pending ${'shift_sync_pending'.tr}'
                          : 'shift_synced'.tr),
                syncError != null ? Icons.sync_problem : Icons.sync,
                warning: syncError != null,
              ),
            if (commandPending)
              _status('SHIFT_COMMAND_PENDING'.tr, Icons.hourglass_top),
            if (updatedAt != null)
              Text(
                '${'shift_updated'.tr} ${stamp(updatedAt)}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            OutlinedButton.icon(
              onPressed: loading ? null : _refresh,
              icon: const Icon(Icons.refresh),
              label: Text('refresh'.tr),
            ),
            if (detailsEnabled)
              OutlinedButton.icon(
                onPressed: () => showDialog<void>(
                  context: context,
                  builder: (_) => ShiftHistoryDialog(controller),
                ),
                icon: const Icon(Icons.history),
                label: Text('shift_history'.tr),
              ),
          ],
        ),
        if (loading) const LinearProgressIndicator(minHeight: 2),
        if (paired && !store) const RegisterNotice('USE_STORE_REGISTER'),
        if (unavailable) const RegisterNotice('SHIFT_DETAILS_UNAVAILABLE'),
        if (paired && syncError != null)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.sync_problem),
            title: Text('shift_resolve_store_sync'.tr),
            subtitle: Text(syncError.tr),
          ),
        if (!store && syncError != null) RegisterNotice(syncError),
        if (head != null && head.status == 'attention')
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(head.lastError?.tr ?? 'shift_sync_attention'.tr),
            trailing: Wrap(
              children: [
                TextButton(
                  onPressed: controller.busy.value
                      ? null
                      : controller.retryStoreSync,
                  child: Text('retry'.tr),
                ),
                if (controller.canApproveStoreSync(head))
                  OutlinedButton(
                    onPressed: controller.busy.value
                        ? null
                        : () => _recover(head),
                    child: Text('approve_store_sync'.tr),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 14),
        if (!hasDay && !hasShift) SurfaceCard(child: Text('shift_disabled'.tr)),
        _adaptive([
          if (hasDay)
            _card(
              'working_day',
              Icons.calendar_today_outlined,
              day,
              [
                if (day != null) ...[
                  _detail('shift_business_date', date ?? ''),
                  _detail('shift_opened_at', stamp(day['opened_at'])),
                  _detail('shift_opened_by', shiftPerson(day, 'opened_by')),
                ] else if (!manager)
                  Text('shift_wait_for_manager'.tr),
              ],
              action: (day == null ? controller.allowsAction("allow_start_working_day") : controller.allowsAction("allow_close_working_day"))
                  ? (day == null
                        ? RegisterButton(
                            'open_day',
                            onPressed: canOpen
                                ? () => controller.operation(
                                    ApiEndpoint.workingDays,
                                    {},
                                  )
                                : null,
                          )
                        : OutlinedButton.icon(
                            onPressed: connected ? () => manager ? _reviewDay(dayId!, connected) : _closeDay(dayId!) : null,
                            icon: const Icon(Icons.checklist),
                            label: Text('shift_review_day'.tr),
                          ))
                  : null,
            ),
          if (hasShift)
            _card(
              'cashier_shift',
              Icons.point_of_sale_outlined,
              shift,
              [
                _detail('shift_register', register),
                if (shift != null) ...[
                  _detail('shift_opened_at', stamp(shift['opened_at'])),
                  _detail(
                    'shift_opened_by',
                    shiftPerson({...shift, ...?summary}, 'opened_by'),
                  ),
                  if (shift['note'] case final String note when note.isNotEmpty)
                    _detail('cart_note', note),
                  if (operator != null && operator.id != shift['opened_by'])
                    _detail('shift_signed_in', operator.displayName),
                  if (unsent) Text('UNSYNCED_SHIFT_SALES'.tr),
                ] else if (needsDay)
                  Text('WORKING_DAY_REQUIRED'.tr),
              ],
              action: shift == null
                  ? RegisterButton(
                      'open_shift',
                      onPressed: canOpen && !needsDay && controller.allowsAction("allow_start_cashier_shift")
                          ? () => OpenShiftDialogWidget.open(context, controller)
                          : null,
                    )
                  : RegisterButton(
                      'close_shift',
                      onPressed: connected && !unsent && controller.allowsAction("allow_close_cashier_shift")
                          ? () => _closeShift(shiftId!)
                          : null,
                    ),
            ),
        ], 280),
        if (shiftId != null && floatTypes.isNotEmpty) ...[
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 8,
            children: [
              for (final (kind, icon) in [
                ('cash_in', Icons.add),
                ('cash_out', Icons.remove),
              ])
                OutlinedButton.icon(
                  onPressed: canOpen
                      ? () => _cashMovement(shiftId, kind)
                      : null,
                  icon: Icon(icon),
                  label: Text(kind.tr),
                ),
            ],
          ),
        ],
        if (totals != null && summary != null) ...[
          const SizedBox(height: 14),
          _adaptive([
            ShiftMetric(
              'shift_net_sales',
              totals.amount(totals.netSales),
              icon: Icons.trending_up,
            ),
            ShiftMetric(
              'shift_paid_bills',
              totals.paidBills.toString(),
              icon: Icons.receipt_outlined,
            ),
            ShiftMetric(
              'cash_in',
              totals.amount(totals.cashIn),
              icon: Icons.south_west,
            ),
            ShiftMetric(
              'cash_out',
              totals.amount(totals.cashOut),
              icon: Icons.north_east,
            ),
          ], 158),
          if (totals.estimated)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text('shift_estimated_currency'.tr),
            ),
          const SizedBox(height: 14),
          ShiftActivity(summary, timezone: zone, manager: manager),
        ],
      ],
    );
  });
}

class _CashMovementDialog extends StatefulWidget {
  const _CashMovementDialog(this.kind, this.options);

  final String kind;
  final List<_CountRow> options;

  @override
  State<_CashMovementDialog> createState() => _CashMovementDialogState();
}

class _CashMovementDialogState extends State<_CashMovementDialog> {
  final amount = TextEditingController();
  final reason = TextEditingController();
  int selected = 0;
  String? reasonCode;
  String? error;

  List<String> get reasons => [
    if (widget.kind == 'cash_in') 'add_change',
    if (widget.kind == 'cash_out') ...['safe_drop', 'petty_cash'],
    'correction',
    'other',
  ];

  @override
  void dispose() {
    amount.dispose();
    reason.dispose();
    super.dispose();
  }

  void _save() {
    final entry = widget.options[selected];
    final minor = parseAmount(amount.text, entry.currency);
    if (minor == null || minor <= 0) {
      setState(() => error = 'INVALID_AMOUNT');
      return;
    }
    final code = reasonCode;
    final note = reason.text.trim();
    if (code == null || (code == 'other' && note.isEmpty)) {
      setState(() => error = 'CASH_MOVEMENT_REASON');
      return;
    }
    Navigator.pop(context, <String, dynamic>{
      'kind': widget.kind,
      'payment_type_id': entry.id,
      'currency': entry.currency,
      'amount_minor': minor,
      'reason': note.isEmpty ? code : note,
      'reason_code': code,
    });
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.kind.tr),
    content: SizedBox(
      width: 390,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 10,
          children: [
            RegisterNotice(error),
            AppSelectionField<int>(
              initialValue: selected,
              decoration: InputDecoration(labelText: 'payment_type'.tr),
              items: [
                for (final (index, row) in widget.options.indexed)
                  DropdownMenuItem(
                    value: index,
                    child: Text('${row.name} · ${row.currency}'),
                  ),
              ],
              onChanged: (value) => setState(() => selected = value!),
            ),
            AppTextField(
              controller: amount,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: InputDecoration(labelText: 'amount'.tr),
            ),
            AppSelectionField<String>(
              initialValue: reasonCode,
              decoration: InputDecoration(labelText: 'reason'.tr),
              items: [
                for (final code in reasons)
                  DropdownMenuItem(
                    value: code,
                    child: Text('shift_reason_$code'.tr),
                  ),
              ],
              onChanged: (value) => setState(() => reasonCode = value),
            ),
            AppTextField(
              controller: reason,
              maxLength: 500,
              decoration: InputDecoration(
                labelText:
                    (reasonCode == 'other'
                            ? 'shift_required_note'
                            : 'shift_optional_note')
                        .tr,
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
      RegisterButton('save', onPressed: _save),
    ],
  );
}

typedef _CountRow = ({String id, String name, String currency, bool cash});

class _ClosingCountDialog extends StatefulWidget {
  const _ClosingCountDialog(
    this.rows, {
    this.initial = const {},
    this.changed = false,
  });

  final List<_CountRow> rows;
  final Map<String, int> initial;
  final bool changed;

  @override
  State<_ClosingCountDialog> createState() => _ClosingCountDialogState();
}

class _ClosingCountDialogState extends State<_ClosingCountDialog> {
  late final inputs = widget.rows
      .map((row) => TextEditingController(text: _editableAmount(row)))
      .toList();
  bool invalid = false;

  String _editableAmount(_CountRow row) {
    final amount = widget.initial['${row.id}:${row.currency}'];
    if (amount == null) return '';
    if (row.currency != 'USD') return amount.toString();
    final absolute = amount.abs();
    return '${amount < 0 ? '-' : ''}${absolute ~/ 100}.${(absolute % 100).toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    for (final input in inputs) {
      input.dispose();
    }
    super.dispose();
  }

  void submit() {
    final counts = <Json>[];
    for (final (index, row) in widget.rows.indexed) {
      final amount = parseAmount(
        inputs[index].text,
        row.currency,
        signed: !row.cash,
      );
      if (amount == null) {
        setState(() => invalid = true);
        return;
      }
      counts.add({
        'payment_type_id': row.id,
        'currency': row.currency,
        'declared_minor': amount,
      });
    }
    Navigator.pop(context, counts);
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text('shift_enter_count'.tr),
    content: SizedBox(
      width: 420,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 12,
          children: [
            if (invalid) const RegisterNotice('INVALID_AMOUNT'),
            if (widget.changed) const RegisterNotice('RECONCILIATION_CHANGED'),
            Text('shift_count_instructions'.tr),
            for (final (index, row) in widget.rows.indexed)
              AppTextField(
                controller: inputs[index],
                keyboardType: TextInputType.numberWithOptions(
                  decimal: row.currency == 'USD',
                  signed: !row.cash,
                ),
                decoration: InputDecoration(
                  labelText: '${row.name} · ${row.currency}',
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
      RegisterButton('shift_review_count', onPressed: submit),
    ],
  );
}
