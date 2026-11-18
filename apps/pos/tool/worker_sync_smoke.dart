import 'dart:convert';
import 'dart:io';

import 'package:drift/native.dart';
import 'package:emenu_pos/core/api_endpoint.dart';
import 'package:emenu_pos/features/sales/sale/cart_line.dart';
import 'package:emenu_pos/core/pos_api.dart';
import 'package:emenu_pos/core/pos_device_key.dart';
import 'package:emenu_pos/core/register_authority.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:emenu_pos/features/sales/sale/sale_sync.dart';
import 'package:emenu_pos/core/store_host.dart';
import 'package:emenu_pos/core/store_transport.dart';
import 'package:http/http.dart' as http;
import 'package:timezone/data/latest_all.dart' as timezones;
import 'package:uuid/uuid.dart';

class InterruptedCheckout extends http.BaseClient {
  final _client = http.Client();
  final interrupted = <String>{};
  bool offline = false;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    if (offline) throw http.ClientException('Simulated WAN loss');
    final response = await _client.send(request);
    final path = request.url.path;
    if (request is! http.Request ||
        !(path.endsWith(ApiEndpoint.storeOperations) ||
            path.endsWith(ApiEndpoint.recoverStoreOperations))) {
      return response;
    }
    final input = jsonObject(jsonDecode(request.body));
    final event = input['operation'] == null
        ? input
        : jsonObject(input['operation']);
    if (response.statusCode >= 400) {
      final failure = await http.Response.fromStream(response);
      stderr.writeln(
        'Store operation ${event['sequence']} ${event['kind']}: ${failure.body}',
      );
      return http.StreamedResponse(
        Stream.value(failure.bodyBytes),
        response.statusCode,
        headers: response.headers,
      );
    }
    if (response.statusCode == 201) {
      final kind = event['kind'] as String;
      if ((kind == 'checkout' || kind == 'reversal') && interrupted.add(kind)) {
        await response.stream.drain<void>();
        throw http.ClientException(
          'Simulated loss after the Worker recorded $kind',
        );
      }
    }
    return response;
  }

  @override
  void close() => _client.close();
}

Future<void> main() async {
  timezones.initializeTimeZones();
  final env = Platform.environment;
  final revocationToken = env['POS_SMOKE_REVOKE_CASHIER_TOKEN'];
  final transport = InterruptedCheckout();
  final api = PosApi(env['POS_API_BASE']!, client: transport);
  final folder = await Directory.systemTemp.createTemp('emenu-store-smoke-');
  final file = File('${folder.path}${Platform.pathSeparator}store.sqlite');
  var database = RegisterDatabase(NativeDatabase(file));
  StoreHost? host;
  StoreClient? front;
  StoreClient? counter;
  StoreClient? side;
  try {
    final discovery = await api.login(
      env['POS_BUSINESS_SLUG']!,
      env['POS_EMAIL']!,
      env['POS_PASSWORD']!,
    );
    final profile = env['POS_PROFILE_ID']!;
    final sideProfile = env['POS_SECOND_PROFILE_ID']!;
    final session = await api.startSession(
      discovery['token'] as String,
      profile,
    );
    final token = session['token'] as String;
    final context = await api.request(ApiEndpoint.context, token: token);
    final owner = jsonObject(context['operator']);
    final ownerId = owner['id'] as String;
    final business = jsonObject(context['business']);
    final config = jsonObject(jsonObject(context['profile'])['config']);
    final catalog = await api.catalog(
      token,
      menuId: defaultCatalogMenuId(context),
    );
    final tables = await api.pages(ApiEndpoint.tables, 'tables', token);
    final customers = await api.pages(
      ApiEndpoint.customers,
      'customers',
      token,
    );
    final product = jsonRows(catalog['products'])
        .singleWhere((product) => product['id'] == env['POS_PRODUCT_ID']);
    final line = CartLine(product);
    final price = line.totals(config).total;
    final currency = business['currency'] as String;
    final payment = jsonRows(context['payment_types']).firstWhere(
      (method) => method['kind'] == 'cash' && method['currency'] == currency,
    );
    final khrCash = jsonRows(context['payment_types']).firstWhere(
      (method) => method['kind'] == 'cash' && method['currency'] == 'KHR',
    );
    await database
        .into(database.registerInstallations)
        .insert(
          RegisterInstallationsCompanion.insert(
            apiOrigin: api.origin.toString(),
            businessSlug: env['POS_BUSINESS_SLUG']!,
            businessId: business['id'] as String,
            branchId: jsonObject(context['profile'])['branch_id'] as String,
            profileId: profile,
          ),
        );
    await database.saveSnapshot(profile, {
      'context': context,
      'catalog': catalog,
      'tables': tables,
      'customers': customers,
    });
    if (revocationToken != null) {
      if (jsonObject(context['capabilities'])['store_recovery'] != true) {
        throw StateError(
          'The fixture needs a Worker that supports store recovery',
        );
      }
      await database
          .into(database.registerOperators)
          .insert(
            RegisterOperatorsCompanion.insert(
              id: ownerId,
              email: env['POS_EMAIL']!,
              displayName: owner['name'] as String,
              role: 'owner',
            ),
          );
    }
    final signingKey = PosDeviceKey.generate();
    final descriptor = await signingKey.descriptor('Store register');
    final credentials = <(String, String), String>{};
    final now = DateTime.now().toUtc();
    final openingTime = DateTime.utc(now.year, now.month, now.day - 2, 16, 50);
    var clock = openingTime;
    host = StoreHost(
      RegisterAuthority(database, now: () => clock),
      StoreCertificate.generate(),
      verifyPosSession: (token) =>
          api.request(ApiEndpoint.context, token: token),
      onVerified: (context, token) async {
        final selected = jsonObject(context['profile'])['id'] as String;
        if (selected != profile) {
          await database.saveSnapshot(selected, {
            'context': context,
            'catalog': await api.catalog(
              token,
              menuId: defaultCatalogMenuId(context),
            ),
            'tables': await api.pages(ApiEndpoint.tables, 'tables', token),
            'customers': await api.pages(
              ApiEndpoint.customers,
              'customers',
              token,
            ),
          });
        }
        final credential = await api.request(
          ApiEndpoint.devices,
          method: 'POST',
          token: token,
          body: descriptor,
        );
        credentials[(
              jsonObject(context['operator'])['id'] as String,
              selected,
            )] =
            credential['id'] as String;
      },
    );
    await host.start(address: InternetAddress.loopbackIPv4, port: 0);
    final frontInvite = host.invitation('127.0.0.1');
    front = StoreClient(frontInvite.endpoint);
    final frontGrant =
        (await front.pair(
              invitation: frontInvite,
              attemptId: const Uuid().v4(),
              label: 'Front till',
              posToken: token,
            ))['staff_credential']
            as String;
    final counterInvite = host.invitation('127.0.0.1');
    counter = StoreClient(counterInvite.endpoint);
    final pairedCounter = await counter.pair(
      invitation: counterInvite,
      attemptId: const Uuid().v4(),
      label: 'Counter till',
      posToken: token,
    );
    final cashierUsername = env['POS_CASHIER_USERNAME'];
    final cashierEmail = cashierUsername == null
        ? env['POS_CASHIER_EMAIL']!
        : await api.resolveUsername(cashierUsername, token);
    final cashierDiscovery = await api.login(
      env['POS_BUSINESS_SLUG']!,
      cashierEmail,
      env['POS_PASSWORD']!,
      username: cashierUsername,
    );
    final cashier = await api.startSession(
      cashierDiscovery['token'] as String,
      profile,
    );
    final cashierToken = cashier['token'] as String;
    final counterGrant =
        (await counter.enroll(
              pairedCounter['device_credential'] as String,
              cashierToken,
            ))['staff_credential']
            as String;

    final sideSession = await api.startSession(
      discovery['token'] as String,
      sideProfile,
    );
    final sideToken = sideSession['token'] as String;
    final sideInvite = host.invitation('127.0.0.1');
    side = StoreClient(sideInvite.endpoint);
    final sidePair = await side.pair(
      invitation: sideInvite,
      attemptId: const Uuid().v4(),
      label: 'Retail till',
      posToken: sideToken,
    );
    if (sidePair['profile_id'] != sideProfile) {
      throw StateError('The retail till used the wrong profile');
    }
    final sideGrant = sidePair['staff_credential'] as String;
    try {
      await side.enroll(sidePair['device_credential'] as String, cashierToken);
      throw StateError('A till accepted enrollment from another profile');
    } on PosApiError catch (error) {
      if (error.code != 'WRONG_PROFILE') rethrow;
    }

    final authority = await api.request(
      ApiEndpoint.storeAuthority,
      method: 'POST',
      token: token,
      body: {},
    );
    final epoch = authority['epoch'] as String;
    await database.startStoreAuthority(epoch, authority['timezone'] as String);
    await api.request(
      ApiEndpoint.currentSession,
      method: 'DELETE',
      token: token,
    );
    await api.request(
      ApiEndpoint.currentSession,
      method: 'DELETE',
      token: sideToken,
    );
    await api.request(
      ApiEndpoint.currentSession,
      method: 'DELETE',
      token: cashierToken,
    );
    transport.offline = true;
    Future<Json> command(
      StoreClient till,
      String grant,
      RegisterAction action,
      Json body, {
      String? id,
    }) => till.command(
      staffCredential: grant,
      id: id ?? const Uuid().v4(),
      action: action,
      body: body,
    );
    Future<Json> registerContext() async {
      final state = await counter!.state(counterGrant);
      return jsonObject(jsonObject(state['snapshot'])['context']);
    }

    Future<Json> frontCount() async {
      final state = await front!.state(frontGrant);
      final context = jsonObject(jsonObject(state['snapshot'])['context']);
      return jsonObject(context['cashier_shift']);
    }

    Future<Json> sideContext() async {
      final state = await side!.state(sideGrant);
      return jsonObject(jsonObject(state['snapshot'])['context']);
    }

    final drawerId = payment['id'];
    final day = await command(front, frontGrant, RegisterAction.openDay, {});
    final firstShift = await command(
      front,
      frontGrant,
      RegisterAction.openShift,
      {
        'day_id': day['id'],
        'opening_cash': [
          {'payment_type_id': drawerId, 'currency': 'USD', 'amount_minor': 500},
        ],
      },
    );
    final retailStart = await sideContext();
    if (jsonObject(retailStart['working_day'])['id'] != day['id'] ||
        retailStart['cashier_shift'] != null) {
      throw StateError(
        'The retail till did not share the day with a separate drawer',
      );
    }
    final sideShift = await command(side, sideGrant, RegisterAction.openShift, {
      'day_id': day['id'],
      'opening_cash': [
        {'payment_type_id': drawerId, 'currency': 'USD', 'amount_minor': 900},
      ],
    });
    await command(front, frontGrant, RegisterAction.cashMovement, {
      'shift_id': firstShift['id'],
      'payment_type_id': khrCash['id'],
      'currency': 'KHR',
      'amount_minor': 4000,
      'kind': 'cash_in',
      'reason': 'Float',
    });
    Json countInput(Json shift) => {
      'shift_id': shift['id'],
      'activity_revision': shift['activity_revision'],
      'counts': [
        for (final row in jsonRows(shift['counts']))
          {
            'payment_type_id': row['payment_type_id'],
            'currency': row['currency'],
            'declared_minor': row['expected_minor'],
          },
      ],
    };
    final localId = const Uuid().v4();
    final editedLine = line.withLineEdits({
      'base_price_override_minor': line.catalogBase,
      'note': 'Offline table order',
    });
    final bill = {
      'cart_line_edits_version': 1,
      'table_id': tables.first['id'],
      'guest_cover': 4,
      'expected_context': registerOperatingContext(
        await registerContext(),
        clock,
      ),
      'quote': [editedLine.quote(config)],
      'total_minor': price,
      'currency': currency,
      'exchange_rate': business['secondary_exchange_rate'],
    };
    await command(front, frontGrant, RegisterAction.hold, bill, id: localId);
    final shared = await counter.state(counterGrant);
    var pairedBill = jsonRows(shared['bills']).single;
    if (pairedBill['id'] != localId ||
        jsonObject(
              jsonDecode(pairedBill['payload'] as String),
            )['table_status'] !=
            'hold') {
      throw StateError('The paired till did not see the held bill');
    }
    for (final status in ['occupied', 'bill_requested']) {
      await command(front, frontGrant, RegisterAction.hold, {
        ...bill,
        'bill_id': localId,
        'bill_revision': pairedBill['revision'],
        'table_status': status,
      });
      pairedBill = jsonRows((await counter.state(counterGrant))['bills'])
          .single;
      final payload = jsonObject(jsonDecode(pairedBill['payload'] as String));
      if (pairedBill['id'] != localId ||
          payload['table_status'] != status ||
          payload['guest_cover'] != 4) {
        throw StateError(
          'The paired till did not see $status and the saved guest count',
        );
      }
    }
    if (jsonRows((await side.state(sideGrant))['bills']).isNotEmpty) {
      throw StateError('The retail till saw another profile’s held bill');
    }
    try {
      await command(side, sideGrant, RegisterAction.hold, bill, id: localId);
      throw StateError('A command replay crossed profiles');
    } on PosApiError catch (error) {
      if (error.code != 'IDEMPOTENCY_CONFLICT') rethrow;
    }
    await command(
      front,
      frontGrant,
      RegisterAction.closeShift,
      countInput(await frontCount()),
    );
    try {
      await command(front, frontGrant, RegisterAction.closeDay, {
        'day_id': day['id'],
      });
      throw StateError('The working day closed with a held bill');
    } on PosApiError catch (error) {
      if (error.code != 'WORKING_DAY_HAS_ACTIVITY') rethrow;
    }
    clock = openingTime.add(const Duration(minutes: 20));
    final lastShift = await command(
      counter,
      counterGrant,
      RegisterAction.openShift,
      {
        'day_id': day['id'],
        'opening_cash': [
          {'payment_type_id': drawerId, 'currency': 'USD', 'amount_minor': 200},
        ],
      },
    );
    await command(counter, counterGrant, RegisterAction.checkout, {
      ...bill,
      'expected_context': registerOperatingContext(
        await registerContext(),
        clock,
      ),
      'bill_id': localId,
      'bill_revision': pairedBill['revision'],
      'payments': [
        {
          'payment_type_id': payment['id'],
          'currency': currency,
          'amount_minor': price ~/ 2,
        },
        {
          'payment_type_id': khrCash['id'],
          'currency': 'KHR',
          'amount_minor': 6000,
        },
        {
          'payment_type_id': khrCash['id'],
          'currency': 'KHR',
          'entry_type': 'change',
          'amount_minor': 6000 - (price - price ~/ 2) * 40,
        },
      ],
    });
    final checkoutTime = clock;
    final stale = countInput(await frontCount());
    await command(front, frontGrant, RegisterAction.cashMovement, {
      'shift_id': lastShift['id'],
      'payment_type_id': drawerId,
      'currency': 'USD',
      'amount_minor': 25,
      'kind': 'cash_out',
      'reason': 'Drawer pickup',
    });
    try {
      await command(counter, counterGrant, RegisterAction.closeShift, stale);
      throw StateError('A stale closing count was accepted');
    } on PosApiError catch (error) {
      if (error.code != 'RECONCILIATION_CHANGED') rethrow;
    }
    final blind = jsonObject((await registerContext())['cashier_shift']);
    if (jsonRows(blind['counts'])
        .any((row) => row.containsKey('expected_minor'))) {
      throw StateError(
        'The cashier received expected counts before submission',
      );
    }
    final counted = countInput(await frontCount());
    final review = await counter.shiftManagement(counterGrant, {
      'kind': 'review',
      'id': blind['id'],
      'count': counted,
    });
    if (jsonRows(review['counts']).any((row) => row['variance_minor'] != 0)) {
      throw StateError('The verified close count did not balance');
    }
    await command(counter, counterGrant, RegisterAction.closeShift, counted);
    await command(front, frontGrant, RegisterAction.reopenShift, {
      'shift_id': lastShift['id'],
      'reason': 'Validate reopening while offline',
    });
    await command(
      front,
      frontGrant,
      RegisterAction.closeShift,
      countInput(await frontCount()),
    );
    try {
      await command(front, frontGrant, RegisterAction.closeDay, {
        'day_id': day['id'],
      });
      throw StateError(
        'The working day closed with the retail shift still open',
      );
    } on PosApiError catch (error) {
      if (error.code != 'WORKING_DAY_HAS_ACTIVITY') rethrow;
    }
    final retail = await sideContext();
    final retailConfig = jsonObject(jsonObject(retail['profile'])['config']);
    final retailTotal = line.totals(retailConfig).total;
    final retailSale = const Uuid().v4();
    await command(side, sideGrant, RegisterAction.checkout, {
      'expected_context': registerOperatingContext(retail, clock),
      'quote': [line.quote(retailConfig)],
      'total_minor': retailTotal,
      'currency': currency,
      'exchange_rate': business['secondary_exchange_rate'],
      'payments': [
        {
          'payment_type_id': drawerId,
          'currency': currency,
          'amount_minor': retailTotal,
        },
      ],
    }, id: retailSale);
    await command(
      side,
      sideGrant,
      RegisterAction.closeShift,
      countInput(jsonObject((await sideContext())['cashier_shift'])),
    );
    await command(front, frontGrant, RegisterAction.closeDay, {
      'day_id': day['id'],
    });
    clock = openingTime.add(const Duration(hours: 5));
    final refundDay = await command(
      front,
      frontGrant,
      RegisterAction.openDay,
      {},
    );
    final refundShift = await command(
      front,
      frontGrant,
      RegisterAction.openShift,
      {
        'day_id': refundDay['id'],
        'opening_cash': [
          {'payment_type_id': drawerId, 'currency': 'USD', 'amount_minor': 500},
          {
            'payment_type_id': khrCash['id'],
            'currency': 'KHR',
            'amount_minor': 10000,
          },
        ],
      },
    );
    final refund = {
      'sale_id': localId,
      'reason': 'Customer returned order',
      'expected_context': registerOperatingContext(
        await registerContext(),
        clock,
      ),
    };
    try {
      await command(counter, counterGrant, RegisterAction.reverseSale, refund);
      throw StateError('A cashier reversed a sale');
    } on PosApiError catch (error) {
      if (error.code != 'MANAGER_REQUIRED') rethrow;
    }
    final reversalId = const Uuid().v4();
    await command(
      front,
      frontGrant,
      RegisterAction.reverseSale,
      refund,
      id: reversalId,
    );
    await command(
      front,
      frontGrant,
      RegisterAction.reverseSale,
      refund,
      id: reversalId,
    );
    try {
      await command(front, frontGrant, RegisterAction.reverseSale, refund);
      throw StateError('The sale was reversed twice');
    } on PosApiError catch (error) {
      if (error.code != 'SALE_ALREADY_REVERSED') rethrow;
    }
    await command(
      front,
      frontGrant,
      RegisterAction.closeShift,
      countInput(await frontCount()),
    );
    await command(front, frontGrant, RegisterAction.closeDay, {
      'day_id': refundDay['id'],
    });
    final lastSequence = (await database.storeOperatingState())!.sequence;
    front.close();
    counter.close();
    side.close();
    await host.close();
    await database.close();
    database = RegisterDatabase(NativeDatabase(file));
    if ((await database.storeOperatingState())?.sequence != lastSequence) {
      throw StateError('The operating sequence did not survive restart');
    }
    final renewedTokens = <(String, String), String>{};
    final sync = SaleSync(database, api, (
      operatorId,
      profileId,
      operation,
    ) async {
      final scope = (operatorId, profileId ?? profile);
      if (!renewedTokens.containsKey(scope)) {
        final proof = await signingKey.proof(credentials[scope]!);
        final renewed = await api.request(
          ApiEndpoint.deviceSession,
          method: 'POST',
          body: proof,
        );
        if (renewed['user_id'] != operatorId ||
            renewed['profile_id'] != scope.$2) {
          throw StateError('Device renewal changed the sale actor or profile');
        }
        renewedTokens[scope] = renewed['token'] as String;
      }
      await operation(renewedTokens[scope]!);
    });
    await sync.wake();
    if ((await database.nextStoreEvent())?.lastError != 'OFFLINE' ||
        (await database.sale(localId)).settlement != null) {
      throw StateError('The disconnected sale did not stay in the outbox');
    }
    transport.offline = false;
    if (revocationToken != null) {
      final revoked = await http
          .put(
            api.origin.resolve(AdminApiEndpoint.profileGrantsFor(profile)),
            headers: {
              'Authorization': 'Bearer $revocationToken',
              'Content-Type': 'application/json',
            },
            body: '{"user_ids":[]}',
          )
          .timeout(const Duration(seconds: 15));
      if (revoked.statusCode != 200) {
        throw StateError('Fixture revocation failed (${revoked.statusCode})');
      }
    }
    final approved = <String>[];
    await database.retryStoreEvent();
    for (var pass = 0; pass < lastSequence; pass++) {
      await sync.wake();
      final head = await database.nextStoreEvent();
      if (head == null) break;
      if (revocationToken != null && head.canApproveRecovery) {
        await database.approveStoreRecovery(
          head.commandId,
          ownerId,
          'Cashier removed while offline',
        );
        approved.add(head.commandId);
      } else if (head.lastError == 'OFFLINE' &&
          transport.interrupted.contains(head.kind) &&
          (await database.sale(head.resourceId)).settlement == null) {
        await database.retryStoreEvent();
      } else {
        throw StateError(
          'The queue stopped at ${head.kind} (${head.lastError})',
        );
      }
    }
    if (!transport.interrupted.containsAll(['checkout', 'reversal'])) {
      throw StateError('The fixture missed a lost acknowledgment');
    }
    if (revocationToken != null && approved.isEmpty) {
      throw StateError('The removed cashier did not need approval');
    }
    final sale = await database.sale(localId);
    if (sale.settlement == null || await database.nextStoreEvent() != null) {
      throw StateError('The saved sale did not synchronize');
    }
    if ((await database.sale(reversalId)).settlement == null) {
      throw StateError('The reversal did not synchronize');
    }
    await api.request(
      ApiEndpoint.storeAuthority,
      method: 'DELETE',
      token: renewedTokens[(ownerId, profile)],
      body: {'epoch': epoch, 'last_sequence': lastSequence},
    );
    final receipt = jsonObject(jsonDecode(sale.settlement!));
    stdout.writeln(
      jsonEncode({
        'server_sale_id': receipt['id'],
        'amount_minor': receipt['total_minor'],
        'day_id': day['id'],
        'business_date': day['business_date'],
        'opened_at': openingTime.toIso8601String(),
        'first_shift_id': firstShift['id'],
        'last_shift_id': lastShift['id'],
        'checkout_at': checkoutTime.toIso8601String(),
        'reversal_id': reversalId,
        'reversal_day_id': refundDay['id'],
        'reversal_shift_id': refundShift['id'],
        'side_shift_id': sideShift['id'],
        'side_sale_id': retailSale,
        'approved_commands': approved,
      }),
    );
  } finally {
    front?.close();
    counter?.close();
    side?.close();
    await host?.close();
    api.close();
    await database.close();
    await folder.delete(recursive: true);
  }
}
