// Run with `flutter test tool/ui_preview_test.dart` to refresh UI previews.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:drift/native.dart';
import 'package:emenu_pos/core/pos_api.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:emenu_pos/features/register/register_controller.dart';
import 'package:emenu_pos/features/sales/sale/widgets/payment_dialog.dart';
import 'package:emenu_pos/global.dart';
import 'package:emenu_pos/shared/app_theme.dart';
import 'package:emenu_pos/auths/login_binding.dart';
import 'package:emenu_pos/auths/login_screen.dart';
import 'package:emenu_pos/ui/register_app.dart';
import 'package:emenu_pos/ui/translations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';

const _operator = RegisterOperator(
  id: 'operator',
  email: 'dara@example.test',
  displayName: 'Dara Sok',
  role: 'owner',
  failedPins: 0,
  accessRevoked: false,
);

const _products = [
  {
    'id': 'flat-white',
    'name': 'Flat white',
    'name_km': 'កាហ្វេទឹកដោះគោ',
    'code': 'C01',
    'price_minor': 350,
    'category_id': 'coffee',
    'unit': 'Cup',
  },
  {
    'id': 'iced-latte',
    'name': 'Iced latte',
    'name_km': 'ឡាតេទឹកកក',
    'code': 'C02',
    'price_minor': 400,
    'category_id': 'coffee',
    'unit': 'Cup',
  },
  {
    'id': 'americano',
    'name': 'Americano',
    'name_km': 'អាមេរិកាណូ',
    'code': 'C03',
    'price_minor': 250,
    'category_id': 'coffee',
    'unit': 'Cup',
  },
  {
    'id': 'matcha',
    'name': 'Matcha latte',
    'name_km': 'ម៉ាត់ឆាទឹកដោះគោ',
    'code': 'T01',
    'price_minor': 450,
    'category_id': 'tea',
    'unit': 'Cup',
  },
  {
    'id': 'croissant',
    'name': 'Butter croissant',
    'name_km': 'នំប៊ឺ',
    'code': 'B01',
    'price_minor': 300,
    'category_id': 'bakery',
    'unit': 'Piece',
  },
  {
    'id': 'toast',
    'name': 'Avocado toast',
    'name_km': 'នំប៉័ងបឺរ',
    'code': 'B02',
    'price_minor': 650,
    'category_id': 'bakery',
    'unit': 'Plate',
  },
  {
    'id': 'lemonade',
    'name': 'House lemonade',
    'name_km': 'ទឹកក្រូចឆ្មា',
    'code': 'D01',
    'price_minor': 300,
    'category_id': 'tea',
    'unit': 'Glass',
  },
  {
    'id': 'cookie',
    'name': 'Chocolate cookie',
    'name_km': 'នំសូកូឡា',
    'code': 'B03',
    'price_minor': 200,
    'category_id': 'bakery',
    'unit': 'Piece',
  },
];

Json _snapshot() => {
  'context': {
    'profile': {
      'name': 'Atelier Café · Riverside',
      'config': {
        'table_mode': 'optional',
        'prompt_guest_cover': true,
        'working_day_enabled': true,
        'cashier_shift_enabled': true,
        'default_payment_type_id': 'cash',
        'tax_mode': 'disabled',
      },
    },
    'business': {'currency': 'USD', 'secondary_exchange_rate': '4000'},
    'working_day': {'id': 'day', 'business_date': '2026-11-17'},
    'cashier_shift': {'id': 'shift'},
    'payment_types': [
      {'id': 'cash', 'name': 'Cash', 'kind': 'cash', 'currency': 'USD'},
      {'id': 'qr', 'name': 'ABA Pay', 'kind': 'qr', 'currency': 'USD'},
    ],
    'capabilities': {'cart_line_edits': true, 'staff_usernames': true},
  },
  'catalog': {
    'mode': 'category',
    'nodes': [
      {'id': 'coffee', 'name': 'Coffee', 'name_km': 'កាហ្វេ'},
      {'id': 'tea', 'name': 'Tea & drinks', 'name_km': 'តែ និងភេសជ្ជៈ'},
      {'id': 'bakery', 'name': 'Bakery', 'name_km': 'នំប៉័ង'},
    ],
    'products': _products,
  },
  'tables': [
    for (var i = 1; i <= 10; i++)
      {
        'id': 't$i',
        'code': 'T${i.toString().padLeft(2, '0')}',
        'label': [
          'Window seat',
          'Garden table',
          'Corner booth',
          'Long table',
        ][(i - 1) % 4],
        'group_id': 'dining',
        'group_name': 'Dining room',
        'status': [
          'vacant',
          'occupied',
          'bill_requested',
          'hold',
          'booked',
        ][(i - 1) % 5],
        if (i % 5 == 2) 'open_sale_id': 'external$i',
      },
  ],
  'customers': [
    {'id': 'walk-in', 'name': 'Walk-in customer', 'name_km': 'ភ្ញៀវទូទៅ'},
  ],
};

Future<void> _scene(
  WidgetTester tester,
  String name, {
  Size size = const Size(1440, 960),
  int tab = RegisterController.sellTab,
  String language = 'en',
  double scale = 1,
  bool login = false,
  String? dialog,
}) async {
  final database = RegisterDatabase(NativeDatabase.memory());
  final register = RegisterController(database);
  register.snapshot.value = _snapshot();
  register.operator.value = _operator;
  register.online.value = true;
  register.staff.add(_operator);
  register.pinConfigured.value = true;
  register.tab.value = tab;
  if (login) {
    register.stage.value = RegisterStage.locked;
    register.installation.value = const RegisterInstallation(
      id: 1,
      apiOrigin: 'https://pos.example.test',
      businessSlug: 'atelier-cafe',
      businessId: 'business',
      branchId: 'riverside',
      profileId: 'counter',
    );
  } else {
    register.add(CartLine(_products.first, quantity: 2));
    register.add(CartLine(_products[4]));
    register.add(CartLine(_products[3], note: 'Oat milk'));
  }
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  final boundaryKey = GlobalKey();
  await tester.pumpWidget(
    RepaintBoundary(
      key: boundaryKey,
      child: GetMaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        locale: Locale(language),
        supportedLocales: const [Locale('en'), Locale('km')],
        translations: PosTranslations(),
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        initialBinding: LoginBinding(register),
        home: login ? const LoginScreen() : RegisterShell(register),
      ),
    ),
  );
  await tester.pumpAndSettle();
  if (dialog == 'number') {
    app.input_number(
      title: language == 'km' ? 'ចំនួនភ្ញៀវ' : 'Guest count',
      value: 4,
      min: 1,
      max: 1000,
    );
    await tester.pumpAndSettle();
  } else if (dialog == 'payment') {
    Get.dialog<void>(
      PaymentDialog(
        total: register.cartTotal,
        currency: 'USD',
        rate: '4000',
        types: register.paymentTypes,
        defaultType: 'cash',
      ),
    );
    await tester.pumpAndSettle();
  }
  expect(tester.takeException(), isNull, reason: name);
  await tester.runAsync(() async {
    final boundary = tester.renderObject<RenderRepaintBoundary>(
      find.byKey(boundaryKey),
    );
    final image = await boundary.toImage();
    try {
      final pixels = await image.toByteData(format: ui.ImageByteFormat.png);
      final file = File('build/ui_preview/$name.png');
      await file.parent.create(recursive: true);
      await file.writeAsBytes(pixels!.buffer.asUint8List());
    } finally {
      image.dispose();
    }
  });
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pumpAndSettle();
  Get.reset();
  await database.close();
}

void main() {
  testWidgets(
    'render desktop and mobile workspaces with the production theme',
    (tester) async {
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.runAsync(() async {
        await (FontLoader(
          'Noto Sans Khmer',
        )..addFont(rootBundle.load('assets/fonts/NotoSansKhmer.ttf'))).load();
        await (FontLoader(
          'MaterialIcons',
        )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
      });
      await _scene(tester, 'sale-desktop');
      await _scene(tester, 'tables-desktop', tab: RegisterController.tablesTab);
      await _scene(tester, 'shift-desktop', tab: RegisterController.shiftTab);
      await _scene(
        tester,
        'profile-desktop',
        tab: RegisterController.profileTab,
      );
      await _scene(tester, 'login-desktop', login: true);
      await _scene(tester, 'payment-desktop', dialog: 'payment');
      await _scene(tester, 'number-desktop', dialog: 'number');
      await _scene(tester, 'sale-mobile', size: const Size(390, 844));
      await _scene(
        tester,
        'tables-mobile-km',
        size: const Size(390, 844),
        language: 'km',
        tab: RegisterController.tablesTab,
      );
      await _scene(
        tester,
        'login-mobile-km',
        size: const Size(390, 844),
        language: 'km',
        login: true,
      );
      await _scene(
        tester,
        'sale-accessibility',
        size: const Size(1024, 768),
        language: 'km',
        scale: 1.5,
      );
    },
  );
}
