import 'package:timezone/timezone.dart' as tz;

import 'pos_api.dart';
import 'pricing.dart';
import 'register_database.dart';

enum RegisterAction {
  hold,
  discard,
  checkout,
  reverseSale,
  openDay,
  closeDay,
  openShift,
  closeShift,
  reopenShift,
  cashMovement;

  bool get consumesCart => this == hold || this == checkout || this == discard;
}

typedef RegisterActor = ({String id, String displayName, String role});

void requireRegisterManager(RegisterActor actor) {
  if (actor.role != 'owner' && actor.role != 'manager') {
    throw const PosApiError(403, 'MANAGER_REQUIRED', 'A manager is required.');
  }
}

String registerLocalDate(Json context, DateTime now) {
  final timezone = jsonObject(context['business'])['timezone'] as String;
  return tz.TZDateTime.from(
    now,
    tz.getLocation(timezone),
  ).toIso8601String().substring(0, 10);
}

Json registerOperatingContext(Json context, DateTime now) {
  final day = context['working_day'] as Map?;
  final shift = context['cashier_shift'] as Map?;
  return {
    'business_date': day?['business_date'] ?? registerLocalDate(context, now),
    'working_day_id': day?['id'],
    'shift_id': shift?['id'],
  };
}

/// Applies the store's working day and drawer rules inside the same
/// transaction that saves the operator command and its upload entry.
class RegisterOperating {
  RegisterOperating(
    this.database,
    this.store,
    this.snapshot,
    this.actor,
    this.time,
    this.activity,
  ) : context = jsonObject(snapshot['context']);

  final RegisterDatabase database;
  final StoreOperatingState store;
  final Json snapshot;
  final Json context;
  final Json activity;
  final RegisterActor actor;
  final DateTime time;
  late final _profiles = jsonObject(activity['profiles']);
  late final _drawer = jsonObject(_profiles[_profileId] ?? {});

  Json get _profile => jsonObject(context['profile']);
  Json get _config => jsonObject(_profile['config']);
  Json? get _day => context['working_day'] as Json?;
  Json? get _shift => _drawer['cashier_shift'] as Json?;
  String get _timestamp => time.toUtc().toIso8601String();
  String get _profileId => _profile['id'] as String;

  Future<Json> apply(
    RegisterAction action,
    String commandId,
    Json input,
  ) async {
    final String kind;
    final String resource;
    final Json payload;
    final Json result;
    switch (action) {
      case RegisterAction.openDay:
        requireRegisterManager(actor);
        if (_config['working_day_enabled'] != true) throw _disabled;
        if (activity['working_day'] != null) {
          throw const PosApiError(
            409,
            'WORKING_DAY_OPEN',
            'Close the active working day.',
          );
        }
        kind = 'open_day';
        resource = commandId;
        payload = {
          'base_currency': jsonObject(context['business'])['currency'],
        };
        result = {
          'id': resource,
          'business_date': registerLocalDate(context, time),
          'branch_id': _profile['branch_id'],
          'timezone': store.timezone,
          'opened_at': _timestamp,
          'opened_by': actor.id,
          'opened_by_name': actor.displayName,
          'base_currency': payload['base_currency'],
        };
        activity['working_day'] = result;
      case RegisterAction.closeDay:
        requireRegisterManager(actor);
        final day = _day;
        if (day == null || day['id'] != input['day_id']) throw _changed;
        resource = day['id'] as String;
        if (_profiles.values.any(
              (profile) =>
                  (profile['cashier_shift'] as Map?)?['working_day_id'] ==
                  resource,
            ) ||
            await database.hasHeldBillsOnDay(resource)) {
          throw const PosApiError(
            409,
            'WORKING_DAY_HAS_ACTIVITY',
            'Close shifts and settle or cancel bills.',
          );
        }
        kind = 'close_day';
        payload = {};
        result = {
          ...day,
          'closed_at': _timestamp,
          'closed_by': actor.id,
          'closed_by_name': actor.displayName,
        };
        activity.remove('working_day');
      case RegisterAction.openShift:
        if (_config['cashier_shift_enabled'] != true) throw _disabled;
        if (_shift != null) {
          throw const PosApiError(
            409,
            'CASHIER_SHIFT_OPEN',
            'Close the active shift.',
          );
        }
        if (_config['working_day_enabled'] == true && _day == null) {
          throw const PosApiError(
            409,
            'WORKING_DAY_REQUIRED',
            'Open the working day.',
          );
        }
        if (input['day_id'] != _day?['id']) throw _changed;
        kind = 'open_shift';
        resource = commandId;
        final types = jsonRows(context['payment_types']);
        final counts = [
          for (final type in types)
            for (final currency in paymentCurrencies(type))
              _count(type, currency),
        ];
        final opening = jsonRows(input['opening_cash']);
        if (opening.length > 40 ||
            opening.map(_key).toSet().length != opening.length) {
          throw _invalidCount;
        }
        for (final row in opening) {
          final count = _floatCount(types, counts, row);
          count['expected_minor'] = _amount(row['amount_minor'], 0);
        }
        final business = jsonObject(context['business']);
        payload = {
          'opening_cash': opening,
          'payment_types': types,
          'base_currency': business['currency'],
          'exchange_rate': business['secondary_exchange_rate']?.toString(),
        };
        result = {
          'id': resource,
          'profile_id': _profileId,
          'branch_id': _profile['branch_id'],
          'working_day_id': _day?['id'],
          'opened_at': _timestamp,
          'opened_by': actor.id,
          'opened_by_name': actor.displayName,
          'profile_name': _profile['name'],
          'business_date':
              _day?['business_date'] ?? registerLocalDate(context, time),
          'base_currency': payload['base_currency'],
          'exchange_rate': payload['exchange_rate'],
          'activity_revision': 1,
          'counts': counts,
        };
        _drawer['cashier_shift'] = result;
        _drawer['profile'] = _profile;
        _drawer['payment_types'] = types;
      case RegisterAction.reopenShift:
        requireRegisterManager(actor);
        if ((context['capabilities'] as Map?)?['shift_management'] != true) {
          throw const PosApiError(
            409,
            'SERVER_UPGRADE_REQUIRED',
            'Refresh after the server is upgraded.',
          );
        }
        final reason = (input['reason'] as String?)?.trim();
        if (reason == null || reason.isEmpty || reason.length > 500) {
          throw const FormatException('SHIFT_REOPEN_REASON');
        }
        final id = input['shift_id'];
        final latest = await database.latestStoreShift(store.epoch, _profileId);
        final closed = latest?.kind == 'close_shift'
            ? await database.savedCommand(latest!.commandId)
            : null;
        final previous = closed == null
            ? null
            : jsonObjectFromString(closed.result);
        if (_shift != null ||
            _config['cashier_shift_enabled'] != true ||
            latest?.resourceId != id ||
            previous == null ||
            previous['working_day_id'] != _day?['id'] ||
            (_config['working_day_enabled'] == true && _day == null)) {
          throw const PosApiError(
            409,
            'SHIFT_REOPEN_UNAVAILABLE',
            'Only the latest eligible shift can be reopened.',
          );
        }
        final opened = await database.storeShiftOpening(
          store.epoch,
          id as String,
        );
        if (opened == null) throw _changed;
        final openedPayload = jsonObject(
          jsonObjectFromString(opened.envelope)['payload'],
        );
        kind = 'reopen_shift';
        resource = id;
        payload = {'reason': reason};
        result =
            {
              ...previous,
              'activity_revision': (previous['activity_revision'] as int) + 1,
            }..removeWhere(
              (key, _) => const [
                'closed_at',
                'closed_by',
                'closed_by_name',
                'closing_counts',
              ].contains(key),
            );
        _drawer['cashier_shift'] = result;
        _drawer['profile'] = _profile;
        _drawer['payment_types'] = openedPayload['payment_types'];
      case RegisterAction.cashMovement:
        final shift = _currentShift(input['shift_id']);
        final counts = jsonRows(shift['counts']);
        final types = jsonRows(
          _drawer['payment_types'] ?? context['payment_types'],
        );
        final count = _floatCount(types, counts, input);
        final amount = _amount(input['amount_minor'], 1);
        final movement = input['kind'];
        final reason = (input['reason'] as String?)?.trim();
        final reasonCode = input['reason_code'];
        if ((movement != 'cash_in' && movement != 'cash_out') ||
            reason == null ||
            reason.isEmpty ||
            reason.length > 500 ||
            (reasonCode != null &&
                !const {
                  'add_change',
                  'safe_drop',
                  'petty_cash',
                  'correction',
                  'other',
                }.contains(reasonCode))) {
          throw const FormatException('CASH_MOVEMENT_REASON');
        }
        count['expected_minor'] =
            (count['expected_minor'] as int) +
            (movement == 'cash_in' ? amount : -amount);
        _saveCounts(shift, counts);
        kind = 'cash_movement';
        resource = commandId;
        payload = {
          'shift_id': shift['id'],
          'payment_type_id': count['payment_type_id'],
          'currency': count['currency'],
          'amount_minor': amount,
          'kind': movement,
          'reason': reason,
          'reason_code': ?reasonCode,
        };
        result = {
          'id': resource,
          ...payload,
          'created_at': _timestamp,
          'created_by': actor.id,
        };
      case RegisterAction.closeShift:
        final shift = _currentShift(input['shift_id']);
        final revision = shift['activity_revision'];
        if (input['activity_revision'] != revision) {
          throw const PosApiError(
            409,
            'RECONCILIATION_CHANGED',
            'Refresh the drawer counts.',
          );
        }
        final counts = jsonRows(shift['counts']);
        final declared = jsonRows(input['counts']);
        final amounts = {
          for (final row in declared) _key(row): row['declared_minor'],
        };
        if (declared.length != counts.length ||
            amounts.length != counts.length) {
          throw _invalidCount;
        }
        final closing = [
          for (final row in counts)
            {
              ...row,
              'declared_minor': _amount(
                amounts[_key(row)],
                row['payment_kind'] == 'cash' ? 0 : -maxPosAmount,
              ),
            },
        ];
        kind = 'close_shift';
        resource = shift['id'] as String;
        payload = {'activity_revision': revision, 'counts': closing};
        result = {
          ...shift,
          'closed_at': _timestamp,
          'closed_by': actor.id,
          'closed_by_name': actor.displayName,
          'closing_counts': closing
              .map(
                (row) => {
                  ...row,
                  'variance_minor':
                      (row['declared_minor'] as int) -
                      (row['expected_minor'] as int),
                },
              )
              .toList(),
        };
        _drawer.clear();
      default:
        throw const FormatException('INVALID_COMMAND');
    }
    await _append(kind, commandId, resource, payload);
    return result;
  }

  Future<void> checkout(String commandId, String saleId, Json payload) async {
    _postPayments(savedCheckoutPayments(payload));
    await _append('checkout', commandId, saleId, payload);
  }

  Future<void> reverseSale(String id, Json payload, List<Json> payments) async {
    _postPayments(payments);
    await _append('reversal', id, id, payload);
  }

  static List<Json> savedCheckoutPayments(Json payload) {
    final types = {
      for (final type in jsonRows(payload['payment_types'])) type['id']: type,
    };
    return jsonRows(payload['payments']).map((payment) {
      final type = types[payment['payment_type_id']]!;
      final amount = payment['amount_minor'] as int;
      return {
        ...payment,
        'payment_type_name': type['name'],
        'payment_kind': type['kind'],
        'amount_minor': payment['entry_type'] == 'change' ? -amount : amount,
      };
    }).toList();
  }

  void _postPayments(List<Json> payments) {
    final shift = _shift;
    if (shift != null) {
      final counts = jsonRows(shift['counts']).toList();
      for (final payment in payments) {
        final currency = payment['currency'] as String;
        final drawer = payment['payment_kind'] == 'cash'
            ? counts
                  .where(
                    (row) =>
                        row['payment_kind'] == 'cash' &&
                        row['currency'] == currency,
                  )
                  .firstOrNull
            : null;
        final matched =
            drawer ??
            counts.where((row) => _key(row) == _key(payment)).firstOrNull;
        final count =
            matched ??
            {
              'payment_type_id': payment['payment_type_id'],
              'payment_type_name': payment['payment_type_name'],
              'payment_kind': payment['payment_kind'],
              'currency': currency,
              'expected_minor': 0,
            };
        if (matched == null) counts.add(count);
        final amount = payment['amount_minor'] as int;
        count['expected_minor'] = (count['expected_minor'] as int) + amount;
      }
      _saveCounts(shift, counts);
    }
  }

  Future<void> _append(
    String kind,
    String commandId,
    String resourceId,
    Json payload,
  ) {
    if (_drawer.isEmpty) {
      _profiles.remove(_profileId);
    } else {
      _profiles[_profileId] = _drawer;
    }
    activity['profiles'] = _profiles;
    return database.appendStoreEvent(
      store: store,
      commandId: commandId,
      resourceId: resourceId,
      operatorId: actor.id,
      operatorName: actor.displayName,
      kind: kind,
      occurredAt: time,
      settings: {
        'working_day_enabled': _config['working_day_enabled'] == true,
        'cashier_shift_enabled': _config['cashier_shift_enabled'] == true,
      },
      payload: payload,
      activity: activity,
      profileId: _profileId,
    );
  }

  Json _currentShift(Object? id) {
    final shift = _shift;
    if (shift == null || shift['id'] != id) throw _changed;
    return shift;
  }

  void _saveCounts(Json shift, List<Json> counts) {
    _drawer['cashier_shift'] = {
      ...shift,
      'counts': counts,
      'activity_revision': (shift['activity_revision'] as int) + 1,
    };
  }

  static String _key(Json row) =>
      '${row['payment_type_id']}:${row['currency']}';

  static Json _count(Json type, String currency) => {
    'payment_type_id': type['id'],
    'payment_type_name': type['name'],
    'payment_kind': type['kind'],
    'currency': currency,
    'expected_minor': 0,
  };

  static Json _floatCount(List<Json> types, List<Json> counts, Json input) {
    final type = types
        .where((type) => type['id'] == input['payment_type_id'])
        .firstOrNull;
    if (type == null || !allowsCashFloat(type)) throw _invalidCount;
    return counts.where((row) => _key(row) == _key(input)).firstOrNull ??
        (throw _invalidCount);
  }

  static int _amount(Object? value, int minimum) {
    if (value is! int || value < minimum || value > maxPosAmount) {
      throw _invalidCount;
    }
    return value;
  }

  static const _invalidCount = FormatException('INVALID_AMOUNT');
  static const _changed = PosApiError(
    409,
    'SALE_CONTEXT_CHANGED',
    'The working day or shift changed.',
  );
  static const _disabled = PosApiError(
    409,
    'FEATURE_DISABLED',
    'This control is disabled for the profile.',
  );
}
