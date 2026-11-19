import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart' show Value;
import 'package:drift/native.dart';
import 'package:emenu_pos/core/api_endpoint.dart';
import 'package:emenu_pos/core/pos_api.dart';
import 'package:emenu_pos/core/register_access.dart';
import 'package:emenu_pos/core/register_authority.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:emenu_pos/core/store_host.dart';
import 'package:emenu_pos/core/store_transport.dart';
import 'package:emenu_pos/features/register/register_controller.dart';
import 'package:emenu_pos/features/sales/sale/sale_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uuid/uuid.dart';

Json menuSnapshot(String menu) => {
  'context': {
    'business': {
      'id': 'store',
      'currency': 'USD',
      'secondary_exchange_rate': '4000',
    },
    'profile': {
      'id': 'profile',
      'branch_id': 'branch',
      'config': {
        'catalog_mode': 'menu',
        'default_menu_id': menu,
        'table_mode': 'disabled',
        'tax_mode': 'disabled',
      },
    },
    'operator': {'id': 'owner', 'name': 'Owner', 'role': 'owner'},
    'payment_types': [],
  },
  'catalog': {
    'mode': 'menu',
    'nodes': [
      {'id': menu, 'name': menu, 'parent_id': null},
    ],
    'products': [
      {
        'id': '$menu-product',
        'name': '$menu product',
        'price_minor': 100,
        'menu_ids': [menu],
      },
    ],
  },
  'tables': [],
  'customers': [],
};

Future<void> prepareDatabase(RegisterDatabase database) async {
  await database
      .into(database.registerInstallations)
      .insert(
        RegisterInstallationsCompanion.insert(
          apiOrigin: 'https://pos.example.test',
          businessSlug: 'store',
          businessId: 'store',
          branchId: 'branch',
          profileId: 'profile',
        ),
      );
  await database
      .into(database.registerOperators)
      .insert(
        RegisterOperatorsCompanion.insert(
          id: 'owner',
          email: 'owner@example.test',
          displayName: 'Owner',
          role: 'owner',
        ),
      );
  await database.saveSnapshot('profile', menuSnapshot('old'));
}

class ReloadAccess extends RegisterAccess {
  ReloadAccess(super.database, this.origin);

  final String origin;

  @override
  Future<T> withSession<T>(
    PosApi api,
    String operatorId,
    Future<T> Function(String token) request, {
    String? profileId,
  }) => request('token');

  @override
  Future<Json> prepareProfile(PosApi api, String token, {Json? context}) async {
    final localApi = PosApi(origin);
    try {
      return await super.prepareProfile(localApi, token, context: context);
    } finally {
      localApi.close();
    }
  }

  @override
  Future<void> adoptDeviceSession(
    PosApi api,
    String operatorId,
    Json context,
  ) async {}
}

void main() {
  for (final scenario in ['success', 'failure', 'during poll']) {
    test(
      'reload menu $scenario fetches fresh config and preserves the order',
      () async {
        final database = RegisterDatabase(NativeDatabase.memory());
        await prepareDatabase(database);
        final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
        final requests = <Uri>[];
        final pollStarted = Completer<void>();
        final finishPoll = Completer<void>();
        var contextCalls = 0;
        server.listen((request) async {
          requests.add(request.uri);
          final path = request.uri.path.substring(ApiEndpoint.prefix.length);
          final menu = scenario == 'during poll' && contextCalls == 1
              ? 'poll'
              : 'new';
          Object data;
          if (path == ApiEndpoint.context) {
            contextCalls++;
            if (scenario == 'during poll' && contextCalls == 1) {
              pollStarted.complete();
              await finishPoll.future;
            }
            data = menuSnapshot(
              scenario == 'during poll' && contextCalls == 1 ? 'poll' : 'new',
            )['context']!;
          } else if (path == ApiEndpoint.catalog) {
            if (scenario == 'failure') {
              request.response.statusCode = 503;
              data = {'code': 'OFFLINE', 'error': 'Try again'};
            } else {
              final selected = request.uri.queryParameters['menu_id']!;
              data = {
                ...jsonObject(menuSnapshot(selected)['catalog']),
                'has_more': false,
              };
            }
          } else if (path == ApiEndpoint.tables) {
            data = {'tables': [], 'has_more': false};
          } else if (path == ApiEndpoint.customers) {
            data = {'customers': [], 'has_more': false};
          } else {
            throw StateError('Unexpected path $path ($menu)');
          }
          request.response.headers.contentType = ContentType.json;
          request.response.write(jsonEncode(data));
          await request.response.close();
        });
        final register = RegisterController(
          database,
          access: ReloadAccess(database, 'http://127.0.0.1:${server.port}'),
        );
        try {
          register.installation.value = await database.installation();
          register.operator.value = await database.operatorById('owner');
          register.snapshot.value = await database.readSnapshot('profile');
          await register.connectToApi('https://pos.example.test');
          final line = CartLine(
            jsonRows(
              jsonObject(register.snapshot.value!['catalog'])['products'],
            ).single,
          );
          register.add(line);
          final cartLine = register.cart.single;
          await register.sales.flushCart();
          final draft = (await database.cartDraft('owner', 'profile'))!.payload;

          Future<void>? poll;
          if (scenario == 'during poll') {
            poll = register.refreshRegister();
            await pollStarted.future;
          }
          final reload = register.reloadMenu();
          if (poll != null) {
            await Future<void>.delayed(Duration.zero);
            expect(contextCalls, 1);
            expect(register.busy.value, isTrue);
            finishPoll.complete();
            await poll;
          }
          final success = scenario != 'failure';
          expect(await reload, success);
          expect(register.config['default_menu_id'], success ? 'new' : 'old');
          expect(register.message.value, success ? 'MENU_RELOADED' : 'OFFLINE');
          expect(register.busy.value, isFalse);
          expect(register.cart.single, same(cartLine));
          expect(
            (await database.cartDraft('owner', 'profile'))!.payload,
            draft,
          );
          final saved = (await database.readSnapshot('profile'))!;
          expect(
            jsonObject(
              jsonObject(saved['context'])['profile'],
            )['config']['default_menu_id'],
            success ? 'new' : 'old',
          );
          expect(
            requests
                .where((uri) => uri.path.endsWith(ApiEndpoint.catalog))
                .map((uri) => uri.queryParameters['menu_id']),
            scenario == 'during poll' ? ['poll', 'new'] : ['new'],
          );
        } finally {
          register.onClose();
          await server.close(force: true);
          // onClose releases background synchronization before closing SQLite.
          await Future<void>.delayed(const Duration(milliseconds: 20));
          await database.close();
        }
      },
    );
  }

  test(
    'offline shift keeps checkout settings and adopts the latest default menu',
    () async {
      final database = RegisterDatabase(NativeDatabase.memory());
      addTearDown(database.close);
      await prepareDatabase(database);
      final original = menuSnapshot('old');
      final originalProfile = jsonObject(
        jsonObject(original['context'])['profile'],
      );
      originalProfile['config'] = {
        ...jsonObject(originalProfile['config']),
        'tax_mode': 'exclusive',
        'tax_rate_bps': 1000,
      };
      await database.startStoreAuthority('epoch', 'Asia/Phnom_Penh');
      await database
          .update(database.storeOperatingStates)
          .write(
            StoreOperatingStatesCompanion(
              activity: Value(
                jsonEncode({
                  'profiles': {
                    'profile': {
                      'profile': originalProfile,
                      'cashier_shift': {'id': 'shift'},
                      'payment_types': [],
                    },
                  },
                }),
              ),
            ),
          );
      final effective = await database.saveSnapshot(
        'profile',
        menuSnapshot('new'),
      );
      final config = jsonObject(
        jsonObject(jsonObject(effective['context'])['profile'])['config'],
      );
      expect(config['default_menu_id'], 'new');
      expect(config['tax_mode'], 'exclusive');
      expect(config['tax_rate_bps'], 1000);
      expect(jsonObject(effective['context'])['cashier_shift']['id'], 'shift');
    },
  );

  test('paired reload authenticates, fetches once, and retains cached menu on failure', () async {
    final database = RegisterDatabase(NativeDatabase.memory());
    addTearDown(database.close);
    await prepareDatabase(database);
    var reloads = 0;
    var offline = false;
    final host = StoreHost(
      RegisterAuthority(database),
      StoreCertificate.generate(),
      verifyPosSession: (_) async => jsonObject(menuSnapshot('old')['context']),
      reloadProfile: (operatorId, profileId) async {
        expect(operatorId, 'owner');
        expect(profileId, 'profile');
        reloads++;
        if (offline) throw const PosApiError(503, 'OFFLINE', 'Try again');
        await database.saveSnapshot(profileId, menuSnapshot('new'));
      },
    );
    await host.start(address: InternetAddress.loopbackIPv4, port: 0);
    addTearDown(host.close);
    final invite = host.invitation('127.0.0.1');
    final client = StoreClient(invite.endpoint);
    addTearDown(client.close);
    final grant = await client.pair(
      invitation: invite,
      attemptId: const Uuid().v4(),
      label: 'Till',
      posToken: 'owner',
    );
    final credential = grant['staff_credential'] as String;
    final first = await client.state(credential);
    expect(reloads, 0);
    expect(
      (await client.state(
        credential,
        snapshotVersion: first['snapshot_version'] as String,
      ))['snapshot'],
      isNull,
    );
    final fresh = await client.state(
      credential,
      snapshotVersion: first['snapshot_version'] as String,
      reloadMenu: true,
    );
    expect(reloads, 1);
    expect(fresh['menu_reloaded'], isTrue);
    expect(
      fresh['snapshot']['context']['profile']['config']['default_menu_id'],
      'new',
    );
    final unchanged = await client.state(
      credential,
      snapshotVersion: fresh['snapshot_version'] as String,
      reloadMenu: true,
    );
    expect(unchanged['snapshot'], isNotNull);
    offline = true;
    await expectLater(
      client.state(credential, reloadMenu: true),
      throwsA(isA<PosApiError>().having((e) => e.code, 'code', 'OFFLINE')),
    );
    expect(
      (await client.state(
        credential,
      ))['snapshot']['context']['profile']['config']['default_menu_id'],
      'new',
    );
    final previousReloads = reloads;
    await expectLater(
      client.state(storeSecret(), reloadMenu: true),
      throwsA(isA<PosApiError>().having((e) => e.status, 'status', 401)),
    );
    expect(reloads, previousReloads);
  });
}
