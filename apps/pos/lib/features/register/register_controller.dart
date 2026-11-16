import 'dart:async';
import 'dart:convert';

import 'package:get/get.dart';
import 'package:uuid/uuid.dart';

import '../../core/cart_line.dart';
import '../../core/pos_api.dart';
import '../../core/pricing.dart';
import '../../core/register_access.dart';
import '../../core/register_authority.dart';
import '../../core/register_database.dart';
import '../../core/register_network.dart';
import '../../core/sale_sync.dart';

export '../../core/cart_line.dart' show CartLine;

enum RegisterStage { loading, activation, locked, selectProfile, ready }

class RegisterController extends GetxController {
  RegisterController(this.database, {RegisterAccess? access})
    : access = access ?? RegisterAccess(database),
      authority = RegisterAuthority(database);

  final RegisterDatabase database;
  final RegisterAccess access;
  final RegisterAuthority authority;
  late final network = RegisterNetwork(authority, access, onError: _show);
  final stage = RegisterStage.loading.obs;
  final busy = false.obs;
  final online = false.obs;
  final paired = false.obs;
  final hosting = false.obs;
  final commandPending = false.obs;
  final storeSyncHead = Rxn<StoreOperatingEvent>();
  final message = RxnString();
  final installation = Rxn<RegisterInstallation>();
  final operator = Rxn<RegisterOperator>();
  final staff = <RegisterOperator>[].obs;
  final profiles = <Json>[].obs;
  final snapshot = Rxn<Json>();
  final cart = <CartLine>[].obs;
  final tableId = RxnString();
  final customerId = RxnString();
  final tab = 0.obs;
  final pending = <(LocalSale, SaleOutboxData)>[].obs;
  final heldBills = <HeldBill>[].obs;
  final _activeBill = Rxn<({String id, int revision})>();
  final _quoteContext = Rxn<Json>();
  Future<void> _cartWrites = Future.value();
  bool _cartSaveFailed = false;

  PosApi? _api;
  SaleSync? _sync;
  StreamSubscription<List<(LocalSale, SaleOutboxData)>>? _sales;
  StreamSubscription<List<HeldBill>>? _heldSales;
  StreamSubscription<Json?>? _profileState;
  StreamSubscription<StoreOperatingEvent?>? _storeEvents;
  Timer? _refreshTimer;
  Timer? _storeTimer;
  bool _refreshing = false;
  int _operatingRevision = 0;
  PosApi? _setupApi;
  String? _discovery;
  String? _setupEmail;
  String? _setupSlug;

  Json get context => jsonObject(snapshot.value!['context']);
  Json get operatingContext =>
      registerOperatingContext(context, DateTime.now());
  bool get storeOperations =>
      snapshot.value != null && context['store_operations'] == true;
  bool get storeAuthorityPending =>
      snapshot.value != null && context['store_authority_pending'] == true;
  Json get config => jsonObject(jsonObject(context['profile'])['config']);
  Json get _quoted => _quoteContext.value ?? context;
  Json get quoteConfig => jsonObject(jsonObject(_quoted['profile'])['config']);
  Json get business => jsonObject(_quoted['business']);
  String get currency => business['currency'] as String;
  String get exchangeRate => business['secondary_exchange_rate'].toString();
  List<Json> get products =>
      jsonRows(jsonObject(snapshot.value!['catalog'])['products']);
  List<Json> get tables => jsonRows(snapshot.value!['tables']);
  List<Json> get customers => jsonRows(snapshot.value!['customers']);
  List<Json> get paymentTypes => jsonRows(context['payment_types']);
  List<Json> get quotePaymentTypes => jsonRows(_quoted['payment_types']);
  bool get canManageStaffUsernames =>
      (operator.value?.role == 'owner' || operator.value?.role == 'manager') &&
      (context['capabilities'] as Map?)?['staff_usernames'] == true;

  @override
  void onInit() {
    super.onInit();
    unawaited(initializeRegister());
    _storeEvents = database.watchStoreEventHead().listen(
      (event) => storeSyncHead.value = event,
      onError: (Object error) => _show(error),
    );
    _refreshTimer = Timer.periodic(const Duration(seconds: 45), (_) {
      if (!paired.value && stage.value == RegisterStage.ready && !busy.value) {
        unawaited(refreshRegister());
      }
    });
    _storeTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (paired.value && stage.value == RegisterStage.ready && !busy.value) {
        unawaited(refreshRegister());
      }
    });
  }

  Future<void> initializeRegister() => run(() async {
    installation.value = await database.installation();
    staff.assignAll(await database.operators());
    final setup = installation.value;
    if (setup == null) {
      stage.value = RegisterStage.activation;
    } else {
      await _connect(setup.apiOrigin);
      stage.value = RegisterStage.locked;
    }
  });

  Future<void> _connect(String origin) async {
    final api = _api ??= PosApi(origin);
    await network.restore(api);
    paired.value = network.isTill;
    hosting.value = network.host != null;
    if (!network.isTill) {
      _watchLocalProfile(installation.value!.profileId);
      _sync ??= SaleSync(
        database,
        api,
        (id, profileId, operation) =>
            access.withSession(api, id, operation, profileId: profileId),
        onError: _show,
      )..start();
    }
  }

  void _watchLocalProfile(String profileId) {
    _sales ??= database.watchSales(profileId: profileId).listen((sales) {
      if (!paired.value) pending.assignAll(sales);
    }, onError: _show);
    _heldSales ??= database.watchHeldBills(profileId: profileId).listen((
      bills,
    ) {
      if (!paired.value) heldBills.assignAll(bills);
    }, onError: _show);
    _profileState ??= database.watchSnapshot(profileId).listen((state) {
      final existing = snapshot.value;
      if (!paired.value &&
          state != null &&
          existing != null &&
          jsonEncode(existing['context']) != jsonEncode(state['context'])) {
        snapshot.value = state;
      }
    }, onError: _show);
  }

  void _show(Object error) {
    message.value = switch (error) {
      PosApiError() => error.code,
      FormatException() => error.message,
      _ => 'LOCAL_ERROR',
    };
  }

  Future<void> run(Future<void> Function() action) async {
    if (busy.value) return;
    busy.value = true;
    message.value = null;
    try {
      await action();
    } catch (error) {
      _show(error);
    } finally {
      busy.value = false;
    }
  }

  Future<void> signIn(
    String origin,
    String slug,
    String identifier,
    String password,
  ) => run(() async {
    final account = identifier.trim();
    if (slug.trim().isEmpty || account.isEmpty || password.isEmpty) {
      throw const FormatException('FILL_SIGN_IN');
    }
    final setup = installation.value;
    final username = account.contains('@') ? null : account;
    if (setup == null && username != null) {
      throw const FormatException('OWNER_REQUIRED');
    }
    final api = PosApi(setup?.apiOrigin ?? origin);
    try {
      final email = username == null
          ? account
          : await access.resolveStaffEmail(api, username);
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
      final available = await api.pages('/profiles', 'profiles', token);
      profiles.assignAll(
        available.where(
          (profile) =>
              setup == null ||
              (profile['id'] == setup.profileId &&
                  profile['branch_id'] == setup.branchId),
        ),
      );
      if (profiles.isEmpty) {
        throw const PosApiError(
          403,
          'NO_PROFILES',
          'No available POS profile.',
        );
      }
      _setupApi?.close();
      _setupApi = api;
      _setupEmail = email;
      _setupSlug = slug.trim();
      _discovery = token;
      stage.value = RegisterStage.selectProfile;
    } catch (_) {
      api.close();
      rethrow;
    }
  });

  Future<List<Json>?> loadStaffUsernames() async {
    List<Json>? rows;
    await run(() async {
      final api = _api!;
      rows = await access.withSession(
        api,
        operator.value!.id,
        (token) => api.pages('/staff', 'staff', token),
      );
    });
    return rows;
  }

  Future<Json?> setStaffUsername(String id, String input) async {
    Json? saved;
    await run(() async {
      final api = _api!;
      final username = input.trim();
      final commandId = const Uuid().v4();
      saved = await access.withSession(
        api,
        operator.value!.id,
        (token) => api.request(
          '/staff/$id/username',
          method: 'PUT',
          token: token,
          commandId: commandId,
          body: {'username': username.isEmpty ? null : username},
        ),
      );
      message.value = 'POS_USERNAME_SAVED';
    });
    return saved;
  }

  Future<void> selectProfile(String profileId, String pin, String confirmPin) =>
      run(() async {
        if (pin != confirmPin || !RegExp(r'^\d{6}$').hasMatch(pin)) {
          throw const FormatException('PIN_MATCH');
        }
        final api = _setupApi!;
        final login = _discovery!;
        final session = await api.startSession(login, profileId);
        final token = session['token'] as String;
        try {
          final isTill = network.isTill;
          final data = isTill
              ? {'context': await api.request('/context', token: token)}
              : await access.prepareProfile(api, token);
          final operatorId =
              jsonObject(jsonObject(data['context'])['operator'])['id']
                  as String;
          if (isTill) await network.enroll(operatorId, token);
          await access.enroll(
            api: api,
            slug: _setupSlug!,
            email: _setupEmail!,
            pin: pin,
            session: session,
            snapshot: data,
            updateSnapshot: !isTill,
          );
          installation.value = await database.installation();
          staff.assignAll(await database.operators());
          operator.value = await database.operatorById(operatorId);
          snapshot.value = await database.readSnapshot(
            installation.value!.profileId,
          );
          if (snapshot.value == null) {
            throw const PosApiError(
              409,
              'SYNC_REQUIRED',
              'Load the store profile.',
            );
          }
          online.value = !isTill;
          await _connect(api.origin.toString());
          if (isTill) await refreshRegister();
          await _loadCart(operator.value!);
          tab.value = _initialTab();
          stage.value = RegisterStage.ready;
        } catch (_) {
          unawaited(_logout(api, token));
          rethrow;
        }
        await _logout(api, login);
        api.close();
        _setupApi = null;
        _discovery = null;
      });

  Future<void> _logout(PosApi api, String token) async {
    try {
      await api.request('/sessions/current', method: 'DELETE', token: token);
    } on PosApiError {
      // Short-lived discovery tokens expire if logout cannot reach the server.
    }
  }

  void cancelSignIn() {
    _setupApi?.close();
    _setupApi = null;
    _discovery = null;
    message.value = null;
    stage.value = installation.value == null
        ? RegisterStage.activation
        : RegisterStage.locked;
  }

  Future<void> unlock(String operatorId, String pin) => run(() async {
    final current = await access.unlock(operatorId, pin);
    final cached = await database.readSnapshot(installation.value!.profileId);
    if (cached == null) {
      throw const PosApiError(
        409,
        'SYNC_REQUIRED',
        'Sign in online to load the profile.',
      );
    }
    operator.value = current;
    snapshot.value = cached;
    await _loadCart(current);
    tab.value = _initialTab();
    stage.value = RegisterStage.ready;
    unawaited(refreshRegister());
  });

  int _initialTab() {
    final needsDay =
        config['working_day_enabled'] == true && context['working_day'] == null;
    final needsShift =
        config['cashier_shift_enabled'] == true &&
        context['cashier_shift'] == null;
    return needsDay || needsShift ? 2 : 0;
  }

  Future<void> lock() => run(() async {
    await _flushCart();
    _clearCart();
    tab.value = 0;
    operator.value = null;
    commandPending.value = false;
    message.value = null;
    stage.value = RegisterStage.locked;
  });

  void _clearCart() {
    cart.clear();
    tableId.value = null;
    customerId.value = null;
    _activeBill.value = null;
    _quoteContext.value = null;
  }

  bool get cartEditable => !commandPending.value && !busy.value;

  bool get hasCartDraft =>
      cart.isNotEmpty ||
      _activeBill.value != null ||
      tableId.value != null ||
      customerId.value != null;

  Future<void> _loadCart(RegisterOperator actor) async {
    final profileId = installation.value!.profileId;
    final (draft, waiting) = await database.transaction(
      () async => (
        await database.cartDraft(actor.id, profileId),
        await database.tillCommand(actor.id) != null,
      ),
    );
    if (!identical(operator.value, actor)) return;
    _clearCart();
    _cartSaveFailed = false;
    commandPending.value = waiting;
    if (draft == null) return;
    final saved = jsonObject(jsonDecode(draft.payload));
    final quote = saved['quote_context'];
    _quoteContext.value = quote == null ? null : jsonObject(quote);
    tableId.value = saved['table_id'] as String?;
    customerId.value = saved['customer_id'] as String?;
    if (draft.billId case final String id) {
      _activeBill.value = (id: id, revision: saved['bill_revision'] as int);
    }
    cart.assignAll(jsonRows(saved['lines']).map(CartLine.fromHeldSnapshot));
  }

  void _saveCart() {
    final actor = operator.value;
    final setup = installation.value;
    if (actor == null || setup == null) return;
    final bill = _activeBill.value;
    final payload = hasCartDraft
        ? jsonEncode({
            'bill_revision': bill?.revision,
            'quote_context': _quoteContext.value,
            'table_id': tableId.value,
            'customer_id': customerId.value,
            'lines': cart.map((line) => line.heldSnapshot).toList(),
          })
        : null;
    _cartWrites = _cartWrites.then((_) async {
      try {
        if (payload == null) {
          await database.removeCartDraft(actor.id, setup.profileId);
        } else {
          await database.saveCartDraft(
            operatorId: actor.id,
            profileId: setup.profileId,
            billId: bill?.id,
            payload: payload,
          );
        }
        _cartSaveFailed = false;
      } catch (_) {
        _cartSaveFailed = true;
        message.value = 'CART_SAVE_FAILED';
      }
    });
  }

  Future<void> _flushCart() async {
    await _cartWrites;
    if (!_cartSaveFailed) return;
    _saveCart();
    await _cartWrites;
    if (_cartSaveFailed) throw const FormatException('CART_SAVE_FAILED');
  }

  void selectTable(String? id) {
    if (!cartEditable) return;
    tableId.value = id;
    _saveCart();
  }

  void selectCustomer(String? id) {
    if (!cartEditable) return;
    customerId.value = id;
    _saveCart();
  }

  Future<void> discardCart() => run(() async {
    if (commandPending.value) {
      throw const FormatException('STORE_COMMAND_PENDING');
    }
    await _cartWrites;
    await database.removeCartDraft(
      operator.value!.id,
      installation.value!.profileId,
    );
    _clearCart();
    _cartSaveFailed = false;
  });

  Future<void> refreshRegister() async {
    final active = operator.value;
    if (_refreshing || active == null || _api == null) return;
    _refreshing = true;
    try {
      if (network.isTill) {
        if (!busy.value && commandPending.value) {
          final resumed = await network.retry(active.id);
          if ((resumed == null || resumed.consumesCart) &&
              identical(operator.value, active)) {
            await _loadCart(active);
          }
          if (identical(operator.value, active)) {
            commandPending.value = false;
            message.value = switch (resumed) {
              RegisterAction.hold => 'BILL_HELD',
              RegisterAction.checkout => 'SAVED',
              RegisterAction.reverseSale => 'REVERSAL_SAVED',
              _ => message.value,
            };
          }
        }
        final state = await network.state(active.id);
        if (operator.value?.id == active.id) {
          if (state.snapshot != null) snapshot.value = state.snapshot;
          heldBills.assignAll(state.bills);
          pending.assignAll(state.sales);
          online.value = true;
        }
        return;
      }
      final revision = _operatingRevision;
      final api = _api!;
      final data = await access.withSession(
        api,
        active.id,
        (token) => access.prepareProfile(api, token),
      );
      await access.adoptDeviceSession(
        api,
        active.id,
        jsonObject(data['context']),
      );
      await authority.serialize(() async {
        if (_operatingRevision != revision || network.isTill) return;
        final effective = await database.saveSnapshot(
          installation.value!.profileId,
          data,
        );
        if (operator.value?.id == active.id) {
          snapshot.value = effective;
          online.value = true;
        }
      });
    } on PosApiError catch (error) {
      online.value = false;
      if (network.isTill && operator.value?.id == active.id) {
        commandPending.value = await database.tillCommand(active.id) != null;
      }
      if (!error.transient) _show(error);
    } catch (error) {
      _show(error);
    } finally {
      _refreshing = false;
    }
  }

  Future<void> enableStoreHost() => run(() async {
    _requireOwner();
    await network.enableHost(_api!);
    hosting.value = true;
  });

  Future<void> pairStore(String code, String label) => run(() async {
    _requireOwner();
    if (hasCartDraft) throw const FormatException('HOLD_CURRENT_BILL');
    final actor = operator.value!;
    final token = await access.passwordSessionForOperator(actor.id);
    if (token == null) {
      throw const PosApiError(
        401,
        'SIGN_IN_REQUIRED',
        'Sign in with your password.',
      );
    }
    await network.pair(
      code: code,
      label: label,
      operatorId: actor.id,
      posToken: token,
    );
    paired.value = true;
    online.value = false;
    await _sync?.close();
    _sync = null;
    await refreshRegister();
  });

  Future<void> revokeStoreDevice(String id) => run(() async {
    _requireOwner();
    await network.host!.revoke(id);
  });

  Future<void> enableOfflineOperations() => run(() async {
    _requireOwner();
    if (network.host == null) throw const FormatException('USE_STORE_REGISTER');
    final api = _api!;
    final actor = operator.value!.id;
    final freshSnapshot = await access.withSession(
      api,
      actor,
      (token) => access.prepareProfile(api, token),
    );
    final fresh = jsonObject(freshSnapshot['context']);
    if ((fresh['capabilities'] as Map?)?['store_operations'] != true) {
      throw const PosApiError(
        503,
        'SERVER_UPGRADE_REQUIRED',
        'Update the POS Worker.',
      );
    }
    await access.adoptDeviceSession(api, actor, fresh);
    await authority.serialize(() async {
      final profileId = installation.value!.profileId;
      final store = await database.storeOperatingState();
      if (store?.phase == 'active') return;
      if (store?.phase == 'releasing') {
        throw const FormatException('STORE_AUTHORITY_PENDING');
      }
      if (cart.isNotEmpty ||
          (await database.watchHeldBills().first).isNotEmpty ||
          await database.hasUnsentSales()) {
        throw const FormatException('STORE_SYNC_FIRST');
      }
      _operatingRevision++;
      await database.saveSnapshot(profileId, freshSnapshot);
      await database.prepareStoreClaim(
        jsonObject(fresh['business'])['timezone'] as String,
      );
      snapshot.value = await database.readSnapshot(profileId);
      final Json authorityResult;
      try {
        authorityResult = await access.withSession(
          api,
          actor,
          (token) => api.request(
            '/store-authority',
            method: 'POST',
            token: token,
            body: {},
          ),
        );
      } on PosApiError catch (error) {
        if (error.code == 'STORE_BRANCH_BUSY' ||
            error.code == 'STORE_OWNER_REQUIRED') {
          await database.releaseStoreAuthority();
          snapshot.value = await database.saveSnapshot(
            profileId,
            freshSnapshot,
          );
        }
        rethrow;
      }
      if (authorityResult['last_sequence'] != 0) {
        throw const FormatException('RESTORE_STORE_DATA');
      }
      await database.startStoreAuthority(
        authorityResult['epoch'] as String,
        authorityResult['timezone'] as String,
      );
      snapshot.value = await database.readSnapshot(profileId);
    });
  });

  Future<void> releaseOfflineOperations() => run(() async {
    _requireOwner();
    final api = _api!;
    await authority.serialize(() async {
      final store = await database.storeOperatingState();
      if (store == null || store.epoch.isEmpty) return;
      if (await database.nextStoreEvent() != null ||
          (await database.watchHeldBills().first).isNotEmpty ||
          await database.storeHasOpenActivity(store)) {
        throw const FormatException('STORE_SYNC_FIRST');
      }
      final profileId = installation.value!.profileId;
      _operatingRevision++;
      await database.setStorePhase('releasing');
      snapshot.value = await database.readSnapshot(profileId);
      await access.withSession(
        api,
        operator.value!.id,
        (token) => api.request(
          '/store-authority',
          method: 'DELETE',
          token: token,
          body: {'epoch': store.epoch, 'last_sequence': store.sequence},
        ),
      );
      await database.releaseStoreAuthority();
      snapshot.value = await database.readSnapshot(profileId);
    });
    await refreshRegister();
  });

  Future<void> retryStoreSync() => run(() async {
    await database.retryStoreEvent();
    unawaited(_sync?.wake());
  });

  bool canApproveStoreSync(StoreOperatingEvent event) =>
      hosting.value &&
      operator.value?.role == 'owner' &&
      (context['capabilities'] as Map?)?['store_recovery'] == true &&
      event.canApproveRecovery;

  Future<void> approveStoreSync(StoreOperatingEvent event, String reason) =>
      run(() async {
        if (!canApproveStoreSync(event)) {
          throw const FormatException('STORE_RECOVERY_CHANGED');
        }
        await database.approveStoreRecovery(
          event.commandId,
          operator.value!.id,
          reason,
        );
        unawaited(_sync?.wake());
      });

  void _requireOwner() {
    if (operator.value?.role != 'owner') {
      throw const PosApiError(
        403,
        'OWNER_REQUIRED',
        'Sign in as the business owner.',
      );
    }
  }

  BillTotals totalOf(CartLine line) => line.totals(quoteConfig);

  int get cartTotal =>
      cart.fold(0, (total, line) => total + totalOf(line).total);

  Future<void> operation(String path, Json body) => run(() async {
    if (storeAuthorityPending) {
      throw const FormatException('STORE_AUTHORITY_PENDING');
    }
    if (storeOperations) {
      final parts = path.split('/');
      final (action, payload) = switch (parts) {
        ['', 'working-days'] => (RegisterAction.openDay, body),
        ['', 'working-days', final id, 'close'] => (
          RegisterAction.closeDay,
          {...body, 'day_id': id},
        ),
        ['', 'cashier-shifts'] => (RegisterAction.openShift, body),
        ['', 'cashier-shifts', final id, 'close'] => (
          RegisterAction.closeShift,
          {...body, 'shift_id': id},
        ),
        ['', 'cashier-shifts', final id, 'cash-floats'] => (
          RegisterAction.cashMovement,
          {...body, 'shift_id': id},
        ),
        _ => throw RegisterAuthority.invalidCommand,
      };
      await _sendCommand(action, payload);
      await _refreshAfterStoreOperation();
      unawaited(_sync?.wake());
      return;
    }
    if (network.isTill) throw const FormatException('USE_STORE_REGISTER');
    final operatorId = operator.value!.id;
    final api = _api!;
    await authority.serialize(() async {
      final parts = path.split('/');
      final day = parts[1] == 'working-days';
      final contextKey = day ? 'working_day' : 'cashier_shift';
      final opening = parts.length == 2;
      final closing = parts.length == 4 && parts.last == 'close';
      final profile = installation.value!.profileId;
      if (closing) {
        final id = parts[2];
        final key = day ? 'working_day_id' : 'shift_id';
        if (await database.hasUnsyncedSales(profile, key, id)) {
          throw FormatException(
            day ? 'UNSYNCED_DAY_SALES' : 'UNSYNCED_SHIFT_SALES',
          );
        }
        if (day && await database.hasHeldBillsOnDay(id, profileId: profile)) {
          throw const FormatException('WORKING_DAY_HAS_ACTIVITY');
        }
      }
      final commandId = const Uuid().v4();
      final serverBody = {...body}..remove('day_id');
      final result = await access.withSession(
        api,
        operatorId,
        (token) => api.request(
          path,
          method: 'POST',
          token: token,
          commandId: commandId,
          body: serverBody,
        ),
      );
      if (opening || closing) {
        final next = {
          ...snapshot.value!,
          'context': {...context, contextKey: closing ? null : result},
        };
        _operatingRevision++;
        await database.saveSnapshot(profile, next);
        snapshot.value = next;
      }
    });
    await refreshRegister();
  });

  Future<Json?> shiftPreview(String shiftId) async {
    if (storeOperations) {
      final shift = context['cashier_shift'] as Map?;
      if (shift?['id'] != shiftId) {
        message.value = 'SALE_CONTEXT_CHANGED';
        return null;
      }
      return jsonObject(shift);
    }
    Json? preview;
    await run(() async {
      if (network.isTill) throw const FormatException('USE_STORE_REGISTER');
      final api = _api!;
      preview = await access.withSession(
        api,
        operator.value!.id,
        (token) => api.request(
          '/cashier-shifts/$shiftId/reconciliation',
          token: token,
        ),
      );
    });
    return preview;
  }

  bool hasUnsentSales(String contextKey, String id) {
    for (final (sale, job) in pending) {
      if (job.status == 'synced') continue;
      final request = jsonObject(jsonDecode(sale.request));
      final draft = jsonObject(request['draft']);
      if (jsonObject(draft['expected_context'])[contextKey] == id) return true;
    }
    return false;
  }

  bool isHeldTable(String id) => heldBills.any(
    (bill) => bill.tableId == id && bill.id != _activeBill.value?.id,
  );

  Future<void> holdCart() => run(() async {
    await _flushCart();
    await _sendCommand(RegisterAction.hold, _cartCommand());
    _clearCart();
    message.value = 'BILL_HELD';
  });

  void resumeBill(HeldBill bill) {
    if (!cartEditable) return;
    if (hasCartDraft) {
      message.value = 'HOLD_CURRENT_BILL';
      return;
    }
    final saved = jsonObject(jsonDecode(bill.payload));
    _quoteContext.value = jsonObject(saved['quote_context']);
    tableId.value = bill.tableId;
    customerId.value = saved['customer_id'] as String?;
    _activeBill.value = (id: bill.id, revision: bill.revision);
    cart.assignAll(jsonRows(saved['lines']).map(CartLine.fromHeldSnapshot));
    message.value = null;
    tab.value = 0;
    _saveCart();
  }

  Future<void> discardBill(HeldBill bill) => run(() async {
    await _flushCart();
    await _sendCommand(RegisterAction.discard, {
      'bill_id': bill.id,
      'bill_revision': bill.revision,
    });
    if (_activeBill.value?.id == bill.id) _clearCart();
  });

  void add(CartLine line) {
    if (!cartEditable) return;
    try {
      if (cart.isEmpty && _activeBill.value == null) {
        final current = context;
        _quoteContext.value = {
          'profile': current['profile'],
          'business': current['business'],
          'payment_types': current['payment_types'],
        };
      }
      totalOf(line);
      final modifierIds = line.modifiers.map((item) => item['id']).toSet();
      final index = cart.indexWhere(
        (saved) =>
            saved.product['id'] == line.product['id'] &&
            saved.portion?['id'] == line.portion?['id'] &&
            saved.unit == line.unit &&
            saved.quantity + line.quantity <= 999 &&
            saved.modifiers.length == line.modifiers.length &&
            saved.modifiers.every((item) => modifierIds.contains(item['id'])),
      );
      if (index >= 0) {
        final updated = cart[index].withQuantity(
          cart[index].quantity + line.quantity,
        );
        totalOf(updated);
        cart[index] = updated;
        _saveCart();
        return;
      }
      if (cart.length >= 60) throw const FormatException('CART_LIMIT');
      cart.add(line);
      _saveCart();
    } catch (error) {
      if (cart.isEmpty && _activeBill.value == null) _quoteContext.value = null;
      _show(error);
    }
  }

  void quantity(int index, int amount) {
    if (!cartEditable || index < 0 || index >= cart.length) return;
    if (amount <= 0) {
      cart.removeAt(index);
      if (cart.isEmpty && _activeBill.value == null) _quoteContext.value = null;
      _saveCart();
    } else if (amount <= 999) {
      try {
        final next = cart[index].withQuantity(amount);
        totalOf(next);
        cart[index] = next;
        _saveCart();
      } catch (error) {
        _show(error);
      }
    }
  }

  Future<void> checkout(List<Json> payments) => run(() async {
    await _flushCart();
    await _sendCommand(RegisterAction.checkout, {
      ..._cartCommand(),
      'payments': payments,
    });
    _clearCart();
    message.value = 'SAVED';
    if (storeOperations) await _refreshAfterStoreOperation();
    unawaited(_sync?.wake());
  });

  bool canReverseSale(LocalSale sale) {
    final role = operator.value?.role;
    return (role == 'owner' || role == 'manager') &&
        (context['capabilities'] as Map?)?['reversal_context_guard'] == true &&
        !busy.value &&
        !commandPending.value &&
        !storeAuthorityPending &&
        context['read_only'] != true &&
        sale.reversesSaleId == null &&
        sale.total >= 0 &&
        !pending.any((row) => row.$1.reversesSaleId == sale.id) &&
        (storeOperations
            ? (!paired.value || online.value)
            : (!paired.value && online.value && sale.settlement != null));
  }

  Future<void> reverseSale(
    LocalSale sale,
    String reason,
    Json expectedContext,
  ) async {
    if (!canReverseSale(sale)) {
      message.value = 'SALE_NOT_REVERSIBLE';
      return;
    }
    await run(() async {
      if (!storeOperations) {
        final api = _api!;
        final saved = jsonObject(jsonDecode(sale.settlement!));
        final original = await access.withSession(
          api,
          operator.value!.id,
          (token) => api.request('/sales/${saved['id']}', token: token),
        );
        if (original['reversed_by_sale_id'] != null) {
          throw const PosApiError(
            409,
            'SALE_ALREADY_REVERSED',
            'This sale already has a reversal.',
          );
        }
      }
      await _sendCommand(RegisterAction.reverseSale, {
        'sale_id': sale.id,
        'reason': reason,
        'expected_context': expectedContext,
      });
      if (storeOperations) {
        await _refreshAfterStoreOperation();
        message.value = 'REVERSAL_SAVED';
      } else {
        message.value = 'REVERSAL_QUEUED';
      }
      unawaited(_sync?.wake());
    });
  }

  Future<void> _refreshAfterStoreOperation() async {
    if (network.isTill) {
      await refreshRegister();
    } else {
      snapshot.value = await database.readSnapshot(
        installation.value!.profileId,
      );
    }
  }

  Json _cartCommand() => {
    'bill_id': _activeBill.value?.id,
    'bill_revision': _activeBill.value?.revision,
    'table_id': quoteConfig['table_mode'] == 'disabled' ? null : tableId.value,
    'customer_id': customerId.value,
    'currency': currency,
    'exchange_rate': exchangeRate,
    'total_minor': cartTotal,
    'quote': cart.map((line) => line.quote(quoteConfig)).toList(),
    'expected_context': operatingContext,
  };

  Future<void> _sendCommand(RegisterAction action, Json body) async {
    final operatorId = operator.value!.id;
    if (network.isTill) {
      try {
        await network.submit(operatorId, action, body);
      } finally {
        commandPending.value = await database.tillCommand(operatorId) != null;
      }
      return;
    }
    await authority.execute(
      commandId: const Uuid().v4(),
      operatorId: operatorId,
      action: action,
      body: body,
      consumeLocalCart: true,
    );
  }

  @override
  void onClose() {
    _refreshTimer?.cancel();
    _storeTimer?.cancel();
    unawaited(_sales?.cancel());
    unawaited(_heldSales?.cancel());
    unawaited(_profileState?.cancel());
    unawaited(_storeEvents?.cancel());
    unawaited(_disconnect());
    _setupApi?.close();
    super.onClose();
  }

  Future<void> _disconnect() async {
    await network.close();
    await _sync?.close();
    _api?.close();
  }
}
