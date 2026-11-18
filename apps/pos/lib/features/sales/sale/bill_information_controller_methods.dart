part of '../sale_controller.dart';

extension BillInformationMethods on SaleController {
  Future<void> editPostingDate(BuildContext context) async {
    if (!service.canEditPostingDate) return;
    final generation = service.billGeneration;
    final date = await showPostingDatePicker(
      context,
      parseBillDate(service.postingDate)!,
    );
    if (context.mounted &&
        !isClosed &&
        date != null &&
        generation == service.billGeneration) {
      service.setPostingDate(date.toIso8601String().substring(0, 10));
    }
  }

  Future<void> editBillGuestCover(BuildContext context) async {
    if (!service.cartEditable || !service.promptGuestCover) return;
    final generation = service.billGeneration;
    final table = service.tableMode == 'disabled'
        ? null
        : service.tables
              .where((row) => row['id'] == service.tableId.value)
              .firstOrNull;
    final cover = (await app.input_number(
      title: table == null ? 'counter'.tr : tableLabel(table),
      value: service.guestCover.value,
      min: 1,
      max: 1000,
      label: 'guest_cover'.tr,
      confirmText: 'save'.tr,
    ))?.toInt();
    if (context.mounted &&
        !isClosed &&
        cover != null &&
        generation == service.billGeneration) {
      service.setGuestCover(cover);
    }
  }
}
