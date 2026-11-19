import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import 'api_endpoint.dart';
import 'pos_api.dart';
import 'register_authority.dart';
import 'register_database.dart';
import 'register_history_scope.dart';
import 'register_shift_reports.dart';
import 'store_transport.dart';

class StoreHost {
  StoreHost(
    this.authority,
    this.certificate, {
    required this.verifyPosSession,
    this.onVerified,
    this.reloadProfile,
    this.readServerSaleHistory,
    this.requestCustomerDirectory,
    this.onError,
  });

  final RegisterAuthority authority;
  final StoreCertificate certificate;
  final Future<Json> Function(String token) verifyPosSession;
  final Future<void> Function(Json context, String token)? onVerified;
  final Future<void> Function(String operatorId, String profileId)?
  reloadProfile;
  final Future<Json> Function(
    String operatorId,
    String profileId,
    int? page,
    String? saleId,
  )?
  readServerSaleHistory;
  final Future<Json> Function(String operatorId, String profileId, Json input)?
  requestCustomerDirectory;
  final void Function(Object error)? onError;

  RegisterDatabase get _db => authority.database;
  HttpServer? _server;
  _Pairing? _pairing;
  int? get port => _server?.port;

  Future<void> start({InternetAddress? address, int port = 8879}) async {
    if (_server != null) return;
    final server = await HttpServer.bindSecure(
      address ?? InternetAddress.anyIPv4,
      port,
      certificate.serverContext(),
    );
    server.idleTimeout = const Duration(seconds: 25);
    _server = server;
    server.listen(_handle, onError: (Object error) => onError?.call(error));
  }

  Future<void> close() async {
    final server = _server;
    _server = null;
    _pairing = null;
    await server?.close(force: true);
  }

  StoreInvitation invitation(String ipv4) {
    final port = _server?.port;
    if (port == null) throw StateError('The store register is stopped.');
    final invite = StoreInvitation(
      StoreEndpoint('https://$ipv4:$port', certificate.fingerprint),
      storeSecret(),
    );
    _pairing = _Pairing(
      storeCredentialHash(invite.secret),
      DateTime.now().add(const Duration(minutes: 5)),
    );
    return invite;
  }

  Future<List<StoreDevice>> devices() =>
      (_db.select(_db.storeDevices)
            ..where((row) => row.revokedAt.isNull())
            ..orderBy([(row) => OrderingTerm.asc(row.pairedAt)]))
          .get();

  Future<void> revoke(String id) =>
      (_db.update(_db.storeDevices)..where((row) => row.id.equals(id))).write(
        StoreDevicesCompanion(revokedAt: Value(DateTime.now().toUtc())),
      );

  Future<void> _handle(HttpRequest request) async {
    final response = request.response;
    response.headers.contentType = ContentType.json;
    response.headers.set(HttpHeaders.cacheControlHeader, 'no-store');
    try {
      if (request.method != 'POST') throw _notFound;
      final header = request.headers.value(HttpHeaders.authorizationHeader);
      if (header == null || !header.startsWith('Bearer ')) throw _unauthorized;
      final credential = header.substring(7);
      if (!isStoreSecret(credential)) throw _unauthorized;
      final hash = storeCredentialHash(credential);
      final body = await _readBody(request);
      final result = switch (request.uri.path) {
        StoreApiEndpoint.pair => await _pair(hash, body),
        StoreApiEndpoint.enroll => await _enroll(hash, body),
        StoreApiEndpoint.state => await _state(hash, body),
        StoreApiEndpoint.salesHistory => await _salesHistory(hash, body),
        StoreApiEndpoint.customerDirectory => await _customerDirectory(
          hash,
          body,
        ),
        StoreApiEndpoint.command => await _command(hash, body),
        StoreApiEndpoint.shiftManagement => await _shiftManagement(hash, body),
        _ => throw _notFound,
      };
      response.write(jsonEncode(result));
    } on PosApiError catch (error) {
      response.statusCode = error.status == 0 ? 503 : error.status;
      response.write(jsonEncode({'code': error.code, 'error': error.message}));
    } on FormatException catch (error) {
      response.statusCode = HttpStatus.badRequest;
      response.write(
        jsonEncode({'code': error.message, 'error': error.message}),
      );
    } on TypeError {
      response.statusCode = HttpStatus.badRequest;
      response.write(
        jsonEncode({
          'code': 'INVALID_COMMAND',
          'error': 'Invalid register command.',
        }),
      );
    } on TimeoutException {
      response.statusCode = HttpStatus.requestTimeout;
      response.write(
        jsonEncode({
          'code': 'STORE_UNREACHABLE',
          'error': 'The till request was interrupted.',
        }),
      );
    } catch (error) {
      onError?.call(error);
      response.statusCode = HttpStatus.internalServerError;
      response.write(
        jsonEncode({
          'code': 'LOCAL_ERROR',
          'error': 'The store register could not process the request.',
        }),
      );
    } finally {
      try {
        await response.close();
      } on IOException {
        // A lost response can be retried with the same command ID.
      }
    }
  }

  Future<Json> _readBody(HttpRequest request) async {
    const limit = 1024 * 1024;
    if (request.contentLength > limit) throw RegisterAuthority.invalidCommand;
    final bytes = <int>[];
    await for (final chunk in request.timeout(const Duration(seconds: 5))) {
      if (bytes.length + chunk.length > limit) {
        throw RegisterAuthority.invalidCommand;
      }
      bytes.addAll(chunk);
    }
    try {
      return jsonObject(jsonDecode(utf8.decode(bytes)));
    } on FormatException {
      throw RegisterAuthority.invalidCommand;
    }
  }

  Future<Json> _pair(String hash, Json body) async {
    final pairing = _pairing;
    if (pairing == null ||
        pairing.hash != hash ||
        DateTime.now().isAfter(pairing.expires)) {
      throw const PosApiError(
        403,
        'PAIRING_EXPIRED',
        'Ask for a new pairing code.',
      );
    }
    final label = (body['label'] as String).trim();
    final attempt = body['attempt_id'] as String;
    final token = body['pos_token'] as String;
    if (label.isEmpty ||
        label.length > 64 ||
        !RegExp(r'^[a-f0-9-]{36}$').hasMatch(attempt)) {
      throw RegisterAuthority.invalidCommand;
    }
    final attemptKey = storeCredentialHash('$attempt:$token:$label');
    if (pairing.result != null) {
      if (pairing.attemptKey != attemptKey) {
        throw const PosApiError(
          409,
          'PAIRING_USED',
          'Ask for a new pairing code.',
        );
      }
      return pairing.result!;
    }
    pairing.attemptKey = attemptKey;
    final future = _pairDevice(pairing, label, token);
    pairing.result = future;
    try {
      return await future;
    } catch (_) {
      pairing.result = null;
      rethrow;
    }
  }

  Future<Json> _pairDevice(_Pairing pairing, String label, String token) async {
    final context = await _verify(token);
    final profileId = jsonObject(context['profile'])['id'] as String;
    final actor = jsonObject(context['operator']);
    if (actor['role'] != 'owner') {
      throw const PosApiError(
        403,
        'OWNER_REQUIRED',
        'The business owner must pair tills.',
      );
    }
    await onVerified?.call(context, token);
    return _db.transaction(() async {
      if (!identical(_pairing, pairing) ||
          DateTime.now().isAfter(pairing.expires)) {
        throw const PosApiError(
          403,
          'PAIRING_EXPIRED',
          'Ask for a new pairing code.',
        );
      }
      if (await _db.profileSnapshot(profileId) == null) {
        throw const PosApiError(
          409,
          'SYNC_REQUIRED',
          'Load the store profile.',
        );
      }
      final device = const Uuid().v4();
      final credential = storeSecret();
      await _db
          .into(_db.storeDevices)
          .insert(
            StoreDevicesCompanion.insert(
              id: device,
              profileId: Value(profileId),
              name: label,
              credentialHash: storeCredentialHash(credential),
              pairedAt: DateTime.now().toUtc(),
            ),
          );
      return {
        ...await _grant(device, profileId, actor),
        'device_id': device,
        'device_credential': credential,
      };
    });
  }

  Future<Json> _enroll(String hash, Json body) async {
    final device = await _activeDevice(hash);
    if (device == null) throw _unauthorized;
    final token = body['pos_token'] as String;
    final profileId = device.profileId ?? (await _db.installation())?.profileId;
    if (profileId == null) throw _unauthorized;
    final context = await _verify(token, profileId: profileId);
    final actor = jsonObject(context['operator']);
    await onVerified?.call(context, token);
    return _db.transaction(() async {
      if (await _activeDevice(hash) == null) throw _unauthorized;
      return _grant(device.id, profileId, actor);
    });
  }

  Future<StoreDevice?> _activeDevice(String hash) =>
      (_db.select(_db.storeDevices)..where(
            (row) => row.credentialHash.equals(hash) & row.revokedAt.isNull(),
          ))
          .getSingleOrNull();

  Future<Json> _verify(String token, {String? profileId}) async {
    final setup = await _db.installation();
    if (setup == null) throw _unauthorized;
    final context = await verifyPosSession(token);
    final business = jsonObject(context['business']);
    final profile = jsonObject(context['profile']);
    if (setup.businessId != business['id'] ||
        setup.branchId != profile['branch_id'] ||
        (profileId != null && profileId != profile['id'])) {
      throw const PosApiError(
        403,
        'WRONG_PROFILE',
        'Select a profile assigned to this till in the same branch.',
      );
    }
    return context;
  }

  Future<Json> _grant(String device, String profileId, Json actor) async {
    final grant = storeSecret();
    final id = actor['id'] as String;
    await _db.saveOperatorPermissions(profileId, actor);
    await _db
        .into(_db.storeStaffGrants)
        .insertOnConflictUpdate(
          StoreStaffGrantsCompanion.insert(
            deviceId: device,
            operatorId: id,
            displayName: actor['name'] as String,
            role: actor['role'] as String,
            credentialHash: storeCredentialHash(grant),
          ),
        );
    return {
      'staff_credential': grant,
      'operator_id': id,
      'profile_id': profileId,
    };
  }

  Future<Json> _state(String hash, Json body) async {
    if (body['reload_menu'] == true) {
      final staff = await _db.storeStaff(hash);
      final setup = await _db.installation();
      if (staff == null || setup == null) throw _unauthorized;
      final reload = reloadProfile;
      if (reload == null) {
        throw const PosApiError(
          503,
          'SERVER_UPGRADE_REQUIRED',
          'Update the store register.',
        );
      }
      // Network I/O must finish outside the state transaction.
      await reload(staff.grant.operatorId, staff.profileId ?? setup.profileId);
    }
    final state = await _cachedState(
      hash,
      body['reload_menu'] == true ? null : body['snapshot_version'],
    );
    return {...state, if (body['reload_menu'] == true) 'menu_reloaded': true};
  }

  Future<Json> _cachedState(
    String hash,
    Object? knownVersion,
  ) => _db.transaction(() async {
    final staff = await _db.storeStaff(hash);
    final setup = await _db.installation();
    if (staff == null || setup == null) throw _unauthorized;
    final actor = staff.grant;
    final profileId = staff.profileId ?? setup.profileId;
    final cached = await _db.profileSnapshot(profileId);
    if (cached == null) {
      throw const PosApiError(409, 'SYNC_REQUIRED', 'Load the store profile.');
    }
    final snapshot = await _db.effectiveSnapshot(cached);
    final context = jsonObject(snapshot['context']);
    final shift = context['cashier_shift'] as Json?;
    snapshot['context'] = {
      ...context,
      'store_shift_management': true,
      if (shift != null)
        'cashier_shift': cashierShiftMetadata(shift, shiftManager(actor.role)),
      'store_cart_line_edits': true,
      'store_free_item_reasons': true,
      'store_item_discount_details': true,
      'store_bill_information': true,
      'store_sale_notes': true,
      if (requestCustomerDirectory != null) 'store_customer_directory': true,
      'operator': {
        'id': actor.operatorId,
        'name': actor.displayName,
        'role': actor.role,
        'permissions': await _db.operatorPermissions(profileId, actor.operatorId),
      },
    };
    final version =
        '${cached.payload.hashCode}-${jsonEncode(snapshot['context']).hashCode}';
    final bills =
        await (_db.select(_db.heldBills)
              ..where((row) => row.profileId.equals(profileId))
              ..orderBy([(row) => OrderingTerm.desc(row.updatedAt)]))
            .get();
    final sales =
        await (_db.select(_db.localSales).join([
                innerJoin(
                  _db.saleOutbox,
                  _db.saleOutbox.saleId.equalsExp(_db.localSales.id),
                ),
              ])
              ..where(_db.localSales.profileId.equals(profileId))
              ..orderBy([
                OrderingTerm.desc(_db.localSales.createdAt),
                OrderingTerm.desc(_db.saleOutbox.sequence),
              ])
              ..limit(100))
            .get();
    return {
      'snapshot_version': version,
      'snapshot': version == knownVersion ? null : snapshot,
      'bills': bills.map((row) => row.toJson()).toList(),
      'sales': sales
          .map(
            (row) => {
              'sale': row.readTable(_db.localSales).toJson(),
              'sync': row.readTable(_db.saleOutbox).toJson(),
            },
          )
          .toList(),
    };
  });

  Future<Json> _salesHistory(String hash, Json body) async {
    final staff = await _db.storeStaff(hash);
    final setup = await _db.installation();
    if (staff == null || setup == null) throw _unauthorized;
    final profileId = staff.profileId ?? setup.profileId;
    final page = body['server_page'];
    final saleId = body['sale_id'];
    if (page != null || saleId != null) {
      if ((page != null && (page is! int || page < 1 || saleId != null)) ||
          (saleId != null &&
              (saleId is! String ||
                  !RegExp(r'^[a-zA-Z0-9_-]{1,80}$').hasMatch(saleId)))) {
        throw const PosApiError(
          400,
          'INVALID_INPUT',
          'Invalid sale history request.',
        );
      }
      final read = readServerSaleHistory;
      if (read == null) throw _notFound;
      return read(
        staff.grant.operatorId,
        profileId,
        page as int?,
        saleId as String?,
      );
    }

    return _db.transaction(() async {
      final snapshot = await _db.readSnapshot(profileId);
      if (snapshot == null) {
        throw const PosApiError(
          409,
          'SYNC_REQUIRED',
          'Load the store profile.',
        );
      }
      final context = jsonObject(snapshot['context']);
      final scope = RegisterHistoryScope.fromContext(
        context,
        registerOperatingContext(context, DateTime.now()),
      );
      return {
        'history_scope': scope?.toJson(),
        if (scope != null) ...((await _db.salesHistory(scope)).toJson()),
      };
    });
  }

  Future<Json> _command(String hash, Json body) {
    final action = RegisterAction.values
        .where((value) => value.name == body['action'])
        .firstOrNull;
    if (action == null) throw RegisterAuthority.invalidCommand;
    return authority.executePaired(
      commandId: body['id'] as String,
      credentialHash: hash,
      action: action,
      body: jsonObject(body['payload']),
    );
  }

  Future<Json> _shiftManagement(String hash, Json body) async {
    final staff = await _db.storeStaff(hash);
    final setup = await _db.installation();
    if (staff == null || setup == null) throw _unauthorized;
    final profileId = staff.profileId ?? setup.profileId;
    if (body['kind'] == 'command') {
      final id = body['id'];
      final command = id is String ? await _db.savedCommand(id) : null;
      return {
        'found':
            command != null &&
            command.operatorId == staff.grant.operatorId &&
            command.profileId == profileId,
      };
    }
    return RegisterShiftReports(_db).read(profileId, staff.grant.role, body);
  }

  Future<Json> _customerDirectory(String hash, Json body) async {
    final staff = await _db.storeStaff(hash);
    final setup = await _db.installation();
    if (staff == null || setup == null) throw _unauthorized;
    final request = requestCustomerDirectory;
    if (request == null) throw _notFound;
    return request(
      staff.grant.operatorId,
      staff.profileId ?? setup.profileId,
      body,
    );
  }

  static const _unauthorized = PosApiError(
    401,
    'STORE_ACCESS_REQUIRED',
    'Pair this till or sign in again.',
  );
  static const _notFound = PosApiError(
    404,
    'INVALID_COMMAND',
    'Unknown register operation.',
  );
}

class _Pairing {
  _Pairing(this.hash, this.expires);

  final String hash;
  final DateTime expires;
  String? attemptKey;
  Future<Json>? result;
}
