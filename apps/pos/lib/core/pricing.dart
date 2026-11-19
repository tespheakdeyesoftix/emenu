import 'pos_api.dart';

const maxPosAmount = 100000000000;

// POS quantities are stored to the nearest thousandth of a unit.
num normalizedQuantity(num value) {
  final units = (value * 1000).round();
  return units % 1000 == 0 ? units ~/ 1000 : units / 1000;
}

bool validSaleQuantity(num value) =>
    value.isFinite && value > 0 && value <= 999 &&
    normalizedQuantity(value) == value;

Json legacyTaxSettings(Json config) =>
    config['legacy_tax'] is Map ? jsonObject(config['legacy_tax']) : config;

Json withCurrentTaxSettings(Json saved, Json current) => {
  ...saved,
  for (final key in [
    'tax_rules',
    'default_tax_rule_id',
    'default_tax_rule',
    'legacy_tax',
    'tax_mode',
    'tax_rate_bps',
  ])
    key: current[key],
};

Json? defaultTaxRule(Json config) {
  final selected = config['default_tax_rule'];
  if (selected is Map) return jsonObject(selected);
  final id = config['default_tax_rule_id'];
  if (id is! String || id.isEmpty) return null;
  return jsonRows(config['tax_rules']).where((rule) => rule['id'] == id).firstOrNull;
}

class BillTotals {
  const BillTotals({
    required this.gross,
    required this.subtotal,
    required this.discount,
    required this.tax1,
    required this.tax2,
    required this.tax3,
    required this.total,
  });

  final int gross;
  final int subtotal;
  final int discount;
  final int tax1;
  final int tax2;
  final int tax3;
  final int total;
  int get tax => tax1 + tax2 + tax3;
}

class DiscountExceedsSubtotal extends FormatException {
  const DiscountExceedsSubtotal()
    : super('The discount exceeds the line subtotal.');
}

int _round(BigInt numerator, BigInt denominator) {
  final rounded =
      (BigInt.two * numerator.abs() + denominator) ~/
      (BigInt.two * denominator);
  if (rounded > BigInt.from(maxPosAmount)) {
    throw const FormatException('The amount exceeds the register limit.');
  }
  return (numerator.isNegative ? -rounded : rounded).toInt();
}

(BigInt, BigInt) _taxRate(num value) {
  if (!value.isFinite || value < 0 || value > 100) {
    throw const FormatException('Invalid tax rate.');
  }
  final match = RegExp(r'^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$')
      .firstMatch(value.toString())!;
  final fraction = match.group(2) ?? '';
  final digits = BigInt.parse(match.group(1)! + fraction);
  final scale = fraction.length - int.parse(match.group(3) ?? '0');
  return scale < 0
      ? (digits * BigInt.from(10).pow(-scale), BigInt.one)
      : (digits, BigInt.from(10).pow(scale));
}

BillTotals lineTotals({
  required int unitPrice,
  required num quantity,
  required String taxMode,
  required int taxRateBps,
  int discount = 0,
  int? discountBps,
  Json? taxRule,
}) {
  if (unitPrice < 0 ||
      !validSaleQuantity(quantity) ||
      discount < 0 ||
      (discountBps != null && (discountBps < 1 || discountBps > 10000)) ||
      taxRateBps < 0 ||
      taxRateBps > 10000) {
    throw const FormatException('Invalid quantity, price, or tax.');
  }
  final gross = _round(
    BigInt.from(unitPrice) * BigInt.from((quantity * 1000).round()),
    BigInt.from(1000),
  );
  if (gross > maxPosAmount) {
    throw const FormatException('The amount exceeds the register limit.');
  }
  final mode = taxRule?['tax_mode'] ?? taxMode;
  final hundred = BigInt.from(100);
  final rates = taxRule == null
      ? [
          (BigInt.from(taxRateBps), hundred),
          (BigInt.zero, BigInt.one),
          (BigInt.zero, BigInt.one),
        ]
      : [
          for (var i = 1; i <= 3; i++)
            _taxRate(taxRule['tax_${i}_rate'] as num),
        ];
  final afterDiscount = [
    for (var i = 1; i <= 3; i++)
      taxRule?['calculate_tax_${i}_after_discount'] ?? true,
  ];
  final parents = [
    <int>[],
    [if (taxRule?['calculate_tax_2_after_adding_tax_1'] == true) 0],
    [
      if (taxRule?['calculate_tax_3_after_adding_tax_1'] == true) 0,
      if (taxRule?['calculate_tax_3_after_adding_tax_2'] == true) 1,
    ],
  ];
  var subtotal = gross;
  var taxes = [0, 0, 0];
  int discountFor(int base) => discountBps == null
      ? discount
      : _round(BigInt.from(base) * BigInt.from(discountBps), BigInt.from(10000));
  final int amountOff;
  if (mode == 'inclusive') {
    final scale =
        rates.fold(BigInt.one, (max, rate) => rate.$2 > max ? rate.$2 : max) *
        hundred;
    final base = scale.pow(3);
    List<BigInt> coefficients(bool discounted) {
      final parts = <BigInt>[];
      for (final (i, (numerator, denominator)) in rates.indexed) {
        final input = !discounted || afterDiscount[i] == true
            ? base
            : BigInt.zero;
        final prior = parents[i].fold(
          BigInt.zero,
          (sum, parent) => sum + parts[parent],
        );
        parts.add(
          (input + prior) *
              (numerator * (scale ~/ (denominator * hundred))) ~/
              scale,
        );
      }
      return parts;
    }

    List<int> extract(Iterable<BigInt> amounts, BigInt divisor) {
      var running = BigInt.zero;
      var prior = 0;
      return amounts.map((amount) {
        running += amount;
        final cumulative = _round(running, divisor);
        final part = cumulative - prior;
        prior = cumulative;
        return part;
      }).toList();
    }

    final shares = coefficients(false);
    final denominator = shares.fold(base, (sum, share) => sum + share);
    taxes = extract(
      shares.map((share) => BigInt.from(gross) * share),
      denominator,
    );
    subtotal = gross - taxes.reduce((sum, amount) => sum + amount);
    amountOff = discountFor(subtotal);
    if (amountOff > subtotal) {
      throw const DiscountExceedsSubtotal();
    }
    if (amountOff > 0) {
      final grossBase = BigInt.from(gross) * base;
      final discountBase = BigInt.from(amountOff) * denominator;
      final applied = discountBase > grossBase ? grossBase : discountBase;
      final reductions = coefficients(true);
      taxes = extract(
        shares.indexed.map(
          (pair) => grossBase * pair.$2 - applied * reductions[pair.$1],
        ),
        denominator * base,
      );
    }
  } else {
    amountOff = discountFor(subtotal);
    if (amountOff > subtotal) {
      throw const DiscountExceedsSubtotal();
    }
    if (mode == 'exclusive') {
      for (final (i, (numerator, denominator)) in rates.indexed) {
        final net = subtotal - (afterDiscount[i] == true ? amountOff : 0);
        final prior = parents[i].fold(0, (sum, parent) => sum + taxes[parent]);
        taxes[i] = _round(
          BigInt.from(net + prior) * numerator,
          denominator * hundred,
        );
      }
    } else if (mode != 'disabled') {
      throw const FormatException('Invalid tax setting.');
    }
  }
  return BillTotals(
    gross: gross,
    subtotal: subtotal,
    discount: amountOff,
    tax1: taxes[0],
    tax2: taxes[1],
    tax3: taxes[2],
    total: subtotal - amountOff + taxes.reduce((sum, amount) => sum + amount),
  );
}

int _units(String currency) => switch (currency) {
  'USD' => 100,
  'KHR' => 1,
  _ => throw const FormatException('Unsupported currency.'),
};

(BigInt, BigInt) _exchangeRatio(String exchangeRate) {
  final rate = RegExp(r'^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$')
      .firstMatch(exchangeRate);
  if (rate == null) throw const FormatException('Invalid exchange rate.');
  final fraction = rate.group(2) ?? '';
  var numerator = BigInt.parse(rate.group(1)! + fraction);
  final scale = fraction.length - int.parse(rate.group(3) ?? '0');
  if (numerator <= BigInt.zero || scale.abs() > 308) {
    throw const FormatException('Invalid exchange rate.');
  }
  final denominator = scale > 0 ? BigInt.from(10).pow(scale) : BigInt.one;
  if (scale < 0) numerator *= BigInt.from(10).pow(-scale);
  return (numerator, denominator);
}

int secondaryToPrimary(int amount, String primary, String exchangeRate) {
  final (numerator, denominator) = _exchangeRatio(exchangeRate);
  final secondary = primary == 'USD' ? 'KHR' : 'USD';
  return _round(
    BigInt.from(amount) * BigInt.from(_units(primary)) * denominator,
    BigInt.from(_units(secondary)) * numerator,
  );
}

int primaryToSecondary(int amount, String primary, String exchangeRate) {
  final (numerator, denominator) = _exchangeRatio(exchangeRate);
  final secondary = primary == 'USD' ? 'KHR' : 'USD';
  return _round(
    BigInt.from(amount) * BigInt.from(_units(secondary)) * numerator,
    BigInt.from(_units(primary)) * denominator,
  );
}

String displayAmount(int minor, String currency) {
  if (currency == 'KHR') return '$minor ៛';
  final amount = minor.abs();
  final sign = minor < 0 ? '-' : '';
  return '$sign\$${amount ~/ 100}.${(amount % 100).toString().padLeft(2, '0')}';
}

int? parseAmount(String input, String currency, {bool signed = false}) {
  final value = input.trim();
  final negative = value.startsWith('-');
  if (negative && !signed) return null;
  final digits = negative ? value.substring(1) : value;
  final int? amount;
  if (currency == 'KHR') {
    amount = RegExp(r'^\d+$').hasMatch(digits) ? int.tryParse(digits) : null;
  } else if (currency == 'USD') {
    final match = RegExp(r'^(\d+)(?:\.(\d{1,2}))?$').firstMatch(digits);
    if (match == null) return null;
    final whole = int.tryParse(match.group(1)!);
    if (whole == null || whole > maxPosAmount ~/ 100) return null;
    amount = whole * 100 + int.parse((match.group(2) ?? '').padRight(2, '0'));
  } else {
    return null;
  }
  if (amount == null || amount > maxPosAmount) return null;
  return negative ? -amount : amount;
}

List<String> paymentCurrencies(Json type) {
  final currency = type['currency'];
  if (currency is String) return [currency];
  // An offline register may still have a pre-migration payment snapshot.
  return (type['currencies'] as List?)?.whereType<String>().toList() ?? [];
}

int paymentTotal({
  required List<Json> entries,
  required List<Json> paymentTypes,
  required String primary,
  required String rate,
}) {
  final byId = {for (final type in paymentTypes) type['id']: type};
  final net = {'USD': 0, 'KHR': 0};
  final cash = {'USD': 0, 'KHR': 0};
  for (final entry in entries) {
    final type = byId[entry['payment_type_id']];
    final currency = entry['currency'];
    final amount = entry['amount_minor'];
    final kind = entry['entry_type'] ?? 'tender';
    if (type == null ||
        !paymentCurrencies(type).contains(currency) ||
        !net.containsKey(currency) ||
        amount is! int ||
        amount < 1 ||
        amount > maxPosAmount ||
        (kind != 'tender' && kind != 'change') ||
        (kind == 'change' && type['kind'] != 'cash')) {
      throw const FormatException('Invalid payment.');
    }
    final signed = kind == 'change' ? -amount : amount;
    net[currency] = net[currency]! + signed;
    if (type['kind'] == 'cash') cash[currency] = cash[currency]! + signed;
  }
  if (cash.values.any((amount) => amount < 0)) {
    throw const FormatException(
      'Change cannot exceed cash tendered in that currency.',
    );
  }
  final secondary = primary == 'USD' ? 'KHR' : 'USD';
  return net[primary]! +
      (net[secondary] == 0
          ? 0
          : secondaryToPrimary(net[secondary]!, primary, rate));
}
