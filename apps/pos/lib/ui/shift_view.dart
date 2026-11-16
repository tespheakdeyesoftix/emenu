import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../core/pos_api.dart';
import '../core/pricing.dart';
import '../core/register_database.dart';
import '../features/register/register_controller.dart';
import 'shared_widgets.dart';

class ShiftView extends StatelessWidget {
  const ShiftView(this.controller, {super.key});

  final RegisterController controller;

  Future<void> _recover(BuildContext context, StoreOperatingEvent event) async {
    final payload = jsonObject(
      jsonObject(jsonDecode(event.envelope))['payload'],
    );
    final amount = payload['total_minor'];
    final currency = payload['currency'];
    final profile = await controller.database.readSnapshot(
      event.profileId ?? controller.installation.value!.profileId,
    );
    if (!context.mounted) return;
    final name = (profile?['context'] as Map?)?['profile'] as Map?;
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
          if (name?['name'] case final String profileName) Text(profileName),
          Text('${action.tr} · ${event.operatorName ?? event.operatorId}'),
          if (amount is int && currency is String)
            Text(displayAmount(amount, currency)),
          Text('recover_original_operator'.tr),
        ],
      ),
    );
    if (reason != null) await controller.approveStoreSync(event, reason);
  }

  Future<void> _openShift(BuildContext context) async {
    final dayId = (controller.context['working_day'] as Map?)?['id'];
    final rows = _floatTypes();
    final amounts = rows.isEmpty
        ? <Json>[]
        : await showDialog<List<Json>>(
            context: context,
            builder: (_) => _CountDialog(rows, opening: true),
          );
    if (amounts != null) {
      await controller.operation('/cashier-shifts', {
        'opening_cash': amounts,
        'day_id': dayId,
      });
    }
  }

  Future<void> _closeShift(BuildContext context, String shiftId) async {
    final preview = await controller.shiftPreview(shiftId);
    if (preview == null || !context.mounted) return;
    final rows = [
      for (final row in jsonRows(preview['counts']))
        (
          id: row['payment_type_id'] as String,
          name: row['payment_type_name'] as String,
          currency: row['currency'] as String,
          expected: row['expected_minor'] as int?,
          cash: row['payment_kind'] == 'cash',
        ),
    ];
    final counts = await showDialog<List<Json>>(
      context: context,
      builder: (_) => _CountDialog(rows, opening: false),
    );
    if (counts == null) return;
    if (!controller.storeOperations &&
        controller.hasUnsentSales('shift_id', shiftId)) {
      controller.message.value = 'UNSYNCED_SHIFT_SALES';
      return;
    }
    await controller.operation('/cashier-shifts/$shiftId/close', {
      'activity_revision': preview['activity_revision'],
      'counts': counts,
    });
  }

  Future<void> _closeDay(BuildContext context, String dayId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('close_day'.tr),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('back'.tr),
          ),
          RegisterButton(
            'close',
            onPressed: () => Navigator.pop(context, true),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    if (!controller.storeOperations &&
        controller.hasUnsentSales('working_day_id', dayId)) {
      controller.message.value = 'UNSYNCED_DAY_SALES';
      return;
    }
    if (controller.heldBills.any((bill) => bill.workingDayId == dayId)) {
      controller.message.value = 'WORKING_DAY_HAS_ACTIVITY';
      return;
    }
    await controller.operation('/working-days/$dayId/close', {});
  }

  List<_CountRow> _floatTypes() => [
    for (final type in controller.paymentTypes.where(allowsCashFloat))
      for (final currency in (type['currencies'] as List).cast<String>())
        (
          id: type['id'] as String,
          name: type['name'] as String,
          currency: currency,
          expected: null,
          cash: true,
        ),
  ];

  Future<void> _cashMovement(
    BuildContext context,
    String shiftId,
    String kind,
    List<_CountRow> options,
  ) async {
    final input = await showDialog<Json>(
      context: context,
      builder: (_) => _CashMovementDialog(kind, options),
    );
    if (input != null) {
      await controller.operation('/cashier-shifts/$shiftId/cash-floats', input);
    }
  }

  @override
  Widget build(BuildContext context) => Obx(() {
    final data = controller.context;
    final config = controller.config;
    final day = data['working_day'] as Map?;
    final shift = data['cashier_shift'] as Map?;
    final dayId = day?['id'] as String?;
    final shiftId = shift?['id'] as String?;
    final store = controller.storeOperations;
    final hasDaySales =
        !store &&
        dayId != null &&
        controller.hasUnsentSales('working_day_id', dayId);
    final hasShiftSales =
        !store &&
        shiftId != null &&
        controller.hasUnsentSales('shift_id', shiftId);
    final hasHeldBills =
        dayId != null &&
        controller.heldBills.any((bill) => bill.workingDayId == dayId);
    final paired = controller.paired.value;
    final connected =
        (store
            ? (!paired || controller.online.value)
            : (!paired && controller.online.value)) &&
        !controller.busy.value &&
        !controller.commandPending.value &&
        !controller.storeAuthorityPending;
    final canOpen = connected && data['read_only'] != true;
    final role = controller.operator.value?.role;
    final manager = role == 'owner' || role == 'manager';
    final floatTypes = _floatTypes();
    final head = controller.storeSyncHead.value;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (paired && !store) ListTile(title: Text('USE_STORE_REGISTER'.tr)),
        if (head != null)
          ListTile(
            leading: Icon(
              head.status == 'attention' ? Icons.error_outline : Icons.sync,
            ),
            title: Text('store_sync'.tr),
            subtitle: Text(
              head.lastError?.tr ??
                  (head.recoveryOwnerId == null
                      ? 'pending'.tr
                      : 'store_recovery_queued'.tr),
            ),
            trailing: head.status == 'attention'
                ? TextButton(
                    onPressed: controller.busy.value
                        ? null
                        : controller.retryStoreSync,
                    child: Text('retry'.tr),
                  )
                : null,
          ),
        if (head != null && controller.canApproveStoreSync(head))
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: OutlinedButton(
              onPressed: controller.busy.value
                  ? null
                  : () => _recover(context, head),
              child: Text('approve_store_sync'.tr),
            ),
          ),
        if (config['working_day_enabled'] == true)
          ListTile(
            title: Text('working_day'.tr),
            subtitle: Text(
              hasDaySales
                  ? 'UNSYNCED_DAY_SALES'.tr
                  : hasHeldBills
                  ? 'WORKING_DAY_HAS_ACTIVITY'.tr
                  : day?['business_date']?.toString() ?? 'closed'.tr,
            ),
            trailing: dayId == null
                ? RegisterButton(
                    'open_day',
                    onPressed: canOpen && manager
                        ? () => controller.operation('/working-days', {})
                        : null,
                  )
                : RegisterButton(
                    'close_day',
                    onPressed:
                        connected &&
                            manager &&
                            shiftId == null &&
                            !hasDaySales &&
                            !hasHeldBills
                        ? () => _closeDay(context, dayId)
                        : null,
                  ),
          ),
        if (shiftId != null && floatTypes.isNotEmpty)
          Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              for (final kind in ['cash_in', 'cash_out'])
                OutlinedButton.icon(
                  onPressed: canOpen
                      ? () => _cashMovement(context, shiftId, kind, floatTypes)
                      : null,
                  icon: Icon(kind == 'cash_in' ? Icons.add : Icons.remove),
                  label: Text(kind.tr),
                ),
            ],
          ),
        if (config['cashier_shift_enabled'] == true)
          ListTile(
            title: Text('cashier_shift'.tr),
            subtitle: Text(
              hasShiftSales
                  ? 'UNSYNCED_SHIFT_SALES'.tr
                  : (shiftId == null ? 'closed' : 'open').tr,
            ),
            trailing: shiftId == null
                ? RegisterButton(
                    'open_shift',
                    onPressed:
                        canOpen &&
                            (config['working_day_enabled'] != true ||
                                dayId != null)
                        ? () => _openShift(context)
                        : null,
                  )
                : RegisterButton(
                    'close_shift',
                    onPressed: connected && !hasShiftSales
                        ? () => _closeShift(context, shiftId)
                        : null,
                  ),
          ),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: OutlinedButton.icon(
            onPressed: controller.refreshRegister,
            icon: const Icon(Icons.refresh),
            label: Text('refresh'.tr),
          ),
        ),
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
  String? error;

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
    if (reason.text.trim().isEmpty) {
      setState(() => error = 'CASH_MOVEMENT_REASON');
      return;
    }
    Navigator.pop(context, <String, dynamic>{
      'kind': widget.kind,
      'payment_type_id': entry.id,
      'currency': entry.currency,
      'amount_minor': minor,
      'reason': reason.text.trim(),
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
            DropdownButtonFormField<int>(
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
            TextField(
              controller: amount,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: InputDecoration(labelText: 'amount'.tr),
            ),
            TextField(
              controller: reason,
              maxLength: 500,
              decoration: InputDecoration(labelText: 'reason'.tr),
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

typedef _CountRow = ({
  String id,
  String name,
  String currency,
  int? expected,
  bool cash,
});

class _CountDialog extends StatefulWidget {
  const _CountDialog(this.rows, {required this.opening});

  final List<_CountRow> rows;
  final bool opening;

  @override
  State<_CountDialog> createState() => _CountDialogState();
}

class _CountDialogState extends State<_CountDialog> {
  late final inputs = widget.rows
      .map((_) => TextEditingController(text: widget.opening ? '0' : ''))
      .toList();
  bool invalid = false;

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
        (widget.opening ? 'amount_minor' : 'declared_minor'): amount,
      });
    }
    Navigator.pop(context, counts);
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text((widget.opening ? 'opening_cash' : 'close_shift').tr),
    content: SizedBox(
      width: 420,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 12,
          children: [
            if (invalid) const RegisterNotice('INVALID_AMOUNT'),
            for (final (index, row) in widget.rows.indexed)
              TextField(
                controller: inputs[index],
                keyboardType: TextInputType.numberWithOptions(
                  decimal: row.currency == 'USD',
                  signed: !row.cash,
                ),
                decoration: InputDecoration(
                  labelText: '${row.name} · ${row.currency}',
                  helperText: row.expected == null
                      ? null
                      : '${'expected'.tr} ${displayAmount(row.expected!, row.currency)}',
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
        widget.opening ? 'open_shift' : 'close_shift',
        onPressed: submit,
      ),
    ],
  );
}
