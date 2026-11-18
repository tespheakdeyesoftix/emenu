import '../../../core/pos_api.dart';
import '../../../core/pricing.dart';

class CartLine {
  const CartLine(
    this.product, {
    this.portion,
    this.modifiers = const [],
    this.quantity = 1,
    this.discount = 0,
    this.basePriceOverride,
    this.isFree = false,
    this.note,
  });

  final Json product;
  final Json? portion;
  final List<Json> modifiers;
  final int quantity;
  final int discount;
  final int? basePriceOverride;
  final bool isFree;
  final String? note;

  String name(String language) {
    final translated = (product['name_$language'] as String?)?.trim();
    return translated == null || translated.isEmpty
        ? product['name'] as String
        : translated;
  }

  int get catalogBase => (portion ?? product)['price_minor'] as int;
  int get basePrice => basePriceOverride ?? catalogBase;
  int get modifierPrice =>
      modifiers.fold(0, (total, item) => total + (item['price_minor'] as int));
  int get catalogUnit => catalogBase + modifierPrice;
  int get unit => isFree ? 0 : basePrice + modifierPrice;
  bool get hasLineEdits => basePriceOverride != null || isFree || note != null;
  bool get canMerge => !hasLineEdits && discount == 0;

  CartLine withQuantity(int next, {int? discount}) => CartLine(
    product,
    portion: portion,
    modifiers: modifiers,
    quantity: next,
    discount: discount ?? this.discount,
    basePriceOverride: basePriceOverride,
    isFree: isFree,
    note: note,
  );

  CartLine withLineEdits(Json data) {
    final base = data['base_price_override_minor'];
    final free = data['is_free'];
    final rawNote = data['note'];
    final discount = data['discount_minor'] ?? 0;
    if ((base != null && (base is! int || base < 0 || base > maxPosAmount)) ||
        (free != null && free is! bool) ||
        (rawNote != null &&
            (rawNote is! String || rawNote.trim().length > 500)) ||
        discount is! int ||
        (free == true && discount != 0)) {
      throw const FormatException('INVALID_LINE_EDIT');
    }
    final note = (rawNote as String?)?.trim();
    return CartLine(
      product,
      portion: portion,
      modifiers: modifiers,
      quantity: quantity,
      discount: discount,
      basePriceOverride: base as int?,
      isFree: free == true,
      note: note == null || note.isEmpty ? null : note,
    );
  }

  Json get lineEdits => {
    if (discount != 0) 'discount_minor': discount,
    'base_price_override_minor': ?basePriceOverride,
    if (isFree) 'is_free': true,
    'note': ?note,
  };

  Json get request => {
    'product_id': product['id'],
    'portion_id': portion?['id'],
    'modifier_ids': modifiers.map((item) => item['id']).toList(),
    'quantity': quantity,
    ...lineEdits,
  };

  Json get heldSnapshot => {
    'product': product,
    'portion': portion,
    'modifiers': modifiers,
    'quantity': quantity,
    ...lineEdits,
  };

  factory CartLine.fromHeldSnapshot(Json line) => CartLine(
    jsonObject(line['product']),
    portion: line['portion'] == null ? null : jsonObject(line['portion']),
    modifiers: jsonRows(line['modifiers']),
    quantity: line['quantity'] as int,
  ).withLineEdits(line);

  BillTotals totals(Json config) => lineTotals(
    unitPrice: unit,
    quantity: quantity,
    taxMode: (legacyTaxSettings(config)['tax_mode'] as String?) ?? 'disabled',
    taxRateBps: (legacyTaxSettings(config)['tax_rate_bps'] as int?) ?? 0,
    discount: discount,
    taxRule: config['default_tax_rule'] is Map
        ? jsonObject(config['default_tax_rule'])
        : null,
  );

  Json quote(Json config) {
    final amounts = totals(config);
    return {
      ...request,
      'catalog_base_price_minor': catalogBase,
      'catalog_unit_price_minor': catalogUnit,
      'name_km': name('km'),
      'name_en': name('en'),
      'unit_price_minor': unit,
      'subtotal_minor': amounts.subtotal,
      'tax_1_amount': amounts.tax1,
      'tax_2_amount': amounts.tax2,
      'tax_3_amount': amounts.tax3,
      'total_tax_amount': amounts.tax,
      'tax_minor': amounts.tax,
      'total_minor': amounts.total,
      'total_amount': amounts.total,
    };
  }

  bool matchesSelection(Json line, Set<String> modifierIds) =>
      product['id'] == line['product_id'] &&
      portion?['id'] == line['portion_id'] &&
      (line['catalog_base_price_minor'] ?? catalogBase) == catalogBase &&
      catalogUnit ==
          (line['catalog_unit_price_minor'] ?? line['unit_price_minor']) &&
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
    ).withLineEdits(line);
  }

  static const unavailable = PosApiError(
    409,
    'SELECTION_CHANGED',
    'A product, portion, or modifier is unavailable.',
  );
}
