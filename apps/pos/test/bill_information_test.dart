import 'dart:convert';

import 'package:drift/drift.dart' show Value;
import 'package:drift/native.dart';
import 'package:emenu_pos/core/api_endpoint.dart';
import 'package:emenu_pos/core/bill_information.dart';
import 'package:emenu_pos/core/pos_api.dart';
import 'package:emenu_pos/core/register_authority.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:emenu_pos/features/register/register_controller.dart';
import 'package:emenu_pos/features/sales/sale/sale_service.dart';
import 'package:emenu_pos/features/sales/sale/sale_sync.dart';
import 'package:emenu_pos/features/sales/sale/widgets/bill_info_chip.dart';
import 'package:emenu_pos/features/sales/sale/widgets/bill_table_chip.dart';
import 'package:emenu_pos/features/sales/sale/widgets/cart_bill_information.dart';
import 'package:emenu_pos/features/sales/sale_binding.dart';
import 'package:emenu_pos/shared/app_theme.dart';
import 'package:emenu_pos/ui/translations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart' hide Value;
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:timezone/data/latest_all.dart' as timezones;

const product = <String, dynamic>{
  'id': 'coffee',
  'name': 'Coffee',
  'price_minor': 100,
};
Json fixture({
  String tableMode = 'optional',
  bool guests = true,
  bool day = true,
  bool shift = true,
  bool supported = true,
}) => {
  'context': {
    'capabilities': {'bill_information': supported},
    'local_date': '2026-11-18',
    'business': {
      'id': 'store',
      'name': 'Store',
      'timezone': 'UTC',
      'currency': 'USD',
      'secondary_exchange_rate': '4000',
    },
    'profile': {
      'id': 'profile',
      'config': {
        'table_mode': tableMode,
        'prompt_guest_cover': guests,
        'working_day_enabled': day,
        'cashier_shift_enabled': shift,
        'tax_mode': 'disabled',
        'default_customer_id': 'walk',
      },
    },
    if (day) 'working_day': {'id': 'day', 'business_date': '2026-11-18'},
    if (shift) 'cashier_shift': {'id': 'shift', 'opened_by_name': 'Dara'},
    'payment_types': [
      {
        'id': 'cash',
        'kind': 'cash',
        'currencies': ['USD'],
      },
    ],
  },
  'catalog': {
    'products': [product],
  },
  'customers': [
    {'id': 'walk', 'name': 'Walk-in'},
  ],
  'tables': [
    {'id': 't1', 'label': 'U19', 'status': 'available'},
    {'id': 't2', 'label': 'U20', 'status': 'available'},
  ],
};

Future<void> seed(RegisterDatabase db, Json snapshot) async {
  await db
      .into(db.registerInstallations)
      .insert(
        RegisterInstallationsCompanion.insert(
          apiOrigin: 'https://pos.test',
          businessSlug: 'store',
          businessId: 'store',
          branchId: 'branch',
          profileId: 'profile',
        ),
      );
  await db
      .into(db.registerOperators)
      .insert(
        RegisterOperatorsCompanion.insert(
          id: 'owner',
          email: 'owner@test.com',
          displayName: 'Dara',
          role: 'owner',
        ),
      );
  await db.saveSnapshot('profile', snapshot);
}

void main() {
  timezones.initializeTimeZones();
  late RegisterDatabase db;
  late RegisterController register;
  late SaleService service;
  setUp(() {
    db = RegisterDatabase(NativeDatabase.memory());
    register = RegisterController(db)..snapshot.value = fixture();
    SaleBinding(register).dependencies();
    service = register.sales;
  });
  tearDown(() async {
    Get.reset();
    await db.close();
  });

  Future<void> mount(
    WidgetTester tester, {
    Locale locale = const Locale('en'),
    double scale = 1,
  }) async {
    await tester.pumpWidget(
      GetMaterialApp(
        theme: AppTheme.light,
        locale: locale,
        translations: PosTranslations(),
        supportedLocales: const [Locale('en'), Locale('km')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: const Scaffold(
          body: Center(
            child: SizedBox(width: 280, child: CartBillInformation()),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
    'profile controls chips independently and the row scrolls on a narrow cart',
    (tester) async {
      service.selectTable('t1', cover: 5);
      await mount(tester);
      expect(find.byType(BillTableChip), findsOneWidget);
      for (final key in [
        'bill-guests',
        'bill-working-day',
        'bill-cashier-shift',
        'bill-posting-date',
      ]) {
        expect(find.byKey(ValueKey(key)), findsOneWidget);
      }
      final row = find.byKey(const ValueKey('bill-info-scroll'));
      final scroll = tester.widget<SingleChildScrollView>(row).controller!;
      await tester.tap(find.byTooltip('Scroll bill information right'));
      await tester.pumpAndSettle();
      expect(scroll.offset, greaterThan(0));
      register.snapshot.value = fixture(
        tableMode: 'disabled',
        guests: true,
        day: false,
        shift: false,
      );
      await tester.pumpAndSettle();
      expect(find.byType(BillTableChip), findsNothing);
      expect(find.byKey(const ValueKey('bill-guests')), findsOneWidget);
      expect(find.byKey(const ValueKey('bill-working-day')), findsNothing);
      expect(find.byKey(const ValueKey('bill-cashier-shift')), findsNothing);
      register.snapshot.value = fixture(
        tableMode: 'disabled',
        guests: false,
        day: false,
        shift: false,
      );
      await tester.pumpAndSettle();
      expect(find.byType(BillInfoChip), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('posting date edits without shifts and is locked with a shift', (
    tester,
  ) async {
    register.snapshot.value = fixture(
      tableMode: 'disabled',
      guests: false,
      day: false,
      shift: false,
    );
    await mount(tester);
    await tester.drag(
      find.byKey(const ValueKey('bill-info-scroll')),
      const Offset(-1000, 0),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('bill-posting-date')));
    await tester.pumpAndSettle();
    expect(find.byType(DatePickerDialog), findsOneWidget);
    await tester.tap(find.text('17').last);
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    expect(service.postingDate, '2026-11-17');
    register.snapshot.value = fixture(
      tableMode: 'disabled',
      guests: false,
      day: false,
      shift: true,
    );
    await tester.pumpAndSettle();
    expect(service.postingDate, '2026-11-18');
    expect(
      tester
          .widget<BillInfoChip>(find.byKey(const ValueKey('bill-posting-date')))
          .onTap,
      isNull,
    );
    service.setPostingDate('2026-11-16');
    expect(service.postingDate, '2026-11-18');
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('guest cover can be entered for counter sales when enabled', (
    tester,
  ) async {
    register.snapshot.value = fixture(
      tableMode: 'disabled',
      day: false,
      shift: false,
    );
    await mount(tester);
    await tester.tap(find.byKey(const ValueKey('bill-guests')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '8');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save').last);
    await tester.pumpAndSettle();
    expect(service.tableId.value, isNull);
    expect(
      service.guestCover.value,
      8,
      reason:
          'editable=${service.cartEditable}; supported=${service.supportsBillInformation}; generation=${service.billGeneration}',
    );
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets(
    'busy or incompatible hosts cannot edit date; Khmer large text fits',
    (tester) async {
      register.snapshot.value = fixture(shift: false, supported: false);
      await mount(tester, locale: const Locale('km'), scale: 1.5);
      expect(service.canEditPostingDate, isFalse);
      register.snapshot.value = fixture(shift: false);
      register.commandPending.value = true;
      await tester.pumpAndSettle();
      expect(service.canEditPostingDate, isFalse);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );

  test(
    'posting date validation rejects impossible dates and shift overrides',
    () {
      for (final invalid in [
        '2026-02-30',
        '2026-2-01',
        '0000-01-01',
        'garbage',
      ]) {
        expect(
          () => resolveBillPostingDate(invalid, {}, '2026-11-18'),
          throwsFormatException,
        );
      }
      expect(
        resolveBillPostingDate('2024-02-29', {}, '2026-11-18'),
        '2024-02-29',
      );
      expect(
        () => resolveBillPostingDate('2026-11-17', {
          'cashier_shift_enabled': true,
        }, '2026-11-18'),
        throwsFormatException,
      );
    },
  );

  test(
    'posting date and counter guest cover survive draft restoration',
    () async {
      final data = fixture(tableMode: 'disabled', day: false, shift: false);
      register.snapshot.value = data;
      await seed(db, data);
      register.installation.value = await db.installation();
      final actor = (await db.operatorById('owner'))!;
      register.operator.value = actor;
      service.setPostingDate('2026-11-15');
      service.setGuestCover(3);
      await service.flushCart();
      service.clearCart();
      await service.loadCart(actor);
      expect(service.postingDate, '2026-11-15');
      expect(service.guestCover.value, 3);
      service.setPostingDate('2026-11-18');
      await service.flushCart();
      service.clearCart();
      await service.loadCart(actor);
      expect(service.selectedPostingDate.value, '2026-11-18');
    },
  );

  test(
    'submitted orders keep their statuses, posting date and checkout identity',
    () async {
      final data = fixture(tableMode: 'disabled', day: false, shift: false);
      await seed(db, data);
      final authority = RegisterAuthority(
        db,
        now: () => DateTime.utc(2026, 11, 18, 10),
      );
      final line = CartLine(product);
      final config = jsonObject(
        jsonObject(jsonObject(data['context'])['profile'])['config'],
      );
      final body = <String, dynamic>{
        'table_id': null,
        'guest_cover': 3,
        'posting_date': '2026-11-15',
        'currency': 'USD',
        'exchange_rate': '4000',
        'total_minor': 100,
        'quote': [line.quote(config)],
        'expected_context': {
          'business_date': '2026-11-18',
          'working_day_id': null,
          'shift_id': null,
        },
      };
      await authority.execute(
        commandId: 'hold_date',
        operatorId: 'owner',
        action: RegisterAction.hold,
        body: {...body, 'table_status': 'occupied', 'submit_order': true},
      );
      final held = (await db.select(db.heldBills).get()).single;
      final saved = jsonObject(jsonDecode(held.payload));
      expect(saved['posting_date'], '2026-11-15');
      expect(saved['table_status'], 'occupied');
      expect(saved['status'], 'submitted');
      expect(jsonRows(saved['lines']).single['status'], 'submitted');
      final queued = (await db.nextSubmittedOrder())!;
      expect(queued.saleId, held.id);
      expect(queued.cancel, isFalse);
      expect(
        jsonObject(saved['operating_context'])['business_date'],
        '2026-11-18',
      );
      final result = await authority.execute(
        commandId: 'pay_date',
        operatorId: 'owner',
        action: RegisterAction.checkout,
        body: {
          ...body,
          'bill_id': held.id,
          'bill_revision': held.revision,
          'payments': [
            {'payment_type_id': 'cash', 'currency': 'USD', 'amount_minor': 100},
          ],
        },
      );
      final sale = await db.sale(result['bill_id'] as String);
      final request = jsonObject(jsonDecode(sale.request));
      expect(sale.id, held.id);
      expect(request['submitted_order'], isTrue);
      expect(
        await db.submittedOrderPrecedesSale(queued, (await db.nextJob())!),
        isTrue,
      );
      expect(jsonObject(request['receipt'])['business_date'], '2026-11-15');
      final draft = jsonObject(request['draft']);
      expect(draft['posting_date'], '2026-11-15');
      expect(draft['guest_cover'], 3);
      expect(
        jsonObject(draft['expected_context'])['business_date'],
        '2026-11-18',
      );
      var offline = true;
      final commandIds = <String>[];
      final transport = MockClient((request) async {
        if (offline) throw http.ClientException('Offline');
        final path = request.url.path;
        final Json reply;
        if (path.endsWith(ApiEndpoint.context)) {
          reply = {
            'profile': {'id': 'profile'},
            'operator': {'id': 'owner'},
            'capabilities': {
              'bill_information': true,
              'sale_context_guard': true,
              'submit_orders': true,
              'order_line_history': true,
            },
          };
        } else {
          commandIds.add(request.headers['idempotency-key']!);
          if (path.endsWith(ApiEndpoint.submitSaleFor(held.id))) {
            expect(
              jsonObject(jsonDecode(request.body))['posting_date'],
              '2026-11-15',
            );
            reply = {
              'id': held.id,
              'status': 'submitted',
              'revision': 1,
              'total_minor': sale.total,
              'currency': sale.currency,
              'secondary_exchange_rate': '4000',
              'lines': jsonObject(jsonDecode(sale.request))['quote'],
            };
          } else {
            expect(path, endsWith(ApiEndpoint.checkoutSaleFor(held.id)));
            reply = {'id': held.id, 'status': 'paid'};
          }
        }
        return http.Response(jsonEncode(reply), 200);
      });
      final api = PosApi('https://pos.test', client: transport);
      final sync = SaleSync(db, api, (operatorId, profileId, send) async {
        expect(operatorId, 'owner');
        expect(profileId, 'profile');
        await send('token');
      });
      await sync.wake();
      expect((await db.nextSubmittedOrder())?.lastError, 'OFFLINE');
      await db
          .update(db.submittedOrderJobs)
          .write(SubmittedOrderJobsCompanion(retryAt: Value(DateTime.now())));
      offline = false;
      await sync.wake();
      expect(await db.nextSubmittedOrder(), isNull);
      expect(await db.nextJob(), isNull);
      expect(commandIds, [
        queued.commandId,
        '${held.id}_draft',
        '${held.id}_checkout',
      ]);
      await sync.close();
      transport.close();
    },
  );
}
