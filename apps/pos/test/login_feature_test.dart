import 'dart:convert';

import 'package:drift/native.dart';
import 'package:emenu_pos/auths/login_binding.dart';
import 'package:emenu_pos/auths/login_controller.dart';
import 'package:emenu_pos/auths/login_service.dart';
import 'package:emenu_pos/core/api_endpoint.dart';
import 'package:emenu_pos/core/pos_api.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:emenu_pos/features/register/register_controller.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _installation = RegisterInstallation(
  id: 1,
  apiOrigin: 'https://pos.example.test',
  businessSlug: 'shop',
  businessId: 'business',
  branchId: 'branch',
  profileId: 'profile',
);

class _LoginRegister extends RegisterController {
  _LoginRegister(super.database);

  String? connectedOrigin;

  @override
  Future<void> connectToApi(String origin) async => connectedOrigin = origin;
}

class _LoginClient extends MockClient {
  _LoginClient(super.handler);

  bool closed = false;

  @override
  void close() {
    closed = true;
    super.close();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late RegisterDatabase database;
  late _LoginRegister register;
  late LoginService service;
  late _LoginClient client;
  late List<http.Request> requests;
  late List<Json> profiles;
  late String businessId;
  late String role;

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    database = RegisterDatabase(NativeDatabase.memory());
    register = _LoginRegister(database);
    register.stage.value = RegisterStage.activation;
    requests = [];
    profiles = [
      {
        'id': 'profile',
        'branch_id': 'branch',
        'name': 'Till',
        'branch_name': 'HQ',
      },
    ];
    businessId = 'business';
    role = 'owner';
    client = _LoginClient((request) async {
      requests.add(request);
      final path = request.url.path.substring(ApiEndpoint.prefix.length);
      final body = switch (path) {
        ApiEndpoint.login => {
          'token': 'discovery-token',
          'business_id': businessId,
        },
        ApiEndpoint.profiles => {'profiles': profiles, 'has_more': false},
        ApiEndpoint.sessions => {
          'token': 'profile-token',
          'expires_at': DateTime.now()
              .add(const Duration(hours: 1))
              .toIso8601String(),
        },
        ApiEndpoint.context => {
          'business': {
            'id': 'business',
            'currency': 'USD',
            'secondary_exchange_rate': '4000',
            'timezone': 'Asia/Phnom_Penh',
          },
          'profile': {
            'id': 'profile',
            'branch_id': 'branch',
            'config': {'table_mode': 'disabled', 'tax_mode': 'disabled'},
          },
          'operator': {'id': 'owner', 'name': 'Owner', 'role': role},
        },
        ApiEndpoint.catalog => {'products': [], 'has_more': false},
        ApiEndpoint.tables => {'tables': [], 'has_more': false},
        ApiEndpoint.customers => {'customers': [], 'has_more': false},
        ApiEndpoint.currentSession => <String, dynamic>{},
        _ => throw StateError('Unexpected request: ${request.method} $path'),
      };
      return http.Response(
        jsonEncode(body),
        200,
        headers: {'Content-Type': 'application/json'},
      );
    });
    service = LoginService(
      register,
      apiFactory: (origin) => PosApi(origin, client: client),
    );
  });

  tearDown(() async {
    Get.reset();
    service.onClose();
    client.close();
    await database.close();
  });

  test('activation validates required fields and requires an email', () async {
    await service.signIn('https://pos.example.test', '', '', '');
    expect(register.message.value, 'FILL_SIGN_IN');
    await service.signIn(
      'https://pos.example.test',
      'shop',
      'cashier',
      'secret',
    );
    expect(register.message.value, 'OWNER_REQUIRED');
    expect(requests, isEmpty);
    expect(register.busy.value, isFalse);
  });

  test(
    'password activation enrolls the profile and clears form credentials',
    () async {
      Get.put<LoginService>(service);
      LoginBinding(register).dependencies();
      final controller = Get.find<LoginController>();
      controller.origin.text = 'https://pos.example.test';
      controller.slug.text = ' shop ';
      controller.account.text = ' owner@example.test ';
      controller.password.text = 'secret';

      await controller.signIn();
      expect(register.stage.value, RegisterStage.selectProfile);
      expect(service.profiles.single['id'], 'profile');
      expect(controller.password.text, isEmpty);
      final loginBody = jsonObject(jsonDecode(requests.first.body));
      expect(loginBody['business_slug'], 'shop');
      expect(loginBody['email'], 'owner@example.test');

      await controller.selectProfile();
      expect(register.stage.value, RegisterStage.ready);
      expect(register.installation.value?.profileId, 'profile');
      expect(register.operator.value?.id, 'owner');
      expect(register.offerPinSetup, isTrue);
      expect(register.pinConfigured.value, isFalse);
      expect(register.connectedOrigin, 'https://pos.example.test');
      expect(
        await register.access.passwordSessionForOperator('owner'),
        'profile-token',
      );
      expect(controller.account.text, isEmpty);
      expect(controller.slug.text, isEmpty);
      expect(client.closed, isTrue);
      expect(service.profiles, isEmpty);
      final logout = requests.singleWhere(
        (request) => request.method == 'DELETE',
      );
      expect(logout.headers['Authorization'], 'Bearer discovery-token');
    },
  );

  test(
    'installed register only offers its configured profile and branch',
    () async {
      register.installation.value = _installation;
      register.stage.value = RegisterStage.locked;
      profiles = [
        {'id': 'other-profile', 'branch_id': 'branch'},
        {'id': 'profile', 'branch_id': 'other-branch'},
        {'id': 'profile', 'branch_id': 'branch'},
      ];
      await service.signIn(
        'https://unused.example.test',
        'shop',
        'owner@example.test',
        'secret',
      );
      expect(register.stage.value, RegisterStage.selectProfile);
      expect(service.profiles, [
        {'id': 'profile', 'branch_id': 'branch'},
      ]);
      expect(
        requests.every((request) => request.url.host == 'pos.example.test'),
        isTrue,
      );

      service.cancelSignIn();
      expect(register.stage.value, RegisterStage.locked);
      expect(service.profiles, isEmpty);
      expect(client.closed, isTrue);
    },
  );

  for (final (failure, wrongBusiness) in [
    ('WRONG_PROFILE', true),
    ('NO_PROFILES', false),
  ]) {
    test(
      'failed profile discovery reports $failure and closes the client',
      () async {
        register.installation.value = _installation;
        register.stage.value = RegisterStage.locked;
        if (wrongBusiness) {
          businessId = 'other-business';
        } else {
          profiles.clear();
        }
        await service.signIn(
          'https://pos.example.test',
          'shop',
          'owner@example.test',
          'secret',
        );
        expect(register.message.value, failure);
        expect(register.stage.value, RegisterStage.locked);
        expect(register.busy.value, isFalse);
        expect(client.closed, isTrue);
        expect(service.profiles, isEmpty);
      },
    );
  }

  test(
    'failed enrollment signs out its profile session and allows retry',
    () async {
      role = 'staff';
      await service.signIn(
        'https://pos.example.test',
        'shop',
        'owner@example.test',
        'secret',
      );
      await service.selectProfile('profile');
      expect(register.message.value, 'OWNER_REQUIRED');
      expect(register.stage.value, RegisterStage.selectProfile);
      expect(client.closed, isFalse);
      final logout = requests.singleWhere(
        (request) => request.method == 'DELETE',
      );
      expect(logout.headers['Authorization'], 'Bearer profile-token');

      role = 'owner';
      await service.selectProfile('profile');
      expect(register.stage.value, RegisterStage.ready);
      expect(register.message.value, isNull);
      expect(client.closed, isTrue);
    },
  );

  test(
    'bindings share the service and dispose controller state when recreated',
    () async {
      Get.put<LoginService>(service);
      LoginBinding(register).dependencies();
      final first = Get.find<LoginController>();
      first.account.text = 'owner@example.test';
      first.password.text = 'secret';
      first.profileId.value = 'stale-profile';
      service.profiles.assignAll(profiles);
      expect(first.selectedProfileId, 'profile');
      LoginBinding(register).dependencies();
      expect(Get.find<LoginController>(), same(first));

      await Get.delete<LoginController>();
      final second = Get.find<LoginController>();
      expect(first.isClosed, isTrue);
      expect(second, isNot(same(first)));
      expect(second.service, same(service));
      expect(second.account.text, isEmpty);
      expect(second.password.text, isEmpty);
    },
  );
}
