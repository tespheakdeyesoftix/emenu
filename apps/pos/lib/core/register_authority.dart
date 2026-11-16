import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:drift/drift.dart' show Value;

import 'cart_line.dart';
import 'pos_api.dart';
import 'pricing.dart';
import 'register_database.dart';
import 'register_operating.dart';
import 'register_reversal.dart';

export 'register_operating.dart' show RegisterAction, registerOperatingContext;

/// Owns mutations for both the store register and paired tills.
class RegisterAuthority {
  RegisterAuthority(this.database, {DateTime Function()? now})
    : _now = now ?? DateTime.now;

  final RegisterDatabase database;
  final DateTime Function() _now;
  Future<void> _operationTail = Future.value();

  Future<T> serialize<T>(Future<T> Function() operation) {
    final result = _operationTail.then((_) => operation());
    _operationTail = result.then<void>((_) {}, onError: (Object _) {});
    return result;
  }

  Future<Json> execute({
    required String commandId,
    required String operatorId,
    required RegisterAction action,
    required Json body,
    bool consumeLocalCart = false,
  }) => _execute(
    commandId: commandId,
    action: action,
    body: body,
    consumeLocalCart: consumeLocalCart,
    authenticate: () async {
      final operator = await database.operatorById(operatorId);
      return operator == null || operator.accessRevoked
          ? null
          : (
              profileId: null,
              actor: (
                id: operator.id,
                displayName: operator.displayName,
                role: operator.role,
              ),
            );
    },
  );

  Future<Json> executePaired({
    required String commandId,
    required String credentialHash,
    required RegisterAction action,
    required Json body,
  }) => _execute(
    commandId: commandId,
    action: action,
    body: body,
    authenticate: () async {
      final staff = await database.storeStaff(credentialHash);
      return staff == null
          ? null
          : (
              profileId: staff.profileId,
              actor: (
                id: staff.grant.operatorId,
                displayName: staff.grant.displayName,
                role: staff.grant.role,
              ),
            );
    },
  );

  Future<Json> _execute({
    required String commandId,
    required RegisterAction action,
    required Json body,
    required Future<({String? profileId, RegisterActor actor})?> Function()
    authenticate,
    bool consumeLocalCart = false,
  }) async {
    if (!_validId(commandId)) throw invalidCommand;
    final canonical = _canonicalJson(body);
    final digest = await Sha256().hash(
      utf8.encode('${action.name}:$canonical'),
    );
    final fingerprint = base64Encode(digest.bytes);
    final input = jsonObject(jsonDecode(canonical));
    return serialize(
      () => database.transaction(() async {
        final setup = await database.installation();
        final session = await authenticate();
        if (setup == null || session == null) {
          throw const PosApiError(
            403,
            'SIGN_IN_REQUIRED',
            'Enroll on this register.',
          );
        }
        final actor = session.actor;
        final profileId = session.profileId ?? setup.profileId;
        final prior = await database.savedCommand(commandId);
        if (prior != null) {
          if (prior.operatorId != actor.id ||
              (prior.profileId ?? setup.profileId) != profileId ||
              prior.fingerprint != fingerprint) {
            throw const PosApiError(
              409,
              'IDEMPOTENCY_CONFLICT',
              'This command ID belongs to a different request.',
            );
          }
          return jsonObject(jsonDecode(prior.result));
        }
        final time = _now();
        final snapshot = await database.readSnapshot(profileId);
        if (snapshot == null) {
          throw const PosApiError(
            409,
            'SYNC_REQUIRED',
            'Load the POS profile.',
          );
        }
        final context = jsonObject(snapshot['context']);
        if (context['read_only'] == true &&
            !const [
              RegisterAction.closeDay,
              RegisterAction.closeShift,
              RegisterAction.discard,
            ].contains(action)) {
          throw const PosApiError(
            402,
            'READ_ONLY',
            'The profile is read only.',
          );
        }
        final store = await database.storeOperatingState();
        if (store == null && context['store_authority_required'] == true) {
          throw const PosApiError(
            409,
            'STORE_REGISTER_REQUIRED',
            'Use the designated store register.',
          );
        }
        if (store != null && store.phase != 'active') {
          throw const PosApiError(
            409,
            'STORE_AUTHORITY_PENDING',
            'Finish assigning or releasing the store register.',
          );
        }
        final operating = store == null
            ? null
            : RegisterOperating(
                database,
                store,
                snapshot,
                actor,
                time,
                await database.readStoreActivity(store),
              );
        final result = switch (action) {
          RegisterAction.reverseSale => await recordRegisterReversal(
            database: database,
            id: commandId,
            profileId: profileId,
            actor: actor,
            context: context,
            input: input,
            time: time,
            store: operating,
          ),
          RegisterAction.hold ||
          RegisterAction.discard ||
          RegisterAction.checkout => await _billAction(
            action,
            commandId,
            profileId,
            actor,
            snapshot,
            context,
            input,
            time,
            operating,
          ),
          _ =>
            await (operating ??
                    (throw const PosApiError(
                      409,
                      'STORE_OPERATIONS_DISABLED',
                      'Enable offline operations on the store register.',
                    )))
                .apply(action, commandId, input),
        };
        if (consumeLocalCart && action.consumesCart) {
          await database.removeCartDraft(
            actor.id,
            profileId,
            billId: action == RegisterAction.discard
                ? input['bill_id'] as String
                : null,
          );
        }
        await database
            .into(database.registerCommands)
            .insert(
              RegisterCommandsCompanion.insert(
                id: commandId,
                operatorId: actor.id,
                profileId: Value(profileId),
                fingerprint: fingerprint,
                result: jsonEncode(result),
                createdAt: time.toUtc(),
              ),
            );
        return result;
      }),
    );
  }

  Future<Json> _billAction(
    RegisterAction action,
    String commandId,
    String profileId,
    RegisterActor actor,
    Json snapshot,
    Json context,
    Json input,
    DateTime time,
    RegisterOperating? operating,
  ) async {
    final existingId = input['bill_id'];
    final revision = input['bill_revision'];
    if (existingId != null &&
        (existingId is! String || !_validId(existingId) || revision is! int)) {
      throw invalidCommand;
    }
    if (existingId == null && revision != null) throw invalidCommand;
    final held = existingId == null
        ? null
        : await database.heldBill(profileId, existingId as String);
    if (existingId != null && (held == null || held.revision != revision)) {
      throw const PosApiError(409, 'BILL_CHANGED', 'Reload the held bill.');
    }
    final id = held?.id ?? commandId;
    if (action == RegisterAction.discard) {
      if (held == null) throw invalidCommand;
      await database.discardHeldBill(id, profileId, held.revision);
    } else {
      await _saveBill(
        action,
        commandId,
        id,
        profileId,
        actor,
        snapshot,
        context,
        held,
        input,
        time,
        operating,
      );
    }
    return {'bill_id': id};
  }

  Future<void> _saveBill(
    RegisterAction action,
    String commandId,
    String id,
    String profileId,
    RegisterActor actor,
    Json snapshot,
    Json context,
    HeldBill? held,
    Json input,
    DateTime time,
    RegisterOperating? store,
  ) async {
    final activeConfig = jsonObject(jsonObject(context['profile'])['config']);
    final operating = registerOperatingContext(context, time);
    final workingDay = operating['working_day_id'] as String?;
    if (activeConfig['working_day_enabled'] == true && workingDay == null) {
      throw const PosApiError(
        409,
        'WORKING_DAY_REQUIRED',
        'Open the working day.',
      );
    }
    if (activeConfig['cashier_shift_enabled'] == true &&
        operating['shift_id'] == null) {
      throw const PosApiError(
        409,
        'CASHIER_SHIFT_REQUIRED',
        'Open a cashier shift.',
      );
    }
    if (_canonicalJson(operating) !=
            _canonicalJson(input['expected_context']) ||
        (held?.workingDayId != null && held!.workingDayId != workingDay)) {
      throw const PosApiError(
        409,
        'SALE_CONTEXT_CHANGED',
        'The working day or shift changed.',
      );
    }
    final saved = held == null ? null : jsonObject(jsonDecode(held.payload));
    final quoteContext = saved == null
        ? {
            'profile': context['profile'],
            'business': context['business'],
            'payment_types': context['payment_types'],
          }
        : jsonObject(saved['quote_context']);
    final config = jsonObject(jsonObject(quoteContext['profile'])['config']);
    final business = jsonObject(quoteContext['business']);
    final currency = business['currency'] as String;
    final rate = business['secondary_exchange_rate'].toString();
    final tableId = input['table_id'] as String?;
    final table = jsonRows(snapshot['tables'])
        .where((row) => row['id'] == tableId)
        .firstOrNull;
    if (config['table_mode'] == 'required' && tableId == null) {
      throw const FormatException('TABLE_REQUIRED');
    }
    if (tableId != null &&
        (config['table_mode'] == 'disabled' ||
            (table == null && held?.tableId != tableId))) {
      throw const PosApiError(
        409,
        'SELECTION_CHANGED',
        'This table is unavailable.',
      );
    }
    if (table?['status'] == 'occupied') {
      throw const PosApiError(
        409,
        'TABLE_OCCUPIED',
        'This table has a server bill.',
      );
    }
    final customerId = input['customer_id'] ?? config['default_customer_id'];
    final customer = jsonRows(snapshot['customers'])
        .where((row) => row['id'] == customerId)
        .firstOrNull;
    if (customer == null && customerId != saved?['customer_id']) {
      throw const PosApiError(
        409,
        'SELECTION_CHANGED',
        'This customer is unavailable.',
      );
    }

    final quoted = jsonRows(input['quote']);
    final lines = _pricedLines(snapshot, saved, quoted);
    final prices = lines.map((line) => line.quote(config)).toList();
    final total = prices.fold<int>(
      0,
      (sum, row) => sum + (row['total_minor'] as int),
    );
    const amountFields = [
      'unit_price_minor',
      'subtotal_minor',
      'tax_minor',
      'total_minor',
    ];
    if (input['currency'] != currency ||
        input['exchange_rate'] != rate ||
        input['total_minor'] != total ||
        prices.indexed.any(
          (pair) =>
              amountFields.any((key) => pair.$2[key] != quoted[pair.$1][key]),
        )) {
      throw const PosApiError(
        409,
        'PRICE_CHANGED',
        'Refresh the product prices.',
      );
    }
    if (total > maxPosAmount) throw const FormatException('AMOUNT_LIMIT');
    final currentTableLabel = table?['label'];
    final tableLabel = held?.tableId == tableId
        ? (saved?['table_label'] ?? currentTableLabel)
        : currentTableLabel;
    final tableCode = held?.tableId == tableId
        ? (saved?['table_code'] ?? table?['code'])
        : table?['code'];
    final customerName = customer?['name'] ?? saved?['customer_name'];
    if (action == RegisterAction.hold) {
      await database.holdBill(
        id: id,
        profileId: profileId,
        tableId: tableId,
        workingDayId: workingDay,
        revision: held?.revision,
        payload: {
          'customer_id': customerId,
          'customer_name': customerName,
          'table_code': tableCode,
          'table_label': tableLabel,
          'total_minor': total,
          'currency': currency,
          'quote_context': quoteContext,
          'lines': lines.map((line) => line.heldSnapshot).toList(),
        },
      );
      return;
    }

    final payments = jsonRows(input['payments']).map(_payment).toList();
    final types = jsonRows(quoteContext['payment_types']);
    if (payments.length > 60 ||
        paymentTotal(
              entries: payments,
              paymentTypes: types,
              primary: currency,
              rate: rate,
            ) !=
            total) {
      throw const FormatException('PAYMENT_TOTAL_MISMATCH');
    }
    final quotedProfile = jsonObject(quoteContext['profile']);
    final receipt = {
      'business_name': business['name'],
      'profile_name': quotedProfile['name'],
      'branch_name': quotedProfile['branch_name'],
      'business_date': operating['business_date'],
      'operator_name': actor.displayName,
      'customer_name': customerName,
      'table_label': tableLabel,
      'template': config['receipt_template'],
      'copies': config['print_copies'],
      'payment_type_names': {
        for (final type in types) type['id'] as String: type['name'],
      },
    };
    await database.queueSale(
      id: id,
      profileId: profileId,
      operatorId: actor.id,
      total: total,
      currency: currency,
      heldRevision: held?.revision,
      createdAt: time,
      request: {
        'draft': {
          'table_id': tableId,
          'customer_id': customerId,
          'lines': lines.map((line) => line.request).toList(),
          'expected_context': operating,
        },
        'quote': prices,
        'exchange_rate': rate,
        'payments': payments,
        'receipt': receipt,
      },
    );
    if (store != null) {
      final catalog = jsonObject(snapshot['catalog']);
      await store.checkout(commandId, id, {
        'expected_context': operating,
        'currency': currency,
        'exchange_rate': rate,
        'tax_mode': config['tax_mode'],
        'tax_rate_bps': config['tax_rate_bps'],
        'table_mode': config['table_mode'],
        'table_id': tableId,
        'table_label': tableLabel,
        'table_code': tableCode,
        'customer_id': customerId,
        'customer_name': customerName,
        'total_minor': total,
        'lines': [
          for (final (index, line) in lines.indexed)
            {
              ...prices[index],
              'product_code': line.product['code'],
              'product_name': line.product['name'],
              'portion_name':
                  line.portion?['label'] ??
                  line.portion?['label_km'] ??
                  line.portion?['label_en'],
              'price_list_id':
                  (line.portion ?? line.product)['price_list_id'] ??
                  catalog['price_list_id'],
              'modifiers': line.modifiers,
            },
        ],
        'payment_types': types,
        'payments': payments,
        'receipt': receipt,
      });
    }
  }

  List<CartLine> _pricedLines(Json snapshot, Json? saved, List<Json> quoted) {
    if (quoted.isEmpty) throw const FormatException('EMPTY_CART');
    if (quoted.length > 60) throw const FormatException('CART_LIMIT');
    final catalog = {
      for (final row in jsonRows(jsonObject(snapshot['catalog'])['products']))
        row['id']: row,
    };
    final previous = jsonRows(saved?['lines'])
        .map(CartLine.fromHeldSnapshot)
        .toList();
    return quoted.map((row) {
      final ids = (row['modifier_ids'] as List).cast<String>();
      final selected = ids.toSet();
      if (ids.length > 120 || selected.length != ids.length) {
        throw invalidCommand;
      }
      final existing = previous
          .where((line) => line.matchesSelection(row, selected))
          .firstOrNull;
      if (existing != null) {
        return existing.withQuantity(row['quantity'] as int);
      }
      final product = catalog[row['product_id']];
      if (product == null) throw CartLine.unavailable;
      return CartLine.fromCatalog(product, row, selected);
    }).toList();
  }

  Json _payment(Json payment) {
    final reference = payment['reference'];
    if (reference != null && (reference is! String || reference.length > 160)) {
      throw invalidCommand;
    }
    return {
      'payment_type_id': payment['payment_type_id'],
      'currency': payment['currency'],
      'amount_minor': payment['amount_minor'],
      'entry_type': payment['entry_type'] ?? 'tender',
      'reference': ?reference,
    };
  }

  static bool _validId(String id) =>
      RegExp(r'^[a-zA-Z0-9_-]{1,80}$').hasMatch(id);

  static const invalidCommand = PosApiError(
    400,
    'INVALID_COMMAND',
    'Invalid register command.',
  );
}

String _canonicalJson(Object? value) {
  if (value is Map) {
    final keys = value.keys.cast<String>().toList()..sort();
    return '{${keys.map((key) => '${jsonEncode(key)}:${_canonicalJson(value[key])}').join(',')}}';
  }
  if (value is List) return '[${value.map(_canonicalJson).join(',')}]';
  return jsonEncode(value);
}
