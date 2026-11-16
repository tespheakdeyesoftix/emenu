import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:cryptography/cryptography.dart';
import 'package:drift/drift.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'pos_api.dart';
import 'pos_device_key.dart';
import 'register_database.dart';

class RegisterAccess {
  RegisterAccess(this.database, {this.vault = const FlutterSecureStorage()});

  final RegisterDatabase database;
  final FlutterSecureStorage vault;
  Future<PosDeviceKey>? _deviceKey;
  final _sessionWrites = <String, Future<void>>{};

  String _key(String operatorId) => 'emenu.pos.operator.$operatorId';
  String _deviceSessionKey(String id, [String? otherProfile]) =>
      'emenu.pos.device.session.$id${otherProfile == null ? '' : '.$otherProfile'}';
  String _pairedSessionKey(String id, String? otherProfile) =>
      'emenu.pos.store.session.$id${otherProfile == null ? '' : '.$otherProfile'}';

  Future<Json> prepareProfile(PosApi api, String token, {Json? context}) async {
    final responses = await Future.wait<Object>([
      context == null
          ? api.request('/context', token: token)
          : Future.value(context),
      api.catalog(token),
      api.pages('/tables', 'tables', token),
      api.pages('/customers', 'customers', token),
    ]);
    return {
      'context': responses[0],
      'catalog': responses[1],
      'tables': responses[2],
      'customers': responses[3],
    };
  }

  Future<void> enroll({
    required PosApi api,
    required String slug,
    required String email,
    required String pin,
    required Json session,
    required Json snapshot,
    bool updateSnapshot = true,
  }) async {
    if (!RegExp(r'^\d{6}$').hasMatch(pin)) {
      throw const FormatException('Enter a 6-digit PIN.');
    }
    final context = jsonObject(snapshot['context']);
    final business = jsonObject(context['business']);
    final profile = jsonObject(context['profile']);
    final operator = jsonObject(context['operator']);
    final role = operator['role'] as String;
    final installation = await database.installation();
    if (installation == null && role != 'owner') {
      throw const PosApiError(
        403,
        'OWNER_REQUIRED',
        'The business owner must set up this register.',
      );
    }
    if (installation != null &&
        (business['id'] != installation.businessId ||
            profile['id'] != installation.profileId ||
            profile['branch_id'] != installation.branchId)) {
      throw const PosApiError(
        403,
        'WRONG_PROFILE',
        'Select the profile configured on this register.',
      );
    }

    final random = Random.secure();
    final salt = List<int>.generate(32, (_) => random.nextInt(256));
    final verifier = await _derivePin(pin, salt);
    final operatorId = operator['id'] as String;
    if (updateSnapshot && _supportsDeviceSessions(context)) {
      await _enrollDevice(api, operatorId, session['token'] as String, session);
    }
    final key = _key(operatorId);
    final previous = await vault.read(key: key);
    await vault.write(
      key: key,
      value: jsonEncode({
        'salt': base64Encode(salt),
        'verifier': base64Encode(verifier),
        'token': session['token'],
        'expires_at': session['expires_at'],
      }),
    );
    try {
      await database.transaction(() async {
        if (installation == null) {
          await database
              .into(database.registerInstallations)
              .insert(
                RegisterInstallationsCompanion.insert(
                  apiOrigin: api.origin.toString(),
                  businessSlug: slug,
                  businessId: business['id'] as String,
                  branchId: profile['branch_id'] as String,
                  profileId: profile['id'] as String,
                ),
              );
        }
        await database
            .into(database.registerOperators)
            .insertOnConflictUpdate(
              RegisterOperatorsCompanion.insert(
                id: operatorId,
                email: email.trim().toLowerCase(),
                displayName: operator['name'] as String,
                role: role,
                failedPins: const Value(0),
                blockedUntil: const Value(null),
                accessRevoked: const Value(false),
              ),
            );
        if (updateSnapshot) {
          await database.saveSnapshot(profile['id'] as String, snapshot);
        }
        await database.retryAfterSignIn(
          operatorId,
          profileId: profile['id'] as String,
        );
      });
    } catch (_) {
      if (previous == null) {
        await vault.delete(key: key);
      } else {
        await vault.write(key: key, value: previous);
      }
      rethrow;
    }
  }

  Future<List<int>> _derivePin(String pin, List<int> salt) async {
    final key = await Pbkdf2(
      macAlgorithm: Hmac.sha256(),
      iterations: 210000,
      bits: 256,
    ).deriveKey(secretKey: SecretKey(utf8.encode(pin)), nonce: salt);
    return key.extractBytes();
  }

  Future<Json?> _secret(String operatorId) async {
    final raw = await vault.read(key: _key(operatorId));
    return raw == null ? null : jsonObject(jsonDecode(raw));
  }

  Future<String?> passwordSessionForOperator(String operatorId) async {
    final data = await _secret(operatorId);
    return _validToken(data);
  }

  Future<String> resolveStaffEmail(PosApi api, String username) async {
    final operators = await database.operators();
    for (final actor in operators) {
      if (actor.accessRevoked ||
          (actor.role != 'owner' && actor.role != 'manager')) {
        continue;
      }
      try {
        return await withSession(
          api,
          actor.id,
          (token) => api.resolveUsername(username, token),
        );
      } on PosApiError catch (error) {
        if (error.status == 404) {
          throw const PosApiError(
            401,
            'INVALID_CREDENTIALS',
            'Check the staff username and password.',
          );
        }
        if (error.status != 401 && error.status != 403) rethrow;
      }
    }
    throw const PosApiError(
      401,
      'USERNAME_SETUP_SIGN_IN',
      'An owner or manager must sign in with a password on this till.',
    );
  }

  Future<void> adoptDeviceSession(
    PosApi api,
    String operatorId,
    Json context,
  ) async {
    if (!_supportsDeviceSessions(context) ||
        await vault.read(key: _deviceSessionKey(operatorId)) != null) {
      return;
    }
    final password = await _secret(operatorId);
    final token = _validToken(password);
    if (token != null) await _enrollDevice(api, operatorId, token, password);
  }

  Future<void> rememberPairedSession(
    PosApi api,
    Json context,
    String token,
  ) async {
    final operatorId = jsonObject(context['operator'])['id'] as String;
    final profileId = jsonObject(context['profile'])['id'] as String;
    final otherProfile = await _otherProfile(profileId);
    if (_supportsDeviceSessions(context)) {
      await _enrollDevice(
        api,
        operatorId,
        token,
        null,
        otherProfile: otherProfile,
      );
    } else {
      await vault.write(
        key: _pairedSessionKey(operatorId, otherProfile),
        value: token,
      );
    }
    await database.retryAfterSignIn(operatorId, profileId: profileId);
  }

  Future<String?> _otherProfile(String? profileId) async =>
      profileId == null ||
          (await database.installation())?.profileId == profileId
      ? null
      : profileId;

  Future<String?> tokenForOperator(
    PosApi api,
    String operatorId, {
    String? rejectedToken,
    String? profileId,
  }) async {
    final otherProfile = await _otherProfile(profileId);
    final key = _deviceSessionKey(operatorId, otherProfile);
    return _serializeSession(key, () async {
      final stored = await vault.read(key: key);
      if (stored == null) {
        final legacy =
            (otherProfile == null
                ? await passwordSessionForOperator(operatorId)
                : null) ??
            await vault.read(key: _pairedSessionKey(operatorId, otherProfile));
        return legacy == rejectedToken ? null : legacy;
      }
      final session = jsonObject(jsonDecode(stored));
      if (session['revoked'] == true) return null;
      final cached = _validToken(session);
      final fresh = _validToken(session, minimum: const Duration(minutes: 2));
      if (fresh != null && fresh != rejectedToken) return fresh;
      final credential = session['credential_id'] as String;
      try {
        final response = await api.request(
          '/auth/device-session',
          method: 'POST',
          body: await (await _signingKey()).proof(credential),
        );
        final setup = await database.installation();
        if (setup == null ||
            response['profile_id'] != (otherProfile ?? setup.profileId) ||
            response['user_id'] != operatorId) {
          throw const PosApiError(
            409,
            'WRONG_REGISTER_SESSION',
            'Wrong device session.',
          );
        }
        await vault.write(
          key: key,
          value: jsonEncode({...response, 'credential_id': credential}),
        );
        return response['token'] as String;
      } on PosApiError catch (error) {
        if (error.code == 'INVALID_DEVICE_CREDENTIAL') {
          await _revokeAccess(operatorId, otherProfile, session);
          return null;
        }
        if (cached != null && cached != rejectedToken && error.transient) {
          return cached;
        }
        rethrow;
      }
    });
  }

  Future<T> withSession<T>(
    PosApi api,
    String operatorId,
    Future<T> Function(String token) request, {
    String? profileId,
  }) async {
    final token = await tokenForOperator(api, operatorId, profileId: profileId);
    if (token == null) throw _signInRequired;
    try {
      try {
        return await request(token);
      } on PosApiError catch (error) {
        if (error.status != 401) rethrow;
        final renewed = await tokenForOperator(
          api,
          operatorId,
          rejectedToken: token,
          profileId: profileId,
        );
        if (renewed == null) throw _signInRequired;
        return await request(renewed);
      }
    } on PosApiError catch (error) {
      if (error.code == 'PROFILE_ACCESS_REVOKED') {
        final otherProfile = await _otherProfile(profileId);
        await _serializeSession(
          _deviceSessionKey(operatorId, otherProfile),
          () => _revokeAccess(operatorId, otherProfile),
        );
      }
      rethrow;
    }
  }

  Future<void> _revokeAccess(
    String id,
    String? otherProfile, [
    Json? session,
  ]) async {
    await database.revokeOperatorAccess(id, profileId: otherProfile);
    await vault.write(
      key: _deviceSessionKey(id, otherProfile),
      value: jsonEncode({...?session, 'revoked': true}),
    );
  }

  Future<void> _enrollDevice(
    PosApi api,
    String id,
    String token,
    Json? localSession, {
    String? otherProfile,
  }) => _serializeSession(_deviceSessionKey(id, otherProfile), () async {
    final reply = await api.request(
      '/devices',
      method: 'POST',
      token: token,
      body: await (await _signingKey()).descriptor(
        'eMenu POS ${Platform.operatingSystem}',
      ),
    );
    if (reply['user_id'] != id || reply['id'] is! String) {
      throw const PosApiError(
        409,
        'WRONG_REGISTER_SESSION',
        'Wrong device credential.',
      );
    }
    await vault.write(
      key: _deviceSessionKey(id, otherProfile),
      value: jsonEncode({
        'credential_id': reply['id'],
        'token': localSession?['token'],
        'expires_at': localSession?['expires_at'],
      }),
    );
  });

  Future<PosDeviceKey> _signingKey() async {
    try {
      return await (_deviceKey ??= _loadSigningKey());
    } catch (_) {
      _deviceKey = null;
      rethrow;
    }
  }

  Future<PosDeviceKey> _loadSigningKey() async {
    const vaultKey = 'emenu.pos.device.signing';
    final previous = await vault.read(key: vaultKey);
    if (previous != null) {
      return PosDeviceKey.fromJson(jsonObject(jsonDecode(previous)));
    }
    final device = PosDeviceKey.generate();
    await vault.write(key: vaultKey, value: jsonEncode(device.toJson()));
    return device;
  }

  Future<T> _serializeSession<T>(String id, Future<T> Function() work) {
    final next = (_sessionWrites[id] ?? Future<void>.value()).then(
      (_) => work(),
    );
    final tail = next.then<void>((_) {}, onError: (Object _) {});
    _sessionWrites[id] = tail;
    unawaited(
      tail.whenComplete(() {
        if (identical(_sessionWrites[id], tail)) _sessionWrites.remove(id);
      }),
    );
    return next;
  }

  bool _supportsDeviceSessions(Json context) =>
      (context['capabilities'] as Map?)?['device_sessions'] == true;

  String? _validToken(Json? session, {Duration minimum = Duration.zero}) {
    final expires = DateTime.tryParse(session?['expires_at'] as String? ?? '');
    final token = session?['token'] as String?;
    return expires?.isAfter(DateTime.now().add(minimum)) == true ? token : null;
  }

  Future<RegisterOperator> unlock(String operatorId, String pin) async {
    final operator = await database.operatorById(operatorId);
    if (operator == null || !RegExp(r'^\d{6}$').hasMatch(pin)) {
      throw const FormatException('Enter a 6-digit PIN.');
    }
    if (operator.accessRevoked) throw _signInRequired;
    if (operator.blockedUntil?.isAfter(DateTime.now()) ?? false) {
      throw const PosApiError(
        403,
        'PIN_LOCKED',
        'Wait before retrying, or sign in with your password.',
      );
    }
    final data = await _secret(operatorId);
    if (data == null) {
      throw const PosApiError(
        401,
        'SIGN_IN_REQUIRED',
        'Sign in with your password again.',
      );
    }
    final expected = base64Decode(data['verifier'] as String);
    final actual = await _derivePin(pin, base64Decode(data['salt'] as String));
    var difference = expected.length ^ actual.length;
    for (var i = 0; i < expected.length && i < actual.length; i++) {
      difference |= expected[i] ^ actual[i];
    }
    final attempts = difference == 0 ? 0 : operator.failedPins + 1;
    await (database.update(
      database.registerOperators,
    )..where((row) => row.id.equals(operatorId))).write(
      RegisterOperatorsCompanion(
        failedPins: Value(attempts >= 5 ? 0 : attempts),
        blockedUntil: Value(
          attempts >= 5
              ? DateTime.now().toUtc().add(const Duration(minutes: 5))
              : null,
        ),
      ),
    );
    if (difference != 0) {
      throw const PosApiError(401, 'INVALID_PIN', 'Incorrect PIN.');
    }
    return operator;
  }

  static const _signInRequired = PosApiError(
    401,
    'SIGN_IN_REQUIRED',
    'Sign in with your password again.',
  );
}
