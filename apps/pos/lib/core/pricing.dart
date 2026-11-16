import 'pos_api.dart';

const maxPosAmount = 100000000000;

class BillTotals {
  const BillTotals({
    required this.subtotal,
    required this.tax,
    required this.total,
  });

  final int subtotal;
  final int tax;
  final int total;
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

BillTotals lineTotals({
  required int unitPrice,
  required int quantity,
  required String taxMode,
  required int taxRateBps,
}) {
  if (unitPrice < 0 ||
      quantity < 1 ||
      quantity > 999 ||
      taxRateBps < 0 ||
      taxRateBps > 10000) {
    throw const FormatException('Invalid quantity, price, or tax.');
  }
  final gross = unitPrice * quantity;
  if (gross > maxPosAmount) {
    throw const FormatException('The amount exceeds the register limit.');
  }
  final tax = switch (taxMode) {
    'disabled' => 0,
    'inclusive' => _round(
      BigInt.from(gross) * BigInt.from(taxRateBps),
      BigInt.from(10000 + taxRateBps),
    ),
    'exclusive' => _round(
      BigInt.from(gross) * BigInt.from(taxRateBps),
      BigInt.from(10000),
    ),
    _ => throw const FormatException('Invalid tax setting.'),
  };
  return BillTotals(
    subtotal: taxMode == 'inclusive' ? gross - tax : gross,
    tax: tax,
    total: taxMode == 'exclusive' ? gross + tax : gross,
  );
}

int _units(String currency) => switch (currency) {
  'USD' => 100,
  'KHR' => 1,
  _ => throw const FormatException('Unsupported currency.'),
};

int secondaryToPrimary(int amount, String primary, String exchangeRate) {
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
  final secondary = primary == 'USD' ? 'KHR' : 'USD';
  return _round(
    BigInt.from(amount) * BigInt.from(_units(primary)) * denominator,
    BigInt.from(_units(secondary)) * numerator,
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
        !(type['currencies'] as List).contains(currency) ||
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
