import 'package:emenu_pos/global.dart';
import 'package:emenu_pos/shared/app_theme.dart';
import 'package:emenu_pos/shared/forms/input_number_dialog_widget.dart';
import 'package:emenu_pos/ui/translations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';

Future<void> openNumberDialog(
  WidgetTester tester, {
  required ValueChanged<num?> onResult,
  bool isFloat = false,
  num? value,
  num? min,
  num? max,
}) async {
  await tester.pumpWidget(
    GetMaterialApp(
      theme: AppTheme.light,
      locale: const Locale('en'),
      translations: PosTranslations(),
      home: Scaffold(
        body: Center(
          child: TextButton(
            onPressed: () async => onResult(
              await app.input_number(
                title: 'Number',
                isFloat: isFloat,
                value: value,
                min: min,
                max: max,
              ),
            ),
            child: const Text('Open'),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Open'));
  await tester.pumpAndSettle();
}

void main() {
  tearDown(Get.reset);

  testWidgets('integer input returns a keypad value within its limits', (
    tester,
  ) async {
    num? result;
    await openNumberDialog(
      tester,
      onResult: (value) => result = value,
      value: 2,
      min: 1,
      max: 1000,
    );
    final field = find.byType(TextField);
    expect(tester.widget<TextField>(field).controller!.text, '2');
    await tester.tap(find.widgetWithText(OutlinedButton, '7'));
    expect(tester.widget<TextField>(field).controller!.text, '7');
    await tester.tap(find.widgetWithText(OutlinedButton, '3'));
    expect(tester.widget<TextField>(field).controller!.text, '73');
    await tester.enterText(field, '1001');
    await tester.pump();
    expect(
      tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Save'))
          .onPressed,
      isNull,
    );
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();
    expect(find.byType(InputNumberDialogWidget), findsOneWidget);

    await tester.tap(find.byTooltip('Clear count'));
    await tester.tap(find.widgetWithText(OutlinedButton, '4'));
    await tester.pump();
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    expect(result, isA<int>());
    expect(result, 4);
    expect(find.byType(InputNumberDialogWidget), findsNothing);
  });

  testWidgets('float input supports decimals, signs, and editing a selection', (
    tester,
  ) async {
    num? result;
    await openNumberDialog(
      tester,
      isFloat: true,
      value: 1.25,
      onResult: (value) => result = value,
    );
    final input = tester.widget<TextField>(find.byType(TextField)).controller!;
    expect(input.text, '1.25');
    input.selection = const TextSelection(baseOffset: 2, extentOffset: 4);
    await tester.tap(find.widgetWithText(OutlinedButton, '5'));
    await tester.pump();
    expect(input.text, '1.5');
    await tester.tap(find.text('±'));
    await tester.pump();
    expect(input.text, '-1.5');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();
    expect(result, isA<double>());
    expect(result, -1.5);
  });

  testWidgets('decimal keypad input cannot submit a nonfinite value', (
    tester,
  ) async {
    num? result;
    await openNumberDialog(
      tester,
      isFloat: true,
      min: 0,
      onResult: (value) => result = value,
    );
    final field = find.byType(TextField);
    await tester.enterText(field, '1e309');
    await tester.pump();
    expect(
      tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Save'))
          .onPressed,
      isNull,
    );
    await tester.tap(find.byTooltip('Clear count'));
    await tester.tap(find.widgetWithText(OutlinedButton, '0'));
    await tester.tap(find.widgetWithText(OutlinedButton, '.'));
    await tester.tap(find.widgetWithText(OutlinedButton, '5'));
    await tester.pump();
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    expect(result, 0.5);
    expect(result, isA<double>());
  });

  testWidgets(
    'cancel returns null and reopening starts with the supplied value',
    (tester) async {
      num? result = 99;
      await openNumberDialog(
        tester,
        value: 3,
        onResult: (value) => result = value,
      );
      await tester.enterText(find.byType(TextField), '8');
      await tester.tap(find.text('Back'));
      await tester.pumpAndSettle();
      expect(result, isNull);
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        '3',
      );
      await tester.tap(find.text('Back'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );

  test('invalid number dialog arguments fail before opening a route', () {
    expect(
      () => app.input_number(title: 'Count', value: 1.5),
      throwsArgumentError,
    );
    expect(
      () => app.input_number(title: 'Count', min: 2, max: 1),
      throwsArgumentError,
    );
    expect(
      () => app.input_number(
        title: 'Price',
        isFloat: true,
        value: double.infinity,
      ),
      throwsArgumentError,
    );
  });
}
