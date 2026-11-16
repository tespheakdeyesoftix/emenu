import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart' show Value;
import 'package:drift/native.dart';
import 'package:emenu_pos/core/pos_api.dart';
import 'package:emenu_pos/core/pricing.dart';
import 'package:emenu_pos/core/register_access.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:emenu_pos/core/sale_sync.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const line = <String, dynamic>{
  'product_id': 'coffee',
  'portion_id': null,
  'quantity': 1,
  'unit_price_minor': 1000,
  'subtotal_minor': 1000,
  'tax_minor': 0,
  'total_minor': 1000,
};

const expectedContext = <String, dynamic>{
  'business_date': '2026-11-11',
  'working_day_id': 'day',
  'shift_id': 'shift',
};

const queuedRequest = <String, dynamic>{
  'draft': {
    'lines': [
      {'product_id': 'coffee', 'quantity': 1},
    ],
    'expected_context': expectedContext,
  },
  'quote': [line],
  'exchange_rate': '4000',
  'payments': [
    {'payment_type_id': 'cash', 'currency': 'USD', 'amount_minor': 1000},
  ],
};

Future<void> enqueue(RegisterDatabase database) => database.queueSale(
  id: 'local_sale',
  profileId: 'profile',
  operatorId: 'owner',
  total: 1000,
  currency: 'USD',
  request: queuedRequest,
);

http.Response reply(Json json, [int status = 200]) => http.Response.bytes(
  utf8.encode(jsonEncode(json)),
  status,
  headers: {'Content-Type': 'application/json'},
);

Json context({bool guard = true}) => {
  'profile': {'id': 'profile', 'branch_id': 'branch'},
  'operator': {'id': 'owner', 'name': 'Owner', 'role': 'owner'},
  'business': {'id': 'business'},
  'capabilities': {'sale_context_guard': guard},
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'a table has one held bill and settlement releases it atomically',
    () async {
      final database = RegisterDatabase(NativeDatabase.memory());
      addTearDown(database.close);
      await database.holdBill(
        id: 'local_sale',
        profileId: 'profile',
        tableId: 'table',
        workingDayId: 'day',
        payload: {'total_minor': 1000},
      );
      await expectLater(
        database.holdBill(
          id: 'duplicate',
          profileId: 'profile',
          tableId: 'table',
          workingDayId: 'day',
          payload: {},
        ),
        throwsA(
          isA<PosApiError>().having(
            (error) => error.code,
            'code',
            'TABLE_OCCUPIED',
          ),
        ),
      );
      final request = {
        ...queuedRequest,
        'draft': {...jsonObject(queuedRequest['draft']), 'table_id': 'table'},
      };
      Future<void> settle(int revision) => database.queueSale(
        id: 'local_sale',
        profileId: 'profile',
        operatorId: 'owner',
        total: 1000,
        currency: 'USD',
        request: request,
        heldRevision: revision,
      );
      await expectLater(
        settle(2),
        throwsA(
          isA<PosApiError>().having(
            (error) => error.code,
            'code',
            'BILL_CHANGED',
          ),
        ),
      );
      expect(await database.nextJob(), isNull);
      expect((await database.watchHeldBills().first).single.id, 'local_sale');
      await settle(1);
      expect(await database.watchHeldBills().first, isEmpty);
      expect((await database.nextJob())?.saleId, 'local_sale');
    },
  );

  test(
    'API tax and mixed currency math use integer amounts and per-line rounding',
    () {
      final inclusive = lineTotals(
        unitPrice: 101,
        quantity: 2,
        taxMode: 'inclusive',
        taxRateBps: 1000,
      );
      expect(
        (inclusive.subtotal, inclusive.tax, inclusive.total),
        (184, 18, 202),
      );
      final exclusive = lineTotals(
        unitPrice: 105,
        quantity: 1,
        taxMode: 'exclusive',
        taxRateBps: 1000,
      );
      expect(
        (exclusive.subtotal, exclusive.tax, exclusive.total),
        (105, 11, 116),
      );
      expect(secondaryToPrimary(20000, 'USD', '4000'), 500);
      expect(secondaryToPrimary(150, 'KHR', '2.5e-4'), 6000);
      final payments = [
        {'payment_type_id': 'cash', 'currency': 'USD', 'amount_minor': 600},
        {
          'payment_type_id': 'cash',
          'currency': 'USD',
          'entry_type': 'change',
          'amount_minor': 100,
        },
        {'payment_type_id': 'qr', 'currency': 'KHR', 'amount_minor': 20000},
      ];
      final types = [
        {
          'id': 'cash',
          'kind': 'cash',
          'currencies': ['USD'],
        },
        {
          'id': 'qr',
          'kind': 'qr',
          'currencies': ['KHR'],
        },
      ];
      expect(
        paymentTotal(
          entries: payments,
          paymentTypes: types,
          primary: 'USD',
          rate: '4000',
        ),
        1000,
      );
      expect(displayAmount(-100, 'USD'), r'-$1.00');
    },
  );

  test(
    'the SQLite upgrade preserves pending sales and enables held bills',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'emenu-pos-test-',
      );
      addTearDown(() => directory.delete(recursive: true));
      final file = File('${directory.path}${Platform.pathSeparator}pos.sqlite');
      final initial = RegisterDatabase(NativeDatabase(file));
      await enqueue(initial);
      await initial.customStatement('DROP TABLE store_staff_grants');
      await initial.customStatement('DROP TABLE register_cart_drafts');
      await initial.customStatement('DROP TABLE store_devices');
      await initial.customStatement('DROP TABLE store_network_settings');
      await initial.customStatement('DROP TABLE till_commands');
      await initial.customStatement('DROP TABLE receipt_prints');
      await initial.customStatement('DROP TABLE store_operating_events');
      await initial.customStatement('DROP TABLE store_operating_states');
      await initial.customStatement('DROP INDEX local_sales_one_reversal');
      await initial.customStatement(
        'ALTER TABLE local_sales DROP COLUMN reverses_sale_id',
      );
      await initial.customStatement('DROP TABLE held_bills');
      await initial.customStatement('DROP TABLE register_commands');
      await initial.customStatement(
        'ALTER TABLE register_operators DROP COLUMN access_revoked',
      );
      await initial.customStatement('PRAGMA user_version = 1');
      await initial.close();

      final reopened = RegisterDatabase(NativeDatabase(file));
      addTearDown(reopened.close);
      final job = await reopened.nextJob();
      expect(job?.saleId, 'local_sale');
      final sale = await reopened.sale('local_sale');
      expect(jsonDecode(sale.request), queuedRequest);
      expect(sale.settlement, isNull);
      await reopened.holdBill(
        id: 'new_bill',
        profileId: 'profile',
        payload: {},
      );
      expect((await reopened.watchHeldBills().first).single.id, 'new_bill');
    },
  );

  test(
    'loss of checkout response replays the same key and only settles once',
    () async {
      final database = RegisterDatabase(NativeDatabase.memory());
      addTearDown(database.close);
      await enqueue(database);
      final writes = <String>[];
      final accepted = <String, Json>{};
      var dropped = false;
      final api = PosApi(
        'https://pos.example.test',
        client: MockClient((request) async {
          final path = request.url.path;
          if (path.endsWith('/context')) return reply(context());
          final key =
              request.headers['Idempotency-Key'] ??
              request.headers['idempotency-key'];
          writes.add(key!);
          final body = jsonObject(jsonDecode(request.body));
          expect(body['expected_context'], expectedContext);
          if (path.endsWith('/sales')) {
            return reply({
              'id': 'server_sale',
              'revision': 1,
              'currency': 'USD',
              'total_minor': 1000,
              'secondary_exchange_rate': '4000',
              'lines': [line],
            }, 201);
          }
          final receipt = accepted.putIfAbsent(
            key,
            () => {'id': 'server_sale', 'status': 'paid'},
          );
          if (!dropped) {
            dropped = true;
            throw http.ClientException('Connection lost after settlement');
          }
          return reply(receipt);
        }),
      );
      addTearDown(api.close);
      final sync = SaleSync(
        database,
        api,
        (_, _, operation) => operation('token'),
      );
      await sync.wake();
      expect((await database.nextJob())?.serverDraft, isNotNull);
      expect((await database.sale('local_sale')).settlement, isNull);
      await database
          .update(database.saleOutbox)
          .write(
            SaleOutboxCompanion(
              retryAt: Value(
                DateTime.now().subtract(const Duration(seconds: 1)),
              ),
            ),
          );
      await sync.wake();
      expect(writes, [
        'local_sale_draft',
        'local_sale_checkout',
        'local_sale_checkout',
      ]);
      expect(accepted.length, 1);
      expect(await database.nextJob(), isNull);
      expect(
        jsonDecode((await database.sale('local_sale')).settlement!)['status'],
        'paid',
      );
    },
  );

  test(
    'new installation requires an owner and a saved PIN works without the API',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      final database = RegisterDatabase(NativeDatabase.memory());
      final access = RegisterAccess(database);
      final api = PosApi('https://pos.example.test');
      addTearDown(database.close);
      addTearDown(api.close);
      final operator = jsonObject(context()['operator']);
      Future<void> enroll(Json operator) => access.enroll(
        api: api,
        slug: 'shop',
        email: 'owner@example.test',
        pin: '123456',
        session: {
          'token': 'local-token',
          'expires_at': DateTime.now()
              .add(const Duration(hours: 1))
              .toIso8601String(),
        },
        snapshot: {
          'context': {...context(), 'operator': operator},
        },
      );
      await expectLater(
        enroll({...operator, 'role': 'editor'}),
        throwsA(
          isA<PosApiError>().having(
            (error) => error.code,
            'code',
            'OWNER_REQUIRED',
          ),
        ),
      );
      expect(await database.installation(), isNull);
      await enroll(operator);
      expect((await database.installation())?.businessId, 'business');
      await expectLater(
        access.unlock('owner', '654321'),
        throwsA(
          isA<PosApiError>().having(
            (error) => error.code,
            'code',
            'INVALID_PIN',
          ),
        ),
      );
      expect((await access.unlock('owner', '123456')).role, 'owner');
    },
  );

  test(
    'a staff username uses the owner session and enrolls the staff PIN',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      final database = RegisterDatabase(NativeDatabase.memory());
      addTearDown(database.close);
      final access = RegisterAccess(database);
      final expiry = DateTime.now()
          .add(const Duration(hours: 1))
          .toIso8601String();
      final calls = <String>[];
      final api = PosApi(
        'https://pos.example.test',
        client: MockClient((request) async {
          final action = request.url.path.split('/').last;
          calls.add(action);
          final body = jsonObject(jsonDecode(request.body));
          if (action == 'resolve-username') {
            expect(request.headers['authorization'], 'Bearer owner-token');
            expect(body, {'username': 'front-till'});
            return reply({'email': 'cashier@example.test'});
          }
          expect(action, 'login');
          expect(body['email'], 'cashier@example.test');
          expect(body['username'], 'front-till');
          expect(body['password_proof'], matches(RegExp(r'^[a-f0-9]{64}$')));
          expect(body.containsKey('password'), isFalse);
          return reply({'token': 'staff-token', 'expires_at': expiry});
        }),
      );
      addTearDown(api.close);
      await access.enroll(
        api: api,
        slug: 'shop',
        email: 'owner@example.test',
        pin: '123456',
        session: {'token': 'owner-token', 'expires_at': expiry},
        snapshot: {'context': context()},
      );
      final email = await access.resolveStaffEmail(api, 'front-till');
      final session = await api.login(
        'shop',
        email,
        'staff-password',
        username: 'front-till',
      );
      await access.enroll(
        api: api,
        slug: 'shop',
        email: email,
        pin: '246810',
        session: session,
        snapshot: {
          'context': {
            ...context(),
            'operator': {'id': 'cashier', 'name': 'Cashier', 'role': 'editor'},
          },
        },
      );
      expect(
        (await access.unlock('cashier', '246810')).email,
        'cashier@example.test',
      );
      expect(calls, ['resolve-username', 'login']);
    },
  );

  test(
    'one device renews per profile and revokes only the affected profile',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      final database = RegisterDatabase(NativeDatabase.memory());
      addTearDown(database.close);
      final access = RegisterAccess(database);
      Json? descriptor;
      Json? secondDescriptor;
      var renewals = 0;
      var revoked = false;
      final api = PosApi(
        'https://pos.example.test',
        client: MockClient((request) async {
          final route = request.url.path.split('/').last;
          if (route == 'devices') {
            if (request.headers['authorization'] == 'Bearer retail-password') {
              secondDescriptor = jsonObject(jsonDecode(request.body));
              return reply({
                'id': 'retail_credential',
                'user_id': 'owner',
              }, 201);
            }
            descriptor = jsonObject(jsonDecode(request.body));
            return reply({'id': 'device_credential', 'user_id': 'owner'}, 201);
          }
          if (route == 'device-session') {
            renewals++;
            final proof = jsonObject(jsonDecode(request.body));
            final retail = proof['credential_id'] == 'retail_credential';
            expect(
              proof['credential_id'],
              retail ? 'retail_credential' : 'device_credential',
            );
            expect(proof['nonce'], matches(r'^[0-9a-f]{64}$'));
            expect(proof['signature'], matches(r'^[0-9a-f]{128}$'));
            if (revoked && !retail) {
              return reply({'code': 'INVALID_DEVICE_CREDENTIAL'}, 401);
            }
            return reply({
              'user_id': 'owner',
              'profile_id': retail ? 'retail' : 'profile',
              'token': retail ? 'retail-renewed' : 'renewed',
              'expires_at': DateTime.now()
                  .add(const Duration(hours: 12))
                  .toIso8601String(),
            }, 201);
          }
          if (revoked) return reply({'code': 'INVALID_POS_SESSION'}, 401);
          expect(request.headers['authorization'], 'Bearer renewed');
          return reply(context());
        }),
      );
      addTearDown(api.close);
      await access.enroll(
        api: api,
        slug: 'shop',
        email: 'owner@example.test',
        pin: '123456',
        session: {
          'token': 'original',
          'expires_at': DateTime.now()
              .subtract(const Duration(seconds: 1))
              .toIso8601String(),
        },
        snapshot: {
          'context': {
            ...context(),
            'capabilities': {
              'sale_context_guard': true,
              'device_sessions': true,
            },
          },
        },
      );
      expect(descriptor?['public_key'], matches(r'^[0-9a-f]{64}$'));
      await access.rememberPairedSession(api, {
        ...context(),
        'profile': {'id': 'retail', 'branch_id': 'branch'},
        'capabilities': {'device_sessions': true},
      }, 'retail-password');
      expect(secondDescriptor, descriptor);
      for (final (device, profile) in [
        ('primary', null),
        ('secondary', 'retail'),
      ]) {
        await database
            .into(database.storeDevices)
            .insert(
              StoreDevicesCompanion.insert(
                id: device,
                profileId: Value(profile),
                name: device,
                credentialHash: 'device_$device',
                pairedAt: DateTime.now(),
              ),
            );
        await database
            .into(database.storeStaffGrants)
            .insert(
              StoreStaffGrantsCompanion.insert(
                deviceId: device,
                operatorId: 'owner',
                displayName: 'Owner',
                role: 'owner',
                credentialHash: 'staff_$device',
              ),
            );
      }
      final restarted = RegisterAccess(database);
      expect(
        await Future.wait([
          restarted.tokenForOperator(api, 'owner'),
          restarted.tokenForOperator(api, 'owner'),
        ]),
        ['renewed', 'renewed'],
      );
      expect(renewals, 1);
      expect(
        await restarted.tokenForOperator(api, 'owner', profileId: 'retail'),
        'retail-renewed',
      );
      expect(renewals, 2);
      await enqueue(database);
      revoked = true;
      await expectLater(
        restarted.withSession(
          api,
          'owner',
          (token) => api.request('/context', token: token),
        ),
        throwsA(
          isA<PosApiError>().having(
            (error) => error.code,
            'code',
            'SIGN_IN_REQUIRED',
          ),
        ),
      );
      expect(renewals, 3);
      expect((await database.operatorById('owner'))?.accessRevoked, isTrue);
      expect((await database.nextJob())?.saleId, 'local_sale');
      expect(await restarted.tokenForOperator(api, 'owner'), isNull);
      expect(
        await restarted.tokenForOperator(api, 'owner', profileId: 'retail'),
        'retail-renewed',
      );
      expect(await database.storeStaff('staff_primary'), isNull);
      expect(
        (await database.storeStaff('staff_secondary'))?.profileId,
        'retail',
      );
    },
  );
}
