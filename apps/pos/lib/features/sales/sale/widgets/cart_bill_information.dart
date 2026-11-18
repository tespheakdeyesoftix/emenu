import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../core/bill_information.dart';
import '../../sale_controller.dart';
import '../sale_service.dart';
import 'bill_info_chip.dart';
import 'bill_info_scroll_row.dart';
import 'bill_table_chip.dart';

class CartBillInformation extends GetView<SaleController> {
  const CartBillInformation({super.key});

  @override
  Widget build(BuildContext context) => Obx(() {
    final service = controller.service;
    final localizations = MaterialLocalizations.of(context);
    String dateLabel(Object? value, {bool compact = true}) {
      final date = parseBillDate(value);
      if (date == null) return 'bill_not_open'.tr;
      return compact
          ? localizations.formatShortMonthDay(date)
          : localizations.formatFullDate(date);
    }

    final day = service.context['working_day'] as Map?;
    final shift = service.context['cashier_shift'] as Map?;
    final workingDate = dateLabel(day?['business_date']);
    final shiftLabel = shift == null
        ? 'bill_not_open'.tr
        : shift['opened_by_name'] as String? ?? 'bill_active'.tr;
    final postingDate = service.postingDate;
    final postingDateTooltip =
        '${'posting_date'.tr} · ${dateLabel(postingDate, compact: false)}';
    final dateEditable =
        !service.requiresCashierShift && service.supportsBillInformation;
    final guestEditable =
        service.cartEditable &&
        ((service.tableMode != 'disabled' && service.tableId.value != null) ||
            service.supportsBillInformation);
    return BillInfoScrollRow(
      key: const ValueKey('cart-bill-information'),
      children: [
        if (service.tableMode != 'disabled') const BillTableChip(),
        if (service.promptGuestCover)
          BillInfoChip(
            key: const ValueKey('bill-guests'),
            icon: Icons.groups_outlined,
            label: service.guestCover.value?.toString() ?? '—',
            tooltip: 'guest_cover'.tr,
            onTap: guestEditable
                ? () => controller.editBillGuestCover(context)
                : null,
          ),
        if (service.usesWorkingDay)
          BillInfoChip(
            key: const ValueKey('bill-working-day'),
            icon: Icons.calendar_month_outlined,
            label: workingDate,
            tooltip:
                '${'working_day'.tr} · ${dateLabel(day?['business_date'], compact: false)}',
          ),
        if (service.requiresCashierShift)
          BillInfoChip(
            key: const ValueKey('bill-cashier-shift'),
            icon: Icons.badge_outlined,
            label: shiftLabel,
            tooltip: '${'cashier_shift'.tr} · $shiftLabel',
          ),
        BillInfoChip(
          key: const ValueKey('bill-posting-date'),
          icon: Icons.event_outlined,
          label: dateLabel(postingDate),
          trailing: dateEditable ? Icons.edit_outlined : Icons.lock_outline,
          tooltip: service.requiresCashierShift
              ? '$postingDateTooltip\n${'POSTING_DATE_LOCKED'.tr}'
              : !service.supportsBillInformation
              ? '$postingDateTooltip\n${'SERVER_UPGRADE_REQUIRED'.tr}'
              : postingDateTooltip,
          onTap: service.canEditPostingDate
              ? () => controller.editPostingDate(context)
              : null,
        ),
      ],
    );
  });
}
