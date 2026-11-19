import 'dart:async';
import 'dart:convert';

import 'package:get/get.dart';
import 'package:uuid/uuid.dart';

import '../sales/sale/cart_line.dart';
import '../sales/sale/sale_service.dart';
import '../sales/sales_register.dart';
import '../../core/api_endpoint.dart';
import '../../core/pos_api.dart';
import '../../core/pricing.dart';
import '../../core/register_access.dart';
import '../../core/register_authority.dart';
import '../../core/register_database.dart';
import '../../core/register_network.dart';
import '../../core/register_shift_reports.dart';
import '../../global.dart';
import '../sales/sale/sale_sync.dart';

export '../sales/sale/cart_line.dart' show CartLine;

enum RegisterStage { loading, activation, locked, selectProfile, ready }

class RegisterController extends GetxController implements SalesRegister {
  RegisterController(this.database, {RegisterAccess? access})
    : access = access ?? RegisterAccess(database),
      authority = RegisterAuthority(database);

  @override
  final RegisterDatabase database;
  @override
  final RegisterAccess access;
  final RegisterAuthority authority;
  late final network = RegisterNetwork(authority, access, onError: showError);
  final stage = RegisterStage.loading.obs;
  @override
  final busy = false.obs;
  @override
  final online = false.obs;
  @override
  final paired = false.obs;
  final hosting = false.obs;
  @override
  final commandPending = false.obs;
  final storeSyncHead = Rxn<StoreOperatingEvent>();
  final shiftRefreshRevision = 0.obs;
  @override
  final message = RxnString();
  @override
  final installation = Rxn<RegisterInstallation>();
  @override
  final operator = Rxn<RegisterOperator>();
  final staff = <RegisterOperator>[].obs;
  final pinConfigured = false.obs;
  bool offerPinSetup = false;
  @override
  final snapshot = Rxn<Json>();
  static const sellTab = SalesRegister.sellTab,
      historyTab = 1,
      shiftTab = 2,
      tablesTab = SalesRegister.tablesTab,
      profileTab = 4,
      customersTab = 5;
  @override
  final tab = sellTab.obs;
  @override
  final pending = <(LocalSale, SaleOutboxData)>[].obs;
  @override
  final heldBills = <HeldBill>[].obs;

  // Shared register entry points keep existing shift, access and device flows
  // using the same sales state as the GetX sales feature.
  late final sales = SaleService(this);
  @override
  PosApi get api => _api!;
  @override
  void wakeSaleSync() => unawaited(_sync?.wake());
  RxList<CartLine> get cart => sales.cart;
  RxnString get tableId => sales.tableId;
  RxnString get tableGroupId => sales.tableGroupId;
  RxnInt get guestCover => sales.guestCover;
  RxnString get customerId => sales.customerId;
  Json get quoteConfig => sales.quoteConfig;
  Json get business => sales.business;
  String get currency => sales.currency;
  String get exchangeRate => sales.exchangeRate;
  List<Json> get quotePaymentTypes => sales.quotePaymentTypes;
  String get tableMode => sales.tableMode;
  bool get cartEditable => sales.cartEditable;
  bool get supportsCartLineEdits => sales.supportsCartLineEdits;
  bool get hasCartDraft => sales.hasCartDraft;
  bool get promptGuestCover => sales.promptGuestCover;
  BillTotals totalOf(CartLine line) => sales.totalOf(line);
  int get cartTotal => sales.cartTotal;
  void selectTable(String? id, {int? cover}) =>
      sales.selectTable(id, cover: cover);
  Future<void> openTable(String id, {int? cover}) =>
      sales.openTable(id, cover: cover);
  bool hasParkedTable(String id) => sales.hasParkedTable(id);
  bool canAssignTable(String id) => sales.canAssignTable(id);
  String tableStatus(Json table) => sales.tableStatus(table);
  void selectCustomer(String? id) => sales.selectCustomer(id);
  Future<void> discardCart() => sales.discardCart();
  bool isHeldTable(String id) => sales.isHeldTable(id);
  Future<bool> holdCart({String tableStatus = 'hold'}) =>
      sales.holdCart(tableStatus: tableStatus);
  void openHeldBillFromHistory(HeldBill bill) =>
      sales.openHeldBillFromHistory(bill);
  void resumeBill(HeldBill bill) => sales.resumeBill(bill);
  Future<void> discardBill(HeldBill bill) => sales.discardBill(bill);
  void add(CartLine line) => sales.add(line);
  void quantity(int index, int amount) => sales.quantity(index, amount);
  CartLine? replaceCartLine(CartLine original, CartLine replacement) =>
      sales.replaceCartLine(original, replacement);
  void reorderCartLine(CartLine line) => sales.reorderCartLine(line);
  Json? cartCatalogProduct(CartLine line) => sales.cartCatalogProduct(line);
  Future<void> checkout(List<Json> payments) => sales.checkout(payments);
  bool canReverseSale(LocalSale sale) => sales.canReverseSale(sale);
  Future<void> reverseSale(
    LocalSale sale,
    String reason,
    Json expectedContext,
  ) => sales.reverseSale(sale, reason, expectedContext);

  PosApi? _api;
  SaleSync? _sync;
  StreamSubscription<List<(LocalSale, SaleOutboxData)>>? _sales;
  StreamSubscription<List<HeldBill>>? _heldSales;
  StreamSubscription<Json?>? _profileState;
  StreamSubscription<StoreOperatingEvent?>? _storeEvents;
  Timer? _refreshTimer;
  Timer? _storeTimer;
  bool _refreshing = false;
  Completer<void>? _refreshFinished;
  int _operatingRevision = 0;

  @override
  Json get context => jsonObject(snapshot.value!['context']);
  @override
  Json get operatingContext =>
      registerOperatingContext(context, DateTime.now());
  @override
  bool get storeOperations =>
      snapshot.value != null && context['store_operations'] == true;
  @override
  bool get storeAuthorityPending =>
      snapshot.value != null && context['store_authority_pending'] == true;
  bool get supportsShiftManagement =>
      (context['capabilities'] as Map?)?['shift_management'] == true;
  bool get supportsStoreShiftManagement =>
      storeOperations &&
      (!paired.value || context['store_shift_management'] == true);
  @override
  Json get config => jsonObject(jsonObject(context['profile'])['config']);
  @override
  List<Json> get products => sales.products;
  @override
  List<Json> get tables => jsonRows(snapshot.value!['tables']);
  @override
  List<Json> get customers => jsonRows(snapshot.value!['customers']);
  List<Json> get paymentTypes => jsonRows(context['payment_types']);
  bool get canManageStaffUsernames =>
      (operator.value?.role == 'owner' || operator.value?.role == 'manager') &&
      (context['capabilities'] as Map?)?['staff_usernames'] == true;

  @override
  void onInit() {
    super.onInit();
    _storeEvents = database.watchStoreEventHead().listen(
      (event) => storeSyncHead.value = event,
      onError: (Object error) => showError(error),
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

  @override
  void onReady() {
    super.onReady();
    unawaited(initializeRegister());
  }

  Future<void> initializeRegister() => run(() async {
    installation.value = await database.installation();
    await sales.loadScreenSettings();
    await refreshPinStaff();
    final setup = installation.value;
    if (setup == null) {
      stage.value = RegisterStage.activation;
    } else {
      await connectToApi(setup.apiOrigin);
      stage.value = RegisterStage.locked;
    }
  });

  Future<void> connectToApi(String origin) async {
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
        onError: showError,
      )..start();
    }
  }

  void _watchLocalProfile(String profileId) {
    _sales ??= database.watchSales(profileId: profileId).listen((sales) {
      if (!paired.value) pending.assignAll(sales);
    }, onError: showError);
    _heldSales ??= database.watchHeldBills(profileId: profileId).listen((
      bills,
    ) {
      if (!paired.value) heldBills.assignAll(bills);
    }, onError: showError);
    _profileState ??= database.watchSnapshot(profileId).listen((state) {
      final existing = snapshot.value;
      if (!paired.value &&
          state != null &&
          existing != null &&
          (jsonEncode(existing['context']) != jsonEncode(state['context']) ||
              jsonEncode(existing['catalog']) != jsonEncode(state['catalog']) ||
              jsonEncode(existing['customers']) !=
                  jsonEncode(state['customers']))) {
        applyProfileSnapshot(state);
      }
    }, onError: showError);
  }

  @override
  void showError(Object error) {
    message.value = switch (error) {
      PosApiError() => error.code,
      FormatException() => error.message,
      _ => 'LOCAL_ERROR',
    };
  }

  @override
  Future<void> run(Future<void> Function() action) async {
    if (busy.value) return;
    busy.value = true;
    message.value = null;
    LoadingHandle? loading;
    try {
      if (!app.isLoading) loading = await app.showLoading();
      await action();
    } catch (error) {
      showError(error);
    } finally {
      loading?.close();
      busy.value = false;
    }
  }

  Future<List<Json>?> loadStaffUsernames() async {
    List<Json>? rows;
    await run(() async {
      final api = _api!;
      rows = await access.withSession(
        api,
        operator.value!.id,
        (token) => api.pages(ApiEndpoint.staff, 'staff', token),
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
          ApiEndpoint.staffUsernameFor(id),
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

  void applyProfileSnapshot(Json? state) {
    final wasRequired = snapshot.value != null && tableMode == 'required';
    snapshot.value = state;
    if (state == null || tableMode != 'required') return;
    sales.clearStaleTableSelection(clearEmpty: !wasRequired);
    if (tab.value == sellTab && (!wasRequired || tableId.value == null)) {
      tab.value = tablesTab;
    }
  }

  int get landingTab => tableMode == 'required' ? tablesTab : sellTab;

  @override
  void selectTab(int destination) {
    tab.value =
        destination == sellTab &&
            tableMode == 'required' &&
            tableId.value == null
        ? tablesTab
        : destination;
  }

  @override
  bool get needsOperatingSetup =>
      (config['working_day_enabled'] == true &&
          context['working_day'] == null) ||
      (config['cashier_shift_enabled'] == true &&
          context['cashier_shift'] == null);

  Future<void> refreshPinStaff() async {
    final eligible = <RegisterOperator>[];
    for (final actor in await database.operators()) {
      if (!actor.accessRevoked && await access.hasPin(actor.id)) {
        eligible.add(actor);
      }
    }
    staff.assignAll(eligible);
  }

  Future<bool> configurePin(String pin) async {
    var saved = false;
    await run(() async {
      await access.configurePin(operator.value!.id, pin);
      pinConfigured.value = true;
      await refreshPinStaff();
      saved = true;
    });
    return saved;
  }

  Future<void> lock() => run(() async {
    await sales.flushCart();
    sales.clearSession();
    tab.value = sellTab;
    offerPinSetup = false;
    pinConfigured.value = false;
    tableGroupId.value = null;
    operator.value = null;
    commandPending.value = false;
    message.value = null;
    stage.value = RegisterStage.locked;
  });

  Future<void> refreshRegister() async {
    final active = operator.value;
    if (_refreshing || active == null || _api == null) return;
    _refreshing = true;
    _refreshFinished = Completer<void>();
    try {
      if (network.isTill) {
        if (!busy.value && commandPending.value) {
          final pending = await database.tillCommand(active.id);
          final resumed = await network.retry(active.id);
          if ((resumed == null || resumed.consumesCart) &&
              identical(operator.value, active)) {
            await sales.loadCart(active);
          }
          if (identical(operator.value, active)) {
            commandPending.value = false;
            if (resumed == RegisterAction.hold && tableMode == 'required') {
              tab.value = tablesTab;
            }
            message.value = switch (resumed) {
              RegisterAction.hold => switch (pending == null
                  ? null
                  : jsonObjectFromString(pending.payload)['table_status']) {
                'occupied' => 'ORDER_SAVED',
                'bill_requested' => 'BILL_REQUESTED',
                _ => 'BILL_HELD',
              },
              RegisterAction.checkout => 'SAVED',
              RegisterAction.reverseSale => 'REVERSAL_SAVED',
              _ => message.value,
            };
          }
        }
        await _refreshTillProfile(active);
        return;
      }
      final pendingCommand = await database.tillCommand(active.id);
      if (pendingCommand?.action == 'cloud_shift' &&
          snapshot.value != null &&
          !storeOperations &&
          jsonObjectFromString(pendingCommand!.payload)['profile_id'] ==
              installation.value?.profileId) {
        await authority.serialize(
          () => _finishCloudShift(pendingCommand, verify: true),
        );
      }
      await _refreshCloudProfile(active);
    } on PosApiError catch (error) {
      online.value = false;
      if (network.isTill && operator.value?.id == active.id) {
        commandPending.value = await database.tillCommand(active.id) != null;
      }
      if (!error.transient) showError(error);
    } catch (error) {
      showError(error);
    } finally {
      _refreshing = false;
      _refreshFinished?.complete();
      _refreshFinished = null;
    }
  }

  @override
  Future<bool> reloadMenu() async {
    var reloaded = false;
    await run(() async {
      // Finish an older poll before fetching the current profile configuration.
      await _refreshFinished?.future;
      final active = operator.value;
      if (active == null || _api == null) {
        throw const FormatException('SIGN_IN_REQUIRED');
      }
      _refreshing = true;
      _refreshFinished = Completer<void>();
      try {
        reloaded = network.isTill
            ? await _refreshTillProfile(active, reloadMenu: true)
            : await _refreshCloudProfile(active);
        if (!reloaded) throw const FormatException('SALE_CONTEXT_CHANGED');
        message.value = 'MENU_RELOADED';
      } catch (_) {
        online.value = false;
        rethrow;
      } finally {
        _refreshing = false;
        _refreshFinished?.complete();
        _refreshFinished = null;
      }
    });
    return reloaded;
  }

  Future<bool> _refreshTillProfile(
    RegisterOperator active, {
    bool reloadMenu = false,
  }) async {
    final state = await network.state(active.id, reloadMenu: reloadMenu);
    if (operator.value?.id != active.id) return false;
    if (state.snapshot != null) applyProfileSnapshot(state.snapshot);
    heldBills.assignAll(state.bills);
    pending.assignAll(state.sales);
    online.value = true;
    shiftRefreshRevision.value++;
    return true;
  }

  Future<bool> _refreshCloudProfile(RegisterOperator active) async {
    final revision = _operatingRevision;
    final profileId = installation.value!.profileId;
    final api = _api!;
    final data = await access.withSession(
      api,
      active.id,
      (token) => access.prepareProfile(api, token),
    );
    final context = jsonObject(data['context']);
    if (jsonObject(context['profile'])['id'] != profileId ||
        jsonObject(context['operator'])['id'] != active.id) {
      throw const FormatException('WRONG_REGISTER_SESSION');
    }
    await access.adoptDeviceSession(api, active.id, context);
    return authority.serialize(() async {
      if (_operatingRevision != revision ||
          network.isTill ||
          installation.value?.profileId != profileId ||
          operator.value?.id != active.id) {
        return false;
      }
      final effective = await database.saveSnapshot(profileId, data);
      applyProfileSnapshot(effective);
      online.value = true;
      shiftRefreshRevision.value++;
      return true;
    });
  }

  Future<void> enableStoreHost() => run(() async {
    _requireOwner();
    await network.enableHost(_api!);
    hosting.value = true;
  });

  Future<void> pairStore(String code, String label) => run(() async {
    _requireOwner();
    if (hasCartDraft) throw const FormatException('HOLD_CURRENT_BILL');
    if (await database.hasPendingCloudShift()) {
      throw const FormatException('SHIFT_COMMAND_PENDING');
    }
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
    if (await database.hasPendingCloudShift()) {
      throw const FormatException('SHIFT_COMMAND_PENDING');
    }
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
      applyProfileSnapshot(await database.readSnapshot(profileId));
      final Json authorityResult;
      try {
        authorityResult = await access.withSession(
          api,
          actor,
          (token) => api.request(
            ApiEndpoint.storeAuthority,
            method: 'POST',
            token: token,
            body: {},
          ),
        );
      } on PosApiError catch (error) {
        if (error.code == 'STORE_BRANCH_BUSY' ||
            error.code == 'STORE_OWNER_REQUIRED') {
          await database.releaseStoreAuthority();
          applyProfileSnapshot(
            await database.saveSnapshot(profileId, freshSnapshot),
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
      applyProfileSnapshot(await database.readSnapshot(profileId));
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
      applyProfileSnapshot(await database.readSnapshot(profileId));
      await access.withSession(
        api,
        operator.value!.id,
        (token) => api.request(
          ApiEndpoint.storeAuthority,
          method: 'DELETE',
          token: token,
          body: {'epoch': store.epoch, 'last_sequence': store.sequence},
        ),
      );
      await database.releaseStoreAuthority();
      applyProfileSnapshot(await database.readSnapshot(profileId));
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

  Future<bool> operation(String path, Json body) async {
    var saved = false;
    await run(() async {
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
          ['', 'cashier-shifts', final id, 'reopen'] => (
            RegisterAction.reopenShift,
            {...body, 'shift_id': id},
          ),
          ['', 'cashier-shifts', final id, 'cash-floats'] => (
            RegisterAction.cashMovement,
            {...body, 'shift_id': id},
          ),
          _ => throw RegisterAuthority.invalidCommand,
        };
        await sendCommand(action, payload);
        saved = true;
        await refreshAfterStoreOperation();
        shiftRefreshRevision.value++;
        unawaited(_sync?.wake());
        return;
      }
      if (network.isTill) throw const FormatException('USE_STORE_REGISTER');
      final operatorId = operator.value!.id;
      await authority.serialize(() async {
        final parts = path.split('/');
        final day = parts[1] == 'working-days';
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
        if (await database.tillCommand(operatorId) != null) {
          throw const FormatException('SHIFT_COMMAND_PENDING');
        }
        final serverBody = {...body}..remove('day_id');
        final command = TillCommand(
          operatorId: operatorId,
          commandId: const Uuid().v4(),
          action: 'cloud_shift',
          payload: jsonEncode({
            'path': path,
            'body': serverBody,
            'profile_id': profile,
          }),
        );
        await database.into(database.tillCommands).insert(command);
        await _finishCloudShift(command);
        saved = true;
      });
      await refreshRegister();
    });
    return saved;
  }

  Future<void> _finishCloudShift(
    TillCommand command, {
    bool verify = false,
  }) async {
    final payload = jsonObjectFromString(command.payload);
    final path = payload['path'] as String;
    final profileId = payload['profile_id'] as String;
    final api = _api!;
    final operatorId = command.operatorId;
    commandPending.value = true;
    try {
      final result = await access.withSession(api, operatorId, (token) async {
        if (verify && supportsShiftManagement) {
          try {
            final status = await api.request(
              ApiEndpoint.commandStatusFor(command.commandId),
              token: token,
            );
            return jsonObject(status['result']);
          } on PosApiError catch (error) {
            if (error.status != 404) rethrow;
          }
        }
        return api.request(
          path,
          method: 'POST',
          token: token,
          commandId: command.commandId,
          body: jsonObject(payload['body']),
        );
      });
      final parts = path.split('/');
      final closing = parts.last == 'close';
      if (parts.length == 2 || closing || parts.last == 'reopen') {
        final key = parts[1] == 'working-days'
            ? 'working_day'
            : 'cashier_shift';
        final next = {
          ...snapshot.value!,
          'context': {...context, key: closing ? null : result},
        };
        _operatingRevision++;
        await database.saveSnapshot(profileId, next);
        if (operator.value?.id == operatorId) applyProfileSnapshot(next);
      }
      await database.removeTillCommand(command.commandId);
    } on PosApiError catch (error) {
      if (!error.transient && !const {401, 403, 408}.contains(error.status)) {
        await database.removeTillCommand(command.commandId);
      }
      rethrow;
    } finally {
      if (operator.value?.id == operatorId) {
        commandPending.value = await database.tillCommand(operatorId) != null;
      }
    }
  }

  Future<Json> readShiftManagement(Json input) async {
    final current = operator.value!;
    final profileId = installation.value!.profileId;
    final kind = input['kind'];
    if (storeOperations) {
      try {
        final local = network.isTill
            ? await network.shiftManagement(current.id, input)
            : await RegisterShiftReports(database)
                  .read(profileId, current.role, input);
        if (kind != 'history' ||
            !supportsShiftManagement ||
            (!paired.value && !online.value)) {
          return local;
        }
        try {
          final cloud = await _readCloudShift(
            current.id,
            input,
          ).timeout(const Duration(seconds: 2));
          final activeShifts = (local['active_shift_ids'] as List? ?? [])
              .toSet();
          return {
            'cashier_shifts': [
              ...{
                for (final row in [
                  ...jsonRows(cloud['cashier_shifts']),
                  ...jsonRows(local['cashier_shifts']),
                ])
                  if (!activeShifts.contains(row['id'])) row['id']: row,
              }.values,
            ],
            for (final key in ['operators', 'registers'])
              key: [
                ...{
                  for (final row in [
                    ...jsonRows(cloud[key]),
                    ...jsonRows(local[key]),
                  ])
                    row['id']: row,
                }.values,
              ],
            'has_more': cloud['has_more'] == true || local['has_more'] == true,
          };
        } on PosApiError {
          return local;
        } on TimeoutException {
          return local;
        }
      } on PosApiError catch (error) {
        if (kind != 'summary' ||
            input['historical'] != true ||
            error.status != 404 ||
            !supportsShiftManagement) {
          rethrow;
        }
        return _readCloudShift(current.id, input);
      }
    }
    return _readCloudShift(current.id, input);
  }

  Future<Json> _readCloudShift(String operatorId, Json input) {
    final id = input['id'] as String?;
    final kind = input['kind'];
    final path = switch (kind) {
      'preview' || 'review' => ApiEndpoint.cashierShiftReconciliationFor(id!),
      'summary' => ApiEndpoint.cashierShiftSummaryFor(id!),
      'day' => ApiEndpoint.workingDaySummaryFor(id!),
      'history' => ApiEndpoint.cashierShifts,
      _ => throw const FormatException('SHIFT_DETAILS_UNAVAILABLE'),
    };
    return access.withSession(
      _api!,
      operatorId,
      (token) => _api!.request(
        path,
        method: kind == 'review' ? 'POST' : 'GET',
        token: token,
        body: kind == 'review' ? jsonObject(input['count']) : null,
        query: {
          if (kind == 'history') 'closed': 'true',
          for (final key in [
            'scope',
            'business_date',
            'profile_id',
            'opened_by',
            'page',
          ])
            if (input[key] != null) key: input[key].toString(),
        },
      ),
    );
  }

  Future<Json?> shiftPreview(String shiftId) async {
    if (storeOperations) {
      final shift = context['cashier_shift'] as Map?;
      if (shift?['id'] != shiftId) {
        message.value = 'SALE_CONTEXT_CHANGED';
        return null;
      }
      if (!supportsStoreShiftManagement) return jsonObject(shift);
      return cashierShiftMetadata(
        jsonObject(shift),
        shiftManager(operator.value?.role ?? ''),
      );
    }
    Json? preview;
    await run(() async {
      if (network.isTill) throw const FormatException('USE_STORE_REGISTER');
      final api = _api!;
      preview = await access.withSession(
        api,
        operator.value!.id,
        (token) => api.request(
          ApiEndpoint.cashierShiftReconciliationFor(shiftId),
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

  @override
  Future<void> refreshAfterStoreOperation() async {
    if (network.isTill) {
      await refreshRegister();
    } else {
      applyProfileSnapshot(
        await database.readSnapshot(installation.value!.profileId),
      );
    }
  }

  @override
  Future<Json> readSalesHistory(
    String operatorId, {
    int? serverPage,
    String? saleId,
  }) {
    if (network.isTill) {
      return network.salesHistory(
        operatorId,
        serverPage: serverPage,
        saleId: saleId,
      );
    }
    return access.withSession(
      api,
      operatorId,
      (token) => saleId == null
          ? api.activeSalesPage(token, serverPage!)
          : api.request(ApiEndpoint.saleById(saleId), token: token),
    );
  }

  Future<Json> requestCustomers(Json input) async {
    final active = operator.value;
    final setup = installation.value;
    final api = _api;
    if (active == null || setup == null || api == null) {
      throw const FormatException('SIGN_IN_REQUIRED');
    }
    final operation = input['operation'];
    final writes =
        operation == 'create' || operation == 'update' || operation == 'delete';
    if (writes) await _refreshFinished?.future;
    if (!identical(operator.value, active) ||
        installation.value?.profileId != setup.profileId) {
      throw const FormatException('SIGN_IN_REQUIRED');
    }
    final result = await network.customerDirectory(
      api,
      active.id,
      setup.profileId,
      input,
    );
    if (writes &&
        identical(operator.value, active) &&
        installation.value?.profileId == setup.profileId) {
      final cached = await database.readSnapshot(setup.profileId);
      if (cached != null && identical(operator.value, active)) {
        applyProfileSnapshot(cached);
      }
    }
    return result;
  }

  @override
  Future<void> sendCommand(RegisterAction action, Json body) async {
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
    super.onClose();
  }

  Future<void> _disconnect() async {
    await network.close();
    await _sync?.close();
    _api?.close();
  }
}
