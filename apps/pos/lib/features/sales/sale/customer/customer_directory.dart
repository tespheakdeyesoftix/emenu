import '../../../../core/pos_api.dart';

/// The customer list cached for this register, including member-card references.
class CustomerDirectory {
  CustomerDirectory(Iterable<Json> customers) : customers = List.of(customers);

  final List<Json> customers;

  Json? byId(String? id) =>
      customers.where((customer) => customer['id'] == id).firstOrNull;

  List<Json> search(String term) {
    final words = term.trim().toLowerCase().split(RegExp(r'\s+'));
    return customers.where((customer) {
      final text = [
        customer['name'],
        customer['name_km'],
        customer['name_en'],
        customer['customer_code'],
        customer['external_reference'],
        customer['phone_number'],
        customer['email'],
        customer['id'],
      ].whereType<String>().join(' ').toLowerCase();
      return words.every(text.contains);
    }).toList();
  }

  /// Scan exact IDs, customer codes or references. Resolve duplicates manually.
  List<Json> matchingCode(String code) {
    final value = code.trim().toLowerCase();
    if (value.isEmpty) return [];
    return customers.where((customer) {
      return [
        customer['id'],
        customer['customer_code'],
        customer['external_reference'],
      ].any((field) => field is String && field.trim().toLowerCase() == value);
    }).toList();
  }
}
