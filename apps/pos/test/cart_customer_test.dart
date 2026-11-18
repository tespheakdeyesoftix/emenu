import 'dart:async';

import 'package:drift/native.dart';
import 'package:emenu_pos/core/pos_api.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:emenu_pos/features/register/register_controller.dart';
import 'package:emenu_pos/features/sales/sale/customer/customer_directory.dart';
import 'package:emenu_pos/features/sales/sale/widgets/cart_customer.dart';
import 'package:emenu_pos/features/sales/sale/widgets/member_card_camera.dart';
import 'package:emenu_pos/features/sales/sale/widgets/scan_memeber_card_dialog_widget.dart';
import 'package:emenu_pos/features/sales/sale/widgets/select_customer_dialog_widget.dart';
import 'package:emenu_pos/features/sales/sale_binding.dart';
import 'package:emenu_pos/shared/app_theme.dart';
import 'package:emenu_pos/ui/translations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

const customers = <Json>[
  {'id': 'walk', 'name': 'Walk-in', 'is_walk_in': 1},
  {'id': 'alice', 'name': 'Alice Chan', 'external_reference': 'CARD-001'},
  {'id': 'bob', 'name': 'Bob Smith', 'external_reference': 'CARD-002'},
  {'id': 'sok', 'name': 'សុខ ដារ៉ា', 'external_reference': 'CARD-003'},
];

Json snapshot({List<Json> rows = customers}) => {
  'context': {
    'profile': {
      'config': {'default_customer_id': 'walk', 'table_mode': 'disabled'},
    },
    'business': {'currency': 'USD', 'secondary_exchange_rate': '4000'},
  },
  'catalog': {'products': []},
  'customers': rows,
};

class _Camera extends MobileScannerPlatform {
  final captures = StreamController<BarcodeCapture?>.broadcast(sync: true);
  int starts = 0, stops = 0, disposals = 0;
  bool denied = false;

  @override
  Stream<BarcodeCapture?> get barcodesStream => captures.stream;
  @override
  Stream<TorchState> get torchStateStream => const Stream.empty();
  @override
  Stream<double> get zoomScaleStateStream => const Stream.empty();
  @override
  Widget buildCameraView() => const ColoredBox(color: Colors.black);

  @override
  Future<MobileScannerViewAttributes> start(StartOptions options) async {
    starts++;
    if (denied) {
      throw const MobileScannerException(
        errorCode: MobileScannerErrorCode.permissionDenied,
      );
    }
    return const MobileScannerViewAttributes(
      cameraDirection: CameraFacing.back,
      currentTorchMode: TorchState.unavailable,
      size: Size(640, 480),
      numberOfCameras: 1,
    );
  }

  @override
  Future<void> stop() async {
    stops++;
  }

  @override
  Future<void> dispose() async {
    disposals++;
  }

  @override
  Future<void> updateScanWindow(Rect? window) async {}

  void scan(String code) =>
      captures.add(BarcodeCapture(barcodes: [Barcode(rawValue: code)]));
}

void main() {
  late RegisterDatabase database;
  late RegisterController register;
  late MobileScannerPlatform originalCamera;
  late _Camera camera;

  setUp(() {
    Get.testMode = true;
    database = RegisterDatabase(NativeDatabase.memory());
    register = RegisterController(database)..snapshot.value = snapshot();
    SaleBinding(register).dependencies();
    originalCamera = MobileScannerPlatform.instance;
    camera = _Camera();
    MobileScannerPlatform.instance = camera;
  });

  tearDown(() async {
    Get.reset();
    MobileScannerPlatform.instance = originalCamera;
    await camera.captures.close();
    await database.close();
  });

  Future<void> mount(
    WidgetTester tester, {
    TargetPlatform platform = TargetPlatform.windows,
    Locale locale = const Locale('en'),
    double textScale = 1,
    double cardWidth = 350,
  }) async {
    await tester.pumpWidget(
      GetMaterialApp(
        theme: AppTheme.light.copyWith(platform: platform),
        translations: PosTranslations(),
        locale: locale,
        supportedLocales: const [Locale('en'), Locale('km')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
        home: Scaffold(
          body: Align(
            alignment: Alignment.topCenter,
            child: SizedBox(width: cardWidth, child: const CartCustomer()),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> openPicker(WidgetTester tester) async {
    await tester.tap(find.byKey(const ValueKey('cart-customer-picker')));
    await tester.pumpAndSettle();
  }

  test('customer search supports names/references; scans require an unambiguous exact code', () {
    final directory = CustomerDirectory(customers);
    expect(directory.search('chan alice').single['id'], 'alice');
    expect(directory.search('card-002').single['id'], 'bob');
    expect(directory.search('សុខ').single['id'], 'sok');
    expect(directory.matchingCode(' card-001 ').single['id'], 'alice');
    expect(directory.matchingCode('bob').single['id'], 'bob');
    expect(directory.matchingCode('CARD-00'), isEmpty);
    expect(directory.matchingCode('Alice Chan'), isEmpty);
    expect(directory.matchingCode(''), isEmpty);
    final duplicates = CustomerDirectory([
      ...customers,
      {'id': 'other', 'name': 'Other', 'external_reference': 'CARD-001'},
    ]);
    expect(duplicates.matchingCode('CARD-001'), hasLength(2));
  });

  testWidgets(
    'read-only card searches, selects, and resets to the configured default',
    (tester) async {
      await mount(tester);
      expect(find.byType(TextField), findsNothing);
      expect(find.text('Walk-in'), findsOneWidget);
      expect(find.byTooltip('Use default customer'), findsNothing);
      expect(
        tester
            .widget<IconButton>(
              find.byWidgetPredicate(
                (widget) =>
                    widget is IconButton && widget.tooltip == 'Add customer',
              ),
            )
            .onPressed,
        isNull,
      );
      await tester.tap(find.byIcon(Icons.add_rounded));
      await tester.pumpAndSettle();
      expect(find.byType(SelectCustomerDialogWidget), findsNothing);

      await openPicker(tester);
      await tester.enterText(find.byType(TextField), 'Alice');
      await tester.pump();
      expect(find.text('Bob Smith'), findsNothing);
      await tester.tap(find.text('Alice Chan'));
      await tester.pumpAndSettle();
      expect(register.customerId.value, 'alice');
      expect(find.text('CARD-001'), findsOneWidget);
      await tester.tap(find.byTooltip('Use default customer'));
      await tester.pumpAndSettle();
      expect(register.customerId.value, isNull);
      expect(find.text('Walk-in'), findsOneWidget);

      register.sales.selectCustomer('walk');
      await tester.pump();
      expect(find.byTooltip('Use default customer'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'picker searches references, shows empty results, and cancels without changing customer',
    (tester) async {
      await mount(tester);
      await openPicker(tester);
      await tester.enterText(find.byType(TextField), 'missing');
      await tester.pump();
      expect(find.text('No customers found'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'CARD-002');
      await tester.pump();
      expect(find.text('Bob Smith'), findsOneWidget);
      expect(find.text('Alice Chan'), findsNothing);
      await tester.tap(find.byTooltip('Close'));
      await tester.pumpAndSettle();
      expect(register.customerId.value, isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'desktop QR action focuses scanner input, keeps invalid scans open, and accepts Enter',
    (tester) async {
      await mount(tester);
      await tester.tap(find.byTooltip('Scan customer code'));
      await tester.pumpAndSettle();
      expect(find.byType(ScanMemeberCardDialogWidget), findsOneWidget);
      expect(find.byType(MemberCardCamera), findsNothing);
      expect(
        tester
            .widget<EditableText>(find.byType(EditableText))
            .focusNode
            .hasFocus,
        isTrue,
      );
      await tester.enterText(find.byType(TextField), 'unknown');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();
      expect(find.text('Customer code not found. Scan again.'), findsOneWidget);
      expect(register.customerId.value, isNull);
      expect(
        tester
            .widget<EditableText>(find.byType(EditableText))
            .focusNode
            .hasFocus,
        isTrue,
      );
      await tester.enterText(find.byType(TextField), 'CARD-002');
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(register.customerId.value, 'bob');
      expect(find.byType(ScanMemeberCardDialogWidget), findsNothing);
      expect(camera.starts, 0);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'pending commands block customer changes and stale picker selections are rejected',
    (tester) async {
      await mount(tester);
      register.commandPending.value = true;
      await tester.pump();
      await openPicker(tester);
      expect(find.byType(SelectCustomerDialogWidget), findsNothing);
      register.commandPending.value = false;
      await tester.pump();
      await openPicker(tester);
      register.snapshot.value = snapshot(rows: [customers.first]);
      await tester.tap(find.text('Alice Chan'));
      await tester.pumpAndSettle();
      expect(register.customerId.value, isNull);
      expect(register.message.value, 'customer_unavailable');
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'mobile camera pauses/resumes and selects once before releasing camera',
    (tester) async {
      await mount(tester, platform: TargetPlatform.android);
      await tester.tap(find.byTooltip('Scan customer code'));
      await tester.pumpAndSettle();
      expect(find.byType(MemberCardCamera), findsOneWidget);
      expect(camera.starts, 1);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pumpAndSettle();
      expect(camera.stops, greaterThanOrEqualTo(1));
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(camera.starts, 2);
      camera.scan('unknown');
      await tester.pumpAndSettle();
      expect(find.text('Customer code not found. Scan again.'), findsOneWidget);
      camera.scan('CARD-001');
      camera.scan('CARD-002');
      await tester.pumpAndSettle();
      // A camera event completes the dialog asynchronously; allow its reverse
      // route transition to dispose the preview after applying the selection.
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();
      expect(register.customerId.value, 'alice');
      expect(find.byType(ScanMemeberCardDialogWidget), findsNothing);
      expect(
        camera.disposals,
        1,
        reason:
            'stops=${camera.stops}; listeners=${camera.captures.hasListener}; '
            'scanners=${find.byType(MobileScanner, skipOffstage: false).evaluate().length}; '
            'owner=${MobileScannerController.platformSessionOwner}',
      );
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'mobile denied-camera state offers manual entry and clean cancellation',
    (tester) async {
      camera.denied = true;
      await mount(tester, platform: TargetPlatform.iOS);
      await tester.tap(find.byTooltip('Scan customer code'));
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Allow camera access in app settings, or enter the code below.',
        ),
        findsOneWidget,
      );
      await tester.tap(find.text('Enter code manually'));
      await tester.pumpAndSettle();
      expect(find.byType(MemberCardCamera), findsNothing);
      expect(find.byType(TextField), findsOneWidget);
      await tester.tap(find.byTooltip('Close'));
      await tester.pumpAndSettle();
      expect(register.customerId.value, isNull);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'narrow Khmer picker and scanner fit above the keyboard at large text scale',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(360, 700);
      tester.view.viewInsets = const FakeViewPadding(bottom: 280);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetViewInsets);
      register.sales.selectCustomer('alice');
      await mount(
        tester,
        locale: const Locale('km'),
        textScale: 1.5,
        cardWidth: 280,
      );
      expect(tester.takeException(), isNull);
      await openPicker(tester);
      expect(tester.takeException(), isNull);
      await tester.tap(find.byTooltip('close'.tr));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('scan_customer'.tr));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      await tester.pumpAndSettle();
    },
  );
}
