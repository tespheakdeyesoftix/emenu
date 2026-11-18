import 'package:drift/drift.dart';

import 'pos_api.dart';
import 'pricing.dart';
import 'register_database.dart';

bool shiftManager(String role) => role == 'owner' || role == 'manager';

String shiftCountKey(Json row) =>
    '${row['payment_type_id']}:${row['currency']}';

Json cashierShiftMetadata(Json shift, bool manager) {
  if (manager) return shift;
  return {
    ...shift,
    'counts': [
      for (final row in jsonRows(shift['counts']))
        {...row}..remove('expected_minor'),
    ],
  };
}

Json reviewRegisterShift(Json shift, Json input) {
  if (input['activity_revision'] != shift['activity_revision']) {
    throw const PosApiError(
      409,
      'RECONCILIATION_CHANGED',
      'Refresh the drawer counts.',
    );
  }
  final rows = jsonRows(shift['counts']);
  final counts = jsonRows(input['counts']);
  final declared = {
    for (final row in counts) shiftCountKey(row): row['declared_minor'],
  };
  if (counts.length != rows.length || declared.length != rows.length) {
    throw const FormatException('INVALID_AMOUNT');
  }
  return {
    'shift_id': shift['id'],
    'activity_revision': shift['activity_revision'],
    'counts': [
      for (final row in rows) _variance(row, declared[shiftCountKey(row)]),
    ],
  };
}

Json _variance(Json row, Object? amount) {
  if (amount is! int ||
      amount.abs() > maxPosAmount ||
      (row['payment_kind'] == 'cash' && amount < 0)) {
    throw const FormatException('INVALID_AMOUNT');
  }
  return {
    ...row,
    'declared_minor': amount,
    'variance_minor': amount - (row['expected_minor'] as int),
  }..remove('expected_minor');
}

class RegisterShiftReports {
  RegisterShiftReports(this.database);

  final RegisterDatabase database;

  Future<Json> read(
    String profileId,
    String role,
    Json input,
  ) => database.transaction(() async {
    final store = await database.storeOperatingState();
    if (store == null || store.phase != 'active') throw _unavailable;
    final activity = await database.readStoreActivity(store);
    final profiles = jsonObject(activity['profiles']);
    final current = (profiles[profileId] as Map?)?['cashier_shift'] as Json?;
    final day = activity['working_day'] as Json?;
    final manager = shiftManager(role);
    final id = input['id'];
    final kind = input['kind'];
    if (kind == 'review') {
      if (current == null || current['id'] != id) throw _unavailable;
      return reviewRegisterShift(current, jsonObject(input['count']));
    }
    if (kind == 'summary' && current != null && current['id'] == id) {
      return _shiftSummary(store.epoch, current, manager);
    }
    if (kind == 'day' && (!manager || day == null || day['id'] != id)) {
      throw _unavailable;
    }
    if (kind == 'sync') {
      final pending =
          await (database.select(database.storeOperatingEvents)..where(
                (row) =>
                    row.epoch.equals(store.epoch) &
                    row.status.equals('synced').not(),
              ))
              .get();
      return {
        'pending': pending.length,
        'error': pending
            .where((row) => row.status == 'attention')
            .firstOrNull
            ?.lastError,
      };
    }
    final branch = manager && (input['scope'] == 'branch' || kind == 'day');
    final closed = await _closedShifts(store, branch ? null : profileId);
    if (kind == 'day') {
      return _daySummary(day!, profiles, closed);
    }
    if (kind == 'history') {
      final date = input['business_date'];
      final register = branch ? input['profile_id'] : null;
      final operator = branch ? input['opened_by'] : null;
      final filtered = closed
          .where(
            (row) =>
                (date == null || row['business_date'] == date) &&
                (register == null || row['profile_id'] == register) &&
                (operator == null || row['opened_by'] == operator),
          )
          .toList();
      final page = input['page'] as int? ?? 1;
      if (page < 1) throw _unavailable;
      const size = 25;
      return {
        'cashier_shifts': filtered
            .skip((page - 1) * size)
            .take(size)
            .map(_historyRow)
            .toList(),
        'has_more': filtered.length > page * size,
        'active_shift_ids': [
          for (final entry in profiles.entries)
            if ((branch || entry.key == profileId) &&
                (entry.value as Map)['cashier_shift'] != null)
              ((entry.value as Map)['cashier_shift'] as Map)['id'],
        ],
        'registers': _choices(closed, 'profile_id', 'profile_name'),
        'operators': _choices(closed, 'opened_by', 'opened_by_name'),
      };
    }
    if (kind == 'summary') {
      final shift = closed.where((row) => row['id'] == id).firstOrNull;
      if (shift == null) throw _unavailable;
      final latest = await database.latestStoreShift(store.epoch, profileId);
      final config =
          (await database.readSnapshot(profileId))?['context'] as Map?;
      final profileConfig = (config?['profile'] as Map?)?['config'] as Map?;
      final dayEnabled = profileConfig?['working_day_enabled'] == true;
      final activeDayId = dayEnabled ? (day?['id']) : null;
      return {
        ...await _shiftSummary(store.epoch, shift, manager),
        'can_reopen':
            manager &&
            shift['profile_id'] == profileId &&
            (config?['capabilities'] as Map?)?['shift_management'] == true &&
            profileConfig?['cashier_shift_enabled'] == true &&
            (!dayEnabled || day != null) &&
            latest?.kind == 'close_shift' &&
            latest?.resourceId == id &&
            shift['working_day_id'] == activeDayId,
      };
    }
    throw _unavailable;
  });

  List<Json> _choices(List<Json> rows, String id, String label) => [
    for (final entry in {
      for (final row in rows) row[id]: row[label] ?? row[id],
    }.entries)
      {'id': entry.key, 'name': entry.value},
  ];

  Json _historyRow(Json shift) => {...shift}
    ..removeWhere((key, _) => const {'counts', 'closing_counts'}.contains(key));

  Future<List<Json>> _closedShifts(
    StoreOperatingState store,
    String? profileId,
  ) async {
    final events =
        await (database.select(database.storeOperatingEvents)
              ..where(
                (row) =>
                    row.epoch.equals(store.epoch) &
                    row.kind.isIn(['close_shift', 'reopen_shift']) &
                    (profileId == null
                        ? const Constant(true)
                        : row.profileId.equals(profileId)),
              )
              ..orderBy([(row) => OrderingTerm.desc(row.sequence)]))
            .get();
    final seen = <String>{};
    final rows = <Json>[];
    for (final event in events) {
      if (!seen.add(event.resourceId) || event.kind != 'close_shift') continue;
      final command = await database.savedCommand(event.commandId);
      if (command == null) continue;
      final row = jsonObjectFromString(command.result);
      final snapshot = event.profileId == null || row['profile_name'] != null
          ? null
          : await database.readSnapshot(event.profileId!);
      final profile = (snapshot?['context'] as Map?)?['profile'] as Map?;
      final opening = row['opened_by_name'] == null
          ? await database.storeShiftOpening(store.epoch, event.resourceId)
          : null;
      rows.add({
        ...row,
        'profile_name': row['profile_name'] ?? profile?['name'],
        'opened_by_name': row['opened_by_name'] ?? opening?.operatorName,
        'closed_by_name': row['closed_by_name'] ?? event.operatorName,
        'business_date':
            row['business_date'] ??
            (row['working_day_id'] == null
                ? null
                : await _dayDate(
                    store.epoch,
                    row['working_day_id'] as String,
                  )) ??
            (row['opened_at'] as String).substring(0, 10),
      });
    }
    return rows;
  }

  Future<Object?> _dayDate(String epoch, String id) async {
    final event =
        await (database.select(database.storeOperatingEvents)..where(
              (row) =>
                  row.epoch.equals(epoch) &
                  row.resourceId.equals(id) &
                  row.kind.equals('open_day'),
            ))
            .getSingleOrNull();
    final command = event == null
        ? null
        : await database.savedCommand(event.commandId);
    return command == null
        ? null
        : jsonObjectFromString(command.result)['business_date'];
  }

  Future<List<LocalSale>> _sales(String column, String id) async {
    final rows = await database
        .customSelect(
          "SELECT * FROM local_sales WHERE COALESCE(json_extract(request,'\$.draft.expected_context.$column'),"
          "json_extract(request,'\$.expected_context.$column'),json_extract(settlement,'\$.$column'))=?",
          variables: [Variable<String>(id)],
          readsFrom: {database.localSales},
        )
        .get();
    return [for (final row in rows) database.localSales.map(row.data)];
  }

  List<Json> _saleTotals(List<LocalSale> sales) {
    final groups = <(String, String?), Json>{};
    for (final sale in sales) {
      final data = jsonObjectFromString(sale.request);
      final draft = data['draft'] as Map?;
      final settlement = sale.settlement == null
          ? null
          : jsonObjectFromString(sale.settlement!);
      final rate =
          (settlement?['secondary_exchange_rate'] ??
                  draft?['exchange_rate'] ??
                  data['exchange_rate'])
              ?.toString();
      final row = groups.putIfAbsent(
        (sale.currency, rate),
        () => {
          'currency': sale.currency,
          'exchange_rate': rate,
          'amount_minor': 0,
          'paid_bills': 0,
        },
      );
      row['amount_minor'] = (row['amount_minor'] as int) + sale.total;
      if (sale.reversesSaleId == null) {
        row['paid_bills'] = (row['paid_bills'] as int) + 1;
      }
    }
    return groups.values.toList();
  }

  Future<Json> _shiftSummary(String epoch, Json shift, bool manager) async {
    final id = shift['id'] as String;
    final opening = await database.storeShiftOpening(epoch, id);
    final openingPayload = opening == null
        ? <String, dynamic>{}
        : jsonObject(jsonObjectFromString(opening.envelope)['payload']);
    final sales = await _sales('shift_id', id);
    final events = await database
        .customSelect(
          "SELECT * FROM store_operating_events WHERE epoch=? AND kind='cash_movement' "
          "AND json_extract(envelope,'\$.payload.shift_id')=? ORDER BY sequence DESC",
          variables: [Variable<String>(epoch), Variable<String>(id)],
          readsFrom: {database.storeOperatingEvents},
        )
        .get();
    final movements = [
      for (final event in events.map(
        (row) => database.storeOperatingEvents.map(row.data),
      ))
        {
          ...jsonObject(jsonObjectFromString(event.envelope)['payload']),
          'created_at': jsonObjectFromString(event.envelope)['occurred_at'],
          'created_by': event.operatorId,
          'created_by_name': event.operatorName,
        },
    ];
    final payments = <String, Json>{};
    for (final sale in sales) {
      final request = jsonObjectFromString(sale.request);
      final settlement = sale.settlement == null
          ? null
          : jsonObjectFromString(sale.settlement!);
      final names = (request['receipt'] as Map?)?['payment_type_names'] as Map?;
      final draft = request['draft'] as Map?;
      final types = {
        for (final type in jsonRows(
          draft?['payment_types'] ?? openingPayload['payment_types'],
        ))
          type['id']: type,
      };
      for (final payment in jsonRows(
        settlement?['payments'] ?? request['payments'] ?? draft?['payments'],
      )) {
        final type = types[payment['payment_type_id']];
        final row = payments.putIfAbsent(
          shiftCountKey(payment),
          () => {
            'payment_type_id': payment['payment_type_id'],
            'payment_type_name':
                payment['payment_type_name'] ??
                names?[payment['payment_type_id']] ??
                type?['name'],
            'payment_kind': payment['payment_kind'] ?? type?['kind'],
            'currency': payment['currency'],
            'amount_minor': 0,
            'payments_minor': 0,
            'reversals_minor': 0,
          },
        );
        final source = payment['amount_minor'] as int;
        final amount = settlement == null && payment['entry_type'] == 'change'
            ? -source
            : source;
        final part = sale.reversesSaleId == null
            ? 'payments_minor'
            : 'reversals_minor';
        row['amount_minor'] = (row['amount_minor'] as int) + amount;
        row[part] = (row[part] as int) + amount;
      }
    }
    return {
      ..._historyRow(shift),
      'opened_by_name': shift['opened_by_name'] ?? opening?.operatorName,
      'closing_counts': shift['closing_counts'],
      'drawer_counts': manager && shift['closed_at'] == null
          ? shift['counts']
          : [],
      'tenders': [
        for (final row in jsonRows(shift['counts']))
          {
            'payment_type_id': row['payment_type_id'],
            'payment_type_name': row['payment_type_name'],
            'currency': row['currency'],
          },
      ],
      'sales': _saleTotals(sales),
      'payments': payments.values.toList(),
      'cash': [
        if (manager)
          for (final row in jsonRows(openingPayload['opening_cash']))
            {...row, 'kind': 'opening'},
        ...movements,
      ],
      'movements': movements.take(10).toList(),
    };
  }

  Future<Json> _daySummary(Json day, Json profiles, List<Json> closed) async {
    final id = day['id'] as String;
    final bills = await (database.select(
      database.heldBills,
    )..where((bill) => bill.workingDayId.equals(id))).get();
    final sales = await _sales('working_day_id', id);
    final shifts = [
      for (final profile in profiles.values)
        if ((profile as Map)['cashier_shift'] case final Json shift)
          if (shift['working_day_id'] == id)
            {
              ..._historyRow(shift),
              'profile_name': (profile['profile'] as Map?)?['name'],
            },
      ...closed.where((row) => row['working_day_id'] == id).map(_historyRow),
    ];
    final registers = {
      ...shifts.map((row) => row['profile_id']),
      ...bills.map((row) => row.profileId),
      ...sales.map((row) => row.profileId),
    };
    return {
      ...day,
      'shifts': shifts,
      'register_count': registers.length,
      'sales': _saleTotals(sales),
      'open_bills': [
        for (final bill in bills)
          {
            'id': bill.id,
            'profile_id': bill.profileId,
            'profile_name':
                ((((await database.readSnapshot(bill.profileId))?['context']
                        as Map?)?['profile'])
                    as Map?)?['name'],
            'table_code': jsonObjectFromString(bill.payload)['table_code'],
          },
      ],
      'discrepancies': [
        for (final shift in closed.where((row) => row['working_day_id'] == id))
          for (final row in jsonRows(shift['closing_counts']))
            if (row['variance_minor'] != 0) {...row, 'shift_id': shift['id']},
      ],
    };
  }

  static const _unavailable = PosApiError(
    404,
    'SHIFT_DETAILS_UNAVAILABLE',
    'Shift details are unavailable.',
  );
}
