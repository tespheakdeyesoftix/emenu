import 'package:drift/native.dart';
import 'package:emenu_pos/core/pos_api.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:emenu_pos/features/register/register_controller.dart';
import 'package:emenu_pos/ui/shift_view.dart';
import 'package:emenu_pos/ui/translations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:timezone/data/latest_all.dart' as timezones;

class _ShiftRegister extends RegisterController {
  _ShiftRegister(super.database) {
    online.value = true;
    operator.value = const RegisterOperator(
      id: 'staff',
      email: 'staff@example.test',
      role: 'staff',
      displayName: 'Dara',
      failedPins: 0,
      accessRevoked: false,
    );
    snapshot.value = {
      'context': {
        'capabilities': {'shift_management': true},
        'business': {
          'currency': 'USD',
          'timezone': 'Asia/Phnom_Penh',
          'secondary_exchange_rate': '4000',
        },
        'profile': {
          'name': 'Front register',
          'config': {
            'working_day_enabled': true,
            'cashier_shift_enabled': true,
          },
        },
        'working_day': {
          'id': 'day',
          'business_date': '2026-11-12',
          'opened_at': '2026-11-12T10:00:00Z',
          'opened_by_name': 'Vanna',
        },
        'cashier_shift': {
          'id': 'shift',
          'opened_at': '2026-11-12T18:00:00Z',
          'opened_by': 'opener',
          'opened_by_name': 'Sophea',
        },
        'payment_types': [
          {'id': 'cash', 'name': 'Cash', 'kind': 'cash', 'currency': 'USD'},
        ],
      },
    };
  }

  static const tender = {
    'payment_type_id': 'cash',
    'payment_type_name': 'Cash',
    'payment_kind': 'cash',
    'currency': 'USD',
  };

  @override
  Future<Json?> shiftPreview(String shiftId) async => {
    'activity_revision': 8,
    'counts': [
      {...tender, 'expected_minor': 1650},
    ],
  };

  @override
  Future<Json> readShiftManagement(Json input) async {
    if (input['kind'] == 'review') {
      final counts = jsonRows((input['count'] as Map)['counts']);
      expect(counts.single['declared_minor'], 1600);
      return {
        'counts': [
          {...tender, 'declared_minor': 1600, 'variance_minor': -50},
        ],
      };
    }
    return {
      'id': 'shift',
      'base_currency': 'USD',
      'business_date': '2026-11-12',
      'sales': [
        {'currency': 'USD', 'amount_minor': 2185, 'paid_bills': 4},
      ],
      'cash': [
        {'currency': 'KHR', 'kind': 'cash_out', 'amount_minor': 4000},
      ],
      'exchange_rate': '4000',
    };
  }
}

void main() {
  setUpAll(timezones.initializeTimeZones);

  for (final (locale, size) in [
    (const Locale('en'), const Size(1440, 850)),
    (const Locale('km'), const Size(390, 844)),
  ]) {
    testWidgets(
      'shows shift status and totals in ${locale.languageCode} at ${size.width}px',
      (tester) async {
        final database = RegisterDatabase(NativeDatabase.memory());
        addTearDown(database.close);
        final controller = _ShiftRegister(database);
        await tester.binding.setSurfaceSize(size);
        addTearDown(() => tester.binding.setSurfaceSize(null));
        await tester.pumpWidget(
          GetMaterialApp(
            translations: PosTranslations(),
            locale: locale,
            supportedLocales: const [Locale('en'), Locale('km')],
            localizationsDelegates: GlobalMaterialLocalizations.delegates,
            home: Scaffold(body: ShiftView(controller)),
          ),
        );
        await tester.pump(const Duration(milliseconds: 150));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.text('working_day'.tr), findsOneWidget);
        expect(find.text('cashier_shift'.tr), findsOneWidget);
        expect(find.text('close_shift'.tr), findsOneWidget);
        expect(
          find.textContaining('Sophea', findRichText: true),
          findsOneWidget,
        );
        if (size.width < 600) {
          await tester.scrollUntilVisible(find.text(r'$21.85'), 140);
        }
        expect(find.text(r'$21.85'), findsOneWidget);
        expect(find.text(r'$1.00'), findsOneWidget);
        expect(find.text('shift_expected_drawer'.tr), findsNothing);

        await tester.ensureVisible(find.text('close_shift'.tr));
        await tester.tap(find.text('close_shift'.tr));
        await tester.pumpAndSettle();
        expect(find.text('shift_enter_count'.tr), findsOneWidget);
        expect(find.textContaining(r'$16.50'), findsNothing);
        await tester.enterText(find.byType(EditableText), '16.00');
        await tester.tap(find.text('shift_review_count'.tr));
        await tester.pumpAndSettle();
        expect(find.text('${'shift_short'.tr} \$0.50'), findsOneWidget);
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }
}
