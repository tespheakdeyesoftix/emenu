import '../../../core/pos_api.dart';
import '../../../core/pricing.dart';

class CartLine {
  const CartLine(
    this.product, {
    this.portion,
    this.modifiers = const [],
    this.quantity = 1,
    this.discount = 0,
    this.discountBps,
    this.discountNote,
    this.basePriceOverride,
    this.priceChangeReason,
    this.isFree = false,
    this.freeReason,
    this.note,
    this.order = const {},
  });

  final Json product;
  final Json? portion;
  final List<Json> modifiers;
  final num quantity;
  final int discount;
  final int? discountBps;
  final String? discountNote;
  final int? basePriceOverride;
  final String? priceChangeReason;
  final bool isFree;
  final String? freeReason;
  final String? note;
  final Json order;
  bool get submitted => order['status'] == 'submitted';
  bool get voided => order['status'] == 'void';
  bool get canEditQuantity => !submitted && !voided;
  String get session => submitted || voided
      ? order['order_session'] as String? ?? 'legacy'
      : 'current';

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
  bool get hasLineEdits =>
      basePriceOverride != null || priceChangeReason != null || isFree || note != null;
  bool get hasDiscount => discount > 0 || discountBps != null;
  bool get canMerge => !submitted && !hasLineEdits && !hasDiscount;

  CartLine withQuantity(num next, {int? discount, Json? order}) => CartLine(
    product,
    portion: portion,
    modifiers: modifiers,
    quantity: next,
    discount: discount ?? this.discount,
    discountBps: discountBps,
    discountNote: discountNote,
    basePriceOverride: basePriceOverride,
    priceChangeReason: priceChangeReason,
    isFree: isFree,
    freeReason: freeReason,
    note: note,
    order: order ?? this.order,
  );

  CartLine withDiscount({int amount = 0, int? bps, String? note}) =>
      withLineEdits({
        ...lineEdits,
        'discount_minor': amount,
        'discount_bps': bps,
        'discount_note': note,
      });

  CartLine withLineEdits(Json data) {
    final base = data['base_price_override_minor'];
    final free = data['is_free'];
    final freeReason = data['free_reason'];
    final rawNote = data['note'];
    final reason = data['price_change_reason'];
    final discount = data['discount_minor'] ?? 0;
    final discountBps = data['discount_bps'];
    final discountNote = data['discount_note'];
    if ((base != null && (base is! int || base < 0 || base > maxPosAmount)) ||
        (free != null && free is! bool) ||
        (freeReason != null &&
            (free != true || freeReason is! String ||
                freeReason.trim().isEmpty || freeReason.trim().length > 250)) ||
        (rawNote != null &&
            (rawNote is! String || rawNote.trim().length > 500)) ||
        (reason != null && (reason is! String || reason.trim().length > 250)) ||
        discount is! int ||
        discount < 0 ||
        (discountBps != null &&
            (discountBps is! int || discountBps < 1 || discountBps > 10000)) ||
        (discountNote != null &&
            (discountNote is! String || discountNote.trim().length > 250 ||
                (discount == 0 && discountBps == null))) ||
        (free == true && (discount != 0 || discountBps != null))) {
      throw const FormatException('INVALID_LINE_EDIT');
    }
    final note = (rawNote as String?)?.trim();
    return CartLine(
      product,
      portion: portion,
      modifiers: modifiers,
      quantity: quantity,
      discount: discountBps == null ? discount : 0,
      discountBps: discountBps as int?,
      discountNote: (discountNote as String?)?.trim(),
      basePriceOverride: base as int?,
      priceChangeReason: reason is String && reason.trim().isNotEmpty ? reason.trim() : null,
      isFree: free == true,
      freeReason: (freeReason as String?)?.trim(),
      note: note == null || note.isEmpty ? null : note,
      order: order,
    );
  }

  Json get lineEdits => {
    if (discount != 0) 'discount_minor': discount,
    'discount_bps': ?discountBps,
    if (hasDiscount) 'discount_note': ?discountNote,
    'base_price_override_minor': ?basePriceOverride,
    'price_change_reason': ?priceChangeReason,
    if (isFree) 'is_free': true,
    'free_reason': ?freeReason,
    'note': ?note,
  };

  Json get request => {
    'status': 'new',
    ...order,
    'product_id': product['id'],
    'portion_id': portion?['id'],
    'modifier_ids': modifiers.map((item) => item['id']).toList(),
    'quantity': quantity,
    ...lineEdits,
  };

  Json get heldSnapshot => {
    'status': 'new',
    ...order,
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
    quantity: line['quantity'] as num,
    order: {
      for (final key in [
        'status',
        'line_key',
        'order_session',
        'ordered_at',
        'ordered_by',
        'ordered_by_name',
        'source_line_key',
        'void_reason',
      ])
        if (line[key] != null) key: line[key],
    },
  ).withLineEdits(line);

  static List<CartLine> billLines(Json bill) => [
    for (final (index, row) in jsonRows(bill['lines']).indexed)
      CartLine.fromHeldSnapshot({
        'status': bill['status'] ?? 'new',
        'line_key': 'legacy_${index + 1}',
        if (bill['status'] == 'submitted')
          'ordered_by_name': bill['operator_name'],
        ...row,
      }),
  ];

  BillTotals totals(Json config) => lineTotals(
    unitPrice: unit,
    quantity: quantity,
    taxMode: (legacyTaxSettings(config)['tax_mode'] as String?) ?? 'disabled',
    taxRateBps: (legacyTaxSettings(config)['tax_rate_bps'] as int?) ?? 0,
    discount: discount,
    discountBps: discountBps,
    taxRule: defaultTaxRule(config),
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
      if (amounts.discount != 0) 'discount_minor': amounts.discount,
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
      quantity: line['quantity'] as num,
    ).withLineEdits(line);
  }

  static const unavailable = PosApiError(
    409,
    'SELECTION_CHANGED',
    'A product, portion, or modifier is unavailable.',
  );
}
