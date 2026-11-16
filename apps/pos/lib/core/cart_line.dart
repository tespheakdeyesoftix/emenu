import 'pos_api.dart';
import 'pricing.dart';

class CartLine {
  const CartLine(
    this.product, {
    this.portion,
    this.modifiers = const [],
    this.quantity = 1,
  });

  final Json product;
  final Json? portion;
  final List<Json> modifiers;
  final int quantity;

  String name(String language) {
    final translated = (product['name_$language'] as String?)?.trim();
    return translated == null || translated.isEmpty
        ? product['name'] as String
        : translated;
  }

  int get unit =>
      ((portion ?? product)['price_minor'] as int) +
      modifiers.fold(0, (total, item) => total + (item['price_minor'] as int));

  CartLine withQuantity(int next) =>
      CartLine(product, portion: portion, modifiers: modifiers, quantity: next);

  Json get request => {
    'product_id': product['id'],
    'portion_id': portion?['id'],
    'modifier_ids': modifiers.map((item) => item['id']).toList(),
    'quantity': quantity,
  };

  Json get heldSnapshot => {
    'product': product,
    'portion': portion,
    'modifiers': modifiers,
    'quantity': quantity,
  };

  factory CartLine.fromHeldSnapshot(Json line) => CartLine(
    jsonObject(line['product']),
    portion: line['portion'] == null ? null : jsonObject(line['portion']),
    modifiers: jsonRows(line['modifiers']),
    quantity: line['quantity'] as int,
  );

  BillTotals totals(Json config) => lineTotals(
    unitPrice: unit,
    quantity: quantity,
    taxMode: config['tax_mode'] as String,
    taxRateBps: config['tax_rate_bps'] as int,
  );

  Json quote(Json config) {
    final amounts = totals(config);
    return {
      ...request,
      'name_km': name('km'),
      'name_en': name('en'),
      'unit_price_minor': unit,
      'subtotal_minor': amounts.subtotal,
      'tax_minor': amounts.tax,
      'total_minor': amounts.total,
    };
  }

  bool matchesSelection(Json line, Set<String> modifierIds) =>
      product['id'] == line['product_id'] &&
      portion?['id'] == line['portion_id'] &&
      unit == line['unit_price_minor'] &&
      modifiers.length == modifierIds.length &&
      modifiers.every((option) => modifierIds.contains(option['id']));

  static CartLine fromCatalog(
    Json product,
    Json line,
    Set<String> modifierIds,
  ) {
    final portions = jsonRows(product['portions']);
    final portion = portions
        .where((row) => row['id'] == line['portion_id'])
        .firstOrNull;
    if (portion == null &&
        (portions.isNotEmpty || line['portion_id'] != null)) {
      throw unavailable;
    }

    final selected = <Json>[];
    for (final group in jsonRows(product['modifier_groups'])) {
      final options = jsonRows(group['options'])
          .where((option) => modifierIds.contains(option['id']))
          .toList();
      if ((group['required'] == true && options.isEmpty) ||
          (group['multiple'] != true && options.length > 1)) {
        throw unavailable;
      }
      selected.addAll(
        options.map((option) => {...option, 'group_id': group['id']}),
      );
    }
    if (selected.length != modifierIds.length) throw unavailable;
    return CartLine(
      product,
      portion: portion,
      modifiers: selected,
      quantity: line['quantity'] as int,
    );
  }

  static const unavailable = PosApiError(
    409,
    'SELECTION_CHANGED',
    'A product, portion, or modifier is unavailable.',
  );
}
