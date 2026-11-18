import 'pos_api.dart';

enum RegisterHistoryPeriod {
  shift('shift', 'shift_id'),
  workingDay('working_day', 'working_day_id'),
  businessDate('business_date', 'business_date');

  const RegisterHistoryPeriod(this.wireName, this.operatingField);

  final String wireName;
  final String operatingField;
}

class RegisterHistoryScope {
  const RegisterHistoryScope(
    this.profileId,
    this.period,
    this.id,
    this.openedAt,
  );

  final String profileId;
  final RegisterHistoryPeriod period;
  final String id;
  final DateTime? openedAt;

  (String, RegisterHistoryPeriod, String) get key => (profileId, period, id);

  static RegisterHistoryScope? fromContext(Json context, Json operating) {
    final profile = jsonObject(context['profile']);
    final config = jsonObject(profile['config']);
    final day = context['working_day'] as Map?;
    final shift = context['cashier_shift'] as Map?;
    if (config['working_day_enabled'] == true && day == null) return null;
    final period = config['cashier_shift_enabled'] == true
        ? RegisterHistoryPeriod.shift
        : config['working_day_enabled'] == true
        ? RegisterHistoryPeriod.workingDay
        : RegisterHistoryPeriod.businessDate;
    if (period == RegisterHistoryPeriod.shift &&
        shift?.containsKey('working_day_id') == true &&
        shift?['working_day_id'] != day?['id']) {
      return null;
    }
    final periodData = switch (period) {
      RegisterHistoryPeriod.shift => shift,
      RegisterHistoryPeriod.workingDay => day,
      RegisterHistoryPeriod.businessDate => null,
    };
    final id = operating[period.operatingField];
    if (id is! String || profile['id'] is! String) return null;
    return RegisterHistoryScope(
      profile['id'] as String,
      period,
      id,
      DateTime.tryParse(periodData?['opened_at'] as String? ?? ''),
    );
  }

  Json toJson() => {'profile_id': profileId, 'kind': period.wireName, 'id': id};

  bool matches(Object? other) =>
      other is Map &&
      other['profile_id'] == profileId &&
      other['kind'] == period.wireName &&
      other['id'] == id;
}
