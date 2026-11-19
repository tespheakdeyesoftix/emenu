import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import 'api_endpoint.dart';
import 'pos_api.dart';
import 'register_access.dart';
import 'register_authority.dart';
import 'register_database.dart';
import 'store_host.dart';
import 'store_transport.dart';

class RegisterNetwork {
  RegisterNetwork(this.authority, this.access, {this.onError});

  final RegisterAuthority authority;
  final RegisterAccess access;
  final void Function(Object error)? onError;
  RegisterDatabase get _db => authority.database;

  static const _certificateKey = 'emenu.pos.store.certificate';
  static const _deviceKey = 'emenu.pos.store.device';
  StoreHost? host;
  StoreClient? _till;
  Timer? _staffValidation;
  bool _validatingStaff = false;
  String? _snapshotVersion;
  String? _attemptId;
  String? _attemptCode;

  bool get isTill => _till != null;

  Future<void> restore(PosApi api) async {
    final settings = await _db.networkSettings();
    if (settings?.mode == 'host') {
      await _startHost(api, createIdentity: false);
    } else if (settings?.mode == 'till' && _till == null) {
      _till = StoreClient(
        StoreEndpoint(settings!.endpoint!, settings.fingerprint!),
      );
    }
  }

  Future<void> enableHost(PosApi api) async {
    if (isTill) throw _alreadyPaired;
    await _startHost(api, createIdentity: true);
    await _db
        .into(_db.storeNetworkSettings)
        .insertOnConflictUpdate(
          StoreNetworkSettingsCompanion.insert(mode: 'host'),
        );
  }

  Future<void> _startHost(PosApi api, {required bool createIdentity}) async {
    if (host != null) return;
    final saved = await access.vault.read(key: _certificateKey);
    final StoreCertificate certificate;
    if (saved != null) {
      certificate = StoreCertificate.fromJson(jsonObject(jsonDecode(saved)));
    } else {
      if (!createIdentity) {
        throw const PosApiError(
          409,
          'STORE_CERTIFICATE',
          'The store identity is unavailable.',
        );
      }
      certificate = StoreCertificate.generate();
      await access.vault.write(
        key: _certificateKey,
        value: jsonEncode(certificate.toJson()),
      );
    }
    final server = StoreHost(
      authority,
      certificate,
      verifyPosSession: (token) =>
          api.request(ApiEndpoint.context, token: token),
      reloadProfile: (operatorId, profileId) async {
        final store = await _db.storeOperatingState();
        final snapshot = await access.withSession(
          api,
          operatorId,
          (token) => access.prepareProfile(api, token),
          profileId: profileId,
        );
        final context = jsonObject(snapshot['context']);
        if (jsonObject(context['profile'])['id'] != profileId ||
            jsonObject(context['operator'])['id'] != operatorId) {
          throw _wrongActor;
        }
        await authority.serialize(() async {
          final current = await _db.storeOperatingState();
          if (current?.epoch != store?.epoch ||
              current?.phase != store?.phase) {
            throw const FormatException('SALE_CONTEXT_CHANGED');
          }
          await _db.saveSnapshot(profileId, snapshot);
        });
      },
      readServerSaleHistory: (operatorId, profileId, page, saleId) =>
          access.withSession(
            api,
            operatorId,
            (token) => saleId == null
                ? api.activeSalesPage(token, page!)
                : api.request(ApiEndpoint.saleById(saleId), token: token),
            profileId: profileId,
          ),
      requestCustomerDirectory: (operatorId, profileId, input) =>
          _cloudCustomerDirectory(api, operatorId, profileId, input),
      onVerified: (context, token) async {
        final profileId = jsonObject(context['profile'])['id'] as String;
        if (profileId != (await _db.installation())!.profileId) {
          final snapshot = await access.prepareProfile(
            api,
            token,
            context: context,
          );
          await authority.serialize(
            () => _db.saveSnapshot(profileId, snapshot),
          );
        }
        await access.rememberPairedSession(api, context, token);
      },
      onError: onError,
    );
    try {
      await server.start();
    } on SocketException {
      throw const PosApiError(
        409,
        'STORE_PORT_BUSY',
        'Port 8879 is unavailable.',
      );
    }
    host = server;
    _staffValidation = Timer.periodic(
      const Duration(minutes: 1),
      (_) => unawaited(_validateStaff(api)),
    );
    unawaited(_validateStaff(api));
  }

  Future<void> _validateStaff(PosApi api) async {
    if (_validatingStaff) return;
    _validatingStaff = true;
    try {
      final setup = await _db.installation();
      if (setup == null) return;
      final grants = await (_db.select(_db.storeStaffGrants).join([
        innerJoin(
          _db.storeDevices,
          _db.storeDevices.id.equalsExp(_db.storeStaffGrants.deviceId),
        ),
      ])..where(_db.storeDevices.revokedAt.isNull())).get();
      final ids = {
        for (final row in grants)
          (
            row.readTable(_db.storeStaffGrants).operatorId,
            row.readTable(_db.storeDevices).profileId ?? setup.profileId,
          ),
      };
      final refreshed = {setup.profileId};
      for (final (id, profileId) in ids) {
        try {
          final context = await access.withSession(api, id, (token) async {
            final store = await _db.storeOperatingState();
            final context = await api.request(
              ApiEndpoint.context,
              token: token,
            );
            if (jsonObject(context['profile'])['id'] != profileId ||
                jsonObject(context['operator'])['id'] != id) {
              throw _wrongActor;
            }
            if (!refreshed.contains(profileId)) {
              final snapshot = await access.prepareProfile(
                api,
                token,
                context: context,
              );
              await authority.serialize(() async {
                final current = await _db.storeOperatingState();
                if (current?.epoch == store?.epoch &&
                    current?.phase == store?.phase) {
                  await _db.saveSnapshot(profileId, snapshot);
                  refreshed.add(profileId);
                }
              });
            }
            return context;
          }, profileId: profileId);
          final actor = jsonObject(context['operator']);
          await _db.saveOperatorPermissions(profileId, actor);
          final devices = _db.selectOnly(_db.storeDevices)
            ..addColumns([_db.storeDevices.id])
            ..where(
              _db.storeDevices.profileId.equals(profileId) |
                  (profileId == setup.profileId
                      ? _db.storeDevices.profileId.isNull()
                      : const Constant(false)),
            );
          await (_db.update(_db.storeStaffGrants)..where(
                (row) =>
                    row.operatorId.equals(id) & row.deviceId.isInQuery(devices),
              ))
              .write(
                StoreStaffGrantsCompanion(
                  role: Value(actor['role'] as String),
                  displayName: Value(actor['name'] as String),
                ),
              );
        } on PosApiError catch (error) {
          if (error.transient) return;
        }
      }
    } catch (error) {
      onError?.call(error);
    } finally {
      _validatingStaff = false;
    }
  }

  Future<void> pair({
    required String code,
    required String label,
    required String operatorId,
    required String posToken,
  }) async {
    if (isTill || host != null) throw _alreadyPaired;
    final bills = await (_db.select(_db.heldBills)..limit(1)).get();
    final sales = await (_db.select(_db.localSales)..limit(1)).get();
    if (bills.isNotEmpty || sales.isNotEmpty) {
      throw const PosApiError(
        409,
        'STORE_HAS_SALES',
        'Pair a new register before recording sales.',
      );
    }
    final invitation = StoreInvitation.parse(code);
    final client = StoreClient(invitation.endpoint);
    if (_attemptCode != code) {
      _attemptCode = code;
      _attemptId = const Uuid().v4();
    }
    try {
      final reply = await client.pair(
        invitation: invitation,
        attemptId: _attemptId!,
        label: label,
        posToken: posToken,
      );
      if (reply['operator_id'] != operatorId) throw _wrongActor;
      await access.vault.write(
        key: _deviceKey,
        value: reply['device_credential'] as String,
      );
      await _saveStaff(operatorId, reply);
      await _db
          .into(_db.storeNetworkSettings)
          .insertOnConflictUpdate(
            StoreNetworkSettingsCompanion.insert(
              mode: 'till',
              endpoint: Value(client.endpoint.uri.toString()),
              fingerprint: Value(client.endpoint.fingerprint),
            ),
          );
      _till = client;
      _attemptCode = null;
      _attemptId = null;
    } catch (_) {
      client.close();
      rethrow;
    }
  }

  Future<void> enroll(String operatorId, String posToken) async {
    final device = await access.vault.read(key: _deviceKey);
    if (device == null) throw _signInRequired;
    final reply = await _till!.enroll(device, posToken);
    await _saveStaff(operatorId, reply);
  }

  Future<void> _saveStaff(String operatorId, Json reply) async {
    final profileId = reply['profile_id'];
    if (reply['operator_id'] != operatorId ||
        (profileId != null &&
            profileId != (await _db.installation())?.profileId)) {
      throw _wrongActor;
    }
    await access.vault.write(
      key: _staffKey(operatorId),
      value: reply['staff_credential'] as String,
    );
  }

  Future<
    ({
      Json? snapshot,
      List<HeldBill> bills,
      List<(LocalSale, SaleOutboxData)> sales,
    })
  >
  state(String operatorId, {bool reloadMenu = false}) async {
    final reply = await _till!.state(
      await _staff(operatorId),
      snapshotVersion: _snapshotVersion,
      reloadMenu: reloadMenu,
    );
    final snapshot = reply['snapshot'];
    if (reloadMenu && (reply['menu_reloaded'] != true || snapshot is! Map)) {
      throw const PosApiError(
        503,
        'SERVER_UPGRADE_REQUIRED',
        'Update the store register to reload menus.',
      );
    }
    if (snapshot is Map) {
      final setup = (await _db.installation())!;
      await _db.saveSnapshot(setup.profileId, jsonObject(snapshot));
    }
    _snapshotVersion = reply['snapshot_version'] as String;
    return (
      snapshot: snapshot == null ? null : jsonObject(snapshot),
      bills: jsonRows(reply['bills']).map(HeldBill.fromJson).toList(),
      sales: jsonRows(reply['sales'])
          .map(
            (row) => (
              LocalSale.fromJson(jsonObject(row['sale'])),
              SaleOutboxData.fromJson(jsonObject(row['sync'])),
            ),
          )
          .toList(),
    );
  }

  Future<Json> salesHistory(
    String operatorId, {
    int? serverPage,
    String? saleId,
  }) async => _till!.salesHistory(
    await _staff(operatorId),
    serverPage: serverPage,
    saleId: saleId,
  );

  Future<Json> customerDirectory(
    PosApi api,
    String operatorId,
    String profileId,
    Json input,
  ) async {
    final till = _till;
    if (till == null) {
      return _cloudCustomerDirectory(api, operatorId, profileId, input);
    }
    final result = await till.customerDirectory(
      await _staff(operatorId),
      input,
    );
    await _cacheCustomerResult(input, result);
    return result;
  }

  Future<Json> _cloudCustomerDirectory(
    PosApi api,
    String operatorId,
    String profileId,
    Json input,
  ) async {
    final operation = input['operation'];
    if (operation == 'groups') {
      return access.withSession(
        api,
        operatorId,
        (token) async => {
          'customer_groups': await api.pages(
            ApiEndpoint.customerGroups,
            'customer_groups',
            token,
          ),
        },
        profileId: profileId,
      );
    }
    final id = input['customer_id'];
    if (operation != 'create' &&
        (id is! String || !RegExp(r'^[a-zA-Z0-9_-]{1,80}$').hasMatch(id))) {
      throw RegisterAuthority.invalidCommand;
    }
    if (operation == 'photo') {
      return access.withSession(
        api,
        operatorId,
        (token) => api.request(
          ApiEndpoint.customerPhotoFor(id as String),
          token: token,
        ),
        profileId: profileId,
      );
    }
    final commandId = input['command_id'];
    if (commandId is! String) throw RegisterAuthority.invalidCommand;
    final (method, path) = switch (operation) {
      'create' => ('POST', ApiEndpoint.customers),
      'update' => ('PATCH', ApiEndpoint.customerFor(id as String)),
      'delete' => ('DELETE', ApiEndpoint.customerFor(id as String)),
      _ => throw RegisterAuthority.invalidCommand,
    };
    final result = await access.withSession(
      api,
      operatorId,
      (token) => api.request(
        path,
        method: method,
        token: token,
        commandId: commandId,
        body: operation == 'delete' ? {} : jsonObject(input['fields']),
      ),
      profileId: profileId,
    );
    await _cacheCustomerResult(input, result);
    return result;
  }

  Future<void> _cacheCustomerResult(Json input, Json result) async {
    if (input['operation'] == 'groups' || input['operation'] == 'photo') return;
    final deleted = input['operation'] == 'delete';
    final id = (deleted ? input['customer_id'] : result['id']) as String;
    final setup = await _db.installation();
    if (setup != null) {
      await authority.serialize(
        () => _db.cacheCustomerChange(
          setup.businessId,
          id,
          deleted ? null : result,
        ),
      );
    }
  }

  Future<void> submit(
    String operatorId,
    RegisterAction action,
    Json body,
  ) async {
    final command = await _db.transaction(() async {
      if (await _db.tillCommand(operatorId) != null) {
        throw const PosApiError(
          409,
          'STORE_COMMAND_PENDING',
          'Waiting for the store register.',
        );
      }
      final command = TillCommand(
        operatorId: operatorId,
        commandId: const Uuid().v4(),
        action: action.name,
        payload: jsonEncode(body),
      );
      await _db.into(_db.tillCommands).insert(command);
      return command;
    });
    await _send(command);
  }

  Future<Json> shiftManagement(String operatorId, Json body) async =>
      _till!.shiftManagement(await _staff(operatorId), body);

  Future<RegisterAction?> retry(String operatorId) async {
    final command = await _db.tillCommand(operatorId);
    return command == null || command.action == 'cloud_shift'
        ? null
        : _send(command, verify: true);
  }

  Future<RegisterAction> _send(
    TillCommand command, {
    bool verify = false,
  }) async {
    final action = RegisterAction.values.byName(command.action);
    final body = jsonObject(jsonDecode(command.payload));
    try {
      var found = false;
      if (verify &&
          !action.consumesCart &&
          action != RegisterAction.reverseSale) {
        try {
          found =
              (await shiftManagement(command.operatorId, {
                'kind': 'command',
                'id': command.commandId,
              }))['found'] ==
              true;
        } on PosApiError catch (error) {
          if (error.status != 404) rethrow;
        }
      }
      if (!found) {
        await _till!.command(
          staffCredential: await _staff(command.operatorId),
          id: command.commandId,
          action: action,
          body: body,
        );
      }
    } on PosApiError catch (error) {
      // A definitive rejection can be corrected. Keep ambiguous writes until acknowledged.
      if (!error.transient &&
          error.status != 401 &&
          error.status != 403 &&
          error.status != 408) {
        await _db.removeTillCommand(command.commandId);
      }
      rethrow;
    }
    await _db.acknowledgeTillCommand(
      command,
      consumeCart: action.consumesCart,
      billId: action == RegisterAction.discard
          ? body['bill_id'] as String
          : null,
    );
    return action;
  }

  Future<String> _staff(String id) async {
    final credential = await access.vault.read(key: _staffKey(id));
    if (credential == null) throw _signInRequired;
    return credential;
  }

  String _staffKey(String id) => 'emenu.pos.store.staff.$id';

  Future<List<String>> addresses() async {
    final interfaces = await NetworkInterface.list(
      type: InternetAddressType.IPv4,
      includeLoopback: true,
    );
    return {
      for (final interface in interfaces)
        for (final address in interface.addresses) address.address,
      '127.0.0.1',
    }.toList();
  }

  Future<void> close() async {
    _staffValidation?.cancel();
    _till?.close();
    await host?.close();
  }

  static const _alreadyPaired = PosApiError(
    409,
    'STORE_ALREADY_CONFIGURED',
    'This register is already configured.',
  );
  static const _wrongActor = PosApiError(
    403,
    'STORE_ACCESS_REQUIRED',
    'Sign in with the matching store account.',
  );
  static const _signInRequired = PosApiError(
    401,
    'SIGN_IN_REQUIRED',
    'Sign in with your password.',
  );
}
