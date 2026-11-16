import 'dart:convert';

import 'package:emenu_pos/core/receipt_document.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:emenu_pos/ui/receipt_dialog.dart';
import 'package:emenu_pos/ui/translations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:pdf/pdf.dart';

void main() {
  test(
    'print documents use thermal paper size and the configured copy count',
    () async {
      final document = await receiptDocument(
        png: base64Decode(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC',
        ),
        heightToWidth: 2,
        widthMm: 58,
        copies: 3,
      );
      expect(document.format.width, closeTo(58 * PdfPageFormat.mm, 0.01));
      expect(document.format.height, closeTo(116 * PdfPageFormat.mm, 0.01));
      final pdf = latin1.decode(document.bytes);
      expect(pdf, startsWith('%PDF'));
      expect(pdf, matches(RegExp(r'/Count\s+3\b')));
    },
  );

  testWidgets(
    'receipt preview uses saved Khmer product, tax, footer and copies',
    (tester) async {
      await tester.pumpWidget(
        GetMaterialApp(
          locale: const Locale('km'),
          translations: PosTranslations(),
          home: Scaffold(
            body: ReceiptDialog(
              sale: LocalSale(
                id: 'local_receipt',
                profileId: 'restaurant',
                operatorId: 'cashier',
                createdAt: DateTime.utc(2026, 11, 12),
                total: 110,
                currency: 'USD',
                request: jsonEncode({
                  'receipt': {
                    'business_date': '2026-11-12',
                    'copies': 2,
                    'template': {
                      'title': 'ហាងកាហ្វេ',
                      'footer': 'អរគុណ',
                      'show_tax': true,
                    },
                  },
                  'quote': [
                    {
                      'quantity': 1,
                      'name_km': 'កាហ្វេ',
                      'tax_minor': 10,
                      'total_minor': 110,
                    },
                  ],
                }),
              ),
              syncStatus: 'pending',
              recordPrint: (_) async {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('ហាងកាហ្វេ'), findsOneWidget);
      expect(find.text('1 × កាហ្វេ'), findsOneWidget);
      expect(find.text('ពន្ធ'), findsOneWidget);
      expect(find.text('អរគុណ'), findsOneWidget);
      expect(find.text('ចំនួនច្បាប់ 2'), findsOneWidget);
      expect(find.text('រង់ចាំផ្ញើ'), findsOneWidget);
    },
  );
}
