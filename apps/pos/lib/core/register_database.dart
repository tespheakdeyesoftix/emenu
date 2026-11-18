import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/extensions/json1.dart';
import 'package:drift/native.dart';

import 'pos_api.dart';
import 'register_history_scope.dart';

part 'register_database.g.dart';

class RegisterUiPreferences extends Table {
  IntColumn get id => integer().withDefault(const Constant(1))();
  TextColumn get sellScreenLayout =>
      text().withDefault(const Constant('menu_top'))();
  IntColumn get orderProductListWidth =>
      integer().withDefault(const Constant(350))();
  IntColumn get catalogWidth => integer().withDefault(const Constant(200))();

  @override
  Set<Column> get primaryKey => {id};
}

class RegisterInstallations extends Table {
  IntColumn get id => integer().withDefault(const Constant(1))();
  TextColumn get apiOrigin => text()();
  TextColumn get businessSlug => text()();
  TextColumn get businessId => text()();
  TextColumn get branchId => text()();
  TextColumn get profileId => text()();

  @override
  Set<Column> get primaryKey => {id};
}

class RegisterOperators extends Table {
  TextColumn get id => text()();
  TextColumn get email => text().unique()();
  TextColumn get displayName => text()();
  TextColumn get role => text()();
  IntColumn get failedPins => integer().withDefault(const Constant(0))();
  DateTimeColumn get blockedUntil => dateTime().nullable()();
  BoolColumn get accessRevoked =>
      boolean().withDefault(const Constant(false))();

  @override
  Set<Column> get primaryKey => {id};
}

class ProfileSnapshots extends Table {
  TextColumn get profileId => text()();
  TextColumn get payload => text()();
  DateTimeColumn get refreshedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {profileId};
}

@TableIndex(
  name: 'local_sales_one_reversal',
  columns: {#reversesSaleId},
  unique: true,
)
class LocalSales extends Table {
  TextColumn get id => text()();
  TextColumn get profileId => text()();
  TextColumn get operatorId => text()();
  DateTimeColumn get createdAt => dateTime()();
  IntColumn get total => integer()();
  TextColumn get currency => text()();
  TextColumn get request => text()();
  TextColumn get settlement => text().nullable()();
  TextColumn get reversesSaleId =>
      text().nullable().references(LocalSales, #id)();

  @override
  Set<Column> get primaryKey => {id};
}

class HeldBills extends Table {
  TextColumn get id => text()();
  TextColumn get profileId => text()();
  TextColumn get tableId => text().nullable()();
  TextColumn get workingDayId => text().nullable()();
  TextColumn get payload => text()();
  IntColumn get revision => integer().withDefault(const Constant(1))();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};

  @override
  List<Set<Column>> get uniqueKeys => [
    {profileId, tableId},
  ];
}

class DiscardedBills extends Table {
  TextColumn get id => text()();
  TextColumn get profileId => text()();
  TextColumn get billId => text()();
  TextColumn get shiftId => text().nullable()();
  TextColumn get workingDayId => text().nullable()();
  TextColumn get businessDate => text()();
  TextColumn get operatorName => text()();
  TextColumn get payload => text()();
  DateTimeColumn get discardedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

class RegisterCartDrafts extends Table {
  TextColumn get operatorId => text().references(RegisterOperators, #id)();
  TextColumn get profileId => text()();
  TextColumn get billId => text().nullable()();
  TextColumn get payload => text()();

  @override
  Set<Column> get primaryKey => {operatorId, profileId};
}

class ParkedTableDrafts extends Table {
  TextColumn get operatorId => text().references(RegisterOperators, #id)();
  TextColumn get profileId => text()();
  TextColumn get tableId => text()();
  TextColumn get payload => text()();

  @override
  Set<Column> get primaryKey => {operatorId, profileId, tableId};
}

@TableIndex(name: 'sale_outbox_pending', columns: {#status, #retryAt})
class SaleOutbox extends Table {
  IntColumn get sequence => integer().autoIncrement()();
  TextColumn get saleId => text().unique().references(LocalSales, #id)();
  TextColumn get status => text().withDefault(const Constant('pending'))();
  IntColumn get attempts => integer().withDefault(const Constant(0))();
  DateTimeColumn get retryAt => dateTime()();
  TextColumn get serverDraft => text().nullable()();
  TextColumn get lastError => text().nullable()();
}

class RegisterCommands extends Table {
  TextColumn get id => text()();
  TextColumn get operatorId => text()();
  TextColumn get profileId => text().nullable()();
  TextColumn get fingerprint => text()();
  TextColumn get result => text()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

class StoreNetworkSettings extends Table {
  IntColumn get id => integer().withDefault(const Constant(1))();
  TextColumn get mode => text()();
  TextColumn get endpoint => text().nullable()();
  TextColumn get fingerprint => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class StoreDevices extends Table {
  TextColumn get id => text()();
  TextColumn get profileId => text().nullable()();
  TextColumn get name => text()();
  TextColumn get credentialHash => text().unique()();
  DateTimeColumn get pairedAt => dateTime()();
  DateTimeColumn get revokedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class StoreStaffGrants extends Table {
  TextColumn get deviceId => text().references(StoreDevices, #id)();
  TextColumn get operatorId => text()();
  TextColumn get displayName => text()();
  TextColumn get role => text()();
  TextColumn get credentialHash => text().unique()();

  @override
  Set<Column> get primaryKey => {deviceId, operatorId};
}

class TillCommands extends Table {
  TextColumn get operatorId => text()();
  TextColumn get commandId => text().unique()();
  TextColumn get action => text()();
  TextColumn get payload => text()();

  @override
  Set<Column> get primaryKey => {operatorId};
}

class ReceiptPrints extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get saleId => text()();
  TextColumn get operatorId => text()();
  IntColumn get copies => integer()();
  DateTimeColumn get sentAt => dateTime()();
}

class StoreOperatingStates extends Table {
  IntColumn get id => integer().withDefault(const Constant(1))();
  TextColumn get epoch => text()();
  TextColumn get timezone => text()();
  IntColumn get sequence => integer().withDefault(const Constant(0))();
  TextColumn get phase => text().withDefault(const Constant('active'))();
  TextColumn get activity => text().withDefault(const Constant('{}'))();

  @override
  Set<Column> get primaryKey => {id};
}

class StoreOperatingEvents extends Table {
  TextColumn get epoch => text()();
  IntColumn get sequence => integer()();
  TextColumn get commandId => text().unique()();
  TextColumn get resourceId => text()();
  TextColumn get operatorId => text()();
  TextColumn get operatorName => text().nullable()();
  TextColumn get profileId => text().nullable()();
  TextColumn get kind => text()();
  TextColumn get envelope => text()();
  TextColumn get status => text().withDefault(const Constant('pending'))();
  IntColumn get attempts => integer().withDefault(const Constant(0))();
  DateTimeColumn get retryAt => dateTime()();
  TextColumn get lastError => text().nullable()();
  TextColumn get acknowledgment => text().nullable()();
  TextColumn get recoveryOwnerId => text().nullable()();
  TextColumn get recoveryReason => text().nullable()();

  @override
  Set<Column> get primaryKey => {epoch, sequence};
}

@DriftDatabase(
  tables: [
    RegisterUiPreferences,
    RegisterInstallations,
    RegisterOperators,
    ProfileSnapshots,
    LocalSales,
    SaleOutbox,
    HeldBills,
    DiscardedBills,
    RegisterCartDrafts,
    ParkedTableDrafts,
    RegisterCommands,
    StoreNetworkSettings,
    StoreDevices,
    StoreStaffGrants,
    TillCommands,
    ReceiptPrints,
    StoreOperatingStates,
    StoreOperatingEvents,
  ],
)
class RegisterDatabase extends _$RegisterDatabase {
  RegisterDatabase(super.executor);

  factory RegisterDatabase.open(File file) =>
      RegisterDatabase(NativeDatabase.createInBackground(file));

  @override
  int get schemaVersion => 15;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onUpgrade: (migrator, from, to) async {
      if (from < 13) await migrator.createTable(registerUiPreferences);
      if (from < 14) await migrator.createTable(discardedBills);
      if (from >= 13 && from < 15) {
        await migrator.addColumn(
          registerUiPreferences,
          registerUiPreferences.catalogWidth,
        );
      }
      if (from < 2) await migrator.createTable(heldBills);
      if (from < 3) await migrator.createTable(registerCommands);
      if (from < 4) {
        await migrator.createTable(storeNetworkSettings);
        await migrator.createTable(storeDevices);
        await migrator.createTable(storeStaffGrants);
        await migrator.createTable(tillCommands);
      }
      if (from < 5) {
        await migrator.addColumn(
          registerOperators,
          registerOperators.accessRevoked,
        );
      }
      if (from < 6) await migrator.createTable(receiptPrints);
      if (from < 7) {
        await migrator.createTable(storeOperatingStates);
        await migrator.createTable(storeOperatingEvents);
      }
      if (from < 8) {
        await migrator.addColumn(localSales, localSales.reversesSaleId);
        await customStatement(
          'CREATE UNIQUE INDEX local_sales_one_reversal ON local_sales (reverses_sale_id)',
        );
      }
      if (from < 9) await migrator.createTable(registerCartDrafts);
      if (from < 12) await migrator.createTable(parkedTableDrafts);
      if (from >= 3 && from < 10) {
        await migrator.addColumn(registerCommands, registerCommands.profileId);
      }
      if (from >= 4 && from < 10) {
        await migrator.addColumn(storeDevices, storeDevices.profileId);
      }
      if (from >= 7 && from < 10) {
        await migrator.addColumn(
          storeOperatingEvents,
          storeOperatingEvents.profileId,
        );
      }
      if (from >= 7 && from < 11) {
        await migrator.addColumn(
          storeOperatingEvents,
          storeOperatingEvents.operatorName,
        );
        await migrator.addColumn(
          storeOperatingEvents,
          storeOperatingEvents.recoveryOwnerId,
        );
        await migrator.addColumn(
          storeOperatingEvents,
          storeOperatingEvents.recoveryReason,
        );
      }
    },
    beforeOpen: (_) async {
      await customStatement('PRAGMA foreign_keys = ON');
      await customStatement('PRAGMA journal_mode = WAL');
      await customStatement('PRAGMA synchronous = FULL');
      await customStatement('PRAGMA busy_timeout = 5000');
    },
  );

  Future<Json?> readUiPreferences() async {
    final row = await (select(
      registerUiPreferences,
    )..where((row) => row.id.equals(1))).getSingleOrNull();
    return row == null
        ? null
        : {
            'sell_screen_layout': row.sellScreenLayout,
            'order_product_list_width': row.orderProductListWidth,
            'catalog_width': row.catalogWidth,
          };
  }

  Future<void> saveUiPreferences(
    String layout,
    int width, {
    int catalogWidth = 200,
  }) => into(registerUiPreferences).insertOnConflictUpdate(
    RegisterUiPreferencesCompanion.insert(
      id: const Value(1),
      sellScreenLayout: Value(layout),
      orderProductListWidth: Value(width),
      catalogWidth: Value(catalogWidth),
    ),
  );

  Future<RegisterInstallation?> installation() => (select(
    registerInstallations,
  )..where((row) => row.id.equals(1))).getSingleOrNull();

  Future<ProfileSnapshot?> profileSnapshot(String profileId) => (select(
    profileSnapshots,
  )..where((row) => row.profileId.equals(profileId))).getSingleOrNull();

  Future<Json?> readSnapshot(String profileId) async {
    final row = await profileSnapshot(profileId);
    return row == null ? null : effectiveSnapshot(row);
  }

  Stream<Json?> watchSnapshot(String profileId) => customSelect(
    'SELECT 1',
    readsFrom: {profileSnapshots, storeOperatingStates, heldBills},
  ).watch().asyncMap((_) => readSnapshot(profileId));

  Future<Json> effectiveSnapshot(ProfileSnapshot row) async {
    final snapshot = jsonObject(jsonDecode(row.payload));
    final store = await storeOperatingState();
    return store == null
        ? snapshot
        : _withStoreActivity(row.profileId, snapshot, store);
  }

  Future<Json> saveSnapshot(String profileId, Json snapshot) async {
    await into(profileSnapshots).insertOnConflictUpdate(
      ProfileSnapshotsCompanion.insert(
        profileId: profileId,
        payload: jsonEncode(snapshot),
        refreshedAt: DateTime.now().toUtc(),
      ),
    );
    final store = await storeOperatingState();
    return store == null
        ? snapshot
        : _withStoreActivity(profileId, snapshot, store);
  }

  /// Keep the checkout directory current across this store's cached profiles.
  Future<void> cacheCustomerChange(String businessId, String id, Json? row) =>
      transaction(() async {
        for (final cached in await select(profileSnapshots).get()) {
          final snapshot = jsonObjectFromString(cached.payload);
          final context = jsonObject(snapshot['context']);
          if ((context['business'] as Map?)?['id'] != businessId) continue;
          final rows = jsonRows(snapshot['customers']).toList();
          final index = rows.indexWhere((item) => item['id'] == id);
          if (index == -1 && row == null) continue;
          if (row == null) {
            rows.removeAt(index);
          } else if (index == -1) {
            rows.add(row);
          } else {
            rows[index] = row;
          }
          final payload = jsonEncode({...snapshot, 'customers': rows});
          await (update(profileSnapshots)
                ..where((item) => item.profileId.equals(cached.profileId)))
              .write(ProfileSnapshotsCompanion(payload: Value(payload)));
        }
      });

  Future<Json> _withStoreActivity(
    String profileId,
    Json snapshot,
    StoreOperatingState store,
  ) async {
    final context = jsonObject(snapshot['context']);
    final activity = await readStoreActivity(store);
    final operating = jsonObject(
      (activity['profiles'] as Map)[profileId] ?? {},
    );
    // Keep the effective checkout settings for an open shift. An API refresh
    // may see a changed profile before the offline shift has reached the server.
    final held = operating['profile'] == null
        ? await (select(heldBills)
                ..where((row) => row.profileId.equals(profileId))
                ..orderBy([(row) => OrderingTerm.asc(row.updatedAt)])
                ..limit(1))
              .getSingleOrNull()
        : null;
    final heldQuote = held == null
        ? null
        : jsonObject(jsonDecode(held.payload))['quote_context'] as Map?;
    final profile = jsonObject(
      operating['profile'] ?? heldQuote?['profile'] ?? context['profile'],
    );
    final config = jsonObject(profile['config']);
    final latestConfig = jsonObject(jsonObject(context['profile'])['config']);
    final day = config['working_day_enabled'] == true
        ? activity['working_day']
        : null;
    final shift = operating['cashier_shift'];
    return {
      ...snapshot,
      if (store.epoch.isNotEmpty)
        'tables': [
          for (final table in jsonRows(snapshot['tables']))
            if (table['status'] == 'occupied')
              {...table, 'status': 'available', 'open_sale_id': null}
            else
              table,
        ],
      'context': {
        ...context,
        'business': {
          ...jsonObject(context['business']),
          'timezone': store.timezone,
        },
        'profile': {
          ...profile,
          'config': {
            ...config,
            // Browsing follows the latest profile while an open shift keeps
            // its original checkout, tax, and payment settings.
            for (final key in [
              'catalog_mode',
              'selected_ids',
              'default_menu_id',
            ])
              if (latestConfig.containsKey(key)) key: latestConfig[key],
            if (shift != null) 'cashier_shift_enabled': true,
          },
        },
        'payment_types':
            operating['payment_types'] ??
            heldQuote?['payment_types'] ??
            context['payment_types'],
        'working_day': day,
        'cashier_shift': shift,
        'store_operations': store.epoch.isNotEmpty,
        'store_authority_pending': store.phase != 'active',
      },
    };
  }

  Future<Json> readStoreActivity(StoreOperatingState store) async {
    final activity = jsonObject(jsonDecode(store.activity));
    if (activity['profiles'] is Map) return activity;
    final setup = (await installation())!;
    return {
      'working_day': activity['working_day'],
      'profiles': {
        if (activity['cashier_shift'] != null)
          setup.profileId: {
            'cashier_shift': activity['cashier_shift'],
            'profile': activity['profile'],
            'payment_types': activity['payment_types'],
          },
      },
    };
  }

  Future<bool> storeHasOpenActivity(StoreOperatingState store) async {
    final activity = await readStoreActivity(store);
    return activity['working_day'] != null ||
        (activity['profiles'] as Map).values.any(
          (profile) => profile['cashier_shift'] != null,
        );
  }

  Future<StoreOperatingState?> storeOperatingState() => (select(
    storeOperatingStates,
  )..where((row) => row.id.equals(1))).getSingleOrNull();

  Future<StoreOperatingEvent?> latestStoreShift(
    String epoch,
    String profileId,
  ) =>
      (select(storeOperatingEvents)
            ..where(
              (row) =>
                  row.epoch.equals(epoch) &
                  row.profileId.equals(profileId) &
                  row.kind.isIn(['open_shift', 'close_shift', 'reopen_shift']),
            )
            ..orderBy([(row) => OrderingTerm.desc(row.sequence)])
            ..limit(1))
          .getSingleOrNull();

  Future<StoreOperatingEvent?> storeShiftOpening(
    String epoch,
    String shiftId,
  ) =>
      (select(storeOperatingEvents)..where(
            (row) =>
                row.epoch.equals(epoch) &
                row.resourceId.equals(shiftId) &
                row.kind.equals('open_shift'),
          ))
          .getSingleOrNull();

  Future<StoreOperatingEvent?> nextStoreEvent() =>
      (select(storeOperatingEvents)
            ..where((event) => event.status.equals('synced').not())
            ..orderBy([(event) => OrderingTerm.asc(event.sequence)])
            ..limit(1))
          .getSingleOrNull();

  Stream<StoreOperatingEvent?> watchStoreEventHead() =>
      (select(storeOperatingEvents)
            ..where((event) => event.status.equals('synced').not())
            ..orderBy([(event) => OrderingTerm.asc(event.sequence)])
            ..limit(1))
          .watchSingleOrNull();

  Future<void> prepareStoreClaim(String timezone) =>
      _writeStoreAuthority('', timezone, 'claiming');

  Future<void> startStoreAuthority(String epoch, String timezone) =>
      _writeStoreAuthority(epoch, timezone, 'active');

  Future<void> _writeStoreAuthority(
    String epoch,
    String timezone,
    String phase,
  ) => transaction(() async {
    await into(storeOperatingStates).insertOnConflictUpdate(
      StoreOperatingStatesCompanion.insert(
        epoch: epoch,
        timezone: timezone,
        phase: Value(phase),
      ),
    );
  });

  Future<void> setStorePhase(String phase) =>
      (update(storeOperatingStates)..where((row) => row.id.equals(1))).write(
        StoreOperatingStatesCompanion(phase: Value(phase)),
      );

  Future<void> releaseStoreAuthority() => transaction(() async {
    final hadAuthority =
        (await storeOperatingState())?.epoch.isNotEmpty == true;
    await delete(storeOperatingStates).go();
    for (final row in await select(profileSnapshots).get()) {
      final cached = jsonObject(jsonDecode(row.payload));
      final context = jsonObject(cached['context'])
        ..remove('store_operations')
        ..remove('store_authority_pending')
        ..remove('store_authority_required');
      if (hadAuthority) {
        context['working_day'] = null;
        context['cashier_shift'] = null;
      }
      await saveSnapshot(row.profileId, {...cached, 'context': context});
    }
  });

  Future<void> appendStoreEvent({
    required StoreOperatingState store,
    required String commandId,
    required String resourceId,
    required String operatorId,
    required String operatorName,
    required String kind,
    required DateTime occurredAt,
    required Json settings,
    required Json payload,
    required Json activity,
    required String profileId,
  }) async {
    final sequence = store.sequence + 1;
    final envelope = jsonEncode({
      'epoch': store.epoch,
      'sequence': sequence,
      'profile_id': profileId,
      'kind': kind,
      'resource_id': resourceId,
      'occurred_at': occurredAt.toUtc().toIso8601String(),
      'settings': settings,
      'payload': payload,
    });
    if (utf8.encode(envelope).length > 1000000) {
      throw const FormatException('CART_LIMIT');
    }
    await into(storeOperatingEvents).insert(
      StoreOperatingEventsCompanion.insert(
        epoch: store.epoch,
        sequence: sequence,
        commandId: commandId,
        resourceId: resourceId,
        operatorId: operatorId,
        operatorName: Value(operatorName),
        profileId: Value(profileId),
        kind: kind,
        envelope: envelope,
        retryAt: DateTime.now().toUtc(),
      ),
    );
    await (update(
      storeOperatingStates,
    )..where((row) => row.id.equals(1))).write(
      StoreOperatingStatesCompanion(
        sequence: Value(sequence),
        activity: Value(jsonEncode(activity)),
      ),
    );
  }

  Future<void> acknowledgeStoreEvent(
    StoreOperatingEvent event,
    Json response,
  ) => transaction(() async {
    if (event.createsSale) {
      await saveSettlement(event.resourceId, response);
    }
    await (update(
      storeOperatingEvents,
    )..where((row) => row.commandId.equals(event.commandId))).write(
      StoreOperatingEventsCompanion(
        status: const Value('synced'),
        acknowledgment: Value(jsonEncode(response)),
        lastError: const Value(null),
      ),
    );
  });

  Future<void> failStoreEvent(
    StoreOperatingEvent event,
    PosApiError error,
    DateTime? retryAt,
  ) => transaction(() async {
    await (update(
      storeOperatingEvents,
    )..where((row) => row.commandId.equals(event.commandId))).write(
      StoreOperatingEventsCompanion(
        status: Value(retryAt == null ? 'attention' : 'pending'),
        lastError: Value(error.code),
        attempts: Value(event.attempts + 1),
        retryAt: retryAt == null ? const Value.absent() : Value(retryAt),
      ),
    );
    if (event.createsSale && retryAt == null) {
      await (update(
        saleOutbox,
      )..where((row) => row.saleId.equals(event.resourceId))).write(
        SaleOutboxCompanion(
          status: const Value('attention'),
          lastError: Value(error.code),
        ),
      );
    }
  });

  Future<void> retryStoreEvent() => transaction(() async {
    final event = await nextStoreEvent();
    if (event != null) await _requeueStoreEvent(event);
  });

  Future<void> approveStoreRecovery(
    String commandId,
    String ownerId,
    String input,
  ) => transaction(() async {
    final reason = input.trim();
    if (reason.isEmpty || reason.length > 500) {
      throw const FormatException('REASON_REQUIRED');
    }
    final owner = await operatorById(ownerId);
    if (owner == null || owner.role != 'owner' || owner.accessRevoked) {
      throw const FormatException('OWNER_REQUIRED');
    }
    final event = await nextStoreEvent();
    if (event == null ||
        event.commandId != commandId ||
        !event.canApproveRecovery) {
      throw const FormatException('STORE_RECOVERY_CHANGED');
    }
    await _requeueStoreEvent(
      event,
      ownerId: Value(ownerId),
      reason: Value(reason),
    );
  });

  Future<void> retryAsOriginalOperator(String commandId) =>
      transaction(() async {
        final event = await nextStoreEvent();
        if (event == null ||
            event.commandId != commandId ||
            event.recoveryOwnerId == null) {
          return;
        }
        await _requeueStoreEvent(
          event,
          ownerId: const Value(null),
          reason: const Value(null),
        );
      });

  Future<void> _requeueStoreEvent(
    StoreOperatingEvent event, {
    Value<String?> ownerId = const Value.absent(),
    Value<String?> reason = const Value.absent(),
  }) async {
    await (update(
      storeOperatingEvents,
    )..where((row) => row.commandId.equals(event.commandId))).write(
      StoreOperatingEventsCompanion(
        status: const Value('pending'),
        retryAt: Value(DateTime.now().toUtc()),
        lastError: const Value(null),
        recoveryOwnerId: ownerId,
        recoveryReason: reason,
      ),
    );
    if (event.createsSale) {
      await (update(
        saleOutbox,
      )..where((row) => row.saleId.equals(event.resourceId))).write(
        const SaleOutboxCompanion(
          status: Value('pending'),
          lastError: Value(null),
        ),
      );
    }
  }

  Future<RegisterOperator?> operatorById(String id) => (select(
    registerOperators,
  )..where((row) => row.id.equals(id))).getSingleOrNull();

  Future<void> revokeOperatorAccess(String id, {String? profileId}) =>
      transaction(() async {
        final primary = (await installation())?.profileId;
        final profile = profileId ?? primary;
        final isPrimary = profile == primary;
        if (isPrimary) {
          await (update(
            registerOperators,
          )..where((row) => row.id.equals(id))).write(
            const RegisterOperatorsCompanion(accessRevoked: Value(true)),
          );
        }
        final devices = selectOnly(storeDevices)
          ..addColumns([storeDevices.id])
          ..where(_matchesProfile(storeDevices.profileId, profile, isPrimary));
        await (delete(storeStaffGrants)..where(
              (row) =>
                  row.operatorId.equals(id) & row.deviceId.isInQuery(devices),
            ))
            .go();
      });

  Expression<bool> _matchesProfile(
    GeneratedColumn<String> column,
    String? profileId,
    bool includeLegacy,
  ) =>
      (profileId == null ? const Constant(false) : column.equals(profileId)) |
      (includeLegacy ? column.isNull() : const Constant(false));

  Future<List<RegisterOperator>> operators() => (select(
    registerOperators,
  )..orderBy([(row) => OrderingTerm.asc(row.displayName)])).get();

  Future<void> queueSale({
    required String id,
    required String profileId,
    required String operatorId,
    required int total,
    required String currency,
    required Json request,
    int? heldRevision,
    DateTime? createdAt,
  }) => transaction(() async {
    final tableId = jsonObject(request['draft'])['table_id'] as String?;
    await _assertTableAvailable(profileId, tableId, exceptBill: id);
    if (heldRevision != null) {
      await _removeHeldBill(id, profileId, heldRevision);
    }
    await _insertQueuedSale(
      LocalSalesCompanion.insert(
        id: id,
        profileId: profileId,
        operatorId: operatorId,
        total: total,
        currency: currency,
        createdAt: (createdAt ?? DateTime.now()).toUtc(),
        request: jsonEncode(request),
      ),
    );
  });

  Future<void> queueReversal({
    required String id,
    required LocalSale original,
    required String operatorId,
    required DateTime createdAt,
    required Json request,
  }) => transaction(() async {
    await _insertQueuedSale(
      LocalSalesCompanion.insert(
        id: id,
        profileId: original.profileId,
        operatorId: operatorId,
        total: -original.total,
        currency: original.currency,
        createdAt: createdAt.toUtc(),
        request: jsonEncode(request),
        reversesSaleId: Value(original.id),
      ),
    );
  });

  Future<void> _insertQueuedSale(LocalSalesCompanion sale) async {
    await into(localSales).insert(sale);
    await into(saleOutbox).insert(
      SaleOutboxCompanion.insert(
        saleId: sale.id.value,
        retryAt: DateTime.now().toUtc(),
      ),
    );
  }

  Future<LocalSale?> originalSale(String profile, String id) =>
      (select(localSales)
            ..where((row) => row.profileId.equals(profile) & row.id.equals(id)))
          .getSingleOrNull();

  Future<bool> hasReversal(String originalId) async =>
      await (select(localSales)
            ..where((row) => row.reversesSaleId.equals(originalId)))
          .getSingleOrNull() !=
      null;

  Future<StoreOperatingEvent?> checkoutEvent(String id) =>
      (select(storeOperatingEvents)..where(
            (row) => row.resourceId.equals(id) & row.kind.equals('checkout'),
          ))
          .getSingleOrNull();

  Stream<List<HeldBill>> watchHeldBills({String? profileId}) {
    final query = select(heldBills)
      ..orderBy([(row) => OrderingTerm.desc(row.updatedAt)]);
    if (profileId != null) {
      query.where((row) => row.profileId.equals(profileId));
    }
    return query.watch();
  }

  Future<HeldBill?> heldBill(String profileId, String id) =>
      (select(heldBills)..where(
            (row) => row.profileId.equals(profileId) & row.id.equals(id),
          ))
          .getSingleOrNull();

  Future<RegisterCartDraft?> cartDraft(String operatorId, String profileId) =>
      (select(registerCartDrafts)..where(
            (row) =>
                row.operatorId.equals(operatorId) &
                row.profileId.equals(profileId),
          ))
          .getSingleOrNull();

  Future<void> saveCartDraft({
    required String operatorId,
    required String profileId,
    required String? billId,
    required String payload,
  }) => into(registerCartDrafts).insertOnConflictUpdate(
    RegisterCartDraftsCompanion.insert(
      operatorId: operatorId,
      profileId: profileId,
      billId: Value(billId),
      payload: payload,
    ),
  );

  Future<void> removeCartDraft(
    String operatorId,
    String profileId, {
    String? billId,
  }) =>
      (delete(registerCartDrafts)..where((row) {
            final owner =
                row.operatorId.equals(operatorId) &
                row.profileId.equals(profileId);
            return billId == null ? owner : owner & row.billId.equals(billId);
          }))
          .go();

  Future<List<String>> parkedTableIds(
    String operatorId,
    String profileId,
  ) async {
    final rows =
        await (select(parkedTableDrafts)..where(
              (row) =>
                  row.operatorId.equals(operatorId) &
                  row.profileId.equals(profileId),
            ))
            .get();
    return [for (final row in rows) row.tableId];
  }

  Future<void> parkTableDraft(
    String operatorId,
    String profileId,
    String tableId,
  ) => transaction(() async {
    final draft = await cartDraft(operatorId, profileId);
    if (draft == null ||
        draft.billId != null ||
        jsonObject(jsonDecode(draft.payload))['table_id'] != tableId) {
      throw const FormatException('CART_SAVE_FAILED');
    }
    await into(parkedTableDrafts).insert(
      ParkedTableDraftsCompanion.insert(
        operatorId: operatorId,
        profileId: profileId,
        tableId: tableId,
        payload: draft.payload,
      ),
    );
    await removeCartDraft(operatorId, profileId);
  });

  Future<void> restoreTableDraft(
    String operatorId,
    String profileId,
    String tableId,
  ) => transaction(() async {
    final current = await cartDraft(operatorId, profileId);
    if (current != null &&
        (current.billId != null ||
            jsonRows(jsonObject(jsonDecode(current.payload))['lines'])
                .isNotEmpty)) {
      throw const FormatException('CART_SAVE_FAILED');
    }
    final query = select(parkedTableDrafts)
      ..where(
        (row) =>
            row.operatorId.equals(operatorId) &
            row.profileId.equals(profileId) &
            row.tableId.equals(tableId),
      );
    final draft = await query.getSingleOrNull();
    if (draft == null) throw const FormatException('CART_SAVE_FAILED');
    await saveCartDraft(
      operatorId: operatorId,
      profileId: profileId,
      billId: null,
      payload: draft.payload,
    );
    await (delete(parkedTableDrafts)..where(
          (row) =>
              row.operatorId.equals(operatorId) &
              row.profileId.equals(profileId) &
              row.tableId.equals(tableId),
        ))
        .go();
  });

  Future<RegisterCommand?> savedCommand(String id) => (select(
    registerCommands,
  )..where((row) => row.id.equals(id))).getSingleOrNull();

  Future<StoreNetworkSetting?> networkSettings() => (select(
    storeNetworkSettings,
  )..where((row) => row.id.equals(1))).getSingleOrNull();

  Future<TillCommand?> tillCommand(String operatorId) => (select(
    tillCommands,
  )..where((row) => row.operatorId.equals(operatorId))).getSingleOrNull();

  Future<bool> hasPendingCloudShift() async =>
      await (select(tillCommands)
            ..where((row) => row.action.equals('cloud_shift'))
            ..limit(1))
          .getSingleOrNull() !=
      null;

  Future<void> removeTillCommand(String commandId) => (delete(
    tillCommands,
  )..where((row) => row.commandId.equals(commandId))).go();

  Future<void> acknowledgeTillCommand(
    TillCommand command, {
    required bool consumeCart,
    String? billId,
  }) => transaction(() async {
    final removed = await (delete(
      tillCommands,
    )..where((row) => row.commandId.equals(command.commandId))).go();
    if (removed == 0 || !consumeCart) return;
    final setup = await installation();
    if (setup != null) {
      await removeCartDraft(
        command.operatorId,
        setup.profileId,
        billId: billId,
      );
    }
  });

  Future<void> recordReceiptPrint(
    String saleId,
    String operatorId,
    int copies,
  ) => into(receiptPrints).insert(
    ReceiptPrintsCompanion.insert(
      saleId: saleId,
      operatorId: operatorId,
      copies: copies,
      sentAt: DateTime.now().toUtc(),
    ),
  );

  Future<({StoreStaffGrant grant, String? profileId})?> storeStaff(
    String credentialHash,
  ) async {
    final row =
        await (select(storeStaffGrants).join([
              innerJoin(
                storeDevices,
                storeDevices.id.equalsExp(storeStaffGrants.deviceId),
              ),
            ])..where(
              storeStaffGrants.credentialHash.equals(credentialHash) &
                  storeDevices.revokedAt.isNull(),
            ))
            .getSingleOrNull();
    return row == null
        ? null
        : (
            grant: row.readTable(storeStaffGrants),
            profileId: row.readTable(storeDevices).profileId,
          );
  }

  Future<void> holdBill({
    required String id,
    required String profileId,
    required Json payload,
    String? tableId,
    String? workingDayId,
    int? revision,
  }) => transaction(() async {
    await _assertTableAvailable(profileId, tableId, exceptBill: id);
    final now = DateTime.now().toUtc();
    if (revision == null) {
      await into(heldBills).insert(
        HeldBillsCompanion.insert(
          id: id,
          profileId: profileId,
          tableId: Value(tableId),
          workingDayId: Value(workingDayId),
          payload: jsonEncode(payload),
          updatedAt: now,
        ),
      );
      return;
    }
    final changed =
        await (update(heldBills)..where(
              (row) =>
                  row.id.equals(id) &
                  row.profileId.equals(profileId) &
                  row.revision.equals(revision),
            ))
            .write(
              HeldBillsCompanion(
                tableId: Value(tableId),
                workingDayId: Value(workingDayId),
                payload: Value(jsonEncode(payload)),
                updatedAt: Value(now),
                revision: Value(revision + 1),
              ),
            );
    if (changed != 1) {
      throw const PosApiError(409, 'BILL_CHANGED', 'Reload the held bill.');
    }
  });

  Future<void> _assertTableAvailable(
    String profileId,
    String? tableId, {
    required String exceptBill,
  }) async {
    if (tableId == null) return;
    final other =
        await (select(heldBills)..where(
              (row) =>
                  row.profileId.equals(profileId) &
                  row.tableId.equals(tableId) &
                  row.id.equals(exceptBill).not(),
            ))
            .getSingleOrNull();
    if (other != null) {
      throw const PosApiError(
        409,
        'TABLE_OCCUPIED',
        'The table has a held bill.',
      );
    }
  }

  Future<void> discardHeldBill(String id, String profileId, int revision) =>
      _removeHeldBill(id, profileId, revision);

  Future<void> recordDiscardedBill({
    required String commandId,
    required HeldBill bill,
    required String operatorName,
    required DateTime time,
    required Json operating,
  }) => transaction(() async {
    await _removeHeldBill(bill.id, bill.profileId, bill.revision);
    await into(discardedBills).insert(
      DiscardedBillsCompanion.insert(
        id: commandId,
        billId: bill.id,
        profileId: bill.profileId,
        shiftId: Value(operating['shift_id'] as String?),
        workingDayId: Value(operating['working_day_id'] as String?),
        businessDate: operating['business_date'] as String,
        operatorName: operatorName,
        payload: bill.payload,
        discardedAt: time.toUtc(),
      ),
    );
  });

  Future<void> _removeHeldBill(
    String id,
    String profileId,
    int revision,
  ) async {
    final changed =
        await (delete(heldBills)..where(
              (row) =>
                  row.id.equals(id) &
                  row.profileId.equals(profileId) &
                  row.revision.equals(revision),
            ))
            .go();
    if (changed != 1) {
      throw const PosApiError(409, 'BILL_CHANGED', 'Reload the held bill.');
    }
  }

  Future<SaleOutboxData?> nextJob() =>
      (select(saleOutbox)
            ..where((row) => row.status.equals('pending'))
            ..orderBy([(row) => OrderingTerm.asc(row.sequence)])
            ..limit(1))
          .getSingleOrNull();

  Future<LocalSale> sale(String id) =>
      (select(localSales)..where((row) => row.id.equals(id))).getSingle();

  Future<bool> hasUnsyncedSales(
    String profile,
    String contextKey,
    String id,
  ) async {
    final row = await customSelect(
      '''SELECT EXISTS(
        SELECT 1 FROM local_sales sale
        JOIN sale_outbox job ON job.sale_id = sale.id
        WHERE sale.profile_id = ? AND job.status != 'synced'
          AND json_extract(sale.request, ?) = ?
      ) AS has_unsynced''',
      variables: [
        Variable(profile),
        Variable('\$.draft.expected_context.$contextKey'),
        Variable(id),
      ],
      readsFrom: {localSales, saleOutbox},
    ).getSingle();
    return row.read<int>('has_unsynced') == 1;
  }

  Future<bool> hasHeldBillsOnDay(String dayId, {String? profileId}) async {
    final found =
        await (select(heldBills)
              ..where(
                (bill) =>
                    bill.workingDayId.equals(dayId) &
                    (profileId == null
                        ? const Constant(true)
                        : bill.profileId.equals(profileId)),
              )
              ..limit(1))
            .getSingleOrNull();
    return found != null;
  }

  Future<bool> hasUnsentSales() async =>
      await (select(saleOutbox)
            ..where((row) => row.status.equals('synced').not())
            ..limit(1))
          .getSingleOrNull() !=
      null;

  Stream<List<(LocalSale, SaleOutboxData)>> watchSales({String? profileId}) {
    final query =
        select(localSales).join([
          innerJoin(saleOutbox, saleOutbox.saleId.equalsExp(localSales.id)),
        ])..orderBy([
          OrderingTerm.desc(localSales.createdAt),
          OrderingTerm.desc(saleOutbox.sequence),
        ]);
    if (profileId != null) query.where(localSales.profileId.equals(profileId));
    return query.watch().map(
      (rows) => rows
          .map((row) => (row.readTable(localSales), row.readTable(saleOutbox)))
          .toList(),
    );
  }

  Stream<RegisterHistory> watchSalesHistory(RegisterHistoryScope scope) =>
      customSelect(
        'SELECT 1',
        readsFrom: {localSales, saleOutbox, heldBills, discardedBills},
      ).watch().asyncMap((_) => salesHistory(scope));

  Future<RegisterHistory> salesHistory(
    RegisterHistoryScope scope,
  ) => transaction(() async {
    final inProfile = localSales.profileId.equals(scope.profileId);
    final field = scope.period.operatingField;
    final quotedPeriod = localSales.request.jsonExtract<String>(
      '\$.draft.expected_context.$field',
    );
    final inPeriod =
        quotedPeriod.equals(scope.id) |
        (quotedPeriod.isNull() &
            localSales.settlement
                .jsonExtract<String>('\$.$field')
                .equals(scope.id));
    final current = select(localSales).join([
      innerJoin(saleOutbox, saleOutbox.saleId.equalsExp(localSales.id)),
    ])..where(inProfile & inPeriod);
    final rows = await current.get();
    final originals = selectOnly(localSales)
      ..addColumns([localSales.id])
      ..where(inProfile & inPeriod);
    final reversals =
        selectOnly(localSales).join([
            innerJoin(
              saleOutbox,
              saleOutbox.saleId.equalsExp(localSales.id),
              useColumns: false,
            ),
          ])
          ..addColumns([localSales.reversesSaleId, saleOutbox.status])
          ..where(inProfile & localSales.reversesSaleId.isInQuery(originals));
    final links = await reversals.get();
    // An unfinished server draft is part of a local checkout, even if the
    // checkout belongs to a previous period. It isn't a submitted order.
    final draftId = saleOutbox.serverDraft.jsonExtract<String>(r'$.id');
    final drafts =
        selectOnly(saleOutbox).join([
            innerJoin(
              localSales,
              localSales.id.equalsExp(saleOutbox.saleId),
              useColumns: false,
            ),
          ])
          ..addColumns([draftId])
          ..where(
            inProfile &
                saleOutbox.status.equals('synced').not() &
                draftId.isNotNull(),
          );
    final draftRows = await drafts.get();
    final held = await (select(
      heldBills,
    )..where((row) => row.profileId.equals(scope.profileId))).get();
    final discarded =
        await (select(discardedBills)..where((row) {
              final field = switch (scope.period) {
                RegisterHistoryPeriod.shift => row.shiftId,
                RegisterHistoryPeriod.workingDay => row.workingDayId,
                RegisterHistoryPeriod.businessDate => row.businessDate,
              };
              return row.profileId.equals(scope.profileId) &
                  field.equals(scope.id);
            }))
            .get();
    return RegisterHistory(
      sales: [
        for (final row in rows)
          (row.readTable(localSales), row.readTable(saleOutbox)),
      ],
      held: held,
      discarded: discarded,
      reversalStatuses: {
        for (final row in links)
          row.read(localSales.reversesSaleId)!: row.read(saleOutbox.status)!,
      },
      knownServerDraftIds: {for (final row in draftRows) row.read(draftId)!},
    );
  });

  Future<void> saveServerDraft(String saleId, Json draft) =>
      (update(saleOutbox)..where((row) => row.saleId.equals(saleId))).write(
        SaleOutboxCompanion(serverDraft: Value(jsonEncode(draft))),
      );

  Future<void> saveSettlement(String saleId, Json settlement) =>
      transaction(() async {
        await (update(localSales)..where((row) => row.id.equals(saleId))).write(
          LocalSalesCompanion(settlement: Value(jsonEncode(settlement))),
        );
        await (update(
          saleOutbox,
        )..where((row) => row.saleId.equals(saleId))).write(
          const SaleOutboxCompanion(
            status: Value('synced'),
            lastError: Value(null),
          ),
        );
      });

  Future<void> recordSyncFailure(
    SaleOutboxData job,
    PosApiError error,
    DateTime? retryAt,
  ) => (update(saleOutbox)..where((row) => row.sequence.equals(job.sequence)))
      .write(
        SaleOutboxCompanion(
          status: Value(retryAt == null ? 'attention' : 'pending'),
          attempts: Value(job.attempts + 1),
          retryAt: retryAt == null ? const Value.absent() : Value(retryAt),
          lastError: Value(error.code),
        ),
      );

  Future<void> retryAfterSignIn(
    String operatorId, {
    String? profileId,
  }) => transaction(() async {
    final primary = (await installation())?.profileId;
    final profile = profileId ?? primary;
    final head = await nextStoreEvent();
    if (head != null &&
        head.status == 'attention' &&
        head.recoveryOwnerId != null) {
      if (head.operatorId == operatorId &&
          (head.profileId ?? primary) == profile &&
          (head.needsSignIn || head.lastError == 'STORE_OPERATOR_UNKNOWN')) {
        await _requeueStoreEvent(
          head,
          ownerId: const Value(null),
          reason: const Value(null),
        );
      } else if (head.recoveryOwnerId == operatorId &&
          profile == primary &&
          head.needsSignIn) {
        await _requeueStoreEvent(head);
      }
    }
    final now = DateTime.now().toUtc();
    await customUpdate(
      '''UPDATE sale_outbox SET status='pending', retry_at=?, last_error=NULL
        WHERE status='attention' AND last_error IN ('SIGN_IN_REQUIRED','PROFILE_ACCESS_REVOKED')
          AND sale_id IN (SELECT id FROM local_sales WHERE operator_id=? AND profile_id=?)''',
      variables: [
        Variable(now.millisecondsSinceEpoch ~/ 1000),
        Variable(operatorId),
        Variable<String>(profile),
      ],
      updates: {saleOutbox},
    );
    await (update(storeOperatingEvents)..where(
          (row) =>
              row.operatorId.equals(operatorId) &
              _matchesProfile(row.profileId, profile, profile == primary) &
              row.status.equals('attention') &
              row.lastError.isIn([
                'SIGN_IN_REQUIRED',
                'PROFILE_ACCESS_REVOKED',
              ]),
        ))
        .write(
          StoreOperatingEventsCompanion(
            status: const Value('pending'),
            retryAt: Value(now),
            lastError: const Value(null),
          ),
        );
  });
}

class RegisterHistory {
  const RegisterHistory({
    this.sales = const [],
    this.held = const [],
    this.discarded = const [],
    this.reversalStatuses = const {},
    this.knownServerDraftIds = const {},
  });

  final List<(LocalSale, SaleOutboxData)> sales;
  final List<HeldBill> held;
  final List<DiscardedBill> discarded;
  final Map<String, String> reversalStatuses;
  final Set<String> knownServerDraftIds;

  factory RegisterHistory.fromJson(Json data) => RegisterHistory(
    sales: jsonRows(data['sales'])
        .map(
          (row) => (
            LocalSale.fromJson(jsonObject(row['sale'])),
            SaleOutboxData.fromJson(jsonObject(row['sync'])),
          ),
        )
        .toList(),
    held: jsonRows(data['held']).map(HeldBill.fromJson).toList(),
    discarded: jsonRows(data['discarded']).map(DiscardedBill.fromJson).toList(),
    reversalStatuses: Map<String, String>.from(
      data['reversal_statuses'] as Map,
    ),
    knownServerDraftIds: Set<String>.from(data['server_draft_ids'] as List),
  );

  Json toJson() => {
    'sales': [
      for (final (sale, job) in sales)
        {'sale': sale.toJson(), 'sync': job.toJson()},
    ],
    'held': held.map((row) => row.toJson()).toList(),
    'discarded': discarded.map((row) => row.toJson()).toList(),
    'reversal_statuses': reversalStatuses,
    'server_draft_ids': knownServerDraftIds.toList(),
  };
}

extension StoreEventStatus on StoreOperatingEvent {
  bool get createsSale => kind == 'checkout' || kind == 'reversal';
  bool get needsSignIn =>
      lastError == 'SIGN_IN_REQUIRED' || lastError == 'PROFILE_ACCESS_REVOKED';
  bool get canApproveRecovery =>
      status == 'attention' && needsSignIn && recoveryOwnerId == null;
}
