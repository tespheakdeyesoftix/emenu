import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart' show Value, driftRuntimeOptions;
import 'package:drift/native.dart';
import 'package:emenu_pos/core/pos_api.dart';
import 'package:emenu_pos/core/register_access.dart';
import 'package:emenu_pos/core/register_authority.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:emenu_pos/core/register_network.dart';
import 'package:emenu_pos/core/sale_sync.dart';
import 'package:emenu_pos/core/store_host.dart';
import 'package:emenu_pos/core/store_transport.dart';
import 'package:emenu_pos/features/register/register_controller.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:timezone/data/latest_all.dart' as timezones;
import 'package:uuid/uuid.dart';

const profileId = 'dine_in';
const config = <String, dynamic>{
  'table_mode': 'required',
  'working_day_enabled': true,
  'cashier_shift_enabled': true,
  'tax_mode': 'exclusive',
  'tax_rate_bps': 1000,
  'default_customer_id': 'walk_in',
};
const coffee = <String, dynamic>{
  'id': 'coffee',
  'name': 'Coffee',
  'price_minor': 100,
};
final overnight = DateTime.utc(2026, 11, 11, 18, 30);

Json snapshot(String shift) => {
  'context': {
    'capabilities': {'reversal_context_guard': true},
    'business': {
      'id': 'store',
      'name': 'Store',
      'timezone': 'Asia/Phnom_Penh',
      'currency': 'USD',
      'secondary_exchange_rate': '4000',
    },
    'profile': {'id': profileId, 'config': config},
    'working_day': {'id': 'day', 'business_date': '2026-11-11'},
    'cashier_shift': {'id': shift},
    'payment_types': [
      {
        'id': 'cash',
        'kind': 'cash',
        'currencies': ['USD', 'KHR'],
      },
    ],
  },
  'catalog': {
    'products': [coffee],
  },
  'customers': [
    {'id': 'walk_in', 'name': 'Walk-in'},
  ],
  'tables': [
    {'id': 'table', 'label': 'A1', 'status': 'available'},
  ],
};

Json order({
  String? billId,
  int? revision,
  int quantity = 1,
  String shift = 'morning',
  Json product = coffee,
}) {
  final line = CartLine(product, quantity: quantity);
  return {
    'bill_id': billId,
    'bill_revision': revision,
    'table_id': 'table',
    'total_minor': line.totals(config).total,
    'quote': [line.quote(config)],
    'currency': 'USD',
    'exchange_rate': '4000',
    'expected_context': registerOperatingContext(
      jsonObject(snapshot(shift)['context']),
      overnight,
    ),
  };
}

Future<void> prepare(RegisterDatabase database) async {
  await database
      .into(database.registerInstallations)
      .insert(
        RegisterInstallationsCompanion.insert(
          apiOrigin: 'https://pos.example.test',
          businessSlug: 'store',
          businessId: 'store',
          branchId: 'branch',
          profileId: profileId,
        ),
      );
  for (final id in ['owner', 'cashier']) {
    await database
        .into(database.registerOperators)
        .insert(
          RegisterOperatorsCompanion.insert(
            id: id,
            email: '$id@example.test',
            displayName: id,
            role: id == 'owner' ? 'owner' : 'staff',
          ),
        );
  }
  await database.saveSnapshot(profileId, snapshot('morning'));
}

Matcher errorCode(String code) =>
    isA<PosApiError>().having((error) => error.code, 'code', code);

void main() {
  timezones.initializeTimeZones();

  test(
    'an approved recovery survives restart and retries a lost acknowledgment',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'emenu-recovery-',
      );
      addTearDown(() => directory.delete(recursive: true));
      final file = File(
        '${directory.path}${Platform.pathSeparator}register.sqlite',
      );
      final first = RegisterDatabase(NativeDatabase(file));
      var dropReply = true;
      final recoveryRequests = <Json>[];
      final imported = <String>[];
      final api = PosApi(
        'https://pos.example.test',
        client: MockClient((request) async {
          final input = jsonObject(jsonDecode(request.body));
          final recovery = request.url.path.endsWith('/recover');
          final operation = recovery ? jsonObject(input['operation']) : input;
          final id = operation['resource_id'] as String;
          if (recovery) {
            expect(request.headers['authorization'], 'Bearer owner');
            expect(request.headers['idempotency-key'], 'saved_sale');
            expect(input['profile_id'], profileId);
            expect(input['operator_id'], 'cashier');
            expect(input['reason'], 'Cashier left');
            recoveryRequests.add(input);
            if (dropReply) {
              dropReply = false;
              throw http.ClientException('Lost reply');
            }
          }
          imported.add(id);
          return http.Response(
            jsonEncode({'id': id, 'settled_by': 'cashier'}),
            201,
          );
        }),
      );
      addTearDown(api.close);
      SaleSync sync(RegisterDatabase db) =>
          SaleSync(db, api, (id, profile, work) {
            if (id == 'cashier') {
              throw const PosApiError(
                401,
                'SIGN_IN_REQUIRED',
                'Cashier access was removed',
              );
            }
            return work(id);
          });
      try {
        await prepare(first);
        await first.startStoreAuthority('store_epoch', 'Asia/Phnom_Penh');
        final authority = RegisterAuthority(
          first,
          now: () => DateTime.utc(2026, 11, 11, 16, 50),
        );
        Future<Json> act(
          String id,
          RegisterAction action,
          Json body, {
          String actor = 'owner',
        }) => authority.execute(
          commandId: id,
          operatorId: actor,
          action: action,
          body: body,
        );
        await act('day', RegisterAction.openDay, {});
        await act('morning', RegisterAction.openShift, {'day_id': 'day'});
        await act('saved_sale', RegisterAction.checkout, {
          ...order(),
          'payments': [
            {'payment_type_id': 'cash', 'currency': 'USD', 'amount_minor': 110},
          ],
        }, actor: 'cashier');
        await act('after_sale', RegisterAction.cashMovement, {
          'shift_id': 'morning',
          'payment_type_id': 'cash',
          'currency': 'USD',
          'kind': 'cash_in',
          'amount_minor': 50,
          'reason': 'Change float',
        });
        await sync(first).wake();
        final head = (await first.nextStoreEvent())!;
        expect(head.commandId, 'saved_sale');
        expect(head.operatorName, 'cashier');
        expect(head.canApproveRecovery, isTrue);
        expect(imported, ['day', 'morning']);
        await expectLater(
          first.approveStoreRecovery('saved_sale', 'cashier', 'Denied'),
          throwsFormatException,
        );
        await expectLater(
          first.approveStoreRecovery('after_sale', 'owner', 'Wrong entry'),
          throwsFormatException,
        );
        await first.approveStoreRecovery(
          'saved_sale',
          'owner',
          '  Cashier left  ',
        );
        expect((await first.nextStoreEvent())?.envelope, head.envelope);
      } finally {
        await first.close();
      }

      final reopened = RegisterDatabase(NativeDatabase(file));
      addTearDown(reopened.close);
      expect((await reopened.nextStoreEvent())?.recoveryOwnerId, 'owner');
      final worker = sync(reopened);
      await worker.wake();
      expect((await reopened.nextStoreEvent())?.commandId, 'saved_sale');
      expect((await reopened.sale('saved_sale')).settlement, isNull);
      await reopened.retryStoreEvent();
      await worker.wake();
      expect(recoveryRequests.length, 2);
      expect(recoveryRequests.first, recoveryRequests.last);
      expect(imported, ['day', 'morning', 'saved_sale', 'after_sale']);
      expect(await reopened.nextStoreEvent(), isNull);
      final sale = (await reopened.watchSales().first).single.$1;
      expect(sale.operatorId, 'cashier');
      expect(jsonObject(jsonDecode(sale.settlement!))['settled_by'], 'cashier');
    },
  );

  test(
    'an active version 9 store upgrades and keeps its day, drawer, and journal',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'emenu-branch-upgrade-',
      );
      addTearDown(() => directory.delete(recursive: true));
      final file = File(
        '${directory.path}${Platform.pathSeparator}register.sqlite',
      );
      final old = RegisterDatabase(NativeDatabase(file));
      try {
        await prepare(old);
        await old.startStoreAuthority('store_epoch', 'Asia/Phnom_Penh');
        final register = RegisterAuthority(old, now: () => overnight);
        await register.execute(
          commandId: 'old_day',
          operatorId: 'owner',
          action: RegisterAction.openDay,
          body: {},
        );
        await register.execute(
          commandId: 'old_shift',
          operatorId: 'owner',
          action: RegisterAction.openShift,
          body: {'day_id': 'old_day'},
        );
        final activity = jsonObject(
          jsonDecode((await old.storeOperatingState())!.activity),
        );
        final primary = jsonObject(jsonObject(activity['profiles'])[profileId]);
        await old.customStatement(
          'UPDATE store_operating_states SET activity=? WHERE id=1',
          [
            jsonEncode({'working_day': activity['working_day'], ...primary}),
          ],
        );
        await old.customStatement(
          r"UPDATE store_operating_events SET envelope=json_remove(envelope,'$.profile_id')",
        );
        for (final table in [
          'register_commands',
          'store_operating_events',
          'store_devices',
        ]) {
          await old.customStatement(
            'ALTER TABLE $table DROP COLUMN profile_id',
          );
        }
        for (final column in [
          'operator_name',
          'recovery_owner_id',
          'recovery_reason',
        ]) {
          await old.customStatement(
            'ALTER TABLE store_operating_events DROP COLUMN $column',
          );
        }
        await old.customStatement('PRAGMA user_version = 9');
      } finally {
        await old.close();
      }

      final database = RegisterDatabase(NativeDatabase(file));
      addTearDown(database.close);
      final pending = (await database.nextStoreEvent())!;
      expect(pending.profileId, isNull);
      expect(
        jsonObject(jsonDecode(pending.envelope)).containsKey('profile_id'),
        isFalse,
      );
      final existing = jsonObject(
        (await database.readSnapshot(profileId))!['context'],
      );
      expect(jsonObject(existing['working_day'])['id'], 'old_day');
      final shift = jsonObject(existing['cashier_shift']);
      expect(shift['id'], 'old_shift');

      const second = 'takeaway';
      final catalog = snapshot('unused');
      catalog['context'] = {
        ...jsonObject(catalog['context']),
        'profile': {
          'id': second,
          'config': {...config, 'working_day_enabled': false},
        },
      };
      await database.saveSnapshot(second, catalog);
      await database
          .into(database.storeDevices)
          .insert(
            StoreDevicesCompanion.insert(
              id: 'takeaway_till',
              profileId: const Value(second),
              name: 'Takeaway',
              credentialHash: 'device_hash',
              pairedAt: overnight,
            ),
          );
      await database
          .into(database.storeStaffGrants)
          .insert(
            StoreStaffGrantsCompanion.insert(
              deviceId: 'takeaway_till',
              operatorId: 'owner',
              displayName: 'Owner',
              role: 'owner',
              credentialHash: 'staff_hash',
            ),
          );
      final register = RegisterAuthority(database, now: () => overnight);
      final takeaway = await register.executePaired(
        commandId: 'takeaway_shift',
        credentialHash: 'staff_hash',
        action: RegisterAction.openShift,
        body: {'day_id': null},
      );
      expect(takeaway['working_day_id'], isNull);
      final side = jsonObject(
        (await database.readSnapshot(second))!['context'],
      );
      expect(side['working_day'], isNull);
      expect(jsonObject(side['cashier_shift'])['id'], 'takeaway_shift');
      await register.execute(
        commandId: 'close_old_shift',
        operatorId: 'owner',
        action: RegisterAction.closeShift,
        body: {
          'shift_id': 'old_shift',
          'activity_revision': shift['activity_revision'],
          'counts': [
            for (final row in jsonRows(shift['counts']))
              {
                'payment_type_id': row['payment_type_id'],
                'currency': row['currency'],
                'declared_minor': 0,
              },
          ],
        },
      );
      final closed = database
          .watchSnapshot(profileId)
          .firstWhere(
            (state) => jsonObject(state!['context'])['working_day'] == null,
          );
      await register.execute(
        commandId: 'close_old_day',
        operatorId: 'owner',
        action: RegisterAction.closeDay,
        body: {'day_id': 'old_day'},
      );
      expect(await closed, isNotNull);
      final events = await database.select(database.storeOperatingEvents).get();
      expect(
        events
            .singleWhere((event) => event.commandId == 'takeaway_shift')
            .profileId,
        second,
      );
      expect((await database.storeOperatingState())?.sequence, 5);
      expect(
        await database.storeHasOpenActivity(
          (await database.storeOperatingState())!,
        ),
        isTrue,
      );
    },
  );

  test('an unfinished cart restores its operator, selections, and quote after restart', () async {
    final directory = await Directory.systemTemp.createTemp('emenu-cart-');
    addTearDown(() => directory.delete(recursive: true));
    final file = File(
      '${directory.path}${Platform.pathSeparator}register.sqlite',
    );
    FlutterSecureStorage.setMockInitialValues({});
    final api = PosApi('https://pos.example.test');
    addTearDown(api.close);

    final portion = {'id': 'large', 'name': 'Large', 'price_minor': 125};
    final milk = {'id': 'milk', 'name': 'Milk', 'price_minor': 25};
    final product = {
      ...coffee,
      'portions': [portion],
      'modifier_groups': [
        {
          'id': 'extras',
          'options': [milk],
        },
      ],
    };
    final original = snapshot('morning');
    original['catalog'] = {
      'products': [product],
    };
    Future<RegisterController> controller(RegisterDatabase db) async =>
        RegisterController(db)..installation.value = await db.installation();

    final first = RegisterDatabase(NativeDatabase(file));
    try {
      await prepare(first);
      await first.saveSnapshot(profileId, original);
      for (final id in ['owner', 'cashier']) {
        final context = jsonObject(original['context']);
        await RegisterAccess(first).enroll(
          api: api,
          slug: 'store',
          email: '$id@example.test',
          pin: '123456',
          session: {'token': 'fixture', 'expires_at': '2026-11-12T00:00:00Z'},
          snapshot: {
            'context': {
              ...context,
              'profile': {
                ...jsonObject(context['profile']),
                'branch_id': 'branch',
              },
              'operator': {
                'id': id,
                'name': id,
                'role': id == 'owner' ? 'owner' : 'staff',
              },
            },
          },
          updateSnapshot: false,
        );
      }
      final current = await controller(first);
      await current.unlock('owner', '123456');
      expect(current.stage.value, RegisterStage.ready);
      current.selectTable('table');
      current.selectCustomer('walk_in');
      current.add(CartLine(product, portion: portion, modifiers: [milk]));
      current.quantity(0, 3);
      expect(current.cartTotal, 495);
      await current.lock();
      await current.unlock('cashier', '123456');
      expect(current.hasCartDraft, isFalse);
      current.add(CartLine(product, portion: portion));
      await first
          .select(first.registerCartDrafts)
          .watch()
          .firstWhere(
            (drafts) => drafts.any((draft) => draft.operatorId == 'cashier'),
          );
    } finally {
      await first.close();
    }

    final reopened = RegisterDatabase(NativeDatabase(file));
    addTearDown(reopened.close);
    final restored = await controller(reopened);
    final context = jsonObject(original['context']);
    await reopened.saveSnapshot(profileId, {
      ...original,
      'context': {
        ...context,
        'profile': {
          'id': profileId,
          'config': {...config, 'tax_rate_bps': 2000},
        },
      },
    });
    await restored.unlock('owner', '123456');
    expect(restored.cart.single.quantity, 3);
    expect(restored.cart.single.portion?['id'], 'large');
    expect(restored.cart.single.modifiers.single['id'], 'milk');
    expect(restored.tableId.value, 'table');
    expect(restored.customerId.value, 'walk_in');
    expect(restored.cartTotal, 495);
    await restored.holdCart();
    expect(restored.message.value, 'PRICE_CHANGED');
    expect(await reopened.cartDraft('owner', profileId), isNotNull);
    expect(await reopened.watchHeldBills().first, isEmpty);

    restored.snapshot.value = await reopened.saveSnapshot(profileId, original);
    await restored.holdCart();
    final held = (await reopened.watchHeldBills().first).single;
    expect(await reopened.cartDraft('owner', profileId), isNull);
    expect(restored.hasCartDraft, isFalse);
    restored.resumeBill(held);
    await restored.discardCart();
    expect(await reopened.heldBill(profileId, held.id), isNotNull);
    expect(restored.hasCartDraft, isFalse);

    restored.resumeBill(held);
    restored.quantity(0, 4);
    await restored.lock();
    await restored.unlock('owner', '123456');
    expect(restored.cart.single.quantity, 4);
    await restored.checkout([
      {'payment_type_id': 'cash', 'currency': 'USD', 'amount_minor': 660},
    ]);
    expect(restored.message.value, 'SAVED');
    expect(await reopened.heldBill(profileId, held.id), isNull);
    expect(await reopened.cartDraft('owner', profileId), isNull);
    expect((await reopened.watchSales().first).single.$1.total, 660);
    expect(await reopened.cartDraft('cashier', profileId), isNotNull);
  });

  test('live reversal replays its own request and leaves the original receipt intact', () async {
    final database = RegisterDatabase(NativeDatabase.memory());
    addTearDown(database.close);
    await prepare(database);
    final body = order();
    final expected = body['expected_context'];
    const originalReceipt = {
      'id': 'server_paid',
      'status': 'paid',
      'reversed_by_sale_id': null,
      'payments': [
        {
          'payment_type_id': 'cash',
          'payment_type_name': 'Cash',
          'payment_kind': 'cash',
          'currency': 'USD',
          'amount_minor': 110,
        },
      ],
    };
    await database.queueSale(
      id: 'local_paid',
      profileId: profileId,
      operatorId: 'cashier',
      total: 110,
      currency: 'USD',
      request: {
        'draft': {'table_id': null, 'expected_context': expected},
        'quote': body['quote'],
      },
    );
    await database.saveSettlement('local_paid', originalReceipt);
    final authority = RegisterAuthority(database, now: () => overnight);
    final reversal = await authority.execute(
      commandId: 'live_reversal',
      operatorId: 'owner',
      action: RegisterAction.reverseSale,
      body: {
        'sale_id': 'local_paid',
        'reason': 'Returned',
        'expected_context': expected,
      },
    );
    expect(reversal['reverses_sale_id'], 'local_paid');
    expect((await database.sale('live_reversal')).total, -110);
    final keys = <String?>[];
    final api = PosApi(
      'https://pos.example.test',
      client: MockClient((request) async {
        if (request.url.path.endsWith('/context')) {
          return http.Response(
            jsonEncode({
              'profile': {'id': profileId},
              'operator': {'id': 'owner'},
              'capabilities': {'sale_context_guard': true},
            }),
            200,
          );
        }
        expect(request.url.path.endsWith('/sales/server_paid/reverse'), isTrue);
        expect(jsonDecode(request.body), {
          'reason': 'Returned',
          'expected_context': expected,
          'expected_total_minor': 110,
        });
        keys.add(
          request.headers['Idempotency-Key'] ??
              request.headers['idempotency-key'],
        );
        if (keys.length == 1) {
          throw http.ClientException('Lost reversal acknowledgment');
        }
        return http.Response(
          jsonEncode({
            'id': 'server_reverse',
            'reverses_sale_id': 'server_paid',
            'total_minor': -110,
            'currency': 'USD',
          }),
          201,
        );
      }),
    );
    addTearDown(api.close);
    final sync = SaleSync(database, api, (actor, profile, work) {
      expect(actor, 'owner');
      return work('token');
    });
    await sync.wake();
    expect((await database.nextJob())?.lastError, 'OFFLINE');
    await database
        .update(database.saleOutbox)
        .write(
          SaleOutboxCompanion(
            retryAt: Value(DateTime.now().subtract(const Duration(seconds: 1))),
          ),
        );
    await sync.wake();
    expect(keys, ['live_reversal_reverse', 'live_reversal_reverse']);
    expect((await database.sale('live_reversal')).settlement, isNotNull);
    expect(
      jsonDecode((await database.sale('local_paid')).settlement!),
      originalReceipt,
    );
  });

  for (final (days, shifts) in [
    (false, false),
    (true, false),
    (false, true),
    (true, true),
  ]) {
    test('offline store honors day=$days and shift=$shifts', () async {
      final database = RegisterDatabase(NativeDatabase.memory());
      addTearDown(database.close);
      await prepare(database);
      final profileSnapshot = snapshot('old');
      final context = jsonObject(profileSnapshot['context']);
      final profile = jsonObject(context['profile']);
      await database.saveSnapshot(profileId, {
        ...profileSnapshot,
        'context': {
          ...context,
          'profile': {
            ...profile,
            'config': {
              ...config,
              'working_day_enabled': days,
              'cashier_shift_enabled': shifts,
              'table_mode': 'optional',
            },
          },
        },
      });
      await database.startStoreAuthority('epoch', 'Asia/Phnom_Penh');
      final authority = RegisterAuthority(database, now: () => overnight);
      if (days) {
        await authority.execute(
          commandId: 'local_day',
          operatorId: 'owner',
          action: RegisterAction.openDay,
          body: {},
        );
      }
      if (shifts) {
        await authority.execute(
          commandId: 'local_shift',
          operatorId: 'cashier',
          action: RegisterAction.openShift,
          body: {'day_id': days ? 'local_day' : null},
        );
      }
      final effective = jsonObject(
        (await database.readSnapshot(profileId))!['context'],
      );
      final operation = registerOperatingContext(effective, overnight);
      await authority.execute(
        commandId: 'local_checkout',
        operatorId: 'cashier',
        action: RegisterAction.checkout,
        body: {
          ...order(),
          'table_id': null,
          'expected_context': operation,
          'payments': [
            {'payment_type_id': 'cash', 'currency': 'USD', 'amount_minor': 110},
          ],
        },
      );
      final events = await database.select(database.storeOperatingEvents).get();
      expect(events.map((event) => event.kind), [
        if (days) 'open_day',
        if (shifts) 'open_shift',
        'checkout',
      ]);
      final checkout = jsonObject(jsonDecode(events.last.envelope));
      expect(jsonObject(checkout['payload'])['expected_context'], {
        'working_day_id': days ? 'local_day' : null,
        'shift_id': shifts ? 'local_shift' : null,
        'business_date': '2026-11-12',
      });
    });
  }

  test(
    'a till resumes its pending checkout from SQLite after a restart',
    () async {
      final hostDb = RegisterDatabase(NativeDatabase.memory());
      addTearDown(hostDb.close);
      await prepare(hostDb);
      final warn = driftRuntimeOptions.dontWarnAboutMultipleDatabases;
      driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
      addTearDown(() {
        driftRuntimeOptions.dontWarnAboutMultipleDatabases = warn;
      });
      final authority = RegisterAuthority(hostDb, now: () => overnight);
      final host = StoreHost(
        authority,
        StoreCertificate.generate(),
        verifyPosSession: (_) async => {
          'business': {'id': 'store'},
          'profile': {'id': profileId, 'branch_id': 'branch'},
          'operator': {'id': 'owner', 'name': 'Owner', 'role': 'owner'},
        },
      );
      await host.start(address: InternetAddress.loopbackIPv4, port: 0);
      final port = host.port!;
      addTearDown(host.close);
      final invite = host.invitation('127.0.0.1');

      final folder = await Directory.systemTemp.createTemp('emenu-till-');
      addTearDown(() => folder.delete(recursive: true));
      final file = File('${folder.path}${Platform.pathSeparator}till.sqlite');
      FlutterSecureStorage.setMockInitialValues({});
      final tillDb = RegisterDatabase(NativeDatabase(file));
      final original = RegisterNetwork(
        RegisterAuthority(tillDb),
        RegisterAccess(tillDb),
      );
      final checkout = {
        ...order(),
        'payments': [
          {'payment_type_id': 'cash', 'currency': 'USD', 'amount_minor': 110},
        ],
      };
      final String id;
      try {
        await prepare(tillDb);
        await original.pair(
          code: invite.encode(),
          label: 'Restart till',
          operatorId: 'owner',
          posToken: 'owner-token',
        );
        for (final id in ['owner', 'cashier']) {
          await tillDb.saveCartDraft(
            operatorId: id,
            profileId: profileId,
            billId: null,
            payload: '{}',
          );
        }
        await host.close();
        await expectLater(
          original.submit('owner', RegisterAction.checkout, checkout),
          throwsA(errorCode('STORE_UNREACHABLE')),
        );
        id = (await tillDb.tillCommand('owner'))!.commandId;
        await expectLater(
          original.submit('owner', RegisterAction.checkout, checkout),
          throwsA(errorCode('STORE_COMMAND_PENDING')),
        );
      } finally {
        await original.close();
        await tillDb.close();
      }

      // The host may have committed before the first reply reached the till.
      await authority.execute(
        commandId: id,
        operatorId: 'owner',
        action: RegisterAction.checkout,
        body: checkout,
      );
      await host.start(address: InternetAddress.loopbackIPv4, port: port);
      final restoredDb = RegisterDatabase(NativeDatabase(file));
      addTearDown(restoredDb.close);
      final restored = RegisterNetwork(
        RegisterAuthority(restoredDb),
        RegisterAccess(restoredDb),
      );
      addTearDown(restored.close);
      final api = PosApi('https://pos.example.test');
      addTearDown(api.close);
      await restored.restore(api);
      expect(await restoredDb.cartDraft('owner', profileId), isNotNull);
      expect(await restored.retry('owner'), RegisterAction.checkout);
      expect(await restoredDb.tillCommand('owner'), isNull);
      expect(await restoredDb.cartDraft('owner', profileId), isNull);
      expect(await restoredDb.cartDraft('cashier', profileId), isNotNull);
      expect((await restored.state('owner')).sales.single.$1.id, id);
      expect((await hostDb.watchSales().first).length, 1);

      await restoredDb.saveCartDraft(
        operatorId: 'owner',
        profileId: profileId,
        billId: 'stale_bill',
        payload: '{}',
      );
      await expectLater(
        restored.submit('owner', RegisterAction.checkout, {
          ...checkout,
          'bill_id': 'stale_bill',
          'bill_revision': 1,
        }),
        throwsA(errorCode('BILL_CHANGED')),
      );
      expect(await restoredDb.tillCommand('owner'), isNull);
      expect(
        (await restoredDb.cartDraft('owner', profileId))?.billId,
        'stale_bill',
      );
    },
  );

  test(
    'two paired TLS clients share a bill, shift and checkout with WAN down',
    () async {
      final database = RegisterDatabase(NativeDatabase.memory());
      addTearDown(database.close);
      await prepare(database);
      final authority = RegisterAuthority(database, now: () => overnight);
      final certificate = StoreCertificate.generate();
      var wanUp = true;
      final host = StoreHost(
        authority,
        certificate,
        verifyPosSession: (token) async {
          if (!wanUp) throw const PosApiError(0, 'OFFLINE', 'WAN down');
          return {
            'business': {'id': 'store'},
            'profile': {'id': profileId, 'branch_id': 'branch'},
            'operator': {
              'id': token,
              'name': token,
              'role': token == 'owner' ? 'owner' : 'cashier',
            },
          };
        },
      );
      await host.start(address: InternetAddress.loopbackIPv4, port: 0);
      addTearDown(host.close);
      final firstInvite = StoreInvitation.parse(
        host.invitation('127.0.0.1').encode(),
      );
      final wrongCertificate = StoreClient(
        StoreEndpoint(firstInvite.endpoint.uri.toString(), 'a' * 64),
      );
      addTearDown(wrongCertificate.close);
      await expectLater(
        wrongCertificate.pair(
          invitation: firstInvite,
          attemptId: const Uuid().v4(),
          label: 'spoofed',
          posToken: 'owner',
        ),
        throwsA(errorCode('STORE_CERTIFICATE')),
      );

      final first = StoreClient(firstInvite.endpoint);
      addTearDown(first.close);
      final pairingId = const Uuid().v4();
      Future<Json> firstPair(String id) => first.pair(
        invitation: firstInvite,
        attemptId: id,
        label: 'Front till',
        posToken: 'owner',
      );
      final owner = await firstPair(pairingId);
      expect(await firstPair(pairingId), owner);
      await expectLater(
        firstPair(const Uuid().v4()),
        throwsA(errorCode('PAIRING_USED')),
      );

      final secondInvite = host.invitation('127.0.0.1');
      final second = StoreClient(secondInvite.endpoint);
      addTearDown(second.close);
      final secondOwner = await second.pair(
        invitation: secondInvite,
        attemptId: const Uuid().v4(),
        label: 'Bar till',
        posToken: 'owner',
      );
      final secondDevice = secondOwner['device_credential'] as String;
      final cashier = await second.enroll(secondDevice, 'cashier');
      final firstGrant = owner['staff_credential'] as String;
      final secondGrant = cashier['staff_credential'] as String;
      wanUp = false;

      await first.command(
        staffCredential: firstGrant,
        id: 'lan_hold',
        action: RegisterAction.hold,
        body: order(),
      );
      final shared = await second.state(secondGrant);
      expect(jsonRows(shared['bills']).single['id'], 'lan_hold');
      final view = jsonObject(jsonObject(shared['snapshot'])['context']);
      expect(jsonObject(view['operator'])['id'], 'cashier');
      expect(jsonObject(view['cashier_shift'])['id'], 'morning');
      final known = shared['snapshot_version'] as String;
      expect(
        (await second.state(secondGrant, snapshotVersion: known))['snapshot'],
        isNull,
      );
      await database.saveSnapshot(profileId, snapshot('night'));
      final night = await first.state(firstGrant, snapshotVersion: known);
      final newContext = jsonObject(jsonObject(night['snapshot'])['context']);
      expect(jsonObject(newContext['cashier_shift'])['id'], 'night');

      final body = {
        ...order(billId: 'lan_hold', revision: 1, shift: 'night'),
        'payments': [
          {'payment_type_id': 'cash', 'currency': 'KHR', 'amount_minor': 4400},
        ],
      };
      Future<Json> pay(StoreClient till, String grant, String id) =>
          till.command(
            staffCredential: grant,
            id: id,
            action: RegisterAction.checkout,
            body: body,
          );
      final competing = await Future.wait<Object>([
        pay(
          first,
          firstGrant,
          'lan_pay_a',
        ).then<Object>((value) => value, onError: (Object error) => error),
        pay(
          second,
          secondGrant,
          'lan_pay_b',
        ).then<Object>((value) => value, onError: (Object error) => error),
      ]);
      expect(
        competing.whereType<PosApiError>().single,
        errorCode('BILL_CHANGED'),
      );
      expect(competing.whereType<Json>().single, {'bill_id': 'lan_hold'});
      final paid = await first.state(firstGrant);
      expect(jsonRows(paid['bills']), isEmpty);
      final posted = jsonObject(jsonRows(paid['sales']).single['sale']);
      final cashierWon = posted['operatorId'] == 'cashier';
      expect(
        cashierWon
            ? await pay(second, secondGrant, 'lan_pay_b')
            : await pay(first, firstGrant, 'lan_pay_a'),
        {'bill_id': 'lan_hold'},
      );
      expect((await database.watchSales().first).length, 1);
      await host.revoke(secondOwner['device_id'] as String);
      await expectLater(
        second.state(secondGrant),
        throwsA(errorCode('STORE_ACCESS_REQUIRED')),
      );
      await expectLater(
        second.enroll(secondDevice, 'cashier'),
        throwsA(errorCode('STORE_ACCESS_REQUIRED')),
      );
    },
  );

  test(
    'store register checks price and serializes two edits of one bill',
    () async {
      final database = RegisterDatabase(NativeDatabase.memory());
      addTearDown(database.close);
      await prepare(database);
      final authority = RegisterAuthority(database, now: () => overnight);
      await expectLater(
        authority.execute(
          commandId: 'forged',
          operatorId: 'cashier',
          action: RegisterAction.hold,
          body: order(product: {...coffee, 'price_minor': 10}),
        ),
        throwsA(errorCode('PRICE_CHANGED')),
      );
      expect(await database.savedCommand('forged'), isNull);
      await authority.execute(
        commandId: 'first',
        operatorId: 'owner',
        action: RegisterAction.hold,
        body: order(),
      );
      final edits = await Future.wait<Object>([
        for (final (actor, qty) in [('cashier', 2), ('owner', 3)])
          authority
              .execute(
                commandId: 'edit_$actor',
                operatorId: actor,
                action: RegisterAction.hold,
                body: order(billId: 'first', revision: 1, quantity: qty),
              )
              .then<Object>(
                (response) => response,
                onError: (Object error) => error,
              ),
      ]);
      expect(edits.whereType<PosApiError>(), [errorCode('BILL_CHANGED')]);
      expect(edits.whereType<Json>().single, {'bill_id': 'first'});
      expect((await database.heldBill(profileId, 'first'))?.revision, 2);
    },
  );

  test('checkout after shift handoff keeps business date and replays after restart', () async {
    final directory = await Directory.systemTemp.createTemp('emenu-register-');
    final file = File('${directory.path}${Platform.pathSeparator}register.db');
    addTearDown(() => directory.delete(recursive: true));
    final database = RegisterDatabase(NativeDatabase(file));
    final authority = RegisterAuthority(database, now: () => overnight);
    const payments = [
      {'payment_type_id': 'cash', 'currency': 'USD', 'amount_minor': 60},
      {'payment_type_id': 'cash', 'currency': 'KHR', 'amount_minor': 2000},
    ];
    final paymentCommand = {
      ...order(billId: 'held', revision: 1, shift: 'night'),
      'payments': payments,
    };
    try {
      await prepare(database);
      await authority.execute(
        commandId: 'held',
        operatorId: 'owner',
        action: RegisterAction.hold,
        body: order(),
      );
      await database.saveSnapshot(profileId, snapshot('night'));
      await expectLater(
        authority.execute(
          commandId: 'pay',
          operatorId: 'cashier',
          action: RegisterAction.checkout,
          body: {
            ...order(billId: 'held', revision: 1),
            'payments': payments,
          },
        ),
        throwsA(errorCode('SALE_CONTEXT_CHANGED')),
      );
      expect(await database.nextJob(), isNull);
      expect(await database.heldBill(profileId, 'held'), isNotNull);
      await authority.execute(
        commandId: 'pay',
        operatorId: 'cashier',
        action: RegisterAction.checkout,
        body: paymentCommand,
      );
    } finally {
      await database.close();
    }

    final reopened = RegisterDatabase(NativeDatabase(file));
    addTearDown(reopened.close);
    final restarted = RegisterAuthority(reopened, now: () => overnight);
    await reopened.saveSnapshot(profileId, snapshot('later'));
    expect(
      await restarted.execute(
        commandId: 'pay',
        operatorId: 'cashier',
        action: RegisterAction.checkout,
        body: paymentCommand,
      ),
      {'bill_id': 'held'},
    );
    await expectLater(
      restarted.execute(
        commandId: 'pay',
        operatorId: 'owner',
        action: RegisterAction.checkout,
        body: paymentCommand,
      ),
      throwsA(errorCode('IDEMPOTENCY_CONFLICT')),
    );
    await expectLater(
      restarted.execute(
        commandId: 'pay',
        operatorId: 'cashier',
        action: RegisterAction.checkout,
        body: {...paymentCommand, 'payments': []},
      ),
      throwsA(errorCode('IDEMPOTENCY_CONFLICT')),
    );
    expect(await reopened.heldBill(profileId, 'held'), isNull);
    expect(
      await reopened.hasHeldBillsOnDay('day', profileId: profileId),
      isFalse,
    );
    expect(
      await reopened.hasUnsyncedSales(profileId, 'shift_id', 'night'),
      isTrue,
    );
    final sales = await reopened.watchSales().first;
    final (sale, job) = sales.single;
    expect(sale.operatorId, 'cashier');
    expect(job.status, 'pending');
    expect(sale.total, 110);
    final draft = jsonObject(jsonObject(jsonDecode(sale.request))['draft']);
    expect(draft['expected_context'], {
      'business_date': '2026-11-11',
      'working_day_id': 'day',
      'shift_id': 'night',
    });
  });
}
