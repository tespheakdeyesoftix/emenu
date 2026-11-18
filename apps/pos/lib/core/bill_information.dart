import 'pos_api.dart';

DateTime? parseBillDate(Object? value) {
  if (value is! String || !RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value)) {
    return null;
  }
  final date = DateTime.tryParse(value);
  return date != null &&
          date.year >= 1 &&
          date.toIso8601String().startsWith(value)
      ? date
      : null;
}

/// Posting date is independent of the context used to guard operating changes.
String resolveBillPostingDate(
  Object? requested,
  Json config,
  String operatingDate,
) {
  if (requested == null) return operatingDate;
  if (parseBillDate(requested) == null) {
    throw const FormatException('INVALID_POSTING_DATE');
  }
  if (config['cashier_shift_enabled'] == true && requested != operatingDate) {
    throw const FormatException('POSTING_DATE_LOCKED');
  }
  return requested as String;
}
