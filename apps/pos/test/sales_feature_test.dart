import 'package:drift/native.dart';
import 'package:emenu_pos/core/pos_api.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:emenu_pos/features/register/register_controller.dart'
    show RegisterController;
import 'package:emenu_pos/features/sales/sale/cart_line.dart';
import 'package:emenu_pos/features/sales/sale/sale_service.dart';
import 'package:emenu_pos/features/sales/sale_binding.dart';
import 'package:emenu_pos/features/sales/sale_controller.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';

const coffee = <String, dynamic>{
  'id': 'coffee',
  'name': 'Coffee',
  'code': 'C01',
  'price_minor': 200,
  'menu_ids': ['drinks'],
};
const tea = <String, dynamic>{
  'id': 'tea',
  'name': 'Tea',
  'code': 'T01',
  'price_minor': 150,
  'menu_ids': ['drinks'],
};
const cake = <String, dynamic>{
  'id': 'cake',
  'name': 'Cake',
  'code': 'K01',
  'price_minor': 300,
  'menu_ids': ['food'],
};

Json salesSnapshot() => {
  'context': {
    'profile': {
      'config': {'tax_mode': 'disabled'},
    },
    'business': {'currency': 'USD', 'secondary_exchange_rate': '4000'},
    'capabilities': {'cart_line_edits': true},
  },
  'catalog': {
    'mode': 'menu',
    'products': [coffee, tea, cake],
  },
};

void main() {
  late RegisterDatabase database;
  late RegisterController register;

  setUp(() {
    database = RegisterDatabase(NativeDatabase.memory());
    register = RegisterController(database);
    register.snapshot.value = salesSnapshot();
    SaleBinding(register).dependencies();
  });

  tearDown(() async {
    Get.reset();
    await database.close();
  });

  testWidgets('recreating the sales controller retains the register cart', (
    tester,
  ) async {
    final first = Get.find<SaleController>();
    final service = Get.find<SaleService>();
    expect(service, same(register.sales));
    first.service.add(const CartLine(coffee));
    first.selectLine(service.cart.single);
    first.searchChanged('tea');

    await Get.delete<SaleController>();
    SaleBinding(register).dependencies();
    final second = Get.find<SaleController>();
    await tester.pump(const Duration(seconds: 1));

    expect(first.isClosed, isTrue);
    expect(second, isNot(same(first)));
    expect(second.service, same(service));
    expect(register.cart, same(service.cart));
    expect(second.service.cartTotal, 200);
    expect(second.selectedLine.value, isNull);
    expect(second.term.value, isEmpty);
    expect(first.term.value, isEmpty);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'search debounces the latest text and scans one exact product code',
    (tester) async {
      final controller = Get.find<SaleController>();
      controller.searchChanged('tea');
      await tester.pump(const Duration(milliseconds: 600));
      expect(controller.visibleProducts, hasLength(3));
      controller.searchChanged('coffee');
      await tester.pump(const Duration(milliseconds: 700));
      expect(controller.visibleProducts.single['id'], 'coffee');

      controller.search.text = ' C01 ';
      expect(
        controller.searchSubmitted(controller.search.text)?['id'],
        'coffee',
      );
      expect(controller.search.text, isEmpty);
      expect(controller.term.value, isEmpty);
      controller.section.value = 'food';
      expect(controller.visibleProducts.single['id'], 'cake');

      register.snapshot.value = {
        ...salesSnapshot(),
        'catalog': {
          'mode': 'menu',
          'products': [
            coffee,
            {...tea, 'code': 'C01'},
          ],
        },
      };
      expect(controller.searchSubmitted('C01'), isNull);
    },
  );

  test(
    'changing a portion retains line edits and resets its price override',
    () {
      final service = Get.find<SaleService>();
      const small = <String, dynamic>{'id': 'small', 'price_minor': 200};
      const large = <String, dynamic>{'id': 'large', 'price_minor': 350};
      const original = CartLine(
        coffee,
        portion: small,
        quantity: 3,
        basePriceOverride: 180,
        discount: 20,
        note: 'No sugar',
      );

      final unchanged = service.withOptions(
        original,
        const CartLine(coffee, portion: small),
      );
      expect(unchanged.basePriceOverride, 180);
      final changed = service.withOptions(
        original,
        const CartLine(coffee, portion: large),
      );
      expect(changed.basePriceOverride, isNull);
      expect(changed.quantity, 3);
      expect(changed.discount, 20);
      expect(changed.note, 'No sugar');
      expect(service.totalOf(changed).total, 1030);
    },
  );
}
