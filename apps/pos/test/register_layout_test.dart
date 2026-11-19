import 'dart:io';

import 'package:emenu_pos/shared/app_theme.dart';
import 'package:drift/native.dart';
import 'package:emenu_pos/core/pos_api.dart';
import 'package:emenu_pos/core/register_authority.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:emenu_pos/features/register/register_controller.dart';
import 'package:emenu_pos/auths/login_binding.dart';
import 'package:emenu_pos/auths/login_screen.dart';
import 'package:emenu_pos/auths/login_service.dart';
import 'package:emenu_pos/features/customers/customer_screen.dart';
import 'package:emenu_pos/features/sales/sale/widgets/cart_item_row.dart';
import 'package:emenu_pos/features/sales/sale/widgets/bill_table_chip.dart';
import 'package:emenu_pos/features/sales/sale/widgets/product_card.dart';
import 'package:emenu_pos/ui/register_app.dart';
import 'package:emenu_pos/features/sales/sale/widgets/sale_cart.dart';
import 'package:emenu_pos/features/sales/sale/widgets/select_table_number_widget.dart';
import 'package:emenu_pos/features/sales/sale/sell_view.dart';
import 'package:emenu_pos/features/sales/table/table_plan_view.dart';
import 'package:emenu_pos/features/sales/table/widgets/table_card.dart';
import 'package:emenu_pos/ui/translations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

class _SubmitRegister extends RegisterController {
  _SubmitRegister(super.database);

  final submissions = <(RegisterAction, Json)>[];
  bool rejectSubmission = false;

  @override
  Json get operatingContext => {
    'business_date': '2026-11-18',
    'working_day_id': null,
    'shift_id': null,
  };

  @override
  Future<void> sendCommand(RegisterAction action, Json body) async {
    submissions.add((action, body));
    if (rejectSubmission) throw const FormatException('TABLE_OCCUPIED');
  }
}

class _PinLoginService extends LoginService {
  _PinLoginService(super.register);

  final attempts = <(String, String)>[];

  @override
  Future<void> unlock(String operatorId, String pin) async {
    attempts.add((operatorId, pin));
    register.message.value = 'INVALID_PIN';
  }
}

class _CustomerRegister extends RegisterController {
  _CustomerRegister(super.database);
  final photos = <String, Json>{};

  @override
  Future<Json> requestCustomers(Json input) async {
    if (input['operation'] == 'groups') return {'customer_groups': []};
    final id = input['customer_id'] as String? ?? 'added-customer';
    if (input['operation'] == 'photo') return photos[id]!;
    final rows = customers.where((row) => row['id'] != id).toList();
    if (input['operation'] == 'delete') {
      photos.remove(id);
      snapshot.value = {...snapshot.value!, 'customers': rows};
      return {'success': true};
    }
    final fields = jsonObject(input['fields']);
    final upload = fields.remove('photo_upload');
    if (upload != null) photos[id] = jsonObject(upload);
    if (fields.containsKey('photo')) photos.remove(id);
    final saved = {
      ...?customers.where((row) => row['id'] == id).firstOrNull,
      ...fields,
      'has_uploaded_photo': photos.containsKey(id) ? 1 : 0,
      'id': id,
    };
    snapshot.value = {
      ...snapshot.value!,
      'customers': [...rows, saved],
    };
    return saved;
  }
}

void main() {
  testWidgets(
    'Customers rail opens a searchable directory with customer CRUD',
    (tester) async {
      final database = RegisterDatabase(NativeDatabase.memory());
      addTearDown(database.close);
      addTearDown(Get.reset);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1200, 820);
      final register = _CustomerRegister(database);
      final base = _tableSnapshot('disabled');
      register.snapshot.value = {
        ...base,
        'context': {
          ...jsonObject(base['context']),
          'capabilities': {
            'customer_directory': true,
            'customer_photo_upload': true,
          },
        },
        'customers': [
          {'id': 'walk', 'name': 'Walk-in', 'is_walk_in': 1},
          {
            'id': 'regular',
            'name': 'Regular customer',
            'phone_number': '012345678',
          },
        ],
      };
      register.online.value = true;
      await tester.pumpWidget(
        GetMaterialApp(
          theme: AppTheme.light,
          locale: const Locale('en'),
          translations: PosTranslations(),
          home: RegisterShell(register),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Customers'));
      await tester.pumpAndSettle();
      expect(find.byType(CustomerScreen), findsOneWidget);
      final search = find.byType(TextField);
      await tester.enterText(search, '01234');
      await tester.pumpAndSettle();
      expect(find.text('Regular customer'), findsOneWidget);
      expect(find.byKey(const ValueKey('walk')), findsNothing);
      await tester.enterText(search, '');
      await tester.pumpAndSettle();

      await tester.tap(find.byTooltip('Add customer'));
      await tester.pumpAndSettle();
      final name = find.widgetWithText(TextFormField, 'Customer name *');
      await tester.enterText(name, 'New diner');
      const imagePicker = MethodChannel('plugins.flutter.io/image_picker');
      final messenger = tester.binding.defaultBinaryMessenger;
      messenger.setMockMethodCallHandler(imagePicker, (call) async {
        expect(call.method, 'pickImage');
        return File('android/app/src/main/res/mipmap-mdpi/ic_launcher.png')
            .absolute
            .path;
      });
      addTearDown(() => messenger.setMockMethodCallHandler(imagePicker, null));
      final upload = tester.widget<OutlinedButton>(
        find.ancestor(
          of: find.text('Upload photo'),
          matching: find.byWidgetPredicate(
            (widget) => widget is OutlinedButton,
          ),
        ),
      );
      await tester.runAsync(upload.onPressed! as Future<void> Function());
      await tester.pumpAndSettle();
      expect(find.byTooltip('Remove photo'), findsOneWidget);
      await tester.tap(find.widgetWithText(CheckboxListTile, 'Membership'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();
      expect(find.text('Membership requires a customer code'), findsOneWidget);
      final code = find.widgetWithText(TextFormField, 'Customer code *');
      await tester.enterText(code, 'MEM-123');
      final gender = find.widgetWithText(
        DropdownButtonFormField<String>,
        'Gender',
      );
      await tester.ensureVisible(gender);
      await tester.tap(gender);
      await tester.pumpAndSettle();
      expect(find.text('Male').last.hitTestable(), findsOneWidget);
      await tester.tap(find.text('Female').last);
      await tester.pumpAndSettle();
      final birthDate = find.widgetWithText(InkWell, 'Date of birth');
      await tester.ensureVisible(birthDate);
      await tester.tap(birthDate);
      await tester.pumpAndSettle();
      expect(find.byType(DatePickerDialog), findsOneWidget);
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();
      final added = register.sales.customerDirectory.byId('added-customer')!;
      expect(added['customer_code'], 'MEM-123');
      expect(added['is_membership'], true);
      expect(added['gender'], 'Female');
      expect(added['dob'], DateTime.now().toIso8601String().substring(0, 10));
      expect(added['has_uploaded_photo'], 1);
      expect(register.photos['added-customer']!['content_type'], 'image/png');
      expect(
        register.sales.customerDirectory.byId('added-customer')?['name'],
        'New diner',
      );
      await tester.tap(find.text('New diner'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Remove photo'));
      await tester.pumpAndSettle();
      await tester.enterText(name, 'Updated diner');
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();
      expect(register.photos, isEmpty);

      await tester.tap(find.text('Updated diner'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Delete customer'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
      await tester.pumpAndSettle();
      expect(find.text('Updated diner'), findsNothing);
      expect(register.sales.customerDirectory.byId('added-customer'), isNull);

      tester.view.physicalSize = const Size(430, 800);
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Back to Sell'));
      await tester.pumpAndSettle();
      expect(find.byType(SellView), findsOneWidget);
    },
  );

  testWidgets('PIN sign-in supports touch entry and keyboard submission', (
    tester,
  ) async {
    final database = RegisterDatabase(NativeDatabase.memory());
    addTearDown(database.close);
    addTearDown(Get.reset);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 680);

    final controller = RegisterController(database);
    final login = _PinLoginService(controller);
    Get.put<LoginService>(login);
    controller.stage.value = RegisterStage.locked;
    controller.installation.value = const RegisterInstallation(
      id: 1,
      apiOrigin: 'http://127.0.0.1:8787',
      businessSlug: 'fixture',
      businessId: 'business',
      branchId: 'branch',
      profileId: 'profile',
    );
    controller.staff.add(
      const RegisterOperator(
        id: 'cashier',
        email: 'cashier@example.test',
        displayName: 'Cashier',
        role: 'editor',
        failedPins: 0,
        accessRevoked: false,
      ),
    );

    await tester.pumpWidget(
      GetMaterialApp(
        initialBinding: LoginBinding(controller),
        theme: AppTheme.light,
        locale: const Locale('en'),
        translations: PosTranslations(),
        home: const LoginScreen(),
      ),
    );
    await tester.pumpAndSettle();

    final field = find.widgetWithText(TextField, '6-digit PIN');
    final signIn = find.widgetWithText(FilledButton, 'Sign in');
    final pin = tester.widget<TextField>(field).controller!;
    expect(tester.widget<TextField>(field).obscureText, isTrue);
    expect(tester.widget<FilledButton>(signIn).onPressed, isNull);
    Future<void> tap(Finder button) async {
      await tester.ensureVisible(button);
      await tester.tap(button);
      await tester.pumpAndSettle();
    }

    await tap(find.widgetWithText(OutlinedButton, '9'));
    await tap(find.byTooltip('Clear PIN entry'));
    expect(pin.text, isEmpty);

    for (final digit in '012349'.split('')) {
      await tap(find.widgetWithText(OutlinedButton, digit));
    }
    final extraDigit = find.widgetWithText(OutlinedButton, '7');
    expect(tester.widget<OutlinedButton>(extraDigit).onPressed, isNull);
    await tap(find.byTooltip('Delete PIN digit'));
    expect(pin.text, '01234');
    expect(tester.widget<FilledButton>(signIn).onPressed, isNull);
    await tap(find.widgetWithText(OutlinedButton, '5'));
    await tap(signIn);
    expect(login.attempts, [('cashier', '012345')]);
    expect(pin.text, isEmpty);
    expect(find.text('Incorrect PIN'), findsOneWidget);

    await tester.ensureVisible(field);
    await tester.enterText(field, '12x3456');
    await tester.pumpAndSettle();
    expect(pin.text, '123456');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();
    expect(login.attempts.last, ('cashier', '123456'));

    await tap(find.widgetWithText(TextButton, 'Sign in with password'));
    final password = find.widgetWithText(TextField, 'Password');
    expect(tester.widget<TextField>(password).controller!.text, isEmpty);
    expect(find.widgetWithText(OutlinedButton, '1'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  for (final (apiOrigin, useDefaults) in [
    ('http://127.0.0.1:8787', true),
    ('https://pos.example.test', false),
  ]) {
    testWidgets('bakery debug sign-in prefills only on loopback ($apiOrigin)', (
      tester,
    ) async {
      final database = RegisterDatabase(NativeDatabase.memory());
      addTearDown(database.close);
      addTearDown(Get.reset);
      final controller = RegisterController(database);
      controller.stage.value = RegisterStage.locked;
      controller.installation.value = RegisterInstallation(
        id: 1,
        apiOrigin: apiOrigin,
        businessSlug: 'pheakdey-backery',
        businessId: 'business',
        branchId: 'branch',
        profileId: 'profile',
      );

      await tester.pumpWidget(
        GetMaterialApp(
          initialBinding: LoginBinding(controller),
          theme: AppTheme.light,
          locale: const Locale('en'),
          translations: PosTranslations(),
          home: const LoginScreen(),
        ),
      );
      await tester.pumpAndSettle();

      final account = tester.widget<TextField>(
        find.widgetWithText(TextField, 'Username or email'),
      );
      final password = tester.widget<TextField>(
        find.widgetWithText(TextField, 'Password'),
      );
      expect(
        account.controller!.text,
        useDefaults ? 'cashier@pheakdey-backery.example.test' : '',
      );
      expect(password.controller!.text, useDefaults ? '12345678' : '');
      expect(password.obscureText, isTrue);
    });
  }

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
        theme: AppTheme.light,
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
          theme: AppTheme.light,
          locale: const Locale('km'),
          supportedLocales: const [Locale('km'), Locale('en')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          translations: PosTranslations(),
          home: RegisterShell(controller),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.byKey(const ValueKey('register-navigation-rail')),
        findsOneWidget,
      );
      expect(find.byTooltip('ការលក់'), findsOneWidget);
      expect(find.text('ការលក់'), findsNothing);
      final coffee = find.widgetWithText(ProductCard, 'កាហ្វេ');
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

  testWidgets(
    'sale toolbar debounces typing and submits product codes immediately',
    (tester) async {
      final database = RegisterDatabase(NativeDatabase.memory());
      addTearDown(database.close);
      addTearDown(Get.reset);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1250, 800);

      final controller = RegisterController(database);
      controller.snapshot.value = _tableSnapshot('disabled')
        ..['catalog'] = {
          'products': [
            {
              'id': 'coffee',
              'name': 'Coffee',
              'code': 'C1',
              'price_minor': 300,
            },
            {'id': 'tea', 'name': 'Tea', 'code': 'T1', 'price_minor': 200},
          ],
        };
      await tester.pumpWidget(
        GetMaterialApp(
          theme: AppTheme.light,
          locale: const Locale('en'),
          translations: PosTranslations(),
          home: RegisterShell(controller),
        ),
      );
      await tester.pumpAndSettle();

      final toolbar = find.byKey(const ValueKey('register-toolbar'));
      final search = find.descendant(
        of: toolbar,
        matching: find.byType(TextField),
      );
      final coffee = find.widgetWithText(ProductCard, 'Coffee');
      final tea = find.widgetWithText(ProductCard, 'Tea');
      expect(search, findsOneWidget);
      for (final width in [1250.0, 1080.0, 900.0]) {
        tester.view.physicalSize = Size(width, 800);
        await tester.pumpAndSettle();
        final toolbarRect = tester.getRect(toolbar);
        final searchRect = tester.getRect(search);
        expect(searchRect.width, lessThanOrEqualTo(300));
        expect(searchRect.height, lessThanOrEqualTo(40));
        expect(searchRect.center.dx, closeTo(toolbarRect.center.dx, 1));
        expect(searchRect.center.dy, closeTo(toolbarRect.center.dy, 1));
      }
      expect(coffee, findsOneWidget);
      expect(tea, findsOneWidget);
      expect(
        find.descendant(of: coffee, matching: find.text('C1')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: coffee, matching: find.text(r'$3.00')),
        findsOneWidget,
      );

      await tester.enterText(search, 'Coffee');
      await tester.pump(const Duration(milliseconds: 500));
      expect(tea, findsOneWidget);
      await tester.enterText(search, ' tEA ');
      await tester.pump(const Duration(milliseconds: 699));
      expect(coffee, findsOneWidget);
      expect(tea, findsOneWidget);
      await tester.pump(const Duration(milliseconds: 1));
      expect(coffee, findsNothing);
      expect(tea, findsOneWidget);

      await tester.enterText(search, 'c1');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pump();
      expect(controller.cart.single.product['id'], 'coffee');
      expect(tester.widget<TextField>(search).controller!.text, isEmpty);
      await tester.pump(const Duration(milliseconds: 700));
      expect(coffee, findsOneWidget);
      expect(tea, findsOneWidget);

      tester.view.physicalSize = const Size(390, 800);
      await tester.pumpAndSettle();
      expect(search, findsOneWidget);
      await tester.enterText(search, 'Tea');
      await tester.tap(find.widgetWithText(NavigationDestination, 'Sales'));
      await tester.pump();
      expect(search, findsNothing);
      await tester.pump(const Duration(milliseconds: 700));
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('first PIN offer can be skipped and reopened from the rail', (
    tester,
  ) async {
    final database = RegisterDatabase(NativeDatabase.memory());
    addTearDown(database.close);
    addTearDown(Get.reset);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(1220, 780);
    final controller = RegisterController(database)..offerPinSetup = true;
    controller.operator.value = const RegisterOperator(
      id: 'cashier',
      email: 'cashier@example.test',
      displayName: 'Cashier',
      role: 'editor',
      failedPins: 0,
      accessRevoked: false,
    );
    controller.snapshot.value = _tableSnapshot('disabled');
    await tester.pumpWidget(
      GetMaterialApp(
        theme: AppTheme.light,
        locale: const Locale('en'),
        translations: PosTranslations(),
        home: RegisterShell(controller),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Set up a PIN?'), findsOneWidget);
    await tester.tap(find.text('Skip'));
    await tester.pumpAndSettle();
    expect(find.text('Table plan'), findsNothing);
    expect(find.byTooltip('Table plan'), findsNothing);
    expect(controller.pinConfigured.value, isFalse);
    await tester.tap(find.byTooltip('Profile'));
    await tester.pumpAndSettle();
    expect(find.text('cashier@example.test'), findsOneWidget);
    await tester.tap(find.text('PIN is off'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(OutlinedButton, '1'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'Confirm PIN'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('selected cart actions update the quote and keep paid options', (
    tester,
  ) async {
    final database = RegisterDatabase(NativeDatabase.memory());
    addTearDown(database.close);
    addTearDown(Get.reset);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(1250, 900);
    final sizes = [
      {'id': 'small', 'label': 'Small', 'price_minor': 250},
      {'id': 'large', 'label': 'Large', 'price_minor': 400},
    ];
    final milk = {'id': 'milk', 'label': 'Milk', 'price_minor': 25};
    final coffee = {
      'id': 'coffee',
      'name': 'Coffee',
      'code': 'C1',
      'price_minor': 250,
      'portions': sizes,
      'modifier_groups': [
        {
          'id': 'extras',
          'label': 'Extras',
          'options': [milk],
        },
      ],
    };
    final data = _tableSnapshot('disabled');
    data['context']['capabilities'] = {'cart_line_edits': true};
    data['catalog'] = {
      'products': [coffee],
    };
    final controller = RegisterController(database)..snapshot.value = data;
    controller.add(CartLine(coffee, portion: sizes.first, modifiers: [milk]));
    await tester.pumpWidget(
      GetMaterialApp(
        theme: AppTheme.light,
        locale: const Locale('en'),
        translations: PosTranslations(),
        home: RegisterShell(controller),
      ),
    );
    await tester.pumpAndSettle();

    Future<void> tap(Finder finder) async {
      await tester.ensureVisible(finder);
      await tester.tap(finder);
      await tester.pumpAndSettle();
    }

    Future<void> more(String label) async {
      await tap(
        find.byWidgetPredicate(
          (widget) => widget is PopupMenuButton && widget.tooltip == 'More',
        ),
      );
      await tap(
        find.byWidgetPredicate((widget) {
          if (widget is! PopupMenuItem) return false;
          final child = widget.child;
          return child is Text && child.data == label;
        }),
      );
    }

    Future<void> enter(String value) async {
      await tester.enterText(find.byType(TextFormField), value);
      await tap(find.widgetWithText(FilledButton, 'Save'));
    }

    final name = find.text('C1 · Coffee');
    await tap(name);
    await tap(find.widgetWithText(OutlinedButton, 'Price'));
    await enter('3.00');
    expect(controller.cart.single.unit, 325);
    await tap(find.widgetWithText(OutlinedButton, 'Qty'));
    await enter('2');
    await more('Note');
    await enter('No ice');
    expect(find.text('No ice'), findsOneWidget);
    await more('Discount');
    await enter('0.50');
    expect(controller.cartTotal, 600);
    expect(find.text('24000 ៛'), findsOneWidget);

    await more('Edit');
    expect(
      tester.widget<CheckboxListTile>(find.byType(CheckboxListTile)).value,
      isTrue,
    );
    await tap(find.widgetWithText(OutlinedButton, r'Large · $4.00'));
    await tap(find.widgetWithText(FilledButton, 'Save'));
    expect(controller.cart.single.basePriceOverride, isNull);
    expect(controller.cartTotal, 800);
    await tap(find.widgetWithText(OutlinedButton, 'Re-Order'));
    expect(controller.cart.length, 2);
    expect(controller.cart.last.unit, 425);
    expect(controller.cart.last.quantity, 1);
    expect(controller.cart.last.note, isNull);

    await more('Mark as Free');
    expect(controller.cartTotal, 425);
    expect(controller.cart.first.isFree, isTrue);
    await more('Restore Price');
    expect(controller.cartTotal, 1275);
    controller.snapshot.value = {
      ...data,
      'catalog': {
        'products': [
          {...coffee, 'modifier_groups': []},
        ],
      },
    };
    await tester.pumpAndSettle();
    await tap(find.widgetWithText(OutlinedButton, 'Re-Order'));
    expect(controller.cart.length, 2);
    expect(controller.message.value, 'SELECTION_CHANGED');
    controller.message.value = null;
    await tester.pumpAndSettle();
    await tap(find.widgetWithText(OutlinedButton, 'Delete'));
    await tap(find.widgetWithText(FilledButton, 'Delete'));
    expect(controller.cart.length, 1);

    tester.view.physicalSize = const Size(390, 680);
    await tester.pumpAndSettle();
    await tap(find.byType(Tab).last);
    expect(find.byType(CartItemRow), findsOneWidget);
    for (var index = 0; index < 12; index++) {
      controller.add(
        CartLine(
          {
            'id': 'fixture_$index',
            'name': 'កាហ្វេទឹកដោះគោទឹកកក និងស្ករតិច $index',
            'price_minor': 250,
          },
          modifiers: [
            milk,
            {'id': 'syrup', 'label': 'Syrup', 'price_minor': 75},
          ],
        ),
      );
    }
    await tester.pumpAndSettle();
    final pay = find.widgetWithText(FilledButton, 'Pay');
    final payPosition = tester.getCenter(pay);
    final list = find.descendant(
      of: find.byType(SaleCart),
      matching: find.byType(ListView),
    );
    await tester.drag(list, const Offset(0, -350));
    await tester.pumpAndSettle();
    expect(tester.getCenter(pay), payPosition);
    expect(pay.hitTestable(), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'required tables open a separate sale screen from the grouped plan',
    (tester) async {
      final database = RegisterDatabase(NativeDatabase.memory());
      addTearDown(database.close);
      addTearDown(Get.reset);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1220, 820);
      final controller = RegisterController(database);
      controller.snapshot.value = _tableSnapshot('required', prompt: true);
      controller.tab.value = controller.landingTab;
      await tester.pumpWidget(
        GetMaterialApp(
          theme: AppTheme.light,
          locale: const Locale('en'),
          translations: PosTranslations(),
          home: RegisterShell(controller),
        ),
      );
      await tester.pumpAndSettle();
      expect(controller.tab.value, RegisterController.tablesTab);
      final rail = find.byKey(const ValueKey('register-navigation-rail'));
      expect(
        find.descendant(of: rail, matching: find.byTooltip('Sell')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: rail, matching: find.byType(Text)),
        findsNothing,
      );
      expect(
        find.descendant(of: rail, matching: find.byTooltip('Table plan')),
        findsNothing,
      );
      await tester.tap(find.byTooltip('Sales'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Sell'));
      await tester.pumpAndSettle();
      expect(find.byType(TablePlanView), findsOneWidget);
      expect(find.byType(SellView), findsNothing);
      expect(find.text('Dining room'), findsOneWidget);
      expect(find.text('Bar table'), findsNothing);
      await tester.tap(find.text('Bar'));
      await tester.pumpAndSettle();
      expect(find.text('Bar table'), findsOneWidget);
      await tester.tap(find.text('Bar table'));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(TextField, 'Guest count'), findsOneWidget);
      await tester.tap(find.widgetWithText(OutlinedButton, '4'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Open table'));
      await tester.pumpAndSettle();
      expect(controller.tab.value, RegisterController.sellTab);
      expect(controller.tableId.value, 'b1');
      expect(controller.guestCover.value, 4);
      expect(find.widgetWithText(Tooltip, '4'), findsOneWidget);
      expect(find.text('Counter'), findsNothing);
      expect(find.byType(SellView), findsOneWidget);
      expect(find.byType(TablePlanView), findsNothing);
      expect(find.text('Sell · Bar table'), findsOneWidget);
      controller.applyProfileSnapshot(_tableSnapshot('required', prompt: true));
      await tester.pumpAndSettle();
      expect(find.byType(SellView), findsOneWidget);
      await tester.tap(find.widgetWithText(ProductCard, 'Coffee'));
      await tester.pumpAndSettle();
      expect(controller.cart.single.quantity, 1);

      tester.view.physicalSize = const Size(430, 800);
      await tester.pumpAndSettle();
      final navigation = tester.widget<NavigationBar>(
        find.byType(NavigationBar),
      );
      final labels = navigation.destinations.cast<NavigationDestination>().map(
        (destination) => destination.label,
      );
      expect(labels, ['Sell', 'Sales', 'Shift']);
      expect(navigation.selectedIndex, 0);
      await tester.tap(find.byTooltip('Back to table plan'));
      await tester.pumpAndSettle();
      expect(find.byType(SellView), findsNothing);
      expect(find.byType(TablePlanView), findsOneWidget);
      expect(find.text('Bar table'), findsOneWidget);
      expect(controller.guestCover.value, 4);
      await tester.tap(find.text('Bar table'));
      await tester.pumpAndSettle();
      expect(find.byType(SellView), findsOneWidget);
      expect(find.byType(TablePlanView), findsNothing);
      expect(controller.cart.single.quantity, 1);
      expect(tester.takeException(), isNull);
    },
  );

  for (final mode in ['required', 'optional', 'disabled']) {
    testWidgets('Submit confirms and opens the right screen in $mode mode', (
      tester,
    ) async {
      final database = RegisterDatabase(NativeDatabase.memory());
      addTearDown(database.close);
      addTearDown(Get.reset);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1220, 820);
      final register = _SubmitRegister(database);
      register.snapshot.value = _tableSnapshot(mode);
      if (mode != 'disabled') register.selectTable('a1');
      await tester.pumpWidget(
        GetMaterialApp(
          theme: AppTheme.light,
          locale: const Locale('en'),
          translations: PosTranslations(),
          home: RegisterShell(register),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(ProductCard, 'Coffee'));
      await tester.pumpAndSettle();

      final submit = mode == 'required'
          ? find.byTooltip('Submit & New')
          : find.text('Submit');
      Future<void> openConfirmation() async {
        await tester.tap(submit);
        await tester.pumpAndSettle();
        expect(
          find.text('Are you sure you want to submit this order?'),
          findsOneWidget,
        );
      }

      await openConfirmation();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(register.submissions, isEmpty);
      expect(register.cart, hasLength(1));

      if (mode == 'optional') {
        register.rejectSubmission = true;
        await openConfirmation();
        await tester.tap(find.text('Confirm'));
        await tester.pumpAndSettle();
        expect(register.submissions, hasLength(1));
        expect(register.cart, hasLength(1));
        expect(register.tableId.value, 'a1');
        expect(find.byType(SellView), findsOneWidget);
        register.rejectSubmission = false;
        register.submissions.clear();
      }

      await openConfirmation();
      expect(register.submissions, isEmpty);
      await tester.tap(find.text('Confirm'));
      await tester.pumpAndSettle();

      final (action, body) = register.submissions.single;
      expect(action, RegisterAction.hold);
      expect(body['table_status'], 'occupied');
      expect(body['table_id'], mode == 'disabled' ? null : 'a1');
      expect(register.cart, isEmpty);
      expect(register.tableId.value, isNull);
      expect(register.message.value, 'ORDER_SAVED');
      if (mode == 'required') {
        expect(register.tab.value, RegisterController.tablesTab);
        expect(find.byType(TablePlanView), findsOneWidget);
      } else {
        expect(register.tab.value, RegisterController.sellTab);
        expect(find.byType(SellView), findsOneWidget);
      }
      await tester.pumpWidget(const SizedBox());
    });
  }

  testWidgets('optional table mode opens a read-only grouped table dialog', (
    tester,
  ) async {
    final database = RegisterDatabase(NativeDatabase.memory());
    addTearDown(database.close);
    addTearDown(Get.reset);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(1220, 820);
    final controller = RegisterController(database);
    controller.snapshot.value = _tableSnapshot('optional');
    controller.tab.value = controller.landingTab;
    await tester.pumpWidget(
      GetMaterialApp(
        theme: AppTheme.light,
        locale: const Locale('en'),
        translations: PosTranslations(),
        home: RegisterShell(controller),
      ),
    );
    await tester.pumpAndSettle();
    expect(controller.tab.value, RegisterController.sellTab);
    final rail = find.byKey(const ValueKey('register-navigation-rail'));
    expect(
      find.descendant(of: rail, matching: find.byTooltip('Table plan')),
      findsNothing,
    );
    await tester.tap(find.text('Table plan'));
    await tester.pumpAndSettle();
    expect(find.byType(TablePlanView), findsOneWidget);
    expect(find.byType(SellView), findsNothing);
    await tester.tap(find.byTooltip('Back to Sell'));
    await tester.pumpAndSettle();
    expect(find.byType(SellView), findsOneWidget);
    expect(find.byType(TablePlanView), findsNothing);
    await tester.tap(find.widgetWithText(ProductCard, 'Coffee'));
    await tester.pumpAndSettle();
    expect(controller.cart.single.quantity, 1);
    controller.selectTable('a1');
    await tester.pumpAndSettle();
    final tables = find.byType(BillTableChip);
    await tester.tap(tables);
    await tester.pumpAndSettle();
    final dialog = find.byType(SelectTableNumberWidget);
    Finder inDialog(Finder matching) =>
        find.descendant(of: dialog, matching: matching);
    final current = inDialog(find.widgetWithText(TableCard, 'Window table'));
    expect(tester.widget<TableCard>(current).selected, isTrue);
    await tester.tap(inDialog(find.text('Bar')));
    await tester.pumpAndSettle();
    final bar = inDialog(find.widgetWithText(TableCard, 'Bar table'));
    expect(tester.widget<TableCard>(bar).onTap, isNull);
    await tester.tap(bar);
    await tester.pumpAndSettle();
    expect(controller.tableId.value, 'a1');
    expect(controller.cart.single.quantity, 1);
    await tester.tap(inDialog(find.byTooltip('Close')));
    await tester.pumpAndSettle();

    tester.view.physicalSize = const Size(430, 800);
    await tester.pumpAndSettle();
    await tester.tap(find.byType(Tab).last);
    await tester.pumpAndSettle();
    await tester.tap(tables);
    await tester.pumpAndSettle();
    expect(current, findsOneWidget);
    await tester.tap(inDialog(find.byTooltip('Close')));
    await tester.pumpAndSettle();
    expect(controller.tableId.value, 'a1');
    expect(controller.guestCover.value, isNull);
    expect(controller.cart.single.quantity, 1);

    controller.selectTable('b1', cover: 4);
    final required = _tableSnapshot('required');
    required['tables'] = jsonRows(required['tables'])
        .where((row) => row['group_id'] == 'dining')
        .toList();
    controller.applyProfileSnapshot(required);
    await tester.pumpAndSettle();
    expect(find.byType(TablePlanView), findsOneWidget);
    expect(find.byType(SellView), findsNothing);
    expect(controller.tableId.value, isNull);
    expect(controller.guestCover.value, isNull);
    expect(controller.cart.single.quantity, 1);
    await tester.tap(find.text('Window table'));
    await tester.pumpAndSettle();
    expect(find.byType(SellView), findsOneWidget);
    expect(controller.tableId.value, 'a1');
    expect(controller.cart.single.quantity, 1);
    expect(tester.takeException(), isNull);
  });

  test(
    'requiring a table clears an empty selection from optional mode',
    () async {
      final database = RegisterDatabase(NativeDatabase.memory());
      addTearDown(database.close);
      final controller = RegisterController(database);
      controller.applyProfileSnapshot(_tableSnapshot('optional'));
      controller.selectTable('a1');

      controller.applyProfileSnapshot(_tableSnapshot('required'));

      expect(controller.tableId.value, isNull);
      expect(controller.tab.value, RegisterController.tablesTab);
      await controller.openTable('b1');
      expect(controller.tableId.value, 'b1');
      expect(controller.tab.value, RegisterController.sellTab);
      controller.applyProfileSnapshot(_tableSnapshot('required'));
      expect(controller.tableId.value, 'b1');
      expect(controller.tab.value, RegisterController.sellTab);
      controller.selectTab(RegisterController.tablesTab);
      await controller.openTable('a1');
      expect(controller.tableId.value, 'a1');
      expect(controller.tab.value, RegisterController.sellTab);
    },
  );

  testWidgets(
    'disabled tables hide table controls and retain enabled guest cover',
    (tester) async {
      final database = RegisterDatabase(NativeDatabase.memory());
      addTearDown(database.close);
      addTearDown(Get.reset);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1220, 820);
      final controller = RegisterController(database);
      controller.snapshot.value = _tableSnapshot('optional', prompt: true);
      controller.tab.value = controller.landingTab;
      controller.selectTable('a1', cover: 4);
      await tester.pumpWidget(
        GetMaterialApp(
          theme: AppTheme.light,
          locale: const Locale('en'),
          translations: PosTranslations(),
          home: RegisterShell(controller),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(ProductCard, 'Coffee'));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(Tooltip, '4'), findsOneWidget);
      await tester.tap(find.text('Table plan'));
      await tester.pumpAndSettle();
      expect(find.byType(TablePlanView), findsOneWidget);

      controller.snapshot.value = _tableSnapshot('disabled', prompt: true);
      await tester.pumpAndSettle();

      void expectCounterSale() {
        expect(find.byType(SellView), findsOneWidget);
        expect(find.byType(TablePlanView), findsNothing);
        expect(find.byType(DropdownButtonFormField<String>), findsNothing);
        expect(find.text('Table plan'), findsNothing);
        expect(find.byTooltip('Table plan'), findsNothing);
        expect(find.widgetWithText(Tooltip, '4'), findsOneWidget);
        expect(find.text('Save order'), findsNothing);
        expect(find.text('Request bill'), findsNothing);
        expect(find.widgetWithText(FilledButton, 'Pay'), findsOneWidget);
        expect(controller.cart.single.quantity, 1);
      }

      expectCounterSale();
      tester.view.physicalSize = const Size(430, 800);
      await tester.pumpAndSettle();
      await tester.tap(find.byType(Tab).last);
      await tester.pumpAndSettle();
      expectCounterSale();
      expect(tester.takeException(), isNull);
    },
  );
}

Json _tableSnapshot(String mode, {bool prompt = false}) => {
  'context': {
    'profile': {
      'name': 'Main register',
      'config': {'table_mode': mode, 'prompt_guest_cover': prompt},
    },
    'business': {'currency': 'USD', 'secondary_exchange_rate': '4000'},
  },
  'catalog': {
    'products': [
      {'id': 'coffee', 'name': 'Coffee', 'price_minor': 250},
    ],
  },
  'tables': [
    {
      'id': 'a1',
      'code': 'A1',
      'label': 'Window table',
      'group_id': 'dining',
      'group_name': 'Dining room',
    },
    {
      'id': 'b1',
      'code': 'B1',
      'label': 'Bar table',
      'group_id': 'bar',
      'group_name': 'Bar',
    },
  ],
  'customers': [],
};
