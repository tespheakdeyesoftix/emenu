import 'dart:convert';

import '../../../core/pos_api.dart';
import '../../../core/pricing.dart';
import '../../../core/register_database.dart';
import '../../../core/register_history_scope.dart';

enum SaleHistoryStatus {
  all('sales_all'),
  submitted('sales_submitted'),
  hold('table_hold'),
  billRequested('table_bill_requested'),
  closed('closed'),
  voided('sales_void');

  const SaleHistoryStatus(this.label);
  final String label;
}

class SaleHistoryEntry {
  const SaleHistoryEntry({
    required this.id,
    required this.status,
    required this.activity,
    required this.currency,
    required this.amount,
    required this.quantity,
    required this.data,
    this.table,
    this.customer,
    this.operatorName,
    this.bill,
    this.sale,
    this.sync,
    this.orderSyncStatus,
    this.reversalStatus,
    this.carryover = false,
    this.serverOnly = false,
    this.netAmount,
  });

  final String id;
  final SaleHistoryStatus status;
  final DateTime activity;
  final String currency;
  final int amount;
  final num quantity;
  final Json data;
  final String? table;
  final String? customer;
  final String? operatorName;
  final HeldBill? bill;
  final LocalSale? sale;
  final SaleOutboxData? sync;
  final String? orderSyncStatus;
  final String? reversalStatus;
  final bool carryover;
  final bool serverOnly;
  final int? netAmount;

  String get reference => saleHistoryReference(id);
}

String saleHistoryReference(String id) {
  final significant = id.startsWith('possale_') ? id.substring(8) : id;
  return (significant.length > 8 ? significant.substring(0, 8) : significant)
      .toUpperCase();
}

Json historyObject(Object? data) => data is Map ? jsonObject(data) : {};
Json decodeHistoryObject(String? data) =>
    data == null ? {} : historyObject(jsonDecode(data));

num _quantity(Object? lines) => normalizedQuantity(
  jsonRows(lines).fold<num>(0, (sum, line) => sum + (line['quantity'] as num? ?? 0)).abs(),
);

List<SaleHistoryEntry> buildSalesHistory(
  RegisterHistory local,
  List<Json> server,
  RegisterHistoryScope scope, {
  required bool storeOperations,
  required String Function(DateTime) businessDate,
}) {
  final hosted = {for (final row in server) row['id'] as String: row};
  final entries = <SaleHistoryEntry>[];

  bool isCarryover(Object? period, DateTime time) {
    if (period is String) return period != scope.id;
    if (scope.period == RegisterHistoryPeriod.businessDate) {
      return businessDate(time) != scope.id;
    }
    return scope.openedAt?.isAfter(time) ?? false;
  }

  for (final bill in local.held) {
    final saved = decodeHistoryObject(bill.payload);
    final period = historyObject(
      saved['operating_context'],
    )[scope.period.operatingField];
    entries.add(
      SaleHistoryEntry(
        id: bill.id,
        status: switch (saved['table_status']) {
          'occupied' => SaleHistoryStatus.submitted,
          'bill_requested' => SaleHistoryStatus.billRequested,
          _ => SaleHistoryStatus.hold,
        },
        activity: bill.updatedAt,
        currency: saved['currency'] as String,
        amount: saved['total_minor'] as int,
        quantity: _quantity(saved['lines']),
        table: (saved['table_label'] ?? saved['table_code']) as String?,
        customer: saved['customer_name'] as String?,
        operatorName: saved['operator_name'] as String?,
        carryover: isCarryover(
          period ??
              (scope.period == RegisterHistoryPeriod.workingDay
                  ? bill.workingDayId
                  : null),
          bill.updatedAt,
        ),
        data: saved,
        bill: bill,
        orderSyncStatus: const ['submitted', 'bill_requested'].contains(saved['status'])
            ? local.orderSyncStatuses[bill.id] ?? 'synced'
            : null,
      ),
    );
    hosted.remove(bill.id);
  }

  for (final (sale, job) in local.sales) {
    final request = decodeHistoryObject(sale.request);
    final receipt = historyObject(request['receipt']);
    final aliases = {
      sale.id,
      if (decodeHistoryObject(sale.settlement)['id'] case final String id) id,
      if (decodeHistoryObject(job.serverDraft)['id'] case final String id) id,
    };
    Json? serverSale;
    for (final id in aliases) {
      serverSale = hosted.remove(id) ?? serverSale;
    }
    if (serverSale?['status'] == 'cancelled') {
      entries.add(_serverEntry(serverSale!, false));
      continue;
    }
    final reversal = sale.reversesSaleId != null;
    final posted =
        storeOperations ||
        job.status == 'synced' ||
        serverSale?['status'] == 'paid';
    final linkedStatus = local.reversalStatuses[sale.id];
    final reversalStatus =
        serverSale?['reversed_by_sale_id'] != null ||
            decodeHistoryObject(sale.settlement)['reversed_by_sale_id'] !=
                null ||
            linkedStatus == 'synced' ||
            (linkedStatus != null && storeOperations)
        ? 'reversed'
        : linkedStatus == 'attention'
        ? 'attention'
        : linkedStatus != null
        ? 'reversal_pending'
        : null;
    entries.add(
      SaleHistoryEntry(
        id: sale.id,
        status: reversal ? SaleHistoryStatus.voided : SaleHistoryStatus.closed,
        activity: sale.createdAt,
        currency: sale.currency,
        amount: sale.total,
        quantity: _quantity(request['quote']),
        table: receipt['table_label'] as String?,
        customer: receipt['customer_name'] as String?,
        operatorName: receipt['operator_name'] as String?,
        data: request,
        sale: sale,
        sync: job,
        reversalStatus: reversalStatus,
        netAmount: !reversal || posted ? sale.total : null,
      ),
    );
  }

  for (final bill in local.discarded) {
    final saved = decodeHistoryObject(bill.payload);
    hosted.remove(bill.billId);
    entries.add(
      SaleHistoryEntry(
        id: bill.billId,
        status: SaleHistoryStatus.voided,
        activity: bill.discardedAt,
        currency: saved['currency'] as String,
        amount: saved['total_minor'] as int,
        quantity: _quantity(saved['lines']),
        table: (saved['table_label'] ?? saved['table_code']) as String?,
        customer: saved['customer_name'] as String?,
        operatorName: bill.operatorName,
        data: saved,
        orderSyncStatus: const ['submitted', 'bill_requested'].contains(saved['status'])
            ? local.orderSyncStatuses[bill.billId] ?? 'synced'
            : null,
      ),
    );
  }

  for (final row in hosted.values) {
    final open = const ['open', 'submitted', 'bill_requested'].contains(row['status']);
    if (open && local.knownServerDraftIds.contains(row['id'])) continue;
    final carryover =
        open &&
        isCarryover(
          row[scope.period.operatingField],
          DateTime.parse(row['created_at'] as String),
        );
    entries.add(_serverEntry(row, carryover));
  }
  return entries..sort((a, b) {
    final time = b.activity.compareTo(a.activity);
    return time == 0 ? b.id.compareTo(a.id) : time;
  });
}

SaleHistoryEntry _serverEntry(Json row, bool carryover) {
  final paid = row['status'] == 'paid';
  final amount = row['total_minor'] as int;
  return SaleHistoryEntry(
    id: row['id'] as String,
    status: row['status'] == 'cancelled' || row['reverses_sale_id'] != null
        ? SaleHistoryStatus.voided
        : paid
        ? SaleHistoryStatus.closed
        : row['status'] == 'bill_requested'
        ? SaleHistoryStatus.billRequested
        : SaleHistoryStatus.submitted,
    activity: DateTime.parse(
      ((paid ? row['settled_at'] : row['updated_at']) ?? row['created_at'])
          as String,
    ),
    currency: row['currency'] as String,
    amount: amount,
    quantity: normalizedQuantity((row['item_quantity'] as num? ?? 0).abs()),
    table: (row['table_label'] ?? row['table_code']) as String?,
    customer: row['customer_name'] as String?,
    data: row,
    carryover: carryover,
    serverOnly: true,
    reversalStatus: row['reversed_by_sale_id'] == null ? null : 'reversed',
    netAmount: paid ? amount : null,
  );
}

Map<String, int> salesHistoryTotals(
  List<SaleHistoryEntry> entries,
  SaleHistoryStatus tab,
) {
  final totals = <String, int>{};
  for (final entry in entries) {
    if (tab != SaleHistoryStatus.all && entry.status != tab) continue;
    final amount = tab == SaleHistoryStatus.all
        ? entry.netAmount
        : entry.amount;
    if (amount != null) {
      totals.update(
        entry.currency,
        (total) => total + amount,
        ifAbsent: () => amount,
      );
    }
  }
  return totals;
}
