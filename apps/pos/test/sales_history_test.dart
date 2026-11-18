import 'package:drift/native.dart';
import 'package:emenu_pos/core/pos_api.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:emenu_pos/core/register_history_scope.dart';
import 'package:emenu_pos/features/register/register_controller.dart';
import 'package:emenu_pos/features/sales/sale/sale_history_entry.dart';
import 'package:emenu_pos/features/sales/sale/sales_history_view.dart';
import 'package:emenu_pos/features/sales/sale_binding.dart';
import 'package:emenu_pos/ui/translations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:timezone/data/latest_all.dart' as tz;

final firstShift = DateTime.utc(2026, 11, 18, 1);
final secondShift = DateTime.utc(2026, 11, 18, 2);
final secondScope = RegisterHistoryScope(
  'register',
  RegisterHistoryPeriod.shift,
  'second',
  secondShift,
);

Json heldPayload(String status) => {
  'table_label': 'A-4',
  'table_status': status,
  'total_minor': 500,
  'currency': 'USD',
  'lines': [],
};

Json operating(String shift) => {
  'shift_id': shift,
  'working_day_id': null,
  'business_date': '2026-11-18',
};

Json hostedSale(String id, {int total = 500, String currency = 'USD'}) => {
  'id': id,
  'status': 'paid',
  'currency': currency,
  'total_minor': total,
  'item_quantity': 1,
  'shift_id': 'second',
  'created_at': secondShift.toIso8601String(),
  'customer_name': 'Pheakdey',
};

class HistoryRegister extends RegisterController {
  HistoryRegister(super.database);

  bool serverUnavailable = false;

  @override
  Future<Json> readSalesHistory(
    String operatorId, {
    int? serverPage,
    String? saleId,
  }) async {
    final rows = [
      hostedSale('possale_aaaaaaaa'),
      {...hostedSale('possale_bbbbbbbb'), 'status': 'open'},
    ];
    if (saleId != null) {
      return {
        ...rows.singleWhere((row) => row['id'] == saleId),
        'lines': [
          {'quantity': 1, 'product_name': 'Coffee', 'total_minor': 500},
        ],
      };
    }
    if (serverPage != null && serverUnavailable) {
      throw const PosApiError(503, 'OFFLINE', 'Server unavailable');
    }
    return {
      'history_scope': secondScope.toJson(),
      if (serverPage == null)
        ...const RegisterHistory().toJson()
      else
        'sales': rows,
    };
  }
}

void main() {
  setUpAll(tz.initializeTimeZones);

  test(
    'scopes checkout, discard and reversal and totals merged local/server rows',
    () async {
      final db = RegisterDatabase(NativeDatabase.memory());
      addTearDown(db.close);
      Future<void> checkout(String id, String? shift, DateTime time) =>
          db.queueSale(
            id: id,
            profileId: 'register',
            operatorId: 'cashier',
            total: 500,
            currency: 'USD',
            createdAt: time,
            request: {
              'draft': {
                if (shift != null) 'expected_context': operating(shift),
              },
              'quote': [
                {'quantity': 2},
              ],
            },
          );
      await checkout('prior', 'first', firstShift);
      for (var i = 0; i < 103; i++) {
        await checkout('current-$i', i == 0 ? null : 'second', secondShift);
      }
      await db.saveServerDraft('current-0', {'id': 'possale_poscopy'});
      await db.saveSettlement('current-0', {
        'id': 'possale_poscopy',
        'shift_id': 'second',
      });
      await db.queueReversal(
        id: 'reversal',
        original: await db.sale('prior'),
        operatorId: 'cashier',
        createdAt: secondShift,
        request: {
          'draft': {'expected_context': operating('second')},
        },
      );

      for (final (id, table, status) in [
        ('carryover', 'a', 'occupied'),
        ('discard', 'b', 'hold'),
        ('bill-please', 'c', 'bill_requested'),
        ('waiting', 'd', 'hold'),
      ]) {
        await db.holdBill(
          id: id,
          profileId: 'register',
          tableId: table,
          payload: {
            ...heldPayload(status),
            'operating_context': operating(
              id == 'carryover' ? 'first' : 'second',
            ),
          },
        );
      }
      await db.recordDiscardedBill(
        commandId: 'discard-command',
        bill: (await db.heldBill('register', 'discard'))!,
        operatorName: 'Cashier',
        time: secondShift,
        operating: operating('second'),
      );
      expect(await db.heldBill('register', 'discard'), isNull);
      final local = RegisterHistory.fromJson(
        (await db.salesHistory(secondScope)).toJson(),
      );
      expect(local.sales, hasLength(104));
      expect(local.discarded.single.billId, 'discard');
      final rows = buildSalesHistory(
        local,
        [
          hostedSale('possale_poscopy'),
          hostedSale('possale_other', total: 7000, currency: 'KHR'),
        ],
        secondScope,
        storeOperations: true,
        businessDate: (_) => '2026-11-18',
      );
      expect(rows.any((row) => row.id == 'prior'), isFalse);
      expect(rows.any((row) => row.id == 'possale_poscopy'), isFalse);
      expect(
        rows.singleWhere((row) => row.id == 'carryover').carryover,
        isTrue,
      );
      expect(salesHistoryTotals(rows, SaleHistoryStatus.all), {
        'USD': 51000,
        'KHR': 7000,
      });
      expect(salesHistoryTotals(rows, SaleHistoryStatus.voided), {'USD': 0});
      expect(salesHistoryTotals(rows, SaleHistoryStatus.submitted), {
        'USD': 500,
      });
      expect(salesHistoryTotals(rows, SaleHistoryStatus.billRequested), {
        'USD': 500,
      });
      expect(salesHistoryTotals(rows, SaleHistoryStatus.hold), {'USD': 500});
    },
  );

  testWidgets(
    'desktop table and cards open the same server detail; phone and Khmer fit',
    (tester) async {
      final register = HistoryRegister(
        RegisterDatabase(NativeDatabase.memory()),
      );
      addTearDown(() async {
        Get.reset();
        await register.database.close();
      });
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1340, 900);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      register.paired.value = true;
      register.operator.value = const RegisterOperator(
        id: 'cashier',
        displayName: 'Cashier',
        email: 'cashier@example.test',
        role: 'cashier',
        failedPins: 0,
        accessRevoked: false,
      );
      register.snapshot.value = {
        'catalog': {'nodes': [], 'products': []},
        'context': {
          'profile': {
            'id': 'register',
            'config': {
              'cashier_shift_enabled': true,
              'table_status_colors': {'occupied': '#2A5483'},
            },
          },
          'cashier_shift': {
            'id': 'second',
            'opened_at': secondShift.toIso8601String(),
          },
          'business': {'currency': 'USD', 'timezone': 'Asia/Phnom_Penh'},
        },
      };
      SaleBinding(register).dependencies();
      await tester.pumpWidget(
        GetMaterialApp(
          translations: PosTranslations(),
          locale: const Locale('en'),
          supportedLocales: const [Locale('en'), Locale('km')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          home: const Scaffold(body: SalesHistoryView()),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Closed · 1'), findsOneWidget);
      expect(
        tester.widget<Text>(find.text('Submitted · 1')).style?.color,
        const Color(0xff2a5483),
      );
      expect(
        tester.widget<Text>(find.text('Submitted')).style?.color,
        const Color(0xff2a5483),
      );
      expect(find.text('Reference'), findsOneWidget);
      expect(find.byIcon(Icons.cloud_done_outlined), findsNWidgets(2));

      await tester.tap(find.text('#AAAAAAAA'));
      await tester.pumpAndSettle();
      expect(find.text('1 × Coffee'), findsOneWidget);
      expect(find.text('Reverse sale'), findsNothing);
      await tester.tap(find.text('Close'));
      await tester.pumpAndSettle();

      await tester.tap(find.byTooltip('Card view'));
      await tester.pumpAndSettle();
      expect(find.text('Reference'), findsNothing);
      expect(find.byIcon(Icons.cloud_done_outlined), findsNWidgets(2));
      expect(
        tester.widget<Text>(find.text('Submitted')).style?.color,
        const Color(0xff2a5483),
      );
      expect(
        tester.getTopLeft(find.text('#AAAAAAAA')).dy,
        tester.getTopLeft(find.text('#BBBBBBBB')).dy,
      );
      await tester.tap(find.text('#BBBBBBBB'));
      await tester.pumpAndSettle();
      expect(find.text('Sale details #BBBBBBBB'), findsOneWidget);
      await tester.tap(find.text('Close'));
      await tester.pumpAndSettle();

      register.serverUnavailable = true;
      await tester.tap(find.byTooltip('Refresh'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Totals may be incomplete'), findsOneWidget);
      expect(find.text('#AAAAAAAA'), findsOneWidget);

      tester.view.physicalSize = const Size(390, 780);
      final localeChange = Get.updateLocale(const Locale('km'));
      await tester.pumpAndSettle();
      await localeChange;
      expect(find.textContaining('វេនបច្ចុប្បន្ន'), findsOneWidget);
      expect(
        tester.getTopLeft(find.text('#AAAAAAAA')).dy,
        isNot(tester.getTopLeft(find.text('#BBBBBBBB')).dy),
      );
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      await tester.pumpAndSettle();
    },
  );
}
