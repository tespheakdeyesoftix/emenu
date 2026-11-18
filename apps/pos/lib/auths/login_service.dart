import 'dart:async';

import 'package:get/get.dart';

import '../core/api_endpoint.dart';
import '../core/pos_api.dart';
import '../features/register/register_controller.dart';
import '../features/sales/sale/sale_service.dart';

/// Owns password discovery, profile enrollment, and offline PIN authentication.
/// Register state stays shared with the sales, shift, and store features.
class LoginService extends GetxService {
  LoginService(this.register, {PosApi Function(String)? apiFactory})
    : _apiFactory = apiFactory ?? PosApi.new;

  final RegisterController register;
  final PosApi Function(String) _apiFactory;
  final profiles = <Json>[].obs;
  PosApi? _discoveryApi;
  String? _discoveryToken;
  String? _email;
  String? _slug;

  Future<void> signIn(
    String origin,
    String slug,
    String identifier,
    String password,
  ) => register.run(() async {
    final account = identifier.trim();
    if (slug.trim().isEmpty || account.isEmpty || password.isEmpty) {
      throw const FormatException('FILL_SIGN_IN');
    }
    final setup = register.installation.value;
    final username = account.contains('@') ? null : account;
    if (setup == null && username != null) {
      throw const FormatException('OWNER_REQUIRED');
    }
    final api = _apiFactory(setup?.apiOrigin ?? origin);
    try {
      final email = username == null
          ? account
          : await register.access.resolveStaffEmail(api, username);
      final login = await api.login(
        slug.trim(),
        email,
        password,
        username: username,
      );
      final token = login['token'] as String;
      if (setup != null && login['business_id'] != setup.businessId) {
        throw const PosApiError(
          403,
          'WRONG_PROFILE',
          'This register belongs to another business.',
        );
      }
      final available = await api.pages(
        ApiEndpoint.profiles,
        'profiles',
        token,
      );
      final eligible = available
          .where(
            (profile) =>
                setup == null ||
                (profile['id'] == setup.profileId &&
                    profile['branch_id'] == setup.branchId),
          )
          .toList();
      if (eligible.isEmpty) {
        throw const PosApiError(
          403,
          'NO_PROFILES',
          'No available POS profile.',
        );
      }
      _clearDiscovery();
      _discoveryApi = api;
      _discoveryToken = token;
      _email = email;
      _slug = slug.trim();
      profiles.assignAll(eligible);
      register.stage.value = RegisterStage.selectProfile;
    } catch (_) {
      api.close();
      rethrow;
    }
  });

  Future<void> selectProfile(String profileId) => register.run(() async {
    final api = _discoveryApi;
    final discoveryToken = _discoveryToken;
    if (api == null || discoveryToken == null) {
      throw const PosApiError(
        401,
        'SIGN_IN_REQUIRED',
        'Sign in with your password again.',
      );
    }
    final session = await api.startSession(discoveryToken, profileId);
    final token = session['token'] as String;
    try {
      final isTill = register.network.isTill;
      final data = isTill
          ? {'context': await api.request(ApiEndpoint.context, token: token)}
          : await register.access.prepareProfile(api, token);
      final operatorId =
          jsonObject(jsonObject(data['context'])['operator'])['id'] as String;
      final firstSignIn = !await register.access.hasSignedIn(operatorId);
      if (isTill) await register.network.enroll(operatorId, token);
      await register.access.enroll(
        api: api,
        slug: _slug!,
        email: _email!,
        session: session,
        snapshot: data,
        updateSnapshot: !isTill,
      );
      register.installation.value = await register.database.installation();
      await register.refreshPinStaff();
      register.pinConfigured.value = await register.access.hasPin(operatorId);
      register.operator.value = await register.database.operatorById(
        operatorId,
      );
      register.applyProfileSnapshot(
        await register.database.readSnapshot(
          register.installation.value!.profileId,
        ),
      );
      if (register.snapshot.value == null) {
        throw const PosApiError(
          409,
          'SYNC_REQUIRED',
          'Load the store profile.',
        );
      }
      register.online.value = !isTill;
      await register.connectToApi(api.origin.toString());
      if (isTill) await register.refreshRegister();
      await register.sales.loadCart(register.operator.value!);
      register.tab.value = register.landingTab;
      register.offerPinSetup = firstSignIn;
    } catch (_) {
      await _logout(api, token);
      rethrow;
    }
    await _logout(api, discoveryToken);
    _clearDiscovery();
    register.stage.value = RegisterStage.ready;
  });

  Future<void> unlock(String operatorId, String pin) => register.run(() async {
    final current = await register.access.unlock(operatorId, pin);
    final cached = await register.database.readSnapshot(
      register.installation.value!.profileId,
    );
    if (cached == null) {
      throw const PosApiError(
        409,
        'SYNC_REQUIRED',
        'Sign in online to load the profile.',
      );
    }
    register.operator.value = current;
    register.pinConfigured.value = true;
    register.offerPinSetup = false;
    register.applyProfileSnapshot(cached);
    await register.sales.loadCart(current);
    register.tab.value = register.landingTab;
    register.stage.value = RegisterStage.ready;
    unawaited(register.refreshRegister());
  });

  void cancelSignIn() {
    _clearDiscovery();
    register.message.value = null;
    register.stage.value = register.installation.value == null
        ? RegisterStage.activation
        : RegisterStage.locked;
  }

  Future<void> _logout(PosApi api, String token) async {
    try {
      await api.request(
        ApiEndpoint.currentSession,
        method: 'DELETE',
        token: token,
      );
    } on PosApiError {
      // Discovery tokens expire if logout cannot reach the server.
    }
  }

  void _clearDiscovery() {
    _discoveryApi?.close();
    _discoveryApi = null;
    _discoveryToken = null;
    _email = null;
    _slug = null;
    profiles.clear();
  }

  @override
  void onClose() {
    _clearDiscovery();
    super.onClose();
  }
}
