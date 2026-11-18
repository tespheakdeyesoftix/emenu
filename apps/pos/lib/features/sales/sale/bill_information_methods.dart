part of 'sale_service.dart';

extension SaleBillInformation on SaleService {
  bool get requiresCashierShift => config['cashier_shift_enabled'] == true;
  bool get usesWorkingDay => config['working_day_enabled'] == true;
  bool get supportsBillInformation =>
      (context['capabilities'] as Map?)?['bill_information'] == true &&
      (!paired.value || context['store_bill_information'] == true);
  bool get canEditPostingDate =>
      cartEditable && !requiresCashierShift && supportsBillInformation;

  String get defaultPostingDate {
    final day = context['working_day'] as Map?;
    for (final value in [day?['business_date'], context['local_date']]) {
      if (parseBillDate(value) != null) return value as String;
    }
    final zone = (context['business'] as Map?)?['timezone'];
    if (zone is String) {
      try {
        return registerLocalDate(context, DateTime.now());
      } on Exception {
        // A snapshot without timezone data still has a usable local date.
      }
    }
    return DateTime.now().toIso8601String().substring(0, 10);
  }

  String get postingDate => requiresCashierShift
      ? defaultPostingDate
      : selectedPostingDate.value ?? defaultPostingDate;

  void setPostingDate(String date) {
    if (!canEditPostingDate) return;
    resolveBillPostingDate(date, config, defaultPostingDate);
    // Keep an explicit choice even when it matches today: it must replace a
    // previously chosen date when this is an already-held bill.
    selectedPostingDate.value = date;
    _saveCart();
  }

  void setGuestCover(int cover) {
    if (!cartEditable || !promptGuestCover) return;
    if ((tableMode == 'disabled' || tableId.value == null) &&
        !supportsBillInformation) {
      return;
    }
    if (cover < 1 || cover > 1000) {
      throw const FormatException('INVALID_GUEST_COVER');
    }
    guestCover.value = cover;
    _saveCart();
  }
}
