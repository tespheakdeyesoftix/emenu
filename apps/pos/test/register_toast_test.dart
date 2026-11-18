import 'package:drift/native.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:emenu_pos/features/register/register_controller.dart';
import 'package:emenu_pos/shared/app_theme.dart';
import 'package:emenu_pos/ui/register_app.dart';
import 'package:emenu_pos/ui/shared_widgets.dart';
import 'package:emenu_pos/ui/translations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';

void main() {
  late RegisterDatabase database;
  late RegisterController register;

  setUp(() {
    database = RegisterDatabase(NativeDatabase.memory());
    register = RegisterController(database)
      ..snapshot.value = {
        'context': {
          'profile': {
            'name': 'Counter',
            'config': {'table_mode': 'disabled', 'tax_mode': 'disabled'},
          },
          'business': {'currency': 'USD', 'secondary_exchange_rate': '4000'},
          'payment_types': [],
        },
        'catalog': {'products': []},
        'tables': [],
        'customers': [],
      };
    register.online.value = true;
  });

  tearDown(() async {
    Get.reset();
    await database.close();
  });

  Future<void> mount(WidgetTester tester, {bool compact = false}) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = compact
        ? const Size(390, 760)
        : const Size(1200, 800);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      GetMaterialApp(
        theme: AppTheme.light,
        locale: Locale(compact ? 'km' : 'en'),
        supportedLocales: const [Locale('en'), Locale('km')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        translations: PosTranslations(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: TextScaler.linear(compact ? 1.5 : 1)),
          child: child!,
        ),
        home: RegisterShell(register),
      ),
    );
    await tester.pumpAndSettle();
  }

  final toast = find.byKey(const ValueKey('register-toast'));

  testWidgets(
    'errors are temporary overlays and do not move the sales layout',
    (tester) async {
      await mount(tester);
      final panel = find.byKey(const ValueKey('sale-order-panel'));
      final originalPosition = tester.getRect(panel);
      register.message.value = 'TABLE_OCCUPIED';
      await tester.pumpAndSettle();
      expect(toast, findsOneWidget);
      expect(find.byType(RegisterNotice), findsNothing);
      expect(tester.getRect(panel), originalPosition);
      expect(
        tester.widget<Material>(toast).color,
        AppTheme.light.colorScheme.errorContainer,
      );
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();
      expect(toast, findsNothing);
      expect(register.message.value, 'TABLE_OCCUPIED');
      register.online.value = false;
      await tester.pumpAndSettle();
      expect(toast, findsNothing);
      expect(tester.getRect(panel), originalPosition);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('new messages replace the toast and restart its timeout', (
    tester,
  ) async {
    await mount(tester);
    register.message.value = 'TABLE_OCCUPIED';
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 2));
    register.message.value = 'MENU_RELOADED';
    await tester.pumpAndSettle();
    expect(find.text('TABLE_OCCUPIED'.tr), findsNothing);
    expect(find.text('MENU_RELOADED'.tr), findsOneWidget);
    expect(
      tester.widget<Material>(toast).color,
      AppTheme.light.colorScheme.primaryContainer,
    );
    await tester.pump(const Duration(seconds: 2));
    expect(toast, findsOneWidget);
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();
    expect(toast, findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'toasts close manually and repeated actions can display the same message',
    (tester) async {
      await mount(tester);
      register.message.value = 'SAVED';
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Close'));
      await tester.pumpAndSettle();
      expect(toast, findsNothing);
      register.message.value = null;
      await tester.pump();
      register.message.value = 'SAVED';
      await tester.pumpAndSettle();
      expect(toast, findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(seconds: 5));
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'compact Khmer toasts wrap within the screen and preserve pending state',
    (tester) async {
      await mount(tester, compact: true);
      register.commandPending.value = true;
      await tester.pumpAndSettle();
      expect(find.text('STORE_COMMAND_PENDING'.tr), findsOneWidget);
      expect(toast, findsOneWidget);
      final rect = tester.getRect(toast);
      expect(rect.left, greaterThanOrEqualTo(16));
      expect(rect.right, lessThanOrEqualTo(374));
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();
      expect(toast, findsNothing);
      expect(register.commandPending.value, isTrue);
      expect(tester.takeException(), isNull);
    },
  );
}
