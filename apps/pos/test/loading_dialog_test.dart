import 'dart:async';
import 'dart:convert';

import 'package:drift/native.dart';
import 'package:emenu_pos/auths/login_screen.dart';
import 'package:emenu_pos/core/pos_api.dart';
import 'package:emenu_pos/core/register_authority.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:emenu_pos/features/register/register_controller.dart';
import 'package:emenu_pos/features/sales/sale_controller.dart';
import 'package:emenu_pos/global.dart';
import 'package:emenu_pos/shared/app_theme.dart';
import 'package:emenu_pos/shared/loading_dialog_widget.dart';
import 'package:emenu_pos/ui/register_app.dart';
import 'package:emenu_pos/ui/translations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';

Future<LoadingHandle> showLoading(
  WidgetTester tester, [
  String? message,
]) async {
  final pending = app.showLoading(message);
  await tester.pump();
  return pending;
}

Future<void> mount(
  WidgetTester tester, {
  Widget? home,
  VoidCallback? onTap,
}) async {
  await tester.pumpWidget(
    GetMaterialApp(
      theme: AppTheme.light,
      locale: const Locale('en'),
      translations: PosTranslations(),
      home:
          home ??
          Scaffold(
            body: Align(
              alignment: Alignment.bottomLeft,
              child: TextButton(
                onPressed: onTap,
                child: const Text('Underneath'),
              ),
            ),
          ),
    ),
  );
  await tester.pumpAndSettle();
}

class DelayedRegister extends RegisterController {
  DelayedRegister(super.database);

  final completion = Completer<void>();
  int commands = 0;
  String? billId;

  @override
  Json get operatingContext => {'business_date': '2026-11-17'};

  @override
  Future<void> sendCommand(RegisterAction action, Json body) async {
    commands++;
    billId = body['bill_id'] as String?;
    await completion.future;
  }
}

class StartingRegister extends RegisterController {
  StartingRegister(super.database);

  final completion = Completer<void>();

  @override
  Future<void> initializeRegister() => run(() async {
    await completion.future;
    stage.value = RegisterStage.activation;
  });
}

class StartupDatabase extends RegisterDatabase {
  StartupDatabase() : super(NativeDatabase.memory());

  @override
  Stream<StoreOperatingEvent?> watchStoreEventHead() => const Stream.empty();

  @override
  Future<RegisterInstallation?> installation() async => null;

  @override
  Future<List<RegisterOperator>> operators() async => [];

  @override
  Future<Json?> readUiPreferences() async => null;
}

void main() {
  tearDown(Get.reset);

  testWidgets('post-frame loading keeps a handle that closes its dialog', (
    tester,
  ) async {
    await mount(tester);
    final opened = Completer<LoadingHandle>();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      opened.complete(app.showLoading());
    });
    // An existing end-of-frame waiter can finish before the dialog is built.
    final currentFrame = WidgetsBinding.instance.endOfFrame;
    await tester.pump();
    await currentFrame;
    await tester.pump();
    final loading = await opened.future;
    loading.close();
    await tester.pump();
    expect(find.byType(LoadingDialogWidget), findsNothing);
    expect(app.isLoading, isFalse);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'a fresh installation opens an enabled login without a stuck loader',
    (tester) async {
      final database = StartupDatabase();
      final register = RegisterController(database);
      Get.put<RegisterController>(register);
      try {
        final firstFrame = WidgetsBinding.instance.endOfFrame;
        await tester.pumpWidget(const PosApp());
        await firstFrame;
        await tester.pump();
        await tester.pump();
        expect(register.stage.value, RegisterStage.activation);
        expect(register.busy.value, isFalse);
        expect(find.byType(LoginScreen), findsOneWidget);
        expect(find.byType(LoadingDialogWidget), findsNothing);
        expect(
          tester.widget<TextField>(find.byType(TextField).first).enabled,
          isTrue,
        );
        expect(tester.takeException(), isNull);
      } finally {
        await Get.delete<RegisterController>(force: true);
        await tester.pumpWidget(const SizedBox.shrink());
        Get.reset();
        await database.close();
      }
    },
  );

  testWidgets('startup waits for the navigator and uses the shared loader', (
    tester,
  ) async {
    final database = StartupDatabase();
    final register = StartingRegister(database);
    Get.put<RegisterController>(register);
    try {
      await tester.pumpWidget(const PosApp());
      await tester.pump();
      expect(register.stage.value, RegisterStage.loading);
      expect(register.busy.value, isTrue);
      expect(find.byType(LoadingDialogWidget), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsNothing);

      register.completion.complete();
      await tester.pumpAndSettle();
      expect(register.stage.value, RegisterStage.activation);
      expect(register.busy.value, isFalse);
      expect(find.byType(LoadingDialogWidget), findsNothing);
      expect(tester.takeException(), isNull);
    } finally {
      await Get.delete<RegisterController>(force: true);
      await tester.pumpWidget(const SizedBox.shrink());
      Get.reset();
      await database.close();
    }
  });

  for (final failure in [false, true]) {
    testWidgets(
      'register actions use one loader and dismiss it after ${failure ? 'failure' : 'success'}',
      (tester) async {
        final database = RegisterDatabase(NativeDatabase.memory());
        addTearDown(database.close);
        final register = RegisterController(database);
        final completion = Completer<void>();
        var actions = 0;
        var taps = 0;
        await mount(tester, onTap: () => taps++);
        final operation = register.run(() async {
          actions++;
          await completion.future;
        });
        await tester.pump();
        expect(app.isLoading, isTrue);
        expect(find.byType(LoadingDialogWidget), findsOneWidget);
        await tester.tap(find.text('Underneath'), warnIfMissed: false);
        expect(taps, 0);
        await register.run(() async => actions++);
        expect(actions, 1);

        if (failure) {
          completion.completeError(
            const PosApiError(409, 'ACTION_FAILED', 'Action failed'),
          );
        } else {
          completion.complete();
        }
        await operation;
        await tester.pumpAndSettle();
        expect(register.busy.value, isFalse);
        expect(register.message.value, failure ? 'ACTION_FAILED' : null);
        expect(app.isLoading, isFalse);
        expect(find.byType(LoadingDialogWidget), findsNothing);
        await tester.tap(find.text('Underneath'));
        expect(taps, 1);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets(
    'loading returns its handle while blocking taps, escape, and back',
    (tester) async {
      var taps = 0;
      await mount(tester, onTap: () => taps++);
      final loading = await showLoading(tester);
      expect(find.text('Loading...'), findsOneWidget);
      expect(find.byType(LoadingDialogWidget), findsOneWidget);

      await tester.tap(find.text('Underneath'), warnIfMissed: false);
      await tester.tapAt(const Offset(8, 8));
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.binding.handlePopRoute();
      await tester.pump();
      expect(taps, 0);
      expect(find.byType(LoadingDialogWidget), findsOneWidget);

      loading.close();
      loading.close();
      await tester.pumpAndSettle();
      expect(find.byType(LoadingDialogWidget), findsNothing);
      await tester.tap(find.text('Underneath'));
      expect(taps, 1);
    },
  );

  testWidgets(
    'each loading handle closes its own modal without popping another',
    (tester) async {
      await mount(tester);
      final first = await showLoading(tester, 'First operation');
      final second = await showLoading(tester, 'Second operation');
      first.close();
      await tester.pump();
      expect(find.text('Second operation'), findsOneWidget);
      expect(find.text('First operation'), findsNothing);
      first.close();
      expect(Get.isDialogOpen, isTrue);

      second.close();
      await tester.pumpAndSettle();
      expect(Get.isDialogOpen, isFalse);
      expect(find.text('Underneath'), findsOneWidget);
    },
  );

  testWidgets('closing loading preserves an unrelated dialog above it', (
    tester,
  ) async {
    await mount(tester);
    final loading = await showLoading(tester);
    Get.dialog<void>(
      const AlertDialog(content: Text('Another dialog')),
      transitionDuration: Duration.zero,
    );
    await tester.pump();
    loading.close();
    await tester.pump();
    expect(find.text('Another dialog'), findsOneWidget);
    expect(Get.isDialogOpen, isTrue);
    Get.back<void>();
    await tester.pumpAndSettle();
    loading.close();
    expect(find.text('Underneath'), findsOneWidget);
    expect(Get.isDialogOpen, isFalse);
  });

  for (final failure in [false, true]) {
    testWidgets(
      'switching from a submitted order closes its loader after ${failure ? 'failure' : 'success'}',
      (tester) async {
        final database = RegisterDatabase(NativeDatabase.memory());
        addTearDown(database.close);
        final register = DelayedRegister(database);
        register.snapshot.value = {
          'context': {
            'profile': {
              'name': 'Counter',
              'config': {'table_mode': 'required'},
            },
            'business': {'currency': 'USD', 'secondary_exchange_rate': '4000'},
          },
          'catalog': {'products': []},
          'tables': [
            {'id': 'a', 'code': 'A', 'label': 'Table A'},
            {'id': 'b', 'code': 'B', 'label': 'Table B'},
          ],
        };
        const line = CartLine({
          'id': 'coffee',
          'name': 'Coffee',
          'price_minor': 250,
        });
        final bill = HeldBill(
          id: 'submitted-bill',
          profileId: 'counter',
          tableId: 'a',
          revision: 1,
          updatedAt: DateTime.utc(2026, 11, 17),
          payload: jsonEncode({
            'status': 'submitted',
            'table_status': 'occupied',
            'quote_context': register.context,
            'lines': [line.heldSnapshot],
          }),
        );
        register.heldBills.add(bill);
        register.resumeBill(bill);
        register.tab.value = RegisterController.tablesTab;
        await mount(tester, home: RegisterShell(register));
        await tester.tap(find.text('Table B'));
        await tester.pump();
        expect(register.commands, 1);
        expect(register.billId, bill.id);
        expect(register.busy.value, isTrue);
        expect(find.byType(LoadingDialogWidget), findsOneWidget);
        expect(find.byType(LinearProgressIndicator), findsNothing);

        final controller = Get.find<SaleController>();
        await controller.openTable(
          tester.element(find.byType(RegisterShell)),
          register.tables.last,
        );
        expect(register.commands, 1);
        if (failure) {
          register.completion.completeError(
            const PosApiError(409, 'TABLE_OCCUPIED', 'Table unavailable'),
          );
        } else {
          register.completion.complete();
        }
        await tester.pumpAndSettle();
        expect(find.byType(LoadingDialogWidget), findsNothing);
        expect(controller.openingTable.value, isFalse);
        expect(register.busy.value, isFalse);
        expect(register.tableId.value, failure ? 'a' : 'b');
        if (failure) expect(register.message.value, 'TABLE_OCCUPIED');
        expect(tester.takeException(), isNull);
      },
    );
  }
}
