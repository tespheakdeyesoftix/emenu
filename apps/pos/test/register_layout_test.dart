import 'package:drift/native.dart';
import 'package:emenu_pos/core/pos_api.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:emenu_pos/features/register/register_controller.dart';
import 'package:emenu_pos/ui/register_app.dart';
import 'package:emenu_pos/ui/translations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';

class _StaffRegister extends RegisterController {
  _StaffRegister(super.database);

  (String, String)? saved;

  @override
  Future<List<Json>?> loadStaffUsernames() async {
    List<Json>? rows;
    await run(() async {
      rows = [
        {'user_id': 'cashier', 'name': 'Cashier', 'username': null},
      ];
    });
    return rows;
  }

  @override
  Future<Json?> setStaffUsername(String id, String input) async {
    saved = (id, input);
    return {'user_id': id, 'username': input};
  }
}

void main() {
  testWidgets('a manager assigns a username from the desktop register', (
    tester,
  ) async {
    final database = RegisterDatabase(NativeDatabase.memory());
    addTearDown(database.close);
    addTearDown(Get.reset);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(1150, 800);
    final controller = _StaffRegister(database);
    controller.operator.value = const RegisterOperator(
      id: 'manager',
      email: 'manager@example.test',
      displayName: 'Manager',
      role: 'manager',
      failedPins: 0,
      accessRevoked: false,
    );
    controller.snapshot.value = {
      'context': {
        'profile': {
          'name': 'Main',
          'config': {'table_mode': 'disabled'},
        },
        'business': {'currency': 'USD'},
        'capabilities': {'staff_usernames': true},
      },
      'catalog': {'products': []},
      'tables': [],
      'customers': [],
    };
    await tester.pumpWidget(
      GetMaterialApp(
        locale: const Locale('en'),
        translations: PosTranslations(),
        home: RegisterShell(controller),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Staff usernames'));
    await tester.pumpAndSettle();
    expect(find.text('Cashier'), findsOneWidget);
    await tester.enterText(
      find.widgetWithText(TextField, 'Username'),
      'front-till',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();
    expect(controller.saved, ('cashier', 'front-till'));
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'Khmer sales view adapts to a desktop rail and phone navigation',
    (tester) async {
      final database = RegisterDatabase(NativeDatabase.memory());
      addTearDown(database.close);
      addTearDown(Get.reset);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1150, 800);

      final controller = RegisterController(database);
      controller.snapshot.value = {
        'context': {
          'profile': {
            'name': 'Main register',
            'config': {
              'table_mode': 'disabled',
              'tax_mode': 'disabled',
              'tax_rate_bps': 0,
            },
          },
          'business': {'currency': 'KHR'},
        },
        'catalog': {
          'products': [
            {
              'id': 'coffee',
              'name': 'Coffee',
              'name_km': 'កាហ្វេ',
              'price_minor': 8000,
            },
          ],
        },
        'tables': [],
        'customers': [],
      };
      await tester.pumpWidget(
        GetMaterialApp(
          locale: const Locale('km'),
          supportedLocales: const [Locale('km'), Locale('en')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          translations: PosTranslations(),
          home: RegisterShell(controller),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(NavigationRail), findsOneWidget);
      expect(find.text('ការលក់'), findsOneWidget);
      final coffee = find.widgetWithText(OutlinedButton, 'កាហ្វេ');
      await tester.tap(coffee);
      await tester.pump();
      expect(controller.cart.length, 1);
      expect(controller.cartTotal, 8000);
      await tester.tap(coffee);
      await tester.pump();
      expect(controller.cart.single.quantity, 2);
      expect(controller.cartTotal, 16000);
      tester.view.physicalSize = const Size(430, 800);
      await tester.pumpAndSettle();
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(
        find.byTooltip(
          MaterialLocalizations.of(tester.element(find.byType(Scaffold)))
              .openAppDrawerTooltip,
        ),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );
}
