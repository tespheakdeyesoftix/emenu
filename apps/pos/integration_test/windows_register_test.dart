import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:emenu_pos/auths/login_service.dart';
import 'package:emenu_pos/core/pricing.dart';
import 'package:emenu_pos/core/register_access.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:emenu_pos/features/register/register_controller.dart';
import 'package:emenu_pos/features/sales/sale/widgets/product_card.dart';
import 'package:emenu_pos/features/sales/sale/widgets/receipt_dialog.dart';
import 'package:emenu_pos/ui/register_app.dart';
import 'package:emenu_pos/features/sales/sale/widgets/payment_dialog.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:integration_test/integration_test.dart';
import 'package:printing/printing.dart';
import 'package:timezone/data/latest_all.dart' as timezones;

const _ownerPin = '135790';
const _staffPin = '246801';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  timezones.initializeTimeZones();
  final quotaFixture = Platform.environment['POS_NATIVE_QUOTA_FIXTURE'];
  if (quotaFixture != null) {
    _testSubscriptionQuota(quotaFixture);
    return;
  }
  testWidgets('Windows register activation, checkout, and restart', (
    tester,
  ) async {
    final env = Platform.environment;
    final slug = env['POS_NATIVE_SLUG'];
    final origin = Uri.parse(env['POS_NATIVE_ORIGIN'] ?? '');
    if (slug == null ||
        !RegExp(r'^pos-branch-[0-9a-f]{16}$').hasMatch(slug) ||
        origin.scheme != 'https' ||
        !origin.host.contains('-staging.')) {
      fail('Start this test with tool/hosted_branch_smoke.mjs');
    }
    final resume = env['POS_NATIVE_PHASE'] == 'resume';
    final folder = Directory(env['POS_NATIVE_DIRECTORY']!);
    final file = File('${folder.path}${Platform.pathSeparator}register.sqlite');
    final vault = _FixtureVault('emenu.pos.native.$slug.');
    final database = RegisterDatabase.open(file);
    final overrides = HttpOverrides.current;
    if (resume) HttpOverrides.global = _Offline();
    final controller = Get.put(
      RegisterController(
        database,
        access: RegisterAccess(database, vault: vault),
      ),
    );
    final scenario = _RegisterUi(tester, controller);
    final screen = GlobalKey();
    var keepFixture = false;
    try {
      await tester.pumpWidget(
        RepaintBoundary(key: screen, child: const PosApp()),
      );
      await scenario.waitFor(
        () =>
            controller.stage.value ==
            (resume ? RegisterStage.locked : RegisterStage.activation),
        'initial sign-in',
      );
      expect(Get.locale?.languageCode, 'km');
      await scenario.tap(find.widgetWithText(TextButton, 'EN'));
      if (resume) {
        final operator = controller.staff.singleWhere(
          (actor) => actor.id == env['POS_NATIVE_CASHIER_ID'],
        );
        if (controller.staff.first.id != operator.id) {
          await scenario.tap(find.byType(DropdownButtonFormField<String>));
          await scenario.tap(find.text(operator.displayName).last);
        }
        await scenario.enter('6-digit PIN', _staffPin);
        await scenario.press('Sign in');
        await scenario.waitFor(
          () => controller.stage.value == RegisterStage.ready,
          'offline PIN unlock',
        );
        expect(controller.operator.value?.id, operator.id);
        expect(controller.online.value, isFalse);
        expect(controller.cart.single.quantity, 1);
        expect(controller.cartTotal, 251);
        final sale = (await database.watchSales().first).single;
        expect(sale.$1.operatorId, operator.id);
        expect(sale.$2.status, 'synced');
        expect(
          (await database.select(database.receiptPrints).get()).single.copies,
          2,
        );
      } else {
        expect(find.text('Set up register'), findsOneWidget);
        await scenario.enter('API address', origin.origin);
        await scenario.enter('Business slug', slug);
        await scenario.enter('Account email', env['POS_NATIVE_OWNER_EMAIL']!);
        await scenario.enter('Password', env['POS_NATIVE_PASSWORD']!);
        await scenario.press('Sign in');
        await scenario.enrollPin(_ownerPin);
        expect(controller.operator.value?.role, 'owner');
        expect(
          controller.installation.value?.profileId,
          env['POS_NATIVE_PROFILE_ID'],
        );
        expect(
          find.byKey(const ValueKey('register-navigation-rail')),
          findsOneWidget,
        );

        await scenario.tap(find.byTooltip('Shift'));
        await scenario.press('Open day');
        await scenario.waitFor(
          () =>
              controller.context['working_day'] != null &&
              !controller.busy.value,
          'working day',
        );
        await scenario.press('Open shift');
        await scenario.tap(
          find.descendant(
            of: find.byType(AlertDialog),
            matching: _filled('Open shift'),
          ),
        );
        await scenario.waitFor(
          () =>
              controller.context['cashier_shift'] != null &&
              !controller.busy.value,
          'cashier shift',
        );
        await scenario.tap(find.byTooltip('Lock'));
        await scenario.waitFor(
          () => controller.stage.value == RegisterStage.locked,
          'register lock',
        );
        await scenario.tap(
          find.widgetWithText(TextButton, 'Sign in with password'),
        );
        await scenario.enter('Username or email', 'counter-cashier');
        await scenario.enter('Password', env['POS_NATIVE_PASSWORD']!);
        await scenario.press('Sign in');
        await scenario.enrollPin(_staffPin);
        expect(controller.operator.value?.id, env['POS_NATIVE_CASHIER_ID']);
        await scenario.capture(
          screen,
          env['POS_NATIVE_SCREENSHOTS'],
          'windows-register.png',
        );

        await scenario.tap(
          find.widgetWithText(DropdownButtonFormField<String>, 'Counter'),
        );
        await scenario.tap(find.text('Staging Table A1').last);
        await scenario.tap(find.widgetWithText(ProductCard, 'Coffee'));
        expect(controller.cartTotal, 251);
        await scenario.press('Pay');
        final payment = find.byType(PaymentDialog);
        Finder amountShown(int amount, String currency) => find.descendant(
          of: payment,
          matching: find.text(displayAmount(amount, currency)),
        );
        final add = find.descendant(
          of: payment,
          matching: find.ancestor(
            of: find.text('Add'),
            matching: find.byWidgetPredicate(
              (widget) => widget is OutlinedButton,
            ),
          ),
        );
        await scenario.enter('Amount', '1.25');
        await scenario.tap(add);
        expect(amountShown(125, 'USD'), findsOneWidget);
        final currencyField = find.descendant(
          of: payment,
          matching: find.byWidgetPredicate(
            (widget) =>
                widget is DropdownButton<String> &&
                widget.items?.any((item) => item.value == 'KHR') == true,
          ),
        );
        await scenario.tap(currencyField);
        await scenario.tap(find.text('KHR').hitTestable());
        expect(
          tester.widget<DropdownButton<String>>(currencyField).value,
          'KHR',
        );
        await scenario.enter('Amount', '6000');
        await scenario.tap(add);
        expect(
          amountShown(6000, 'KHR'),
          findsOneWidget,
          reason: tester
              .widgetList<Text>(
                find.descendant(of: payment, matching: find.byType(Text)),
              )
              .map((row) => row.data)
              .join(', '),
        );
        final change = find.widgetWithText(CheckboxListTile, 'Change');
        await scenario.tap(change);
        expect(tester.widget<CheckboxListTile>(change).value, isTrue);
        await scenario.enter('Amount', '960');
        await scenario.tap(add);
        expect(amountShown(-960, 'KHR'), findsOneWidget);
        await scenario.capture(
          screen,
          env['POS_NATIVE_SCREENSHOTS'],
          'windows-split-payment.png',
        );
        await scenario.tap(
          find.descendant(of: payment, matching: _filled('Pay')),
        );
        expect(find.text('Payments must match the total'), findsNothing);
        expect(payment, findsNothing);
        await scenario.waitFor(
          () => controller.pending.isNotEmpty,
          'local checkout',
        );
        await scenario.waitFor(
          () => controller.pending.any((sale) => sale.$2.status == 'synced'),
          'sale sync',
        );

        await scenario.tap(find.byTooltip('ខ្មែរ'));
        await scenario.tap(find.byTooltip('ការលក់'));
        await scenario.tap(find.widgetWithText(ListTile, r'$2.51'));
        expect(
          find.descendant(
            of: find.byType(ReceiptDialog),
            matching: find.text('1 × កាហ្វេ'),
          ),
          findsOneWidget,
        );
        await scenario.capture(
          screen,
          env['POS_NATIVE_SCREENSHOTS'],
          'windows-khmer-receipt.png',
        );
        await scenario.verifyReceipt();
        await scenario.tap(find.widgetWithText(TextButton, 'បិទ'));
        await scenario.tap(find.byTooltip('លក់'));
        await scenario.tap(find.widgetWithText(ProductCard, 'កាហ្វេ'));
        await scenario.tap(find.byTooltip('ចាក់សោ'));
        await scenario.waitFor(
          () => controller.stage.value == RegisterStage.locked,
          'draft saved before restart',
        );
        keepFixture = true;
      }
    } finally {
      await tester.pumpWidget(const SizedBox.shrink());
      Get.delete<RegisterController>(force: true);
      await database.close();
      if (!keepFixture) {
        await vault.clean([
          env['POS_NATIVE_OWNER_ID']!,
          env['POS_NATIVE_CASHIER_ID']!,
        ]);
      }
      HttpOverrides.global = overrides;
    }
  }, timeout: const Timeout(Duration(minutes: 3)));
}

void _testSubscriptionQuota(String fixture) {
  final input = jsonDecode(fixture) as Map<String, dynamic>;
  final origin = Uri.parse(input['origin'] as String);
  if (origin.scheme != 'http' || origin.host != '127.0.0.1') {
    throw StateError('The POS quota test requires the isolated local Worker.');
  }
  final fixtures = (input['businesses'] as List).cast<Map<String, dynamic>>();
  for (final business in fixtures) {
    testWidgets('Windows POS subscription quota for ${business['slug']}', (
      tester,
    ) async {
      final slug = business['slug'] as String;
      expect(slug, startsWith('pos-quota-'));
      final folder = await Directory.systemTemp.createTemp('emenu-pos-quota-');
      final database = RegisterDatabase.open(
        File('${folder.path}/quota.sqlite'),
      );
      final vault = _FixtureVault('emenu.pos.native.$slug.');
      final controller = Get.put(
        RegisterController(
          database,
          access: RegisterAccess(database, vault: vault),
        ),
      );
      final scenario = _RegisterUi(tester, controller);
      try {
        await tester.pumpWidget(const PosApp());
        await scenario.waitFor(
          () => controller.stage.value == RegisterStage.activation,
          'register activation',
        );
        if (Get.locale?.languageCode != 'en') {
          await scenario.tap(find.widgetWithText(TextButton, 'EN'));
        }
        await scenario.enter('API address', origin.origin);
        await scenario.enter('Business slug', slug);
        await scenario.enter('Account email', business['email'] as String);
        await scenario.enter('Password', input['password'] as String);
        await scenario.press('Sign in');
        await scenario.waitFor(
          () => controller.stage.value == RegisterStage.selectProfile,
          'profile selection',
        );
        expect(
          Get.find<LoginService>().profiles.map((profile) => profile['id']),
          [business['profileId']],
        );
        await scenario.enrollPin(_ownerPin);
        expect(controller.installation.value?.businessId, business['id']);
        expect(controller.online.value, isTrue);

        Future<void> sellOne() async {
          await scenario.tap(find.widgetWithText(ProductCard, 'Quota coffee'));
          expect(controller.cartTotal, 250);
          await scenario.press('Pay');
          await scenario.tap(
            find.descendant(
              of: find.byType(PaymentDialog),
              matching: _filled('Pay'),
            ),
          );
        }

        await sellOne();
        await scenario.waitFor(
          () => controller.pending.any((sale) => sale.$2.status == 'synced'),
          'first sale settlement',
        );
        await sellOne();
        await scenario.waitFor(
          () => controller.pending.any(
            (sale) =>
                sale.$2.status == 'attention' &&
                sale.$2.lastError == 'PLAN_DAILY_POS_SALE_LIMIT',
          ),
          'second sale quota rejection',
        );
        await scenario.tap(find.byTooltip('Sales'));
        expect(
          find.text('The business has reached its daily POS sales limit'),
          findsOneWidget,
        );
        expect(find.text('Synced'), findsOneWidget);
        expect(find.text('Review'), findsOneWidget);
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        Get.delete<RegisterController>(force: true);
        await database.close();
        await vault.clean([business['ownerId'] as String]);
        await folder.delete(recursive: true);
      }
    }, timeout: const Timeout(Duration(minutes: 3)));
  }
}

Finder _filled(String label) => find.ancestor(
  of: find.text(label),
  matching: find.byWidgetPredicate((widget) => widget is FilledButton),
);

class _RegisterUi {
  _RegisterUi(this.tester, this.register);

  final WidgetTester tester;
  final RegisterController register;

  Future<void> waitFor(bool Function() ready, String name) async {
    final clock = Stopwatch()..start();
    while (!ready()) {
      if (clock.elapsed > const Duration(seconds: 30)) {
        fail(
          '$name timed out (${register.message.value ?? register.stage.value.name}; ${register.pending.map((row) => row.$2.lastError ?? row.$2.status).join(', ')})',
        );
      }
      await tester.pump(const Duration(milliseconds: 70));
    }
    await tester.pump(const Duration(milliseconds: 250));
  }

  Future<void> tap(Finder finder) async {
    await waitFor(() => finder.evaluate().isNotEmpty, 'UI control $finder');
    await tester.ensureVisible(finder);
    await tester.pump();
    expect(finder.hitTestable(), findsOneWidget);
    await tester.tap(finder);
    await tester.pump(const Duration(milliseconds: 350));
  }

  Future<void> press(String label) => tap(_filled(label));

  Future<void> enter(String label, String value) async {
    final finder = find.byWidgetPredicate(
      (widget) => widget is TextField && widget.decoration?.labelText == label,
    );
    await tap(finder);
    final editor = tester.state<EditableTextState>(
      find.descendant(of: finder, matching: find.byType(EditableText)),
    );
    editor.userUpdateTextEditingValue(
      TextEditingValue(
        text: value,
        selection: TextSelection.collapsed(offset: value.length),
      ),
      SelectionChangedCause.keyboard,
    );
    await tester.pump();
    final field = tester.widget<TextField>(finder);
    expect(
      field.controller?.text == value,
      isTrue,
      reason: '$label was not entered',
    );
  }

  Future<void> capture(GlobalKey key, String? folder, String name) async {
    if (folder == null || folder.isEmpty) return;
    await tester.pump();
    final boundary =
        key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    final image = await boundary.toImage();
    try {
      final bytes = (await image.toByteData(format: ui.ImageByteFormat.png))!;
      await Directory(folder).create(recursive: true);
      await File('$folder${Platform.pathSeparator}$name').writeAsBytes(
        bytes.buffer.asUint8List(bytes.offsetInBytes, bytes.lengthInBytes),
        flush: true,
      );
    } finally {
      image.dispose();
    }
  }

  Future<void> enrollPin(String pin) async {
    await waitFor(
      () =>
          register.stage.value == RegisterStage.selectProfile &&
          !register.busy.value,
      'profile selection',
    );
    await press('Save');
    await waitFor(
      () => register.stage.value == RegisterStage.ready && !register.busy.value,
      'password sign-in',
    );
    await press('Set PIN');
    await enter('6-digit PIN', pin);
    await enter('Confirm PIN', pin);
    await press('Save');
    await waitFor(
      () => register.pinConfigured.value && !register.busy.value,
      'PIN enrollment',
    );
  }

  Future<void> verifyReceipt() async {
    final support = await Printing.info();
    expect(support.canPrint, isTrue);
    expect(support.canRaster, isTrue);
    await tap(find.widgetWithText(DropdownButton<int>, '80 mm'));
    await tap(find.text('58 mm').last);
    const channel = MethodChannel('net.nfet.printing');
    const codec = StandardMethodCodec();
    final messenger = tester.binding.defaultBinaryMessenger;
    Future<Object?> callback(String method, Object arguments) async {
      final reply = await messenger.handlePlatformMessage(
        channel.name,
        codec.encodeMethodCall(MethodCall(method, arguments)),
        null,
      );
      return reply == null ? null : codec.decodeEnvelope(reply);
    }

    Uint8List? document;
    messenger.setMockMethodCallHandler(channel, (call) async {
      expect(call.method, 'printPdf');
      final params = call.arguments as Map;
      expect(params['width'], closeTo(58 * 72 / 25.4, 0.1));
      document = await callback('onLayout', params) as Uint8List;
      await callback('onCompleted', {'job': params['job'], 'completed': true});
      return 1;
    });
    try {
      await press('បោះពុម្ព');
      await waitFor(
        () => find.text('បានផ្ញើទៅម៉ាស៊ីនបោះពុម្ព').evaluate().isNotEmpty,
        'receipt PDF',
      );
    } finally {
      messenger.setMockMethodCallHandler(channel, null);
    }
    final pages = await Printing.raster(document!)
        .toList()
        .timeout(const Duration(seconds: 20));
    expect(pages, hasLength(2));
    expect(pages.first.width, inInclusiveRange(163, 166));
    expect(pages.first.pixels.any((value) => value < 80), isTrue);
  }
}

class _Offline extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) => _OfflineClient();
}

class _OfflineClient implements HttpClient {
  @override
  Future<HttpClientRequest> openUrl(String method, Uri url) async =>
      throw const SocketException('Fixture network outage');

  @override
  void close({bool force = false}) {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

// Exercise Windows DPAPI without reading or overwriting the live register keys.
class _FixtureVault extends FlutterSecureStorage {
  const _FixtureVault(this.prefix);

  final String prefix;

  @override
  Future<String?> read({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) => super.read(key: '$prefix$key', wOptions: wOptions);

  @override
  Future<void> write({
    required String key,
    required String? value,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) => super.write(key: '$prefix$key', value: value, wOptions: wOptions);

  Future<void> clean(List<String> operators) async {
    await super.delete(key: '${prefix}emenu.pos.device.signing');
    for (final operator in operators) {
      await super.delete(key: '${prefix}emenu.pos.operator.$operator');
      await super.delete(key: '${prefix}emenu.pos.device.session.$operator');
    }
  }
}
